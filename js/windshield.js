// ============================================================================
// Windshield: drops on the cabin glass in the About section
// The cabin photo is clean; drops live on a transparent canvas on top of it. Wiping
// with the pointer removes the drops under it, then they grow back from the edge of
// the cleared spot towards its centre. A creature silhouette shows on the road only
// while the glass is fully rained over. Rain behind the glass falls independently.
// ============================================================================
class Windshield
{
  // --- Drop size, count and the wipe brush ---
  static DROPS = Object.freeze({
    SIZE_SCALE: 1.0,                // Base drop size multiplier (1.0 = normal, 0.7 = small, 1.4 = large)
    MAX_RADIUS: 5,                  // Hard cap of a drop radius, px: past it the drop slides down and disappears
    GROWTH_LIMIT: 1.2,              // How much a drop may swell from its initial size before sliding (1.2 = a bit, 1.8 = a lot)
    COUNT_SCALE: 0.9,               // Drop density: 1.0 = normal, 1.5 = denser, 0.6 = sparser

    BRUSH_MIN_RADIUS: 1.0,          // Wipe radius for a slow pointer, px
    BRUSH_MAX_RADIUS: 30.0,         // Wipe radius for a fast sweep, px
    BRUSH_FEATHER: 0.75,            // Share of the brush radius that forms the soft edge
    BRUSH_SPEED_THRESHOLD: 2500,    // Pointer speed for the full radius: less = the brush widens more easily

    RESTORE_DELAY_SEC: 1.0,         // Clean-glass pause: seconds before drops start coming back after a wipe
    RESTORE_CENTER_LAG_SEC: 6.0,    // How much longer the centre of a wiped spot stays clean than its edges
    RESTORE_GROW_TIME_SEC: 15.0,    // How long a returning drop takes to grow to full size
    RESTORE_RANDOM_SEC: 3.0,        // Random spread of the return time between neighbouring drops
  });

  // --- Creature silhouette on the road (coordinates in cabin photo pixels) ---
  static CREATURE = Object.freeze({
    IMAGE_SRC: 'img/creature-raw.png',
    SPRITE: { x: 525, y: 22, width: 577, height: 921 },  // Creature area in creature-raw.png
    POS_X: 815,                     // Centre of the creature, horizontally (less = left)
    FEET_Y: 350,                    // Where the feet touch the road (less = farther away)
    HEIGHT: 150,                    // Height of the creature, px (width follows the sprite proportions)
    OPACITY: 0.25,                   // Opacity of the silhouette when fully shown (0..1)
    REAPPEAR_DELAY_SEC: 5.0,       // Minimum time after a wipe over the creature before it shows again
    REAPPEAR_RANDOM_SEC: 5.0,       // Random extra time on top of the delay
    FADE_OUT_SPEED: 1.75,           // Opacity per second while vanishing after a wipe
    FADE_IN_SPEED: 0.25,            // Opacity per second while appearing in the rain
    HIT_PADDING: 12,                // Extra margin around the creature that counts as wiping over it, canvas px
  });

  // Cabin photo size (cabin-dry.png); the outline coordinates below are in its pixels
  static PHOTO = Object.freeze({ width: 1376, height: 768 });

  // Glass outline: windshield + right window; the bottom follows the dash and the wheel's top arc
  static GLASS_OUTLINE = [[320, 28], [1376, 12], [1376, 500], [880, 480], [830, 488], [770, 470], [700, 456], [640, 453], [580, 458], [520, 470], [470, 493], [430, 505], [386, 498]];

  // Areas inside the outline that are not glass: the mirror and the right pillar, [x0, y0, x1, y1]
  static GLASS_BLOCKED = [[1070, 90, 1376, 210], [1210, 0, 1300, 105]];

  // Light refracted through a drop: mostly neutral, a bit of headlight warmth, a bit of cold sky
  static TINTS = [[255, 255, 255], [255, 214, 170], [255, 214, 170], [205, 218, 240]];

  // Longest frame step, seconds
  static MAX_FRAME_TIME = .08;

  // Share of mist droplets moved to a new spot per second: keeps the film alive
  static MIST_RENEW_RATE = .08;

  constructor(root)
  {
    this.dropsCanvas = root.querySelector('.about__layer--drops');
    this.creatureCanvas = root.querySelector('.about__layer--creature');
    this.fallCanvas = root.querySelector('.about__layer--fall');
    this.ctx = this.dropsCanvas.getContext('2d');

    // Canvas resolution is half the photo: chunky pixels like the rest of the art
    this.width = this.dropsCanvas.width;
    this.height = this.dropsCanvas.height;
    this.photoToCanvas = this.width / Windshield.PHOTO.width;

    this.drops = [];
    this.isRunning = false;
    this.isVisible = true;
    this.lastFrameTime = performance.now();
    this.lastPointer = null;
    this.lastCreatureWipeSec = -1e9;
    this.creatureDelaySec = Windshield.CREATURE.REAPPEAR_DELAY_SEC;
    this.creatureOpacity = 0;

    this.glass = this.buildGlassPath();
    this.render = this.render.bind(this);
  }

  start()
  {
    this.drawCreature();
    this.makeDrops();

    new IntersectionObserver(([entry]) =>
    {
      this.isVisible = entry.isIntersecting;
      if (this.isVisible)
      {
        this.schedule();
      }
    }).observe(this.dropsCanvas);

    window.addEventListener('pointermove', (event) => this.onPointerMove(event), { passive: true });
    this.schedule();
    this.startFallingRain();
  }

  // --- Glass geometry ---

  buildGlassPath()
  {
    const path = new Path2D();
    Windshield.GLASS_OUTLINE.forEach(([x, y], i) =>
    {
      const cx = x * this.photoToCanvas;
      const cy = y * this.photoToCanvas;
      if (i === 0)
      {
        path.moveTo(cx, cy);
      }
      else
      {
        path.lineTo(cx, cy);
      }
    });
    path.closePath();
    return path;
  }

  isOnGlass(x, y)
  {
    if (!this.ctx.isPointInPath(this.glass, x, y))
    {
      return false;
    }
    const px = x / this.photoToCanvas;
    const py = y / this.photoToCanvas;
    return !Windshield.GLASS_BLOCKED.some(([x0, y0, x1, y1]) => px > x0 && px < x1 && py > y0 && py < y1);
  }

  randomGlassPoint(attempts)
  {
    for (let i = 0; i < attempts; i++)
    {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      if (this.isOnGlass(x, y))
      {
        return { x, y };
      }
    }
    return null;
  }

  // --- Creature ---

  // Creature box on the road, in photo pixels
  getCreatureBox()
  {
    const { SPRITE, HEIGHT, POS_X, FEET_Y } = Windshield.CREATURE;
    const width = HEIGHT * (SPRITE.width / SPRITE.height);
    return { x: POS_X - width / 2, y: FEET_Y - HEIGHT, width, height: HEIGHT };
  }

  // Solid black silhouette cut from the creature sprite
  drawCreature()
  {
    const ctx = this.creatureCanvas.getContext('2d');
    const image = new Image();
    image.onload = () =>
    {
      const { SPRITE } = Windshield.CREATURE;
      const box = this.getCreatureBox();
      ctx.clearRect(0, 0, this.creatureCanvas.width, this.creatureCanvas.height);
      ctx.save();
      ctx.drawImage(image, SPRITE.x, SPRITE.y, SPRITE.width, SPRITE.height, box.x, box.y, box.width, box.height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#000';
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.restore();
    };
    image.src = Windshield.CREATURE.IMAGE_SRC;
  }

  // True when a wipe segment passes over the creature (canvas coordinates)
  touchesCreature(ax, ay, bx, by, radius)
  {
    const box = this.getCreatureBox();
    const pad = radius + Windshield.CREATURE.HIT_PADDING;
    const x1 = box.x * this.photoToCanvas - pad;
    const x2 = (box.x + box.width) * this.photoToCanvas + pad;
    const y1 = box.y * this.photoToCanvas - pad;
    const y2 = (box.y + box.height) * this.photoToCanvas + pad;
    const inside = (x, y) => x >= x1 && x <= x2 && y >= y1 && y <= y2;
    return inside(ax, ay) || inside(bx, by) || inside((ax + bx) / 2, (ay + by) / 2);
  }

  // Shows the creature only while the glass is fully rained over; a wipe over it hides it quickly
  updateCreature(nowSec, dt)
  {
    const { OPACITY, FADE_OUT_SPEED, FADE_IN_SPEED } = Windshield.CREATURE;
    const isFullyRained = nowSec - this.lastCreatureWipeSec >= this.creatureDelaySec;
    const target = isFullyRained ? OPACITY : 0;
    if (this.creatureOpacity > target)
    {
      this.creatureOpacity = Math.max(target, this.creatureOpacity - dt * FADE_OUT_SPEED);
    }
    else if (this.creatureOpacity < target)
    {
      this.creatureOpacity = Math.min(target, this.creatureOpacity + dt * FADE_IN_SPEED);
    }
    this.creatureCanvas.style.opacity = this.creatureOpacity.toFixed(3);
  }

  // --- Drops ---

  addDrops(make, count)
  {
    for (let added = 0, guard = count * 20; added < count && guard-- > 0;)
    {
      const point = this.randomGlassPoint(1);
      if (!point)
      {
        continue;
      }
      this.drops.push({ ...point, t0: -1e9, ...make() });
      added++;
    }
  }

  makeDrops()
  {
    const { SIZE_SCALE, COUNT_SCALE, GROWTH_LIMIT, MAX_RADIUS } = Windshield.DROPS;
    const area = this.width * this.height;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];

    // Fine mist: the dense film of tiny droplets and short streaks that sells "wet glass"
    this.addDrops(() =>
    {
      const q = Math.random();
      return {
        kind: 'mist',
        length: Math.max(1, Math.round((q < .3 ? 2 + Math.floor(Math.random() * 5) : 1) * SIZE_SCALE)),
        color: q < .8 ? `rgba(215, 220, 230, ${.12 + Math.random() * .3})` : `rgba(0, 0, 0, ${.2 + Math.random() * .25})`,
      };
    }, Math.round(area / 55 * COUNT_SCALE));

    // Beads: soft refracting lenses of different sizes and shapes
    this.addDrops(() =>
    {
      const q = Math.random();
      const size = q < .6 ? 1.3 + Math.random() * .9 : q < .9 ? 2.2 + Math.random() * 1.4 : 3.6 + Math.random() * 2;
      const baseRadius = size * SIZE_SCALE;
      return {
        kind: 'bead',
        r: baseRadius * (.6 + Math.random() * .4),
        baseRadius,
        maxRadius: Math.min(MAX_RADIUS, baseRadius * (GROWTH_LIMIT + Math.random() * .25)),
        growSpeed: (.04 + Math.random() * .12) * SIZE_SCALE,
        state: 'alive',
        fade: 1,
        slideSpeed: 0,
        aspect: .8 + Math.random() * .7,          // Height/width: round beads to teardrops
        tilt: (Math.random() - .5) * .4,
        dark: .1 + Math.random() * .22,           // Body only slightly darkens what is behind it
        tint: pick(Windshield.TINTS),
        tintAlpha: Math.random() * .22,
        flip: Math.random() < .3,                 // Caught light at the top instead of the bottom
        trail: baseRadius > 2.6 && Math.random() < .5 ? (6 + Math.random() * 20) * SIZE_SCALE : 0,
        wobble: (Math.random() - .5) * 2,
      };
    }, Math.round(area / 520 * COUNT_SCALE));
  }

  // A drop that slid off starts again elsewhere as a small new droplet
  respawnDrop(drop)
  {
    const { SIZE_SCALE, GROWTH_LIMIT, MAX_RADIUS } = Windshield.DROPS;
    const point = this.randomGlassPoint(35);
    if (point)
    {
      drop.x = point.x;
      drop.y = point.y;
    }
    drop.r = drop.baseRadius * (.25 + Math.random() * .15);
    drop.maxRadius = Math.min(MAX_RADIUS, drop.baseRadius * (GROWTH_LIMIT + Math.random() * .25));
    drop.growSpeed = (.04 + Math.random() * .12) * SIZE_SCALE;
    drop.state = 'alive';
    drop.fade = 1;
    drop.slideSpeed = 0;
    drop.trail = 0;
    drop.t0 = -1e9;
  }

  // Draws a drop at visibility g (0..1)
  drawDrop(drop, g)
  {
    const ctx = this.ctx;
    if (drop.kind === 'mist')
    {
      ctx.globalAlpha = g;
      ctx.fillStyle = drop.color;
      ctx.fillRect(Math.round(drop.x), Math.round(drop.y), 1, drop.length);
      ctx.globalAlpha = 1;
      return;
    }

    const r = drop.r * g;
    if (r < .5)
    {
      return;
    }
    const rx = r * .85;
    const ry = r * drop.aspect * 1.1;
    const [tr, tg, tb] = drop.tint;

    // Wet streak above a drop that has slid down
    if (drop.trail)
    {
      const length = drop.trail * g;
      for (let i = 0; i < length; i++)
      {
        ctx.fillStyle = `rgba(215, 220, 230, ${.2 * (1 - i / length) * g})`;
        ctx.fillRect(Math.round(drop.x + Math.sin(i * .3) * drop.wobble * .7), Math.round(drop.y - ry * .6 - i), 1, 1);
      }
    }

    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.tilt);
    // Faint body
    ctx.fillStyle = `rgba(4, 4, 6, ${drop.dark * g})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, 7);
    ctx.fill();
    // Dark rim
    if (r > 1.8)
    {
      ctx.strokeStyle = `rgba(0, 0, 0, ${.28 * g})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, 7);
      ctx.stroke();
    }
    // Light refracted through the drop
    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${(.16 + drop.tintAlpha) * g})`;
    ctx.beginPath();
    ctx.ellipse(0, (drop.flip ? -1 : 1) * ry * .4, rx * .6, ry * .38, 0, 0, 7);
    ctx.fill();
    ctx.restore();
    // Specular
    if (r > 1.6)
    {
      ctx.fillStyle = `rgba(255, 255, 255, ${.7 * g})`;
      ctx.fillRect(Math.round(drop.x - rx * .45), Math.round(drop.y - ry * .55), r > 3 ? 2 : 1, 1);
    }
  }

  // Idle life of a bead: it swells, and when too big slides down, fades out and respawns elsewhere
  updateBead(drop, dt)
  {
    if (drop.state === 'alive')
    {
      drop.r += dt * drop.growSpeed;
      if (drop.r >= drop.maxRadius)
      {
        drop.state = 'sliding';
        drop.slideSpeed = 18 + Math.random() * 32;
      }
      return;
    }
    drop.y += dt * drop.slideSpeed;
    drop.slideSpeed += dt * 40;
    drop.trail = Math.min(28, (drop.trail || 4) + dt * 30);
    drop.fade -= dt * 1.6;
    if (drop.fade <= 0 || !this.isOnGlass(drop.x, drop.y))
    {
      this.respawnDrop(drop);
    }
  }

  // Growth of a drop returning after a wipe: 0 = wiped, 1 = fully back (ease-out)
  getRestoreProgress(drop, nowSec)
  {
    const k = (nowSec - drop.t0) / Windshield.DROPS.RESTORE_GROW_TIME_SEC;
    if (k <= 0)
    {
      return 0;
    }
    return k < 1 ? 1 - Math.pow(1 - k, 3) : 1;
  }

  render(now)
  {
    this.isRunning = false;
    const nowSec = now / 1000;
    const dt = Math.min(Windshield.MAX_FRAME_TIME, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const drop of this.drops)
    {
      if (drop.kind === 'mist' && Math.random() < dt * Windshield.MIST_RENEW_RATE)
      {
        const point = this.randomGlassPoint(1);
        if (point)
        {
          drop.x = point.x;
          drop.y = point.y;
        }
      }

      const progress = this.getRestoreProgress(drop, nowSec);
      if (progress <= 0)
      {
        continue;
      }
      if (drop.kind === 'mist')
      {
        this.drawDrop(drop, progress);
        continue;
      }
      if (progress >= 1)
      {
        this.updateBead(drop, dt);
      }
      const g = progress * drop.fade;
      if (g > .02)
      {
        this.drawDrop(drop, g);
      }
    }

    this.updateCreature(nowSec, dt);

    if (this.isVisible && !prefersReducedMotion())
    {
      this.schedule();
    }
  }

  schedule()
  {
    if (this.isRunning)
    {
      return;
    }
    this.isRunning = true;
    requestAnimationFrame(this.render);
  }

  // --- Wiping ---

  // Pointer position -> canvas pixels, accounting for object-fit: cover, its object-position
  // (the cropped overflow is split by those percentages, not in half) and the CSS scale
  toCanvas(clientX, clientY)
  {
    const rect = this.dropsCanvas.getBoundingClientRect();
    const scale = Math.max(rect.width / this.width, rect.height / this.height);
    const [px, py] = getComputedStyle(this.dropsCanvas).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    return {
      x: (clientX - rect.left - (rect.width - this.width * scale) * px) / scale,
      y: (clientY - rect.top - (rect.height - this.height * scale) * py) / scale,
    };
  }

  onPointerMove(event)
  {
    const rect = this.dropsCanvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
    {
      this.lastPointer = null;
      return;
    }

    const { BRUSH_MIN_RADIUS, BRUSH_MAX_RADIUS, BRUSH_SPEED_THRESHOLD } = Windshield.DROPS;
    const now = performance.now();
    const point = this.toCanvas(event.clientX, event.clientY);
    let radius = BRUSH_MIN_RADIUS;
    const last = this.lastPointer;

    if (last)
    {
      // The brush widens with pointer speed: slow = BRUSH_MIN_RADIUS, fast sweep = BRUSH_MAX_RADIUS
      const dt = Math.max(1, now - last.time) / 1000;
      const speed = Math.hypot(point.x - last.x, point.y - last.y) / dt;
      const factor = Math.min(1, Math.max(0, speed / BRUSH_SPEED_THRESHOLD));
      radius = BRUSH_MIN_RADIUS + (BRUSH_MAX_RADIUS - BRUSH_MIN_RADIUS) * Math.sqrt(factor);
      this.wipeSegment(last.x, last.y, point.x, point.y, last.radius, radius, now);
    }
    else
    {
      this.wipeSegment(point.x, point.y, point.x, point.y, radius, radius, now);
    }

    this.lastPointer = { x: point.x, y: point.y, time: now, radius };
    this.schedule();
  }

  // Wipes drops along a segment with a brush whose radius changes from rA to rB
  wipeSegment(ax, ay, bx, by, rA, rB, now)
  {
    const { BRUSH_FEATHER, RESTORE_DELAY_SEC, RESTORE_CENTER_LAG_SEC, RESTORE_GROW_TIME_SEC, RESTORE_RANDOM_SEC } = Windshield.DROPS;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    const nowSec = now / 1000;

    // The creature vanishes only when the glass right over it is wiped
    if (this.touchesCreature(ax, ay, bx, by, Math.max(rA, rB)))
    {
      const { REAPPEAR_DELAY_SEC, REAPPEAR_RANDOM_SEC } = Windshield.CREATURE;
      this.lastCreatureWipeSec = nowSec;
      this.creatureDelaySec = REAPPEAR_DELAY_SEC + Math.random() * REAPPEAR_RANDOM_SEC;
    }

    for (const drop of this.drops)
    {
      const u = Math.max(0, Math.min(1, ((drop.x - ax) * dx + (drop.y - ay) * dy) / lengthSq));
      const distance = Math.hypot(drop.x - (ax + u * dx), drop.y - (ay + u * dy));
      const radius = rA + u * (rB - rA);
      if (distance > radius)
      {
        continue;
      }

      const coreRadius = radius * (1 - BRUSH_FEATHER);
      if (distance <= coreRadius)
      {
        // Brush core: wiped completely; the centre comes back last
        const lag = (1 - distance / radius) * RESTORE_CENTER_LAG_SEC;
        drop.t0 = nowSec + RESTORE_DELAY_SEC + lag + Math.random() * RESTORE_RANDOM_SEC;
        continue;
      }

      // Soft edge: smoothstep falloff of the chance to wipe a drop
      const edge = (distance - coreRadius) / (radius - coreRadius);   // 0 at the core, 1 at the outer edge
      const wipeChance = 1 - (3 * edge * edge - 2 * edge * edge * edge);
      if (Math.random() < wipeChance)
      {
        const lag = (1 - distance / radius) * RESTORE_CENTER_LAG_SEC * .4;
        drop.t0 = nowSec + RESTORE_DELAY_SEC * (1 - edge * .6) + lag + Math.random() * RESTORE_RANDOM_SEC;
      }
      else
      {
        // Not wiped: only shrink it a little
        const partial = Math.max(.08, edge * .75);
        drop.t0 = Math.max(drop.t0, nowSec - partial * RESTORE_GROW_TIME_SEC);
      }
    }
  }

  // --- Rain behind the glass ---

  // Always on and independent of the wipe; clipped to the glass, the blocked areas cut out of the clip
  startFallingRain()
  {
    if (prefersReducedMotion())
    {
      return;
    }
    const clip = new Path2D();
    clip.addPath(this.glass);
    // The mirror and pillar boxes stop at the top glass edge (photo y 14)
    Windshield.GLASS_BLOCKED.forEach(([x0, y0, x1, y1]) =>
    {
      const top = Math.max(y0, 14);
      clip.rect(x0 * this.photoToCanvas, top * this.photoToCanvas, (x1 - x0) * this.photoToCanvas, (Math.max(y1, 14) - top) * this.photoToCanvas);
    });
    new RainStreaks(this.fallCanvas, {
      fixedResolution: true,
      density: 650,
      speedMin: 200,
      speedRange: 220,
      alphaMin: .15,
      alphaRange: .35,
      color: '190, 202, 216',
      clip,
    }).start();
  }
}

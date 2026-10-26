// ============================================================================
// RainStreaks: animated rain on a pixel canvas
// Instead of clearing, each frame partly erases the previous one, so every drop
// leaves a short streak that fades out behind it. Used for the hero, the location
// cards, the outro and the rain seen through the windshield.
// ============================================================================

// Speed of the rain on the hero, the location cards and the outro: 1 = original, less = slower
const RAIN_SPEED = 0.5;

class RainStreaks
{
  static DEFAULTS = Object.freeze({
    pixelScale: 3,                  // Screen pixels per canvas pixel: chunky pixels like the artwork
    fixedResolution: false,         // true = keep the canvas width/height attributes instead of fitting the element
    density: 600,                   // Canvas pixels per streak: less = denser rain
    speedMin: 350 * RAIN_SPEED,     // Speed of the farthest drops, canvas px per second
    speedRange: 350 * RAIN_SPEED,   // Extra speed of the nearest drops
    alphaMin: .2,                   // Opacity of the farthest drops
    alphaRange: .4,                 // Extra opacity of the nearest drops
    color: '180, 194, 208',         // Streak color, "r, g, b"
    slant: .14,                     // Sideways drift per pixel of fall (wind)
    trailKeep: .3,                  // Share of the previous frame kept per 1/60 s: more = longer streaks
    clip: null,                     // Optional Path2D: streaks are drawn only inside it
  });

  // Longest frame step, seconds: after a pause the rain resumes instead of jumping
  static MAX_FRAME_TIME = .05;

  // Streaks respawn this far above the top edge, canvas px
  static SPAWN_OFFSET = 10;

  constructor(canvas, options = {})
  {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.options = { ...RainStreaks.DEFAULTS, ...options };
    this.streaks = [];
    this.isVisible = false;
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
  }

  start()
  {
    if (this.options.fixedResolution)
    {
      this.populate();
    }
    else
    {
      new ResizeObserver(() => this.fitToElement()).observe(this.canvas);
    }
    // Off-screen rain is not drawn
    new IntersectionObserver(([entry]) =>
    {
      this.isVisible = entry.isIntersecting;
    }).observe(this.canvas);
    requestAnimationFrame(this.tick);
  }

  fitToElement()
  {
    this.canvas.width = Math.ceil(this.canvas.clientWidth / this.options.pixelScale);
    this.canvas.height = Math.ceil(this.canvas.clientHeight / this.options.pixelScale);
    this.populate();
  }

  populate()
  {
    const { width, height } = this.canvas;
    const count = Math.round(width * height / this.options.density);
    this.streaks = Array.from({ length: count }, () => this.spawn(Math.random() * height));
  }

  spawn(y)
  {
    // Near drops are faster and brighter than far ones
    const near = Math.random();
    const { speedMin, speedRange, alphaMin, alphaRange } = this.options;
    return {
      x: Math.random() * this.canvas.width * 1.2,
      y,
      speed: speedMin + near * speedRange,
      alpha: alphaMin + near * alphaRange,
    };
  }

  tick(now)
  {
    requestAnimationFrame(this.tick);
    const dt = Math.min(RainStreaks.MAX_FRAME_TIME, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.isVisible)
    {
      return;
    }

    const { context: ctx, canvas, options } = this;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - options.trailKeep ** (dt * 60)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    if (options.clip)
    {
      ctx.clip(options.clip, 'evenodd');
    }
    for (const streak of this.streaks)
    {
      const fall = streak.speed * dt;
      ctx.strokeStyle = `rgba(${options.color}, ${streak.alpha})`;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      streak.x -= fall * options.slant;
      streak.y += fall;
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();
      if (streak.y > canvas.height)
      {
        Object.assign(streak, this.spawn(-RainStreaks.SPAWN_OFFSET));
      }
    }
    ctx.restore();
  }
}

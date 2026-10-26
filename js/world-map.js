// ============================================================================
// WorldMap: chunk map on the navigator screen
// The van moves over a looped grid; chunks near it are streamed in, far ones are
// unloaded. A location whose chunk unloads reappears in another unloaded chunk.
// Reaching a location reports it, so the location card can switch.
// ============================================================================
class WorldMap
{
  static GRID_SIZE = 5;             // The map is GRID_SIZE x GRID_SIZE chunks and wraps around at the edges
  static STREAM_RADIUS = 1;         // Chunks within this distance from the van stay loaded
  static VAN_START = Object.freeze({ x: 2, y: 2 });   // Starting chunk of the van
  static VAN_ICON = '🚐';

  // Keyboard controls; arrow keys are left alone so they keep scrolling the page
  static KEY_DIRECTIONS = Object.freeze({ KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' });

  // Grid steps for each direction
  static STEPS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

  // Location icons on the map: any SVG, emoji or <img> markup
  static ICONS = Object.freeze({
    // 01. Courier parcel locker (terminal with a lit screen and cells)
    postamat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="2.5" width="17" height="19" rx="1.5" fill="#2d3748" stroke="#cbd5e0" stroke-width="0.8"/>
      <rect x="5.5" y="4.5" width="13" height="5.5" rx="0.8" fill="#1a202c"/>
      <rect x="7" y="5.5" width="7" height="3.5" rx="0.5" fill="#48bb78"/>
      <circle cx="16" cy="7.2" r="1" fill="#f56565"/>
      <rect x="5.5" y="11.5" width="5.8" height="3.8" rx="0.5" fill="#4a5568" stroke="#1a202c" stroke-width="0.6"/>
      <rect x="12.7" y="11.5" width="5.8" height="3.8" rx="0.5" fill="#4a5568" stroke="#1a202c" stroke-width="0.6"/>
      <rect x="5.5" y="16.5" width="5.8" height="3.8" rx="0.5" fill="#4a5568" stroke="#1a202c" stroke-width="0.6"/>
      <rect x="12.7" y="16.5" width="5.8" height="3.8" rx="0.5" fill="#4a5568" stroke="#1a202c" stroke-width="0.6"/>
    </svg>`,

    // 02. Abandoned gas station (pump with a hose)
    gas: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4.5" width="11" height="16.5" rx="1.5" fill="#d63a33" stroke="#2b0d0c" stroke-width="0.8"/>
      <rect x="3" y="3" width="13" height="2" rx="0.5" fill="#f7fafc"/>
      <rect x="6" y="7" width="7" height="4.5" rx="0.6" fill="#1a202c"/>
      <rect x="7.2" y="8" width="4.6" height="2.5" fill="#fefcbf"/>
      <path d="M15 7.5H17.5C18.6 7.5 19.5 8.4 19.5 9.5V16C19.5 17.5 18 18 17 18V13.5L15 11" stroke="#f7fafc" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // 03. Old farm (barn with a silo and crossed doors)
    farm: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 9.5C2.5 7 4.5 5.5 4.5 5.5C4.5 5.5 6.5 7 6.5 9.5V20.5H2.5V9.5Z" fill="#b0aba2" stroke="#2a2824" stroke-width="0.8"/>
      <line x1="2.5" y1="13" x2="6.5" y2="13" stroke="#2a2824" stroke-width="0.8"/>
      <line x1="2.5" y1="17" x2="6.5" y2="17" stroke="#2a2824" stroke-width="0.8"/>
      <path d="M7 10L15 4L23 10V21H7V10Z" fill="#b8382e" stroke="#2a100d" stroke-width="0.8"/>
      <path d="M6 10.5L15 3.5L24 10.5" stroke="#f4ede2" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="11.5" y="14" width="7" height="6.8" fill="#1b120c" stroke="#f4ede2" stroke-width="0.7"/>
      <line x1="11.5" y1="14" x2="18.5" y2="20.8" stroke="#f4ede2" stroke-width="0.7"/>
      <line x1="18.5" y1="14" x2="11.5" y2="20.8" stroke="#f4ede2" stroke-width="0.7"/>
      <rect x="13.5" y="8" width="3" height="3" fill="#ffe066" rx="0.5"/>
    </svg>`,

    // 04. Old house No. 12 (two-storey wooden house with a chimney and a lit window)
    house: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="15" y="4.5" width="2.5" height="4.5" fill="#718096" stroke="#2d3748" stroke-width="0.6"/>
      <polygon points="12,3.5 2.5,11.5 5,11.5 5,20.5 19,20.5 19,11.5 21.5,11.5" fill="#4a3b32" stroke="#231b17" stroke-width="0.8"/>
      <polyline points="2,11.5 12,3.2 22,11.5" stroke="#a08d7a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="10" y="14" width="4" height="6.5" fill="#1a1410"/>
      <rect x="6.5" y="13.5" width="2.8" height="2.8" fill="#ffd166"/>
      <circle cx="12" cy="8.5" r="1.3" fill="#ffeaa7"/>
    </svg>`,
  });

  // Key locations: their starting chunk and the index of their card in the locations slider
  static LOCATIONS = Object.freeze([
    { slide: 0, icon: 'postamat', x: 3, y: 3 },
    { slide: 1, icon: 'gas', x: 1, y: 1 },
    { slide: 2, icon: 'farm', x: 3, y: 1 },
    { slide: 3, icon: 'house', x: 1, y: 3 },
  ]);

  // onLocationReached(slideIndex) is called when the van drives onto a location
  constructor(root, { onLocationReached } = {})
  {
    this.grid = root.querySelector('.navigator__grid');
    this.arrows = Array.from(root.querySelectorAll('.navigator__arrow'));
    this.onLocationReached = onLocationReached;
    this.van = { ...WorldMap.VAN_START };
    this.cells = [];
    this.locations = WorldMap.LOCATIONS.map(location => ({ ...location, wasLoaded: true }));
    this.vanMarker = this.createVanMarker();
  }

  start()
  {
    this.createCells();
    this.locations.forEach(location =>
    {
      location.el = document.createElement('div');
      location.el.className = 'navigator__poi';
      location.el.innerHTML = WorldMap.ICONS[location.icon];
      this.getCell(location.x, location.y).appendChild(location.el);
    });

    this.arrows.forEach(arrow =>
    {
      arrow.addEventListener('click', () => this.step(arrow.dataset.direction));
    });
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.setArrowPressed(WorldMap.KEY_DIRECTIONS[event.code], false));

    this.update(true);
  }

  createCells()
  {
    const size = WorldMap.GRID_SIZE;
    for (let y = 0; y < size; y++)
    {
      for (let x = 0; x < size; x++)
      {
        const cell = document.createElement('div');
        cell.className = 'navigator__cell';
        cell.addEventListener('click', () => this.moveTo(x, y));
        this.grid.appendChild(cell);
        this.cells.push(cell);
      }
    }
  }

  createVanMarker()
  {
    const marker = document.createElement('div');
    marker.className = 'navigator__van';
    marker.textContent = WorldMap.VAN_ICON;
    return marker;
  }

  getCell(x, y)
  {
    return this.cells[y * WorldMap.GRID_SIZE + x];
  }

  // Chebyshev distance on the looped grid
  getDistance(ax, ay, bx, by)
  {
    const size = WorldMap.GRID_SIZE;
    const dx = Math.min(Math.abs(ax - bx), size - Math.abs(ax - bx));
    const dy = Math.min(Math.abs(ay - by), size - Math.abs(ay - by));
    return Math.max(dx, dy);
  }

  isLoaded(x, y)
  {
    return this.getDistance(x, y, this.van.x, this.van.y) <= WorldMap.STREAM_RADIUS;
  }

  step(direction)
  {
    const [dx, dy] = WorldMap.STEPS[direction];
    const size = WorldMap.GRID_SIZE;
    this.moveTo((this.van.x + dx + size) % size, (this.van.y + dy + size) % size);
  }

  moveTo(x, y)
  {
    this.van = { x, y };
    this.update(false);
  }

  // Moves the van to a location without reporting it back (used when its card is picked by hand)
  moveToLocation(slideIndex)
  {
    const location = this.locations.find(item => item.slide === slideIndex);
    if (location)
    {
      this.van = { x: location.x, y: location.y };
      this.update(true);
    }
  }

  update(isSilent)
  {
    this.updateCells();
    this.reshuffleUnloadedLocations();
    if (!isSilent)
    {
      const reached = this.locations.find(location => location.x === this.van.x && location.y === this.van.y);
      if (reached && this.onLocationReached)
      {
        this.onLocationReached(reached.slide);
      }
    }
  }

  updateCells()
  {
    this.cells.forEach((cell, index) =>
    {
      const x = index % WorldMap.GRID_SIZE;
      const y = Math.floor(index / WorldMap.GRID_SIZE);
      const isCurrent = x === this.van.x && y === this.van.y;
      cell.classList.toggle('navigator__cell--current', isCurrent);
      cell.classList.toggle('navigator__cell--streamed', !isCurrent && this.isLoaded(x, y));
      cell.classList.toggle('navigator__cell--unloaded', !this.isLoaded(x, y));
      if (isCurrent)
      {
        cell.appendChild(this.vanMarker);
      }
    });
  }

  // A location whose chunk has just unloaded moves to another free unloaded chunk
  reshuffleUnloadedLocations()
  {
    const size = WorldMap.GRID_SIZE;
    this.locations.forEach(location =>
    {
      const isLoaded = this.isLoaded(location.x, location.y);
      if (isLoaded)
      {
        location.wasLoaded = true;
        return;
      }
      if (!location.wasLoaded)
      {
        return;
      }
      const candidates = [];
      for (let y = 0; y < size; y++)
      {
        for (let x = 0; x < size; x++)
        {
          const isTaken = this.locations.some(item => item.x === x && item.y === y);
          if (!this.isLoaded(x, y) && !isTaken)
          {
            candidates.push([x, y]);
          }
        }
      }
      if (candidates.length)
      {
        [location.x, location.y] = candidates[Math.floor(Math.random() * candidates.length)];
        this.getCell(location.x, location.y).appendChild(location.el);
      }
      location.wasLoaded = false;
    });
  }

  onKeyDown(event)
  {
    if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))
    {
      return;
    }
    const direction = WorldMap.KEY_DIRECTIONS[event.code];
    if (direction)
    {
      this.step(direction);
      this.setArrowPressed(direction, true);
    }
  }

  setArrowPressed(direction, isPressed)
  {
    const arrow = this.arrows.find(item => item.dataset.direction === direction);
    if (arrow)
    {
      arrow.classList.toggle('navigator__arrow--pressed', isPressed);
    }
  }
}

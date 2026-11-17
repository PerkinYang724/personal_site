// The home page as a water surface: moving the pointer drags through it and leaves a wake, and a click splashes.
// A small wave simulation runs on a coarse grid and is drawn as light and shade stretched over the page, so the
// page reads as seen through moving water. It stops itself once the water is calm.
const CELL = 4; // px per simulation cell
const STEP = 1000 / 120; // fixed timestep, so waves travel at the same speed on 60 and 120 Hz screens
const DAMPING = 0.991;
const SPONGE = 14; // cells near the screen edges that soak waves up instead of reflecting them
const DRAG_RADIUS = 2.6; // cells
const DRAG_DEPTH = 0.07; // per px of pointer travel
const MAX_DEPTH = 1.2; // the wake never digs deeper than this, however fast the pointer moves
const SPLASH_RADIUS = 4;
const SPLASH_DEPTH = 0.9;
const SPLASH_BEAT = 10; // steps per bob of a splash, which sets the spacing of its rings
const SPLASH_STEPS = 34;
const SLOPE = 1.2; // how steep the surface reads for a given height difference
const LIGHT = 220;
const SHADE = 170;
const GLINT = 140;
const CAUSTIC = 26;
const MAX_LIGHT = 52; // alpha caps out of 255, which keep text readable through the water
const MAX_SHADE = 46;

// Light from the top left, a little above the horizon; the glint is where the surface mirrors it towards the eye.
const [LX, LY, LZ] = norm(-0.55, -0.65, 0.52);
const [HX, HY, HZ] = norm(LX, LY, LZ + 1);
const FLAT_GLINT = HZ ** 32;

// A dent with a raised lip, holding as much water as it pushes aside: the surface only ripples, rather than sinking
// into a broad trough that would wash the whole page grey. d runs from 0 at the centre to 1 at the lip's edge.
const RIM = 1.8;
const bump = (d: number) => (d < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * d) : 0);
const dimple = (d: number) => bump(d * RIM) - bump(d) / (RIM * RIM);

function norm(x: number, y: number, z: number) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function water() {
  const canvas = document.createElement('canvas');
  canvas.className = 'water';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  // The simulation is drawn into a small canvas and smoothed up to twice its size here; left to the browser alone,
  // Safari stretches it with hard square pixels.
  const grid = document.createElement('canvas');
  const gridCtx = grid.getContext('2d')!;

  // The grid overhangs the screen by one cell all round; that border stays flat.
  let w = 0;
  let h = 0;
  let now = new Float32Array(0);
  let prev = new Float32Array(0);
  let damp = new Float32Array(0);
  let image = new ImageData(1, 1);
  const fit = () => {
    w = Math.ceil(innerWidth / CELL) + 2;
    h = Math.ceil(innerHeight / CELL) + 2;
    grid.width = w;
    grid.height = h;
    canvas.width = w * 2;
    canvas.height = h * 2;
    Object.assign(canvas.style, { width: `${w * CELL}px`, height: `${h * CELL}px`, left: `${-CELL}px`, top: `${-CELL}px` });
    now = new Float32Array(w * h);
    prev = new Float32Array(w * h);
    damp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        const soak = Math.max(0, 1 - edge / SPONGE);
        damp[y * w + x] = DAMPING * (1 - 0.12 * soak * soak);
      }
    }
    image = gridCtx.createImageData(w, h);
  };
  fit();
  addEventListener('resize', fit);

  let running = false;
  let calm = 0;
  let last = 0;
  let behind = 0;

  const wake = () => {
    if (running) return;
    running = true;
    calm = 0;
    behind = 0;
    last = performance.now();
    canvas.hidden = false;
    requestAnimationFrame(frame);
  };

  // Presses the surface down in a soft-edged dimple around a point on screen.
  const disturb = (px: number, py: number, radius: number, depth: number) => {
    const cx = px / CELL + 0.5;
    const cy = py / CELL + 0.5;
    radius *= RIM;
    for (let y = Math.max(1, Math.floor(cy - radius)); y <= Math.min(h - 2, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(1, Math.floor(cx - radius)); x <= Math.min(w - 2, Math.ceil(cx + radius)); x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d >= 1) continue;
        const i = y * w + x;
        now[i] = Math.max(-MAX_DEPTH, Math.min(MAX_DEPTH, now[i] - depth * dimple(d)));
      }
    }
  };

  // A splash bobs up and down a few times as it settles, so it sends out a set of rings rather than a single one.
  const splashes: { x: number; y: number; age: number }[] = [];
  const bob = () => {
    for (let k = splashes.length - 1; k >= 0; k--) {
      const s = splashes[k];
      const fade = 1 - s.age / SPLASH_STEPS;
      disturb(s.x, s.y, SPLASH_RADIUS, SPLASH_DEPTH * fade * fade * Math.cos((2 * Math.PI * s.age) / SPLASH_BEAT) * 0.35);
      if (++s.age >= SPLASH_STEPS) splashes.splice(k, 1);
    }
  };

  // The point dragging through the water follows the pointer at the pointer's own speed rather than jumping with
  // each pointer event, so the wake is laid down evenly instead of in beads.
  let dragX = -1;
  let dragY = -1;
  let toX = -1;
  let toY = -1;
  let speed = 0; // px per step
  let lastMove = 0;
  const drag = () => {
    if (dragX < 0) return;
    const gapX = toX - dragX;
    const gapY = toY - dragY;
    const gap = Math.hypot(gapX, gapY);
    if (gap < 0.5) {
      dragX = toX;
      dragY = toY;
      return;
    }
    const distance = Math.min(gap, Math.max(speed, gap * 0.35));
    const dx = (gapX / gap) * distance;
    const dy = (gapY / gap) * distance;
    const stamps = Math.ceil((2 * distance) / CELL);
    for (let k = 1; k <= stamps; k++) {
      disturb(dragX + (dx * k) / stamps, dragY + (dy * k) / stamps, DRAG_RADIUS, (DRAG_DEPTH * distance) / stamps);
    }
    dragX += dx;
    dragY += dy;
  };

  // Each cell is pulled towards the average of its neighbours and overshoots, which is what makes waves travel.
  const step = () => {
    drag();
    bob();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        prev[i] = ((now[i - 1] + now[i + 1] + now[i - w] + now[i + w]) / 2 - prev[i]) * damp[i];
      }
    }
    [now, prev] = [prev, now];
  };

  const frame = (t: number) => {
    behind = Math.min(behind + t - last, STEP * 5); // keeps up down to 24 fps, then slows rather than stalling
    last = t;
    while (behind >= STEP) {
      step();
      behind -= STEP;
    }

    // Shading uses the surface normal: facing the light brightens, facing away darkens, a narrow glint where it
    // mirrors the light, and crests act as small lenses that gather a little extra light.
    const data = image.data;
    let peak = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const l = now[i - 1];
        const r = now[i + 1];
        const u = now[i - w];
        const d = now[i + w];
        const nx = (l - r) * SLOPE;
        const ny = (u - d) * SLOPE;
        const n = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        let glint = (nx * HX + ny * HY + HZ) * n;
        glint *= glint;
        glint *= glint;
        glint *= glint;
        glint *= glint;
        glint *= glint;
        const lit =
          ((nx * LX + ny * LY + LZ) * n - LZ) * (nx * LX + ny * LY > 0 ? LIGHT : SHADE) +
          Math.max(0, glint - FLAT_GLINT) * GLINT +
          Math.max(0, 4 * now[i] - l - r - u - d) * CAUSTIC;
        const o = i * 4;
        if (lit > 0) {
          data[o] = data[o + 1] = data[o + 2] = 255;
          data[o + 3] = lit < MAX_LIGHT ? lit : MAX_LIGHT;
        } else {
          data[o] = data[o + 1] = data[o + 2] = 0;
          data[o + 3] = -lit < MAX_SHADE ? -lit : MAX_SHADE;
        }
        if (data[o + 3] > peak) peak = data[o + 3];
      }
    }
    gridCtx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(grid, 0, 0, canvas.width, canvas.height);

    // Once nothing would show, clear the water outright rather than letting invisible ripples run on.
    if (peak < 2 && toX === dragX && toY === dragY && !splashes.length) {
      if (++calm > 20) {
        running = false;
        canvas.hidden = true;
        now.fill(0);
        prev.fill(0);
        return;
      }
    } else calm = 0;
    requestAnimationFrame(frame);
  };

  // Dragging presses down all along the path, by as much per pixel travelled however often the pointer reports.
  // Moving faster than the waves spread is what folds them into a V behind it.
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.timeStamp;
    const moved = Math.hypot(e.clientX - toX, e.clientY - toY);
    if (toX >= 0 && t > lastMove) speed += ((moved * STEP) / Math.min(t - lastMove, 100) - speed) * 0.5;
    lastMove = t;
    toX = e.clientX;
    toY = e.clientY;
    if (dragX < 0 || Math.hypot(toX - dragX, toY - dragY) > 300) {
      dragX = toX;
      dragY = toY;
    }
    wake();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => (dragX = -1));
  addEventListener('pointerdown', (e) => {
    disturb(e.clientX, e.clientY, SPLASH_RADIUS, SPLASH_DEPTH);
    splashes.push({ x: e.clientX, y: e.clientY, age: 0 });
    wake();
  }, { passive: true });
}

if (document.documentElement.classList.contains('motion')) water();

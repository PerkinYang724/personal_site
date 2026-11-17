// The home page as a dive: the water darkens the further down the page goes, and deep down a little marine snow
// drifts past. Both are keyed to scroll progress, and the animation loop only runs while the snow is visible.
// Reduced motion keeps the dimming but no snow.
const MAX_DIM = 0.42; // darkness at the very bottom, low enough that text and the seabed stay readable
const SNOW_FROM = 0.5; // marine snow fades in between these depths
const SNOW_FULL = 0.85;
const SNOW_COUNT = 44;
const MEASURE_EVERY = 1000; // pinned sections change the page height as they set up, so keep re-reading it

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Flake {
  x: number;
  y: number;
  size: number;
  fall: number;
  sway: number;
  phase: number;
  glow: number;
}

function depth() {
  const motion = document.documentElement.classList.contains('motion');

  const dim = document.createElement('div');
  dim.className = 'depth-dim';
  const snow = document.createElement('canvas');
  snow.className = 'depth-snow';
  snow.hidden = true;
  document.body.append(dim);
  if (motion) document.body.append(snow);

  const sctx = snow.getContext('2d')!;

  // A soft dot, drawn once and stamped for every flake.
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 16;
  const spr = sprite.getContext('2d')!;
  const glow = spr.createRadialGradient(8, 8, 0, 8, 8, 8);
  glow.addColorStop(0, 'rgba(225,245,255,1)');
  glow.addColorStop(0.25, 'rgba(205,235,250,0.55)');
  glow.addColorStop(1, 'rgba(190,225,245,0)');
  spr.fillStyle = glow;
  spr.fillRect(0, 0, 16, 16);

  const flakes: Flake[] = Array.from({ length: SNOW_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 3 + Math.random() ** 2 * 7,
    fall: 5 + Math.random() * 12,
    sway: 4 + Math.random() * 10,
    phase: Math.random() * Math.PI * 2,
    glow: 0.2 + Math.random() * 0.6,
  }));

  const fit = () => {
    snow.width = innerWidth;
    snow.height = innerHeight;
  };
  fit();

  let max = 1;
  const measure = () => {
    max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  };
  measure();

  const drawSnow = (dt: number, t: number, shift: number) => {
    const w = snow.width;
    const h = snow.height;
    sctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      // Flakes are suspended in the water, so they ride a little against the scroll, as nearer things would.
      f.y += (f.fall * dt - shift * 0.25 * (f.size / 10)) / h;
      f.y -= Math.floor(f.y);
      const x = f.x * w + Math.sin(t * 0.3 + f.phase) * f.sway;
      const twinkle = 0.75 + 0.25 * Math.sin(t * 0.9 + f.phase * 3);
      sctx.globalAlpha = f.glow * twinkle;
      sctx.drawImage(sprite, x - f.size / 2, f.y * h - f.size / 2, f.size, f.size);
    }
  };

  let progress = -1;
  let snowOn = false;
  let lastY = scrollY;
  let last = performance.now();
  let frameId = 0;

  const frame = (now: number) => {
    frameId = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Capped, so the first frame after an idle stretch of scrolling doesn't fling every flake at once.
    const shift = Math.max(-120, Math.min(120, scrollY - lastY));
    lastY = scrollY;

    const p = Math.max(0, Math.min(1, scrollY / max));
    if (p !== progress) {
      progress = p;
      dim.style.opacity = (MAX_DIM * p ** 1.1).toFixed(3);
      const deep = smooth(SNOW_FROM, SNOW_FULL, p);
      snow.style.opacity = deep.toFixed(3);
      snowOn = motion && deep > 0.005;
      snow.hidden = !snowOn;
    }

    if (!motion || document.hidden) return;
    if (snowOn) {
      drawSnow(dt, now / 1000, shift);
      frameId = requestAnimationFrame(frame);
    }
  };
  const wake = () => {
    if (!frameId) frameId = requestAnimationFrame(frame);
  };
  wake();

  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => {
    fit();
    measure();
    progress = -1;
    wake();
  });
  document.addEventListener('visibilitychange', wake);
  setInterval(() => {
    const before = max;
    measure();
    if (max !== before) {
      progress = -1;
      wake();
    }
  }, MEASURE_EVERY);
}

depth();

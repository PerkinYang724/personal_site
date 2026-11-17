// The seabed under the last section of the home page: kelp, a crab, starfish, anemones and rising bubbles, drawn in the
// same pale line-art as the creatures in ocean.ts. Everything is opaque ink on one canvas whose CSS opacity does the
// fading, so crossing strokes never double up into seams. The canvas takes no clicks; window listeners map the pointer
// onto it instead, which keeps the custom cursor and water overlay above it working.
// It only animates while on screen, and reduced motion gets a single still frame.
const INK = '#f3f2ee';
const TAU = Math.PI * 2;
const KELP_GAP = 120;
const KELP_SEGMENTS = 16;
const KELP_REACH = 110;
const CRAB_WALK = 22;
const CRAB_FLEE = 150;
const CRAB_DEPTH = 40;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const easeOut = (p: number) => 1 - (1 - clamp(p, 0, 1)) ** 3;
const smooth = (p: number) => clamp(p, 0, 1) ** 2 * (3 - 2 * clamp(p, 0, 1));

interface Kelp {
  x: number;
  height: number;
  phase: number;
  bend: number;
  vel: number;
  blades: { j: number; side: number; len: number }[];
}

type CrabMode = 'walk' | 'pause' | 'flee' | 'dig' | 'buried' | 'emerge';

interface Crab {
  x: number;
  target: number;
  dir: number;
  mode: CrabMode;
  timer: number;
  gait: number;
  sink: number;
}

interface Star {
  x: number;
  size: number;
  rot: number;
  phase: number;
  hop: number;
  spin: number;
}

interface Anemone {
  x: number;
  shut: number;
  since: number;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  age: number;
}

function seabed(section: HTMLElement) {
  const canvas = section.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const sand = document.createElement('canvas');
  const sandCtx = sand.getContext('2d')!;
  const motion = document.documentElement.classList.contains('motion');

  let W = 0;
  let H = 0;
  let t = 0;
  let nextBubble = 0;
  let pointer: { x: number; y: number } | null = null;
  let kelp: Kelp[] = [];
  let stars: Star[] = [];
  let anemones: Anemone[] = [];
  let vents: number[] = [];
  const bubbles: Bubble[] = [];
  const crab: Crab = { x: 0, target: 0, dir: 1, mode: 'pause', timer: 1, gait: 0, sink: 0 };

  const sandY = (x: number) => H - 44 + Math.sin(x * 0.011) * 5 + Math.sin(x * 0.027 + 1.3) * 3;

  // The floor never moves, so it is drawn once per size and copied in each frame.
  const paintSand = (ratio: number) => {
    sand.width = canvas.width;
    sand.height = canvas.height;
    const c = sandCtx;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.strokeStyle = c.fillStyle = INK;
    c.lineWidth = 2;
    c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    for (let x = 0; x <= W; x += 4) c.lineTo(x, sandY(x));
    c.stroke();

    for (let i = 0; i < W * 0.3; i++) {
      const x = Math.random() * W;
      const y = sandY(x) + 5 + Math.random() ** 0.7 * (H - sandY(x) - 6);
      c.globalAlpha = rand(0.15, 0.45);
      c.beginPath();
      c.arc(x, y, rand(0.5, 1.2), 0, TAU);
      c.fill();
    }

    c.globalAlpha = 1;
    c.lineWidth = 1.6;
    for (let i = 0; i < Math.max(3, W / 220); i++) {
      const x = rand(20, W - 20);
      const rx = rand(3, 7);
      c.beginPath();
      c.ellipse(x, sandY(x) + 1, rx, rx * 0.6, rand(-0.2, 0.2), Math.PI, TAU);
      c.stroke();
    }
  };

  const build = () => {
    const rect = section.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintSand(ratio);

    const count = Math.max(3, Math.round(W / KELP_GAP));
    kelp = Array.from({ length: count }, (_, i) => ({
      x: ((i + 0.5) * W) / count + rand(-30, 30),
      height: rand(100, 210),
      phase: rand(0, TAU),
      bend: 0,
      vel: 0,
      blades: Array.from({ length: 5 }, (_, b) => ({ j: 3 + b * 2 + Math.round(rand(0, 1)), side: b % 2 ? 1 : -1, len: rand(9, 15) })),
    }));
    stars = [0.3, 0.8].map((f) => ({ x: f * W + rand(-30, 30), size: rand(12, 15), rot: rand(0, TAU), phase: rand(0, TAU), hop: Infinity, spin: 0 }));
    anemones = (W < 700 ? [0.62] : [0.14, 0.62]).map((f) => ({ x: f * W + rand(-20, 20), shut: 0, since: Infinity }));
    vents = Array.from({ length: 4 }, () => rand(30, W - 30));
    crab.x = crab.target = W * 0.45;
    crab.mode = 'pause';
    crab.timer = rand(1, 3.5);
    crab.sink = 0;
    bubbles.length = 0;
  };

  const bubble = (x: number, y: number) =>
    bubbles.push({ x, y, r: rand(1.5, 4), speed: rand(22, 40), phase: rand(0, TAU), age: 0 });

  // Kelp

  const stepKelp = (k: Kelp, dt: number) => {
    let want = 0;
    if (pointer) {
      const dx = k.x - pointer.x;
      const top = sandY(k.x) - k.height;
      if (Math.abs(dx) < KELP_REACH && pointer.y > top - 30) want = Math.sign(dx || 1) * (1 - Math.abs(dx) / KELP_REACH) * 38;
    }
    // Underdamped, so strands overshoot and settle back like they are in water.
    k.vel += ((want - k.bend) * 18 - k.vel * 3.2) * dt;
    k.bend += k.vel * dt;
  };

  const kelpPoints = (k: Kelp) => {
    const base = sandY(k.x) + 2;
    const seg = k.height / KELP_SEGMENTS;
    const pts: [number, number][] = [];
    for (let j = 0; j <= KELP_SEGMENTS; j++) {
      const f = j / KELP_SEGMENTS;
      const sway = Math.sin(t * 0.9 + k.phase + j * 0.32) * 14 * f ** 1.5;
      pts.push([k.x + sway + k.bend * f * f, base - j * seg * Math.max(0.7, 1 - 0.00012 * k.bend * k.bend * f)]);
    }
    return pts;
  };

  const drawKelp = (k: Kelp) => {
    const pts = kelpPoints(k);
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = 3.5 - (2.5 * i) / (pts.length - 1);
      ctx.beginPath();
      ctx.moveTo(...pts[i - 1]);
      ctx.lineTo(...pts[i]);
      ctx.stroke();
    }
    ctx.lineWidth = 1.3;
    for (const { j, side, len } of k.blades) {
      const [x0, y0] = pts[j];
      const [x1, y1] = pts[j + 1];
      const a = Math.atan2(y1 - y0, x1 - x0) + side * 0.65;
      const tx = x0 + Math.cos(a) * len;
      const ty = y0 + Math.sin(a) * len;
      const nx = -Math.sin(a) * 3.2;
      const ny = Math.cos(a) * 3.2;
      const mx = (x0 + tx) / 2;
      const my = (y0 + ty) / 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
      ctx.quadraticCurveTo(mx - nx, my - ny, x0, y0);
      ctx.stroke();
    }
  };

  // Crab

  const settle = (mode: CrabMode, timer: number) => {
    crab.mode = mode;
    crab.timer = timer;
  };

  const stepCrab = (dt: number) => {
    crab.timer -= dt;
    switch (crab.mode) {
      case 'pause':
        if (crab.timer <= 0) {
          crab.target = rand(40, W - 40);
          crab.mode = 'walk';
        }
        break;
      case 'walk': {
        const dx = crab.target - crab.x;
        crab.dir = Math.sign(dx);
        crab.x += crab.dir * Math.min(Math.abs(dx), CRAB_WALK * dt);
        crab.gait += dt * 9;
        if (Math.abs(dx) < 0.5) settle('pause', rand(1, 3.5));
        break;
      }
      case 'flee':
        crab.x = clamp(crab.x + crab.dir * CRAB_FLEE * dt, 24, W - 24);
        crab.gait += dt * 30;
        if (crab.timer <= 0) settle('dig', 0.7);
        break;
      case 'dig':
        crab.gait += dt * 30;
        crab.sink = CRAB_DEPTH * easeOut(1 - crab.timer / 0.7);
        if (crab.timer <= 0) {
          bubble(crab.x, sandY(crab.x) - 2);
          settle('buried', rand(4, 6));
        }
        break;
      case 'buried':
        if (crab.timer <= 0) {
          crab.x = rand(40, W - 40);
          settle('emerge', 0.8);
        }
        break;
      case 'emerge':
        crab.sink = CRAB_DEPTH * (1 - easeOut(1 - crab.timer / 0.8));
        if (crab.timer <= 0) {
          crab.sink = 0;
          settle('pause', rand(1, 2.5));
        }
    }
  };

  const claw = (side: number, y0: number, open: number) => {
    const sx = side * 13;
    const px = side * 21;
    const py = y0 - 14;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sx, y0 - 3);
    ctx.quadraticCurveTo(side * 20, y0 - 2, px, py + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px, py, 3.6, 4.6, side * 0.35, 0, TAU);
    ctx.stroke();
    // Two fingers that point up and inward, parted by `open`.
    const base = -Math.PI / 2 - side * 0.35;
    for (const f of [-1, 1]) {
      const a = base + f * open;
      const bx = px + Math.cos(base) * 4;
      const by = py + Math.sin(base) * 4;
      const tx = bx + Math.cos(a) * 7;
      const ty = by + Math.sin(a) * 7;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + f * 1.2) * 2, by + Math.sin(a + f * 1.2) * 2);
      ctx.quadraticCurveTo(bx + Math.cos(a + f * 0.5) * 6, by + Math.sin(a + f * 0.5) * 6, tx, ty);
      ctx.stroke();
    }
  };

  const drawCrab = () => {
    if (crab.mode === 'buried') return;
    const ground = sandY(crab.x);
    ctx.save();
    if (crab.sink > 0) {
      ctx.beginPath();
      ctx.moveTo(crab.x - 40, 0);
      ctx.lineTo(crab.x + 40, 0);
      for (let x = crab.x + 40; x >= crab.x - 40; x -= 4) ctx.lineTo(x, sandY(x) - 1);
      ctx.clip();
    }
    ctx.translate(crab.x, ground + crab.sink);
    ctx.strokeStyle = ctx.fillStyle = INK;
    ctx.lineCap = ctx.lineJoin = 'round';
    const moving = crab.mode !== 'pause';
    const y0 = -9;

    ctx.lineWidth = 1.7;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const step = moving ? Math.sin(crab.gait + i * 2.1 + (side > 0 ? Math.PI : 0)) : 0;
        const lift = Math.max(0, step) * 4;
        const hip = side * (6 + i * 3);
        const knee = side * (15 + i * 2.5);
        const foot = side * (18 + i * 3.5) + (moving ? Math.cos(crab.gait + i * 2.1) * 2.5 : 0);
        ctx.beginPath();
        ctx.moveTo(hip, y0 + 1);
        ctx.lineTo(knee, y0 - 4 + i * 1.5 - lift * 0.5);
        ctx.lineTo(foot, -lift);
        ctx.stroke();
      }
    }

    // Eye stalks sit behind the shell, so they go first.
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      const bob = moving ? Math.sin(crab.gait * 0.5 + side) * 0.8 : 0;
      ctx.beginPath();
      ctx.moveTo(side * 4, y0 - 8);
      ctx.lineTo(side * 5.5, y0 - 16 + bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * 5.5, y0 - 17 + bob, 2, 0, TAU);
      ctx.fill();
    }

    ctx.lineWidth = 2.4;
    ctx.fillStyle = '#060607';
    ctx.beginPath();
    ctx.ellipse(0, y0, 14, 10, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, y0 + 2, 7, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();

    // Paused crabs click their pincers; walking ones keep them half open.
    for (const side of [-1, 1]) {
      const open = crab.mode === 'pause' ? 0.08 + 0.42 * Math.max(0, Math.sin(t * 7 + side * 1.3)) ** 2 : 0.25;
      claw(side, y0, open);
    }
    ctx.restore();
  };

  const hitCrab = (x: number, y: number) =>
    crab.mode !== 'buried' && crab.sink < CRAB_DEPTH * 0.6 && Math.abs(x - crab.x) < 26 && y > sandY(crab.x) - 34 && y < sandY(crab.x) + 6;

  const scareCrab = (x: number) => {
    crab.dir = Math.sign(crab.x - x) || 1;
    if ((crab.dir > 0 && crab.x > W - 110) || (crab.dir < 0 && crab.x < 110)) crab.dir *= -1;
    settle('flee', 0.6);
  };

  // Starfish

  const starY = (s: Star) => sandY(s.x) - s.size * 0.55;

  const drawStar = (s: Star) => {
    const p = s.hop / 1.1;
    const hop = p < 1 ? Math.sin(p * Math.PI) * 30 : 0;
    const spin = p < 1 ? easeOut(p) * s.spin : s.spin;
    ctx.save();
    ctx.translate(s.x, starY(s) - hop);
    ctx.rotate(s.rot + spin);
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      const reach = s.size * (1 + Math.sin(t * 1.1 + s.phase + i * 1.3) * 0.06);
      const tipX = Math.cos(a) * reach;
      const tipY = Math.sin(a) * reach;
      const inner = s.size * 0.5;
      const b = a + TAU / 10;
      // Each arm swells toward a rounded tip, so the curves run through points beside the tip, not to it.
      const side = 0.3;
      if (i === 0) ctx.moveTo(Math.cos(a - TAU / 10) * inner, Math.sin(a - TAU / 10) * inner);
      ctx.quadraticCurveTo(Math.cos(a - side) * reach * 0.72, Math.sin(a - side) * reach * 0.72, Math.cos(a - 0.17) * reach, Math.sin(a - 0.17) * reach);
      ctx.quadraticCurveTo(tipX * 1.16, tipY * 1.16, Math.cos(a + 0.17) * reach, Math.sin(a + 0.17) * reach);
      ctx.quadraticCurveTo(Math.cos(a + side) * reach * 0.72, Math.sin(a + side) * reach * 0.72, Math.cos(b) * inner, Math.sin(b) * inner);
    }
    ctx.closePath();
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      for (const f of [0.35, 0.62]) {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s.size * f, Math.sin(a) * s.size * f, 1, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const hitStar = (s: Star, x: number, y: number) => Math.hypot(x - s.x, y - starY(s)) < s.size + 8;

  const hopStar = (s: Star) => {
    if (s.hop < 1.1) return;
    s.rot += s.spin;
    s.spin = (Math.random() < 0.5 ? -1 : 1) * TAU * 0.6;
    s.hop = 0;
  };

  // Anemones

  const anemoneTop = (a: Anemone) => sandY(a.x) - 15;

  const drawAnemone = (a: Anemone) => {
    const ground = sandY(a.x) + 1;
    const top = anemoneTop(a);
    const c = a.shut;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(a.x - 8, ground);
    ctx.quadraticCurveTo(a.x - 5, ground - 8, a.x - 7, top);
    ctx.moveTo(a.x + 8, ground);
    ctx.quadraticCurveTo(a.x + 5, ground - 8, a.x + 7, top);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(a.x, top, 7.5, 2.2, 0, 0, TAU);
    ctx.stroke();
    // Faint bands across the column so it reads as one soft body rather than two legs.
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const f of [0.35, 0.68]) {
      const y = top + (ground - top) * f;
      ctx.moveTo(a.x - 6, y);
      ctx.quadraticCurveTo(a.x, y + 2.5, a.x + 6, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.lineWidth = 1.8;
    const count = 13;
    for (let k = 0; k < count; k++) {
      const f = k / (count - 1) - 0.5;
      const spread = 1.25 * (1 - 0.8 * c);
      const sway = Math.sin(t * 1.6 + k * 0.5 + a.x) * 0.1 * (1 - c);
      const ang = -Math.PI / 2 + f * 2 * spread + sway;
      const len = 22 * (1 - 0.6 * c) * (0.8 + 0.2 * Math.cos(f * Math.PI));
      // Open tentacles droop outward at the tips; shut ones curl in over the mouth.
      const curl = f * 0.9 * (1 - c) - Math.sign(f) * c * 0.9 + Math.sin(t * 1.3 + k) * 0.15 * (1 - c);
      const bx = a.x + f * 10;
      const mx = bx + Math.cos(ang) * len * 0.55;
      const my = top + Math.sin(ang) * len * 0.55;
      const tx = mx + Math.cos(ang + curl) * len * 0.45;
      const ty = my + Math.sin(ang + curl) * len * 0.45;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 1.7, 0, TAU);
      ctx.fill();
    }
  };

  const stepAnemone = (a: Anemone, dt: number) => {
    a.since += dt;
    // Snaps shut fast, then unfurls slowly, so the reopening is the part people watch.
    a.shut = a.since < 0.15 ? Math.max(a.shut, a.since / 0.15) : 1 - smooth((a.since - 0.15) / 3);
  };

  const hitAnemone = (a: Anemone, x: number, y: number) => Math.abs(x - a.x) < 24 && y > anemoneTop(a) - 26 && y < sandY(a.x) + 4;

  // Bubbles

  const stepBubbles = (dt: number) => {
    nextBubble -= dt;
    if (nextBubble <= 0) {
      const x = vents[Math.floor(Math.random() * vents.length)];
      bubble(x, sandY(x) - 2);
      nextBubble = rand(0.6, 1.8);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      b.y -= b.speed * dt;
      if (b.y < -10) bubbles.splice(i, 1);
    }
  };

  const drawBubbles = () => {
    ctx.lineWidth = 1.2;
    for (const b of bubbles) {
      ctx.globalAlpha = clamp(b.y / 90, 0, 1) * clamp(b.age / 0.2, 0, 1);
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(b.age * 3 + b.phase) * 3, b.y, b.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // Frame

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = ctx.fillStyle = INK;
    for (const k of kelp) drawKelp(k);
    ctx.drawImage(sand, 0, 0, W, H);
    for (const s of stars) drawStar(s);
    for (const a of anemones) drawAnemone(a);
    drawCrab();
    drawBubbles();
  };

  const step = (dt: number) => {
    t += dt;
    for (const k of kelp) stepKelp(k, dt);
    for (const s of stars) {
      s.rot += dt * 0.03;
      s.hop += dt;
    }
    for (const a of anemones) stepAnemone(a, dt);
    stepCrab(dt);
    stepBubbles(dt);
  };

  build();
  draw();

  let width = W;
  addEventListener('resize', () => {
    if (section.getBoundingClientRect().width === width) return;
    build();
    width = W;
    draw();
  });
  if (!motion) return;

  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    step(Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!entry.isIntersecting) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }).observe(section);

  const local = (e: PointerEvent) => {
    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
  };

  addEventListener('pointermove', (e) => {
    pointer = e.pointerType === 'touch' ? null : local(e);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => (pointer = null));

  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = local(e);
    if (!p) return;
    for (let i = 0; i < 3; i++) bubble(p.x + rand(-6, 6), p.y + rand(-4, 4));
    for (const k of kelp) {
      const dx = k.x - p.x;
      if (Math.abs(dx) < 160) k.vel += Math.sign(dx || 1) * (1 - Math.abs(dx) / 160) * 260;
    }
    if (hitCrab(p.x, p.y)) scareCrab(p.x);
    for (const s of stars) if (hitStar(s, p.x, p.y)) hopStar(s);
    for (const a of anemones) {
      if (!hitAnemone(a, p.x, p.y)) continue;
      a.since = 0;
      for (let i = 0; i < 8; i++) bubble(a.x + rand(-8, 8), anemoneTop(a) - rand(0, 12));
    }
  }, { passive: true });
}

const section = document.querySelector<HTMLElement>('[data-seabed]');
if (section) seabed(section);

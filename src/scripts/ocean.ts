// The home page as a stretch of ocean. Each creature keeps to one depth of the page, scrolls with it, and has its own
// way of moving and of reacting when clicked. Where they all are lives in localStorage, so they are still there on the
// next visit; each visitor has their own ocean. Section backgrounds are opaque, so the creatures sit above them at low
// opacity and never take clicks from what's underneath. The seabed at the very bottom is in seabed.ts.
const INK = '#f3f2ee';
const MARGIN = 70;
const KEY = 'ocean';

interface Member {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ox: number;
  oy: number;
  phase: number;
}

interface State {
  x: number;
  y: number;
  heading: number;
  speed: number;
  facing: number;
  phase: number;
  // The depth on the page it keeps to.
  home: number;
  flee: number;
  away: number;
  awayX: number;
  awayY: number;
  travel: boolean;
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  tilt: number;
  pulse: number;
  rest: number;
  members: Member[];
}

interface Kind {
  box: number;
  opacity: number;
  init?(s: State): void;
  step(s: State, dt: number): void;
  paint(ctx: CanvasRenderingContext2D, s: State): void;
  hit(s: State, x: number, y: number): boolean;
  scare(s: State, x: number, y: number): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

let pageHeight = 0;
const bottom = () => Math.max(MARGIN + 1, pageHeight - MARGIN);
const right = () => Math.max(MARGIN + 1, innerWidth - MARGIN);

// Long sideways sweeps that drift up and down around the creature's home depth.
function wander(s: State, spread: number) {
  let x = rand(MARGIN, right());
  for (let i = 0; i < 6 && Math.abs(x - s.x) < innerWidth * 0.3; i++) x = rand(MARGIN, right());
  s.wx = x;
  s.wy = clamp(s.home + rand(-spread, spread) * innerHeight, MARGIN, bottom());
}

// Fleeing towards the side, top or bottom of the page, a creature glances off instead of pressing against the edge.
function glance(s: State) {
  if ((s.x < MARGIN && Math.cos(s.away) < 0) || (s.x > right() && Math.cos(s.away) > 0)) s.away = Math.PI - s.away;
  if ((s.y < MARGIN * 2 && Math.sin(s.away) < 0) || (s.y > bottom() - MARGIN && Math.sin(s.away) > 0)) s.away = -s.away;
}

// Steering shared by everything that swims forwards. Turning around reads as the body narrowing and opening out.
function swim(s: State, want: number, turn: number, target: number, dt: number) {
  if (s.flee > 0) {
    glance(s);
    want = s.away;
  }
  s.heading += clamp(angleTo(s.heading, want), -1, 1) * Math.min(1, dt * turn);
  s.speed += (target - s.speed) * Math.min(1, dt * 4);
  s.x = clamp(s.x + Math.cos(s.heading) * s.speed * dt, -MARGIN, innerWidth + MARGIN);
  s.y = clamp(s.y + Math.sin(s.heading) * s.speed * dt, MARGIN, bottom());
  const cos = Math.cos(s.heading);
  if (Math.abs(cos) > 0.15) s.facing += (Math.sign(cos) - s.facing) * Math.min(1, dt * (s.flee > 0 ? 14 : 3));
}

// Wandering about its home depth at an easy pace, and bolting at another while it's frightened.
function cruise(s: State, dt: number, spread: number, pace: number, turn: number, bolt: number, swerve: number) {
  if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
  if (Math.hypot(s.wx - s.x, s.wy - s.y) < 90) wander(s, spread);
  swim(s, Math.atan2(s.wy - s.y, s.wx - s.x), s.flee > 0 ? swerve : turn, s.flee > 0 ? bolt : pace, dt);
}

// Side-on creatures face their way of travel and tip their nose up or down with it.
function side(ctx: CanvasRenderingContext2D, s: State, pitch: number) {
  ctx.scale((s.facing < 0 ? -1 : 1) * Math.max(0.08, Math.abs(s.facing)), 1);
  ctx.rotate(clamp(Math.atan2(Math.sin(s.heading), Math.abs(Math.cos(s.heading))), -pitch, pitch));
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

// A line that thins from w0 to w1 along its points: seahorse bodies, eels, arms.
export function taper(ctx: CanvasRenderingContext2D, pts: [number, number][], w0: number, w1: number) {
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = w0 + ((w1 - w0) * i) / (pts.length - 1);
    ctx.beginPath();
    ctx.moveTo(...pts[i - 1]);
    ctx.lineTo(...pts[i]);
    ctx.stroke();
  }
}

const near = (s: State, x: number, y: number, rx: number, ry: number, dy = 0) =>
  ((x - s.x) / rx) ** 2 + ((y - s.y - dy) / ry) ** 2 <= 1;

const fleeFrom = (s: State, x: number, y: number) => Math.atan2(s.y - y, s.x - x) + rand(-0.3, 0.3);

// The big fish: darts away when clicked, then swims a screen and a half or more up or down the page.
const FISH_ART = [
  // Body, hollow so the page shows through
  'M236 58C205 30 150 22 112 28C90 32 70 45 50 50L50 64C72 66 92 78 118 86C160 96 210 84 236 58ZM222 56C195 37 150 32 115 37C95 41 78 50 60 57C78 60 96 70 120 77C160 85 203 75 222 56Z',
  // Tail
  'M54 52C40 46 28 28 8 20C16 36 20 46 20 57C20 68 16 80 6 94C28 88 40 70 54 62ZM28 45C34 52 40 55 44 57C40 59 34 62 28 69C32 60 32 54 28 45Z',
  // Dorsal fin
  'M92 34C108 26 122 10 136 2C160 4 182 12 196 24C178 20 156 20 140 22C122 24 106 30 92 34ZM128 20C136 16 146 15 156 16C148 12 142 11 137 11C134 14 131 17 128 20Z',
  // Lower fins
  'M84 73C88 80 86 88 80 94C92 94 104 90 110 82Z',
  'M136 88C132 96 124 104 116 108C132 110 150 102 160 90Z',
  // Side fin
  'M124 56C140 52 160 56 176 62C165 72 145 76 132 70C134 66 130 60 124 56ZM140 62C148 62 155 63 162 64C155 67 148 67 142 66Z',
  // Gill, mouth and eye
  'M190 38C176 48 176 68 192 78C184 66 184 50 190 38Z',
  'M236 58C228 62 220 64 210 65C220 67 230 65 238 60Z',
  'M213 50A5 5 0 1 1 203 50A5 5 0 1 1 213 50Z',
];
const FISH_W = 128;
const FISH_H = (FISH_W / 240) * 112;
let fishArt: HTMLCanvasElement | null = null;
const fish: Kind = {
  box: 180,
  opacity: 0.3,
  step(s, dt) {
    let want: number;
    let turn = 0.9;
    let target = 55;
    const distance = Math.hypot(s.wx - s.x, s.wy - s.y);
    if (s.flee > 0) {
      s.flee = Math.max(0, s.flee - dt);
      want = s.away;
      turn = 12;
      target = 680;
      if (s.flee === 0) {
        // Somewhere at least a screen and a half up or down the page, whichever way has room.
        const gap = innerHeight * 1.5;
        const up = s.y - gap > MARGIN;
        const down = s.y + gap < bottom();
        const goUp = up && (!down || Math.random() < 0.5);
        s.wy = up || down ? (goUp ? rand(MARGIN, s.y - gap) : rand(s.y + gap, bottom())) : rand(MARGIN, bottom());
        s.wx = rand(MARGIN, right());
        s.travel = true;
      }
    } else if (s.travel) {
      want = Math.atan2(s.wy - s.y, s.wx - s.x);
      turn = 4;
      target = Math.min(850, 55 + distance * 1.5);
      if (distance < 100) {
        s.travel = false;
        s.home = s.y;
        wander(s, 0.4);
      }
    } else {
      if (distance < 80) wander(s, 0.4);
      want = Math.atan2(s.wy - s.y, s.wx - s.x);
    }
    swim(s, want, turn, target, dt);
    s.phase += (5 + s.speed * 0.045) * dt;
  },
  paint(ctx, s) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (!fishArt) {
      // Drawn once, then redrawn in thin slices each frame so the body can ripple.
      fishArt = document.createElement('canvas');
      fishArt.width = Math.ceil(FISH_W * ratio);
      fishArt.height = Math.ceil(FISH_H * ratio);
      const a = fishArt.getContext('2d')!;
      a.scale(fishArt.width / 240, fishArt.height / 112);
      a.fillStyle = INK;
      for (const d of FISH_ART) a.fill(new Path2D(d), 'evenodd');
    }
    side(ctx, s, 1.2);
    const amp = 2.5 + Math.min(4, s.speed / 110);
    const slice = 2 * ratio;
    for (let sx = 0; sx < fishArt.width; sx += slice) {
      // The art faces right, so the ripple grows towards the tail on the left.
      const along = sx / fishArt.width;
      const y = Math.sin(s.phase + along * 4) * amp * (1 - along) ** 2;
      ctx.drawImage(fishArt, sx, 0, slice, fishArt.height, along * FISH_W - FISH_W / 2, y - FISH_H / 2, slice / ratio + 0.4, FISH_H);
    }
  },
  hit: (s, x, y) => near(s, x, y, FISH_W / 2 + 16, FISH_H / 2 + 16),
  scare(s, x, y) {
    s.away = fleeFrom(s, x, y);
    s.flee = 0.5;
    s.travel = false;
    s.speed = 680;
  },
};

// A school of small fish that follow a leader in loose formation, scatter when clicked and gather again. Bigger
// schools spread wider, and the canvas allows for a scatter of about 190px beyond the formation.
const school = (count: number, size: number): Kind => {
  const spread = 70 * Math.sqrt(count / 9);
  return {
    box: Math.round(2 * (spread + 190)),
    opacity: 0.26,
    init(s) {
      s.members = Array.from({ length: count }, () => {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(Math.random());
        return { x: s.x, y: s.y, vx: 0, vy: 0, ox: Math.cos(a) * r * spread, oy: Math.sin(a) * r * spread * 0.5, phase: rand(0, 6) };
      });
    },
    step(s, dt) {
      if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
      if (Math.hypot(s.wx - s.x, s.wy - s.y) < 80) wander(s, 0.3);
      const panic = s.flee / 1.6;
      swim(s, s.flee > 0 ? s.away : Math.atan2(s.wy - s.y, s.wx - s.x), s.flee > 0 ? 8 : 1.2, 70 + 150 * panic, dt);
      s.phase += dt;
      const lx = Math.cos(s.heading) * s.speed;
      const ly = Math.sin(s.heading) * s.speed;
      for (const m of s.members) {
        // Each one is pulled towards its own place beside the leader, with a little drift so the shape keeps changing.
        // Damping against the leader's velocity rather than the water's keeps them from trailing behind it. The burst
        // away from a click is balanced by that pull, so the scattered school still fits its canvas.
        const tx = s.x + m.ox + Math.sin(s.phase * 0.7 + m.phase) * 10;
        const ty = s.y + m.oy + Math.cos(s.phase * 0.9 + m.phase) * 6;
        let ax = (tx - m.x) * 2.5 - (m.vx - lx) * 1.6;
        let ay = (ty - m.y) * 2.5 - (m.vy - ly) * 1.6;
        if (s.flee > 0) {
          const dx = m.x - s.awayX;
          const dy = m.y - s.awayY;
          const d = Math.hypot(dx, dy) || 1;
          ax += (dx / d) * 550 * panic;
          ay += (dy / d) * 550 * panic;
        }
        m.vx += ax * dt;
        m.vy += ay * dt;
        const v = Math.hypot(m.vx, m.vy);
        if (v > 320) {
          m.vx *= 320 / v;
          m.vy *= 320 / v;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.phase += (9 + v * 0.06) * dt;
      }
    },
    paint(ctx, s) {
      for (const m of s.members) {
        ctx.save();
        ctx.translate(m.x - s.x, m.y - s.y);
        // Still fish keep pointing the way the school is going.
        ctx.rotate(Math.hypot(m.vx, m.vy) > 8 ? Math.atan2(m.vy, m.vx) : s.heading);
        ctx.scale(size, size);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.5, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(-5, 0);
        ctx.rotate(Math.sin(m.phase) * 0.4);
        ctx.beginPath();
        ctx.moveTo(1, 0);
        ctx.lineTo(-5, -3.4);
        ctx.lineTo(-3.6, 0);
        ctx.lineTo(-5, 3.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
    hit: (s, x, y) => s.members.some((m) => Math.hypot(m.x - x, m.y - y) < 26),
    scare(s, x, y) {
      s.flee = 1.6;
      s.away = fleeFrom(s, x, y);
      s.awayX = x;
      s.awayY = y;
    },
  };
};

// Jellyfish rise by squeezing their bell and sink slowly in between. A click makes one pulse hard and fast.
const jelly: Kind = {
  box: 200,
  opacity: 0.3,
  step(s, dt) {
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    s.phase += dt;
    s.pulse += dt / (s.flee > 0 ? 0.8 : 2.6);
    if (s.pulse >= 1) s.pulse -= 1;
    if (Math.abs(s.wx - s.x) < 40) wander(s, 0.2);
    const lean = s.flee > 0 ? s.away : clamp((s.wx - s.x) / 500, -0.4, 0.4);
    s.tilt += (lean - s.tilt) * Math.min(1, dt * 1.5);
    if (s.pulse < 0.25) {
      // Above its home depth it barely pushes, so it drifts back down.
      const push = s.flee > 0 ? 520 : s.y > s.home - 100 ? 120 : 25;
      s.vx += Math.sin(s.tilt) * push * dt;
      s.vy -= Math.cos(s.tilt) * push * dt;
    }
    s.vy += 12 * dt;
    const drag = Math.exp(-dt * 1.4);
    s.vx *= drag;
    s.vy *= drag;
    s.x += s.vx * dt;
    if (s.x < MARGIN || s.x > right()) {
      s.x = clamp(s.x, MARGIN, right());
      s.vx = 0;
    }
    s.y = clamp(s.y + s.vy * dt, MARGIN, bottom());
  },
  paint(ctx, s) {
    const squeeze = s.pulse < 0.25 ? Math.sin((s.pulse / 0.25) * Math.PI) : 0;
    ctx.translate(0, -35);
    ctx.rotate(s.tilt);
    const w = 24 * (1 - 0.2 * squeeze);
    const h = 20 * (1 + 0.25 * squeeze);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w, -h * 1.35, w, -h * 1.35, w, 0);
    for (let i = 0; i < 6; i++) {
      const a = w - (i * 2 * w) / 6;
      const b = w - ((i + 1) * 2 * w) / 6;
      ctx.quadraticCurveTo((a + b) / 2, 5, b, 0);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -1);
    ctx.bezierCurveTo(-w * 0.55, -h * 0.95, w * 0.55, -h * 0.95, w * 0.55, -1);
    ctx.stroke();
    // Tentacles trail behind the way it's drifting.
    const tentacle = (x0: number, length: number, amp: number, width: number, i: number) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const x = x0 * (1 - f * 0.3) + Math.sin(s.phase * 2 + k * 0.6 + i) * f * amp - s.vx * 0.05 * k;
        const y = 2 + f * length * (1 - 0.15 * squeeze);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    };
    for (let i = 0; i < 7; i++) tentacle(-w * 0.8 + (i * w * 1.6) / 6, 62 + (i % 2) * 20, 6, 0.8, i);
    tentacle(-4, 38, 4, 2.2, 1);
    tentacle(4, 34, 4, 2.2, 1.8);
  },
  hit: (s, x, y) => near(s, x, y, 34, 40, -25),
  scare(s, x) {
    s.flee = 2.5;
    s.pulse = 0;
    s.away = clamp((s.x - x) / 40, -0.6, 0.6);
  },
};

// A sea turtle cruising slowly in wide loops. Clicked, it beats its flippers harder and glides off.
const turtle: Kind = {
  box: 200,
  opacity: 0.24,
  step(s, dt) {
    cruise(s, dt, 0.5, 30, 0.45, 190, 3);
    s.phase += (1.8 + s.speed * 0.035) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.5);
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    // Flippers behind the shell
    ctx.save();
    ctx.translate(16, 6);
    ctx.rotate(-0.15 + Math.sin(s.phase) * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-6, 14, -24, 30, -40, 34);
    ctx.bezierCurveTo(-26, 22, -12, 10, 0, 0);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-32, 6);
    ctx.rotate(0.3 + Math.sin(s.phase + 1.2) * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8, 10, -20, 10);
    ctx.quadraticCurveTo(-10, 4, 0, 0);
    ctx.fill();
    ctx.restore();
    // Shell and its plates. The shell is hollow, so the flippers are cut away where it covers them.
    ctx.beginPath();
    ctx.moveTo(-42, 6);
    ctx.bezierCurveTo(-36, -25, 30, -29, 40, 4);
    ctx.quadraticCurveTo(0, 14, -42, 6);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-30, 3);
    ctx.bezierCurveTo(-24, -14, 20, -18, 28, 1);
    for (const x of [-16, 0, 15]) {
      ctx.moveTo(x, -12 + Math.abs(x) * 0.2);
      ctx.lineTo(x * 1.1, 8);
    }
    ctx.stroke();
    // Head, eye and tail
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(38, -1);
    ctx.lineTo(46, -5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(54, -6, 11, 7.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(57, -8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.moveTo(-41, 4);
    ctx.lineTo(-50, 7);
    ctx.lineTo(-41, 9);
    ctx.fill();
  },
  hit: (s, x, y) => near(s, x, y, 70, 42),
  scare(s, x, y) {
    s.flee = 2.2;
    s.away = fleeFrom(s, x, y);
  },
};

// A manta ray seen from above, gliding on slow wing beats along a gently weaving path. Clicked, it banks away.
const ray: Kind = {
  box: 220,
  opacity: 0.22,
  step(s, dt) {
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    if (Math.hypot(s.wx - s.x, s.wy - s.y) < 90) wander(s, 0.5);
    const want = s.flee > 0 ? s.away : Math.atan2(s.wy - s.y, s.wx - s.x) + Math.sin(s.phase * 0.3) * 0.5;
    swim(s, want, s.flee > 0 ? 6 : 0.8, s.flee > 0 ? 300 : 42, dt);
    s.phase += (1.6 + s.speed * 0.02) * dt;
  },
  paint(ctx, s) {
    ctx.rotate(s.heading);
    const span = 58 * (0.78 + 0.22 * Math.cos(s.phase));
    const sweep = 4 * Math.sin(s.phase);
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.bezierCurveTo(14, -20, sweep, -span, -10 + sweep, -span);
    ctx.bezierCurveTo(-14, -span * 0.6, -22, -12, -30, 0);
    ctx.bezierCurveTo(-22, 12, -14, span * 0.6, -10 + sweep, span);
    ctx.bezierCurveTo(sweep, span, 14, 20, 26, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.quadraticCurveTo(36, -10, 35, -2);
    ctx.moveTo(26, 6);
    ctx.quadraticCurveTo(36, 10, 35, 2);
    ctx.moveTo(18, 0);
    ctx.lineTo(-22, 0);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    for (let k = 1; k <= 10; k++) ctx.lineTo(-30 - k * 5.5, Math.sin(s.phase * 1.5 - k * 0.5) * k * 0.5);
    ctx.stroke();
    for (const y of [-7, 7]) {
      ctx.beginPath();
      ctx.arc(18, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  hit: (s, x, y) => near(s, x, y, 70, 70),
  scare(s, x, y) {
    s.flee = 2;
    s.away = fleeFrom(s, x, y);
  },
};

// A seahorse hovering upright, bobbing in place and drifting a little now and then. Clicked, it flutters off.
const seahorse: Kind = {
  box: 120,
  opacity: 0.3,
  init(s) {
    s.wx = s.x;
    s.wy = s.y;
  },
  step(s, dt) {
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    s.phase += dt;
    s.rest -= dt;
    if (s.rest <= 0 && s.flee === 0) {
      s.rest = rand(4, 9);
      s.wx = clamp(s.x + rand(-200, 200), MARGIN, right());
      s.wy = clamp(s.home + rand(-120, 120), MARGIN, bottom());
    }
    const limit = s.flee > 0 ? 110 : 14;
    const tx = clamp((s.wx - s.x) * 0.4, -limit, limit);
    const ty = clamp((s.wy - s.y) * 0.4, -limit, limit) + Math.cos(s.phase * 1.3) * 6;
    s.vx += (tx - s.vx) * Math.min(1, dt * 1.5);
    s.vy += (ty - s.vy) * Math.min(1, dt * 1.5);
    s.x += s.vx * dt;
    s.y = clamp(s.y + s.vy * dt, MARGIN, bottom());
    if (Math.abs(s.vx) > 2) s.facing += (Math.sign(s.vx) - s.facing) * Math.min(1, dt * 2);
  },
  paint(ctx, s) {
    ctx.scale((s.facing < 0 ? -1 : 1) * Math.max(0.08, Math.abs(s.facing)), 1);
    ctx.rotate(clamp(Math.abs(s.vx) * 0.006, 0, 0.3));
    // Neck, then a belly that bulges forwards, then a tail that thins and curls under it towards the front.
    const neck: [number, number][] = [[0, -27], [-3, -21], [-2, -15]];
    const trunk: [number, number][] = [[-2, -15], [3, -9], [6, -2], [6, 5], [3, 11], [-1, 17], [-3, 23]];
    for (let k = 1; k <= 12; k++) {
      const a = Math.PI - (k / 12) * 4.8;
      const r = 6 - (k / 12) * 4.2;
      trunk.push([3 + Math.cos(a) * r, 24 + Math.sin(a) * r]);
    }
    taper(ctx, neck, 5, 7.5);
    taper(ctx, trunk, 9, 1.2);
    ctx.beginPath();
    ctx.ellipse(1, -30, 6.5, 5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    taper(ctx, [[5, -29], [11, -26.5], [17, -24]], 3.4, 2.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(17.5, -26);
    ctx.lineTo(17, -22);
    ctx.stroke();
    taper(ctx, [[-2, -34], [-3, -38], [-2, -41]], 2.6, 1.6);
    // Fin on its back, fluttering faster when it's in a hurry
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const flutter = s.phase * (s.flee > 0 ? 30 : 9);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.88 + i * 0.07) + Math.sin(flutter + i) * 0.14;
      ctx.moveTo(-1, -9 + i * 2.6);
      ctx.lineTo(-1 + Math.cos(a) * 10, -9 + i * 2.6 + Math.sin(a) * 10);
    }
    ctx.stroke();
    // Bony rings across the body, and the eye, cut out so the page shows through.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 2; i < 8; i++) {
      const [x0, y0] = trunk[i - 1];
      const [x1, y1] = trunk[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const nx = (-(y1 - y0) / d) * 6;
      const ny = ((x1 - x0) / d) * 6;
      ctx.moveTo(x1 - nx, y1 - ny);
      ctx.lineTo(x1 + nx, y1 + ny);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2.5, -31, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  hit: (s, x, y) => near(s, x, y, 30, 40, -5),
  scare(s, x, y) {
    const a = fleeFrom(s, x, y);
    s.flee = 2.2;
    s.rest = rand(4, 9);
    s.wx = clamp(s.x + Math.cos(a) * 220, MARGIN, right());
    s.wy = clamp(s.y + Math.sin(a) * 220, MARGIN, bottom());
  },
};

// A lone reef fish that potters about and bolts when clicked.
const darter: Kind = {
  box: 100,
  opacity: 0.28,
  step(s, dt) {
    cruise(s, dt, 0.3, 40, 1.4, 380, 10);
    s.phase += (6 + s.speed * 0.05) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.6);
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.bezierCurveTo(12, -9, -5, -9, -12, -1);
    ctx.lineTo(-12, 1);
    ctx.bezierCurveTo(-5, 8, 12, 8, 17, 0);
    ctx.moveTo(8, -5.5);
    ctx.quadraticCurveTo(5, 0, 8, 5.5);
    ctx.moveTo(-1, -7);
    ctx.quadraticCurveTo(3, -12, 8, -6.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, -1.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(-12, 0);
    ctx.rotate(Math.sin(s.phase) * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -6);
    ctx.quadraticCurveTo(-6, 0, -9, 6);
    ctx.closePath();
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 34, 24),
  scare(s, x, y) {
    s.flee = 0.7;
    s.away = fleeFrom(s, x, y);
  },
};

// A tall angelfish with long trailing fins, drifting slowly about the reef.
const angel: Kind = {
  box: 130,
  opacity: 0.28,
  step(s, dt) {
    cruise(s, dt, 0.25, 20, 0.7, 240, 7);
    s.phase += (2.5 + s.speed * 0.04) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.35);
    const sway = Math.sin(s.phase) * 3;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.bezierCurveTo(14, -10, 4, -18, -6, -18);
    ctx.bezierCurveTo(-10, -18, -12, -9, -14, -3);
    ctx.lineTo(-14, 3);
    ctx.bezierCurveTo(-12, 9, -10, 18, -6, 18);
    ctx.bezierCurveTo(4, 18, 14, 10, 18, 0);
    // Fins swept back from the top and bottom
    ctx.moveTo(-1, -17.5);
    ctx.quadraticCurveTo(-8, -30, -24 + sway, -42);
    ctx.quadraticCurveTo(-16, -22, -12.5, -10);
    ctx.moveTo(-1, 17.5);
    ctx.quadraticCurveTo(-8, 30, -24 - sway, 42);
    ctx.quadraticCurveTo(-16, 22, -12.5, 10);
    ctx.moveTo(-14, -3);
    ctx.lineTo(-24, -10 + sway * 0.3);
    ctx.quadraticCurveTo(-21, 0, -24, 10 + sway * 0.3);
    ctx.lineTo(-14, 3);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5, 13);
    ctx.quadraticCurveTo(4, 24, -1 - sway * 0.5, 34);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(7, -11);
    ctx.quadraticCurveTo(9, 0, 7, 11);
    ctx.moveTo(-4, -16);
    ctx.quadraticCurveTo(-2, 0, -4, 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },
  hit: (s, x, y) => near(s, x, y, 30, 40),
  scare(s, x, y) {
    s.flee = 0.9;
    s.away = fleeFrom(s, x, y);
  },
};

// A pufferfish pottering slowly. Clicked, it blows up into a spiky ball, hangs there, then slowly lets itself down.
const puffer: Kind = {
  box: 110,
  opacity: 0.3,
  init(s) {
    s.pulse = 0;
  },
  step(s, dt) {
    // Its pulse is how blown up it is.
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    s.pulse = s.flee > 5.5 ? s.pulse + (1 - s.pulse) * Math.min(1, dt * 8) : Math.min(s.pulse, s.flee / 5.5);
    if (Math.hypot(s.wx - s.x, s.wy - s.y) < 60) wander(s, 0.2);
    swim(s, Math.atan2(s.wy - s.y, s.wx - s.x), 0.8, 18 * (1 - s.pulse) + 3, dt);
    s.phase += (4 + s.flee) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.3);
    const p = s.pulse;
    const rx = 14 + 5 * p;
    const ry = 10 + 9 * p;
    const wag = Math.sin(s.phase * 2) * 2;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx + 1, 0);
    ctx.lineTo(-rx - 8, -5 + wag);
    ctx.lineTo(-rx - 6, 0);
    ctx.lineTo(-rx - 8, 5 + wag);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (p > 0.05) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + 0.1;
        ctx.moveTo(Math.cos(a) * rx, Math.sin(a) * ry);
        ctx.lineTo(Math.cos(a) * (rx + 6 * p), Math.sin(a) * (ry + 6 * p));
      }
    }
    // Pectoral fin, fanning
    ctx.moveTo(-1, 2);
    ctx.quadraticCurveTo(-7, 2 + Math.sin(s.phase * 3) * 3, -6, 7);
    ctx.moveTo(rx - 1, ry * 0.2);
    ctx.lineTo(rx + 1.5, ry * 0.2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-8 + i * 4, -ry * 0.55 + (i % 2) * 2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(rx * 0.5, -ry * 0.3, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rx * 0.5 + 0.6, -ry * 0.3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  },
  hit: (s, x, y) => near(s, x, y, 30, 26),
  scare(s) {
    s.flee = 7;
    s.away = s.heading;
  },
};

// An eel swimming in S-curves, a wave running from its head to its tail. Clicked, it whips off.
const eel: Kind = {
  box: 230,
  opacity: 0.26,
  step(s, dt) {
    cruise(s, dt, 0.3, 30, 0.6, 210, 5);
    s.phase += (3 + s.speed * 0.04) * dt;
  },
  paint(ctx, s) {
    ctx.rotate(s.heading);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 24; k++) {
      const f = k / 24;
      pts.push([70 - f * 150, Math.sin(s.phase - f * 7) * (2 + f * 9)]);
    }
    taper(ctx, pts, 6.5, 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = 4; k <= 24; k++) {
      const [x, y] = pts[k];
      if (k === 4) ctx.moveTo(x, y - 4.5 + k * 0.12);
      else ctx.lineTo(x, y - 4.5 + k * 0.12);
    }
    ctx.stroke();
    const [hx, hy] = pts[0];
    ctx.beginPath();
    ctx.ellipse(hx + 3, hy, 9, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(hx + 6, hy - 1.4, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy + 0.8);
    ctx.lineTo(hx + 5, hy + 1.3);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  },
  hit: (s, x, y) => near(s, x, y, 75, 45),
  scare(s, x, y) {
    s.flee = 1.5;
    s.away = fleeFrom(s, x, y);
  },
};

// A reef shark patrolling in long, level, unhurried passes. Clicked, it flicks its tail and turns away, then carries on.
const shark: Kind = {
  box: 200,
  opacity: 0.26,
  step(s, dt) {
    cruise(s, dt, 0.12, 45, 0.5, 150, 4);
    s.phase += (2.2 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.25);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(62, 2);
    ctx.bezierCurveTo(56, -8, 30, -13, 0, -12);
    ctx.bezierCurveTo(-24, -11, -40, -6, -50, -2);
    ctx.moveTo(-50, 2);
    ctx.bezierCurveTo(-38, 8, -10, 12, 12, 11);
    ctx.bezierCurveTo(34, 10, 52, 9, 62, 2);
    // Fins: dorsal, pectoral, and the small ones near the tail
    ctx.moveTo(10, -12);
    ctx.quadraticCurveTo(2, -26, -6, -32);
    ctx.quadraticCurveTo(-6, -20, -14, -11);
    ctx.moveTo(22, 10);
    ctx.quadraticCurveTo(14, 24, 2, 29);
    ctx.quadraticCurveTo(8, 18, 8, 11);
    ctx.moveTo(-32, -8);
    ctx.lineTo(-39, -14);
    ctx.lineTo(-39, -6);
    ctx.moveTo(-30, 8);
    ctx.lineTo(-37, 13);
    ctx.lineTo(-38, 6);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [36, 32, 28]) {
      ctx.moveTo(x, -4);
      ctx.quadraticCurveTo(x - 1.5, 1, x, 6);
    }
    ctx.moveTo(52, 7);
    ctx.quadraticCurveTo(46, 9, 40, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(47, -2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.translate(-50, 0);
    ctx.rotate(Math.sin(s.phase) * (s.flee > 0 ? 0.4 : 0.2));
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(-22, -24);
    ctx.quadraticCurveTo(-14, -6, -12, 0);
    ctx.lineTo(-16, 12);
    ctx.quadraticCurveTo(-6, 6, 0, 2);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 75, 35),
  scare(s, x, y) {
    s.flee = 1.2;
    s.away = fleeFrom(s, x, y);
  },
};

// A humpback whale, big and faint, very slow, low in the page. Clicked, it beats its flukes and slowly turns away.
const whale: Kind = {
  box: 420,
  opacity: 0.2,
  step(s, dt) {
    cruise(s, dt, 0.25, 14, 0.15, 40, 0.4);
    s.phase += (0.9 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.15);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(165, 4);
    ctx.bezierCurveTo(160, -18, 120, -30, 60, -32);
    ctx.bezierCurveTo(0, -34, -60, -26, -110, -12);
    ctx.bezierCurveTo(-130, -6, -140, -4, -150, -2);
    ctx.moveTo(-150, 4);
    ctx.bezierCurveTo(-120, 8, -60, 22, 0, 26);
    ctx.bezierCurveTo(60, 30, 120, 30, 150, 18);
    ctx.quadraticCurveTo(162, 12, 165, 4);
    ctx.moveTo(165, 4);
    ctx.quadraticCurveTo(140, 9, 112, 7);
    ctx.moveTo(-50, -29);
    ctx.quadraticCurveTo(-62, -38, -72, -25);
    ctx.stroke();
    // Grooves along the throat
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(146 - i * 6, 14 + i * 3);
      ctx.quadraticCurveTo(100 - i * 6, 22 + i * 2.5, 40 - i * 8, 24 + i * 1.5);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(112, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.save();
    ctx.translate(95, 20);
    ctx.rotate(Math.sin(s.phase * 0.7) * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, 20, -50, 40, -80, 52);
    ctx.bezierCurveTo(-60, 36, -30, 18, -10, 4);
    ctx.stroke();
    ctx.restore();
    ctx.translate(-150, 1);
    ctx.rotate(Math.sin(s.phase) * (s.flee > 0 ? 0.45 : 0.25));
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-18, -5, -36, -14);
    ctx.quadraticCurveTo(-30, 0, -36, 10);
    ctx.quadraticCurveTo(-18, 4, 0, 3);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 170, 50),
  scare(s, x, y) {
    s.flee = 4;
    s.away = fleeFrom(s, x, y);
  },
};

// An octopus moving in pulses, mantle first, its arms trailing and closing together on each push. Clicked, it
// squirts a cloud and jets away.
const octopus: Kind = {
  box: 240,
  opacity: 0.28,
  step(s, dt) {
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    s.phase += dt;
    s.pulse += dt / (s.flee > 0 ? 0.45 : 2.4);
    if (s.pulse >= 1) s.pulse -= 1;
    if (Math.hypot(s.wx - s.x, s.wy - s.y) < 70) wander(s, 0.25);
    if (s.flee > 0) glance(s);
    const want = s.flee > 0 ? s.away : Math.atan2(s.wy - s.y, s.wx - s.x);
    s.heading += clamp(angleTo(s.heading, want), -1, 1) * Math.min(1, dt * (s.flee > 0 ? 8 : 0.8));
    if (s.pulse < 0.3) {
      const push = s.flee > 0 ? 700 : 90;
      s.vx += Math.cos(s.heading) * push * dt;
      s.vy += Math.sin(s.heading) * push * dt;
    }
    const drag = Math.exp(-dt * 1.8);
    s.vx *= drag;
    s.vy *= drag;
    s.x = clamp(s.x + s.vx * dt, MARGIN, right());
    s.y = clamp(s.y + s.vy * dt, MARGIN, bottom());
  },
  paint(ctx, s) {
    // The cloud hangs where it was squirted, spreading and fading.
    if (s.flee > 0) {
      const age = 2 - s.flee;
      ctx.save();
      ctx.globalAlpha = (s.flee / 2) * 0.25;
      for (let i = 0; i < 7; i++) {
        const r = 8 + age * 14 * (1 + (i % 3) * 0.3);
        ctx.beginPath();
        ctx.arc(s.awayX - s.x + Math.cos(i * 1.7) * r * 0.6, s.awayY - s.y + Math.sin(i * 1.7) * r * 0.6, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.rotate(s.heading);
    const squeeze = s.pulse < 0.3 ? Math.sin((s.pulse / 0.3) * Math.PI) : 0;
    ctx.translate(20, 0);
    for (let i = 0; i < 8; i++) {
      const across = (i / 7 - 0.5) * 2;
      const arm: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const x = -6 - f * (56 + (i % 3) * 6) * (1 + 0.15 * squeeze);
        const y = across * 6 + across * (14 - 10 * squeeze) * f * 1.6 + Math.sin(s.phase * 3 - f * 5 + i) * f * 5;
        arm.push([x, y]);
      }
      taper(ctx, arm, 3.2, 0.6);
    }
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(8, 0, 20 * (1 - 0.12 * squeeze), 12 * (1 - 0.2 * squeeze), 0, 0, Math.PI * 2);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (const y of [-8, 8]) {
      ctx.beginPath();
      ctx.arc(-6, y, 2.6, 0, Math.PI * 2);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-6, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  hit: (s, x, y) => near(s, x, y, 60, 60),
  scare(s, x, y) {
    s.flee = 2;
    s.pulse = 0;
    s.away = fleeFrom(s, x, y);
    s.awayX = s.x;
    s.awayY = s.y;
  },
};

// A little swarm of krill drifting about. The ones near a click flick themselves backwards, tail first.
const krill: Kind = {
  box: 320,
  opacity: 0.3,
  init(s) {
    s.members = Array.from({ length: 8 }, () => {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(Math.random());
      return { x: s.x, y: s.y, vx: 0, vy: 0, ox: Math.cos(a) * r * 60, oy: Math.sin(a) * r * 40, phase: rand(0, 6) };
    });
  },
  step(s, dt) {
    if (Math.hypot(s.wx - s.x, s.wy - s.y) < 60) wander(s, 0.25);
    swim(s, Math.atan2(s.wy - s.y, s.wx - s.x), 0.5, 12, dt);
    s.phase += dt;
    for (const m of s.members) {
      const tx = s.x + m.ox + Math.sin(s.phase * 0.5 + m.phase) * 10;
      const ty = s.y + m.oy + Math.cos(s.phase * 0.6 + m.phase * 1.3) * 8;
      m.vx += ((tx - m.x) * 0.8 - m.vx * 2.5) * dt;
      m.vy += ((ty - m.y) * 0.8 - m.vy * 2.5) * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
  },
  paint(ctx, s) {
    const flip = (s.facing < 0 ? -1 : 1) * Math.max(0.08, Math.abs(s.facing));
    for (const m of s.members) {
      ctx.save();
      ctx.translate(m.x - s.x, m.y - s.y);
      ctx.scale(flip * 1.3, 1.3);
      ctx.rotate(Math.sin(s.phase + m.phase) * 0.15);
      taper(ctx, [[6, 0], [3, -1.8], [0, -2], [-3, -1.4], [-6, 0], [-7.5, 2.5]], 2.6, 0.9);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-7.5, 2.5);
      ctx.lineTo(-10.5, 3);
      ctx.moveTo(-7.5, 2.5);
      ctx.lineTo(-9, 5.5);
      ctx.moveTo(6, -0.5);
      ctx.quadraticCurveTo(10, -4, 15, -3 + Math.sin(s.phase * 2 + m.phase));
      ctx.moveTo(6, 0);
      ctx.quadraticCurveTo(10, -1, 14, 1.5);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) {
        const x = 3 - i * 2.2;
        ctx.moveTo(x, -0.5);
        ctx.lineTo(x - 0.8 + Math.sin(s.phase * 12 + m.phase + i) * 0.8, 2.6);
      }
      ctx.stroke();
      ctx.restore();
    }
  },
  hit: (s, x, y) => s.members.some((m) => Math.hypot(m.x - x, m.y - y) < 24),
  scare(s, x, y) {
    const back = s.facing < 0 ? 1 : -1;
    for (const m of s.members) {
      if (Math.hypot(m.x - x, m.y - y) > 90) continue;
      m.vx += back * rand(180, 240);
      m.vy += rand(-40, 40);
    }
  },
};

// An anglerfish hanging just above the seabed, its lure glowing softly. Clicked, it snaps forwards and the light goes
// out, coming back slowly.
const angler: Kind = {
  box: 200,
  opacity: 0.32,
  step(s, dt) {
    if (s.flee > 0) s.flee = Math.max(0, s.flee - dt);
    // Its tilt is how dark the lure has gone.
    s.tilt = Math.max(0, s.tilt - dt * 0.3);
    s.phase += dt;
    s.rest -= dt;
    if (s.rest <= 0) {
      s.rest = rand(5, 10);
      s.wx = clamp(s.x + rand(-180, 180), MARGIN, right());
      s.wy = clamp(s.home + rand(-50, 50), MARGIN, bottom());
    }
    const tx = clamp((s.wx - s.x) * 0.3, -9, 9);
    const ty = clamp((s.wy - s.y) * 0.3, -6, 6) + Math.sin(s.phase * 0.8) * 3;
    s.vx += (tx - s.vx) * Math.min(1, dt * 2);
    s.vy += (ty - s.vy) * Math.min(1, dt * 2);
    s.x = clamp(s.x + s.vx * dt, MARGIN, right());
    s.y = clamp(s.y + s.vy * dt, MARGIN, bottom());
    if (Math.abs(s.vx) > 1.5) s.facing += (Math.sign(s.vx) - s.facing) * Math.min(1, dt);
  },
  paint(ctx, s) {
    ctx.scale((s.facing < 0 ? -1 : 1) * Math.max(0.08, Math.abs(s.facing)) * 1.15, 1.15);
    const lx = 30 + Math.sin(s.phase * 1.1) * 3;
    const ly = -40 + Math.cos(s.phase * 0.9) * 3;
    const glow = (1 - s.tilt) * (0.7 + 0.3 * Math.sin(s.phase * 2.2));
    const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22);
    halo.addColorStop(0, `rgba(243, 242, 238, ${0.6 * glow})`);
    halo.addColorStop(1, 'rgba(243, 242, 238, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lx, ly, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.35 + 0.65 * glow;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, -22);
    ctx.quadraticCurveTo(12, -46, lx, ly);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(24, -2);
    ctx.bezierCurveTo(22, -24, -8, -30, -22, -14);
    ctx.bezierCurveTo(-28, -8, -32, -3, -36, -1);
    ctx.lineTo(-50, -9);
    ctx.quadraticCurveTo(-46, 0.5, -50, 10);
    ctx.lineTo(-36, 2);
    ctx.bezierCurveTo(-28, 12, -12, 20, 2, 16);
    ctx.moveTo(24, -2);
    ctx.lineTo(0, 6);
    ctx.moveTo(-10, 8);
    ctx.quadraticCurveTo(-18, 13 + Math.sin(s.phase * 2) * 2, -15, 19);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const x = 24 - i * 5;
      const y = -2 + i * (8 / 4.8);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 0.5, y + 3.5);
    }
    ctx.arc(6, -12, 2.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6.5, -12, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // The lower jaw, hinged at the back of the mouth, drops open for a moment when it snaps.
    const open = 0.15 + (s.flee > 0 ? Math.sin((1 - s.flee / 0.7) * Math.PI) * 0.85 : 0);
    ctx.translate(0, 6);
    ctx.rotate(open * 0.6);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28, -4);
    ctx.quadraticCurveTo(18, 10, 2, 10);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 5; i++) {
      const x = i * 4.8;
      const y = -x / 7;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.5, y - 4);
    }
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 55, 50, -8),
  scare(s) {
    s.flee = 0.7;
    s.tilt = 1;
    s.vx = (s.facing < 0 ? -1 : 1) * 150;
  },
};

// A pod of three dolphins swimming fast in a loose line, each rising and dipping on its own beat as if porpoising.
// Clicked, the pod puts on a burst of speed and veers off.
const POD: [number, number][] = [[40, -26], [-4, 22], [-52, -4]];
const dolphins: Kind = {
  box: 320,
  opacity: 0.26,
  init(s) {
    s.members = POD.map(([ox, oy], i) => ({ x: 0, y: 0, vx: 0, vy: 0, ox, oy, phase: i * 2.1 }));
  },
  step(s, dt) {
    cruise(s, dt, 0.35, 115, 1, 420, 6);
    s.phase += (2 + s.speed * 0.012) * dt;
  },
  paint(ctx, s) {
    const dir = s.facing < 0 ? -1 : 1;
    for (const m of s.members) {
      const beat = s.phase * 0.6 + m.phase;
      ctx.save();
      ctx.translate(m.ox * dir, m.oy + Math.sin(beat) * 12);
      side(ctx, s, 0.3);
      ctx.rotate(-Math.cos(beat) * 0.28);
      dolphin(ctx, s.phase * 2.2 + m.phase);
      ctx.restore();
    }
  },
  hit: (s, x, y) => s.members.some((m) => near(s, x, y, 40, 22, m.oy) && Math.abs(x - s.x - m.ox * (s.facing < 0 ? -1 : 1)) < 40),
  scare(s, x, y) {
    s.flee = 1.4;
    s.away = fleeFrom(s, x, y);
  },
};

function dolphin(ctx: CanvasRenderingContext2D, beat: number) {
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(38, 2);
  ctx.quadraticCurveTo(32, -1, 25, -3);
  ctx.bezierCurveTo(19, -11, 0, -11, -14, -8);
  ctx.bezierCurveTo(-24, -6, -30, -3, -34, -1);
  ctx.moveTo(-34, 1);
  ctx.bezierCurveTo(-24, 5, -6, 9, 8, 8);
  ctx.bezierCurveTo(20, 7, 30, 5, 38, 2);
  ctx.moveTo(38, 2);
  ctx.lineTo(27, 3);
  // Dorsal and side fins
  ctx.moveTo(2, -10.5);
  ctx.quadraticCurveTo(-3, -19, -12, -21);
  ctx.quadraticCurveTo(-9, -14, -11, -9);
  ctx.moveTo(13, 6);
  ctx.quadraticCurveTo(9, 13, 2, 16);
  ctx.quadraticCurveTo(4, 10, 5, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, -2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Flukes beat up and down.
  ctx.translate(-34, 0);
  ctx.rotate(Math.sin(beat) * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.quadraticCurveTo(-8, -3, -14, -9);
  ctx.quadraticCurveTo(-11, 0, -14, 8);
  ctx.quadraticCurveTo(-8, 3, 0, 1);
  ctx.stroke();
}

// An orca: rounded, heavy, with its tall dorsal fin and the pale patches behind the eye and along the belly.
// Cruises steadily; clicked, it turns hard and powers away.
const orca: Kind = {
  box: 300,
  opacity: 0.24,
  step(s, dt) {
    cruise(s, dt, 0.2, 52, 0.55, 230, 4);
    s.phase += (1.6 + s.speed * 0.025) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.22);
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(78, 2);
    ctx.bezierCurveTo(76, -14, 52, -22, 20, -22);
    ctx.bezierCurveTo(-20, -22, -50, -12, -68, -3);
    ctx.moveTo(-68, 3);
    ctx.bezierCurveTo(-50, 10, -20, 20, 10, 20);
    ctx.bezierCurveTo(44, 20, 72, 14, 78, 2);
    ctx.moveTo(78, 2);
    ctx.quadraticCurveTo(66, 6, 54, 5);
    ctx.moveTo(14, -21);
    ctx.quadraticCurveTo(7, -40, -1, -62);
    ctx.quadraticCurveTo(-5, -38, -16, -20);
    ctx.stroke();
    // Pale patches
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(40, -9, 10, 3.6, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(70, 8);
    ctx.quadraticCurveTo(40, 18, 8, 16);
    ctx.quadraticCurveTo(-14, 15, -28, 7);
    ctx.quadraticCurveTo(-6, 9, 18, 9);
    ctx.quadraticCurveTo(48, 9, 70, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-12, -17, 13, 3.4, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(55, -3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(38, 15);
    ctx.rotate(Math.sin(s.phase * 0.8) * 0.15);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(4, 14, -8, 20);
    ctx.quadraticCurveTo(-14, 12, -8, 2);
    ctx.stroke();
    ctx.restore();
    ctx.translate(-68, 0);
    ctx.rotate(Math.sin(s.phase) * (s.flee > 0 ? 0.42 : 0.24));
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-12, -6, -26, -15);
    ctx.quadraticCurveTo(-21, 0, -26, 12);
    ctx.quadraticCurveTo(-12, 4, 0, 3);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 85, 40),
  scare(s, x, y) {
    s.flee = 1.6;
    s.away = fleeFrom(s, x, y);
  },
};

// A sperm whale, the box-headed deep diver: slow, enormous and wrinkled, it ranges further up and down the page than
// anything else. Clicked, it slowly beats away.
const sperm: Kind = {
  box: 380,
  opacity: 0.18,
  step(s, dt) {
    cruise(s, dt, 0.45, 16, 0.18, 45, 0.45);
    s.phase += (0.8 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.3);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(126, 16);
    ctx.bezierCurveTo(134, 8, 134, -22, 118, -27);
    ctx.bezierCurveTo(90, -32, 30, -29, -20, -22);
    // The knuckles along the back where a dorsal fin would be
    for (let k = 0; k < 5; k++) ctx.quadraticCurveTo(-28 - k * 14, -26 + k * 2.6, -34 - k * 14, -20 + k * 2.6);
    ctx.bezierCurveTo(-100, -8, -110, -4, -120, -2);
    ctx.moveTo(-120, 3);
    ctx.bezierCurveTo(-90, 10, -40, 22, 10, 24);
    ctx.bezierCurveTo(60, 26, 100, 24, 126, 16);
    // The narrow lower jaw tucked under the head
    ctx.moveTo(122, 17);
    ctx.quadraticCurveTo(96, 27, 62, 24);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const x = 10 - k * 15;
      ctx.moveTo(x, -18 + k * 1.5);
      ctx.quadraticCurveTo(x - 3, -6, x + 1, 6 - k);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(76, 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(60, 20);
    ctx.quadraticCurveTo(54, 32, 42, 36);
    ctx.quadraticCurveTo(46, 28, 46, 22);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.translate(-120, 0);
    ctx.rotate(Math.sin(s.phase) * (s.flee > 0 ? 0.45 : 0.25));
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-16, -5, -34, -16);
    ctx.quadraticCurveTo(-28, 0, -34, 13);
    ctx.quadraticCurveTo(-16, 4, 0, 3);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 140, 45),
  scare(s, x, y) {
    s.flee = 4;
    s.away = fleeFrom(s, x, y);
  },
};

// A sea lion: quick and playful, now and then it throws a full loop, rolling over as it goes. Clicked, it darts off.
const sealion: Kind = {
  box: 180,
  opacity: 0.28,
  step(s, dt) {
    if (s.rest > 0) {
      // Mid-loop: keep turning the same way until it's gone all the way round.
      s.rest = Math.max(0, s.rest - dt);
      s.heading += s.tilt * 4 * dt;
      s.speed += (150 - s.speed) * Math.min(1, dt * 3);
      s.x = clamp(s.x + Math.cos(s.heading) * s.speed * dt, -MARGIN, innerWidth + MARGIN);
      s.y = clamp(s.y + Math.sin(s.heading) * s.speed * dt, MARGIN, bottom());
      s.facing += (Math.cos(s.heading) - s.facing) * Math.min(1, dt * 6);
      if (s.rest === 0) s.pulse = rand(4, 10);
    } else {
      cruise(s, dt, 0.25, 85, 1.4, 360, 7);
      s.pulse -= dt;
      if (s.pulse <= 0 && s.flee === 0) {
        s.rest = (Math.PI * 2) / 4;
        s.tilt = Math.random() < 0.5 ? -1 : 1;
      }
    }
    s.phase += (3 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    ctx.rotate(s.heading);
    // Rolls over through the loop rather than flipping.
    ctx.scale(1, (s.facing < 0 ? -1 : 1) * Math.max(0.1, Math.abs(s.facing)));
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(42, 1);
    ctx.bezierCurveTo(41, -6, 31, -9, 21, -8);
    ctx.bezierCurveTo(4, -10, -16, -8, -30, -3);
    ctx.quadraticCurveTo(-36, -1, -40, 0);
    ctx.quadraticCurveTo(-36, 2, -30, 4);
    ctx.bezierCurveTo(-14, 9, 6, 10, 20, 8);
    ctx.bezierCurveTo(31, 7, 39, 5, 42, 1);
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const a of [-0.1, 0.15, 0.4]) {
      ctx.moveTo(38, 3);
      ctx.lineTo(38 + Math.cos(a) * 9, 3 + Math.sin(a) * 9);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, -3, 1.4, 0, Math.PI * 2);
    ctx.arc(41.5, 0.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.save();
    ctx.translate(16, 7);
    ctx.rotate(0.5 + Math.sin(s.phase) * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, 12, -20, 16);
    ctx.quadraticCurveTo(-10, 8, -4, 1);
    ctx.stroke();
    ctx.restore();
    ctx.translate(-40, 0);
    ctx.rotate(Math.sin(s.phase * 0.8) * 0.25);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-13, -6);
    ctx.quadraticCurveTo(-9, 0, -13, 6);
    ctx.closePath();
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 46, 30),
  scare(s, x, y) {
    s.rest = 0;
    s.pulse = rand(4, 10);
    s.flee = 1;
    s.away = fleeFrom(s, x, y);
  },
};

// The outline either side of a spine, for bodies seen from above: w gives the half-width at each point.
function outline(ctx: CanvasRenderingContext2D, pts: [number, number][], w: (f: number) => number) {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)];
    const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / d;
    const ny = (bx - ax) / d;
    const h = w(i / (pts.length - 1));
    left.push([x + nx * h, y + ny * h]);
    right.push([x - nx * h, y - ny * h]);
  });
  ctx.beginPath();
  ctx.moveTo(...left[0]);
  for (const q of left) ctx.lineTo(...q);
  for (const q of right.reverse()) ctx.lineTo(...q);
  ctx.closePath();
  ctx.stroke();
}

// A hammerhead seen from above, its head a wide crossbar swinging side to side as it sweeps for prey. Clicked, it
// whips round and away.
const hammerhead: Kind = {
  box: 260,
  opacity: 0.24,
  step(s, dt) {
    cruise(s, dt, 0.15, 48, 0.6, 200, 5);
    s.phase += (2.4 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    ctx.rotate(s.heading);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 22; k++) {
      const f = k / 22;
      pts.push([48 - f * 128, Math.sin(s.phase - f * 4) * (1.5 + f * 9)]);
    }
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    outline(ctx, pts, (f) => (f < 0.3 ? 4 + f * 20 : Math.max(0.8, 10 * (1 - (f - 0.3) / 0.75))));
    const [hx, hy] = pts[0];
    const turn = Math.atan2(pts[0][1] - pts[2][1], pts[0][0] - pts[2][0]);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(turn);
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-1, -22);
    ctx.quadraticCurveTo(4, -24, 6, -20);
    ctx.quadraticCurveTo(10, 0, 6, 20);
    ctx.quadraticCurveTo(4, 24, -1, 22);
    ctx.lineTo(-2, 4);
    ctx.stroke();
    for (const y of [-21, 21]) {
      ctx.beginPath();
      ctx.arc(2, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Pectoral fins swept back, and the dorsal fin seen edge-on along the spine
    const [px, py] = pts[6];
    ctx.beginPath();
    ctx.moveTo(px + 2, py - 8);
    ctx.lineTo(px - 14, py - 24);
    ctx.lineTo(px - 10, py - 9);
    ctx.moveTo(px + 2, py + 8);
    ctx.lineTo(px - 14, py + 24);
    ctx.lineTo(px - 10, py + 9);
    ctx.moveTo(...pts[7]);
    ctx.lineTo(...pts[10]);
    ctx.stroke();
    const [tx, ty] = pts[22];
    ctx.beginPath();
    ctx.moveTo(...pts[20]);
    ctx.lineTo(tx - 8, ty + Math.sin(s.phase) * 3);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 70, 45),
  scare(s, x, y) {
    s.flee = 1.3;
    s.away = fleeFrom(s, x, y);
  },
};

// A whale shark, the biggest fish of all: broad flat head, spotted back, ridges along its sides. It barely seems to
// move, and when clicked it simply turns aside.
const SPOTS: [number, number][] = [];
for (let i = 0; i < 90; i++) {
  const x = 104 - (i % 18) * 12 + (Math.floor(i / 18) % 2) * 6;
  const y = -20 + Math.floor(i / 18) * 8.5;
  if (Math.abs(y + 2) < 21 * (1 - ((x - 10) / 125) ** 2)) SPOTS.push([x, y]);
}
const whaleShark: Kind = {
  box: 360,
  opacity: 0.2,
  step(s, dt) {
    cruise(s, dt, 0.15, 18, 0.2, 55, 0.6);
    s.phase += (1 + s.speed * 0.03) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.15);
    ctx.lineWidth = 1.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(131, 0);
    ctx.bezierCurveTo(130, -16, 110, -24, 70, -26);
    ctx.bezierCurveTo(10, -28, -50, -20, -95, -8);
    ctx.quadraticCurveTo(-105, -5, -112, -3);
    ctx.moveTo(-112, 3);
    ctx.quadraticCurveTo(-100, 6, -90, 8);
    ctx.bezierCurveTo(-40, 18, 20, 24, 70, 22);
    ctx.bezierCurveTo(105, 20, 128, 12, 131, 0);
    ctx.moveTo(131, 1);
    ctx.quadraticCurveTo(122, 6, 110, 5);
    // Dorsal and pectoral fins
    ctx.moveTo(-18, -25);
    ctx.quadraticCurveTo(-28, -44, -44, -50);
    ctx.quadraticCurveTo(-42, -34, -48, -21);
    ctx.moveTo(60, 20);
    ctx.quadraticCurveTo(48, 36, 30, 44);
    ctx.quadraticCurveTo(36, 30, 40, 21);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const x = 94 - k * 5;
      ctx.moveTo(x, -10);
      ctx.quadraticCurveTo(x - 3, 2, x, 14);
    }
    ctx.moveTo(74, -19);
    ctx.bezierCurveTo(20, -20, -40, -14, -92, -4);
    ctx.moveTo(74, -8);
    ctx.bezierCurveTo(20, -8, -40, -4, -96, 1);
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (const [x, y] of SPOTS) {
      ctx.moveTo(x + 1.3, y);
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(112, -5, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.translate(-112, 0);
    ctx.rotate(Math.sin(s.phase) * (s.flee > 0 ? 0.3 : 0.16));
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-30, -40);
    ctx.quadraticCurveTo(-22, -10, -20, 0);
    ctx.lineTo(-28, 26);
    ctx.quadraticCurveTo(-12, 12, 0, 3);
    ctx.stroke();
  },
  hit: (s, x, y) => near(s, x, y, 140, 45),
  scare(s, x, y) {
    s.flee = 3;
    s.away = fleeFrom(s, x, y);
  },
};

// An ocean sunfish: a great flat disc with a fin above and below that it sculls with in turn, drifting slowly and
// rocking as it goes. Clicked, it flaps a little faster and wobbles away.
const sunfish: Kind = {
  box: 220,
  opacity: 0.24,
  step(s, dt) {
    cruise(s, dt, 0.2, 14, 0.4, 70, 2);
    s.phase += (2 + s.speed * 0.05) * dt;
  },
  paint(ctx, s) {
    side(ctx, s, 0.2);
    ctx.rotate(Math.sin(s.phase * 0.5) * 0.08);
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    for (const up of [-1, 1]) {
      ctx.save();
      ctx.translate(-10, up * 30);
      ctx.rotate(Math.sin(s.phase + (up > 0 ? Math.PI : 0)) * 0.35);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.quadraticCurveTo(4, up * 30, -10, up * 48);
      ctx.quadraticCurveTo(-12, up * 22, -14, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.bezierCurveTo(38, -28, 12, -38, -12, -36);
    ctx.quadraticCurveTo(-24, -34, -28, -26);
    // The scalloped back edge in place of a tail
    for (let k = 0; k < 6; k++) ctx.quadraticCurveTo(-36, -22 + k * 9, -29, -17 + k * 9);
    ctx.quadraticCurveTo(-24, 34, -12, 36);
    ctx.bezierCurveTo(12, 38, 38, 28, 38, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(24, -7, 3.2, 0, Math.PI * 2);
    ctx.moveTo(39, 2);
    ctx.arc(37.5, 2, 1.5, 0, Math.PI * 2);
    ctx.moveTo(16, 3);
    ctx.quadraticCurveTo(8, 6 + Math.sin(s.phase * 2) * 2, 6, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(24.5, -7, 1.3, 0, Math.PI * 2);
    ctx.fill();
  },
  hit: (s, x, y) => near(s, x, y, 50, 60),
  scare(s, x, y) {
    s.flee = 2;
    s.away = fleeFrom(s, x, y);
  },
};

// A scuba diver exploring: kicking slowly along, now and then heading off to a new depth so over time they work their
// way all over the page. Every few seconds they breathe out a stream of bubbles that wobble up and away. Clicked, they
// don't flee: they stop to wave, with a gasp of extra bubbles. The bubbles live in members, in page coordinates.
const diver: Kind = {
  box: 340,
  opacity: 0.3,
  step(s, dt) {
    s.rest = Math.max(0, s.rest - dt);
    if (Math.hypot(s.wx - s.x, s.wy - s.y) < 90) {
      if (Math.random() < 0.35) s.home = clamp(s.home + rand(-0.9, 0.9) * innerHeight, MARGIN * 2, bottom() - MARGIN);
      wander(s, 0.35);
    }
    swim(s, Math.atan2(s.wy - s.y, s.wx - s.x), 0.45, s.rest > 0 ? 3 : 26, dt);
    s.phase += (s.rest > 0 ? 2 : 3 + s.speed * 0.05) * dt;
    s.pulse += dt;
    const out = (n: number) => {
      for (let i = 0; i < n; i++) {
        s.members.push({ x: s.x + s.facing * 72 + rand(-2, 2), y: s.y - 2 + rand(-2, 2), vx: rand(-8, 8), vy: rand(-75, -50), ox: -i * 0.09, oy: rand(1.2, 3), phase: rand(0, 6) });
      }
    };
    if (s.pulse > 4) {
      s.pulse = rand(0, 0.8);
      out(Math.round(rand(5, 8)));
    }
    for (let i = s.members.length - 1; i >= 0; i--) {
      const b = s.members[i];
      b.ox += dt;
      if (b.ox < 0) continue;
      b.phase += dt * 7;
      b.x += (b.vx + Math.sin(b.phase) * 10) * dt;
      b.y += b.vy * dt;
      b.vy -= 12 * dt;
      if (b.ox > 2.4 || b.y < s.y - diver.box / 2 + 10) s.members.splice(i, 1);
    }
    if (s.tilt > 0) {
      out(10);
      s.tilt = 0;
    }
  },
  paint(ctx, s) {
    ctx.lineWidth = 1;
    for (const b of s.members) {
      if (b.ox < 0) continue;
      ctx.globalAlpha = Math.min(1, 2.4 - b.ox);
      ctx.beginPath();
      ctx.arc(b.x - s.x, b.y - s.y, b.oy * (1 + b.ox * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    side(ctx, s, 0.35);
    ctx.scale(1.45, 1.45);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Legs, kicking in turn with a small scissor, the far one fainter, and long fins that bend with each stroke
    for (const [k, far] of [[-Math.sin(s.phase), true], [Math.sin(s.phase), false]] as const) {
      ctx.globalAlpha = far ? 0.5 : 1;
      const knee: [number, number] = [-25, 2 + k * 3];
      const ankle: [number, number] = [-44, 2 + k * 7];
      taper(ctx, [[-4, 2], knee, ankle], 6.5, 4);
      const bend = k * 0.4;
      ctx.save();
      ctx.translate(...ankle);
      ctx.rotate(0.1 + bend);
      ctx.beginPath();
      ctx.moveTo(1, -2);
      ctx.quadraticCurveTo(-12, -3 - bend * 6, -26, -4.5);
      ctx.lineTo(-25, 4.5);
      ctx.quadraticCurveTo(-12, 3 - bend * 6, 1, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Torso, with the tank on the back and the hose to the mouth
    taper(ctx, [[-6, 1], [4, 0], [20, -1], [36, -2]], 12, 11);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-2, -15, 32, 7, 3.5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, -12);
    ctx.quadraticCurveTo(40, -16, 46, -8);
    ctx.quadraticCurveTo(50, -2, 50, 1);
    ctx.stroke();
    // Head and mask
    ctx.beginPath();
    ctx.arc(44, -4, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(47, -9, 5, 5, 1.5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    // Arms: tucked in under the chest, or one raised in a wave
    taper(ctx, [[32, 1], [26, 9], [36, 10]], 4.5, 3.5);
    if (s.rest > 0) {
      const wave = Math.sin(s.phase * 6) * 0.5;
      taper(ctx, [[34, -1], [44 + wave * 4, -14], [50 + wave * 10, -26]], 4.5, 3.5);
      ctx.beginPath();
      ctx.arc(50 + wave * 10, -28, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else taper(ctx, [[34, 0], [28, 8], [38, 8]], 4.5, 3.5);
  },
  hit: (s, x, y) => near(s, x, y, 95, 40),
  scare(s) {
    s.rest = 2.4;
    s.tilt = 1;
  },
};

// Specks drifting down through the water, on one canvas over the screen. They wrap round a band the height of the
// screen and shift at slightly different rates as the page scrolls, which gives the water depth without needing a
// canvas per speck. They thicken towards the bottom of the page.
function plankton(sea: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sea-creature';
  Object.assign(canvas.style, { position: 'fixed', opacity: '0.3', willChange: 'auto' });
  sea.append(canvas);
  const ctx = canvas.getContext('2d')!;
  let specks: { x: number; y: number; r: number; a: number; v: number; k: number; s: number }[] = [];
  const size = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    Object.assign(canvas.style, { width: `${innerWidth}px`, height: `${innerHeight}px` });
    specks = Array.from({ length: Math.round((innerWidth * innerHeight) / 7000) }, () => ({
      x: rand(0, innerWidth),
      y: rand(0, innerHeight + 20),
      r: rand(0.7, 1.9),
      a: rand(0.3, 1),
      v: rand(3, 10),
      k: rand(0.75, 1),
      s: rand(0, 6),
    }));
  };
  size();
  addEventListener('resize', size);
  return (t: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = INK;
    const deep = 0.5 + 0.5 * clamp(scrollY / Math.max(1, pageHeight - innerHeight), 0, 1);
    for (const p of specks) {
      ctx.globalAlpha = p.a * deep;
      ctx.fillRect(p.x + Math.sin(t * 0.4 + p.s) * 6, mod(p.y + t * p.v - scrollY * p.k, innerHeight + 20) - 10, p.r, p.r);
    }
  };
}

// Clicking the same spot again and again shakes out a pinch of food. The pellets sink and sway, and the creatures
// nearby leave off what they were doing to come and nibble them. Jellyfish and krill drift on regardless.
const FEED_RADIUS = 380;
const FEED_MAX = 8;
interface Pellet {
  x: number;
  y: number;
  vx: number;
  r: number;
  age: number;
  life: number;
  s: number;
  eaten: number;
}
function feeder(sea: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sea-creature';
  Object.assign(canvas.style, { position: 'fixed', willChange: 'auto' });
  sea.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const size = () => {
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    Object.assign(canvas.style, { width: `${innerWidth}px`, height: `${innerHeight}px` });
  };
  size();
  addEventListener('resize', size);
  const pellets: Pellet[] = [];
  const drop = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      pellets.push({ x: x + rand(-6, 6), y: y + rand(-4, 4), vx: rand(-22, 22), r: rand(1.3, 2.3), age: 0, life: rand(11, 15), s: rand(0, 6), eaten: 0 });
    }
    if (pellets.length > 48) pellets.splice(0, pellets.length - 48);
  };
  const step = (dt: number) => {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      p.age += dt;
      if (p.eaten) p.eaten += dt;
      // A quick scatter outwards as they leave the fingers, then a slow sway down through the water.
      p.vx *= Math.exp(-dt * 3);
      p.x += (p.vx + Math.sin(p.age * 1.3 + p.s) * 7) * dt;
      p.y += (14 + 20 * Math.exp(-p.age * 2)) * dt;
      if (p.age > p.life || p.eaten > 0.45 || p.y > bottom()) pellets.splice(i, 1);
    }
  };
  const paint = () => {
    ctx.setTransform(ratio, 0, 0, ratio, 0, -scrollY * ratio);
    ctx.clearRect(0, scrollY, innerWidth, innerHeight);
    for (const p of pellets) {
      if (p.y < scrollY - 20 || p.y > scrollY + innerHeight + 20) continue;
      if (p.eaten) {
        // A little ring where it was taken.
        const k = p.eaten / 0.45;
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 + k * 10, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = 0.85 * Math.min(1, p.age * 6, (p.life - p.age) / 2);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      glow.addColorStop(0, 'rgba(255, 226, 160, 0.35)');
      glow.addColorStop(1, 'rgba(255, 226, 160, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4dca6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  // The nearest uneaten pellet in reach of a creature, if any.
  const nearest = (x: number, y: number) => {
    let best: Pellet | null = null;
    let d = FEED_RADIUS;
    for (const p of pellets) {
      if (p.eaten) continue;
      const e = Math.hypot(p.x - x, p.y - y);
      if (e < d) {
        d = e;
        best = p;
      }
    }
    return best;
  };
  return { drop, step, paint, nearest, any: () => pellets.length > 0 };
}

// Who lives here, and how far down the page each one keeps to, zoned like a real ocean: reef fish, seahorses and the
// turtle in the sunlit water at the top, rays, sharks and eels in open water, the whale and jellyfish deeper down, and
// deep-sea things just above the seabed. A negative depth is pixels up from the bottom of the page, so those keep to
// the seabed however long the page is. The big fish starts wherever you're looking.
const small = school(7, 0.9);
const middling = school(11, 1);
const big = school(16, 1.05);
const CAST: { id: string; kind: Kind; depth: number | null }[] = [
  { id: 'fish', kind: fish, depth: null },
  { id: 'darter-1', kind: darter, depth: 0.055 },
  { id: 'school-1', kind: small, depth: 0.065 },
  { id: 'angel-1', kind: angel, depth: 0.09 },
  { id: 'dolphins-1', kind: dolphins, depth: 0.1 },
  { id: 'school-2', kind: big, depth: 0.12 },
  { id: 'seahorse-1', kind: seahorse, depth: 0.15 },
  { id: 'sealion', kind: sealion, depth: 0.17 },
  { id: 'puffer-1', kind: puffer, depth: 0.18 },
  { id: 'darter-2', kind: darter, depth: 0.2 },
  { id: 'angel-2', kind: angel, depth: 0.22 },
  { id: 'diver-1', kind: diver, depth: 0.2 },
  { id: 'turtle', kind: turtle, depth: 0.25 },
  { id: 'school-3', kind: middling, depth: 0.28 },
  { id: 'shark-2', kind: shark, depth: 0.31 },
  { id: 'seahorse-2', kind: seahorse, depth: 0.3 },
  { id: 'krill-1', kind: krill, depth: 0.33 },
  { id: 'puffer-2', kind: puffer, depth: 0.355 },
  { id: 'dolphins-2', kind: dolphins, depth: 0.37 },
  { id: 'sunfish', kind: sunfish, depth: 0.4 },
  { id: 'ray', kind: ray, depth: 0.39 },
  { id: 'darter-3', kind: darter, depth: 0.41 },
  { id: 'orca', kind: orca, depth: 0.43 },
  { id: 'school-4', kind: big, depth: 0.44 },
  { id: 'hammerhead-1', kind: hammerhead, depth: 0.48 },
  { id: 'eel-1', kind: eel, depth: 0.47 },
  { id: 'shark', kind: shark, depth: 0.5 },
  { id: 'whale-shark', kind: whaleShark, depth: 0.52 },
  { id: 'diver-2', kind: diver, depth: 0.55 },
  { id: 'octopus-1', kind: octopus, depth: 0.53 },
  { id: 'school-5', kind: middling, depth: 0.56 },
  { id: 'darter-4', kind: darter, depth: 0.585 },
  { id: 'eel-2', kind: eel, depth: 0.61 },
  { id: 'ray-2', kind: ray, depth: 0.635 },
  { id: 'hammerhead-2', kind: hammerhead, depth: 0.65 },
  { id: 'jelly-1', kind: jelly, depth: 0.66 },
  { id: 'whale', kind: whale, depth: 0.7 },
  { id: 'school-6', kind: small, depth: 0.735 },
  { id: 'whale-2', kind: whale, depth: 0.745 },
  { id: 'jelly-2', kind: jelly, depth: 0.76 },
  { id: 'krill-2', kind: krill, depth: 0.79 },
  { id: 'sperm-whale', kind: sperm, depth: 0.8 },
  { id: 'jelly-3', kind: jelly, depth: 0.82 },
  { id: 'jelly-4', kind: jelly, depth: 0.86 },
  { id: 'school-7', kind: small, depth: 0.89 },
  { id: 'octopus-2', kind: octopus, depth: -700 },
  { id: 'angler', kind: angler, depth: -450 },
  { id: 'krill-3', kind: krill, depth: -560 },
];

function spawn(kind: Kind, depth: number | null): State {
  const y = depth === null ? scrollY + rand(0.25, 0.75) * innerHeight : clamp(depth < 0 ? pageHeight + depth : depth * pageHeight, MARGIN, bottom());
  const toRight = Math.random() < 0.5;
  const s: State = {
    x: rand(MARGIN, right()),
    y,
    heading: toRight ? 0 : Math.PI,
    speed: 0,
    facing: toRight ? 1 : -1,
    phase: rand(0, 6),
    home: y,
    flee: 0,
    away: 0,
    awayX: 0,
    awayY: 0,
    travel: false,
    wx: 0,
    wy: 0,
    vx: 0,
    vy: 0,
    tilt: 0,
    pulse: Math.random(),
    rest: rand(1, 5),
    members: [],
  };
  wander(s, 0.3);
  kind.init?.(s);
  return s;
}

async function ocean() {
  try {
    localStorage.removeItem('fish');
  } catch {}
  // The home page grows once its pinned sections are set up, so wait for that before measuring.
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // The creatures live in a layer the size of the page that clips them, so one swimming along the bottom can't make
  // the page taller. The page's own height is the body's, which they're outside of.
  const sea = document.createElement('div');
  sea.setAttribute('aria-hidden', 'true');
  Object.assign(sea.style, { position: 'absolute', left: '0', top: '0', width: '100%', overflow: 'hidden', pointerEvents: 'none' });
  document.body.append(sea);
  const measure = () => {
    pageHeight = document.body.offsetHeight;
    sea.style.height = `${pageHeight}px`;
  };
  measure();
  const snow = plankton(sea);
  const food = feeder(sea);

  let saved: { at: number; states: Record<string, State> } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {}
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const cast = CAST.map(({ id, kind, depth }) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'sea-creature';
    canvas.width = canvas.height = Math.round(kind.box * ratio);
    Object.assign(canvas.style, { width: `${kind.box}px`, height: `${kind.box}px`, margin: `${-kind.box / 2}px 0 0 ${-kind.box / 2}px`, opacity: kind.opacity });
    sea.append(canvas);
    let s = saved?.states[id];
    if (s) {
      s.x = clamp(s.x, MARGIN, right());
      s.y = clamp(s.y, MARGIN, bottom());
      s.flee = 0;
    } else s = spawn(kind, depth);
    return { id, kind, canvas, ctx: canvas.getContext('2d')!, s, shown: true, lured: null as { x: number; y: number; wx: number; wy: number } | null };
  });
  const missed = saved ? Math.min(3, Math.max(0, (Date.now() - saved.at) / 1000)) : 0;
  for (let t = 0; t < missed; t += 1 / 60) for (const c of cast) c.kind.step(c.s, 1 / 60);

  // Feeding. A lured creature heads for the nearest pellet, with its own wandering target pointed at it so it swims
  // there in its usual way, and eases in over the last stretch. Once the food is gone it goes back to where it was going.
  type Diner = (typeof cast)[number];
  const picky = new Set<Kind>([jelly, krill, diver]);
  const release = (c: Diner) => {
    c.s.wx = c.lured!.wx;
    c.s.wy = c.lured!.wy;
    c.lured = null;
  };
  const lure = (dt: number) => {
    const hungry: [Diner, Pellet, number][] = [];
    for (const c of cast) {
      const p = picky.has(c.kind) || c.s.flee > 0 || c.s.travel ? null : food.nearest(c.s.x, c.s.y);
      if (p) hungry.push([c, p, Math.hypot(p.x - c.s.x, p.y - c.s.y)]);
      else if (c.lured) release(c);
    }
    hungry.sort((a, b) => a[2] - b[2]);
    hungry.forEach(([c, p, d], i) => {
      if (i >= FEED_MAX) {
        if (c.lured) release(c);
        return;
      }
      c.lured ??= { x: 0, y: 0, wx: c.s.wx, wy: c.s.wy };
      c.lured.x = p.x;
      c.lured.y = p.y;
      if (d < 16) p.eaten = dt;
    });
  };
  const pull = (c: Diner, dt: number) => {
    const { s } = c;
    const { x, y } = c.lured!;
    s.wx = x;
    s.wy = y;
    const dx = x - s.x;
    const dy = y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = Math.min(d * 1.4, 110) * dt;
    s.x += (dx / d) * v;
    s.y += (dy / d) * v;
    if (Math.abs(dx) > 6) s.facing += (Math.sign(dx) - s.facing) * Math.min(1, dt * 3);
  };

  let last = performance.now();
  let measured = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (now - measured > 1000) {
      measured = now;
      measure();
    }
    snow(now / 1000);
    food.step(dt);
    if (food.any()) lure(dt);
    else for (const c of cast) if (c.lured) release(c);
    food.paint();
    const middle = scrollY + innerHeight / 2;
    for (const c of cast) {
      c.kind.step(c.s, dt);
      if (c.lured) pull(c, dt);
      // Only creatures near the screen are drawn.
      const shown = Math.abs(c.s.y - middle) < innerHeight / 2 + c.kind.box;
      if (shown !== c.shown) c.canvas.hidden = !(c.shown = shown);
      if (!shown) continue;
      c.canvas.style.transform = `translate(${c.s.x}px, ${c.s.y}px)`;
      c.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.ctx.clearRect(0, 0, c.kind.box, c.kind.box);
      c.ctx.translate(c.kind.box / 2, c.kind.box / 2);
      c.ctx.fillStyle = c.ctx.strokeStyle = INK;
      c.kind.paint(c.ctx, c.s);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Listening on the window lets a click scare a creature and still reach whatever it was swimming over.
  // Clicking the same spot again soon after is feeding, and doesn't frighten anything there.
  let tap = { x: 0, y: 0, at: 0, count: 0 };
  addEventListener('pointerdown', (e) => {
    const again = e.timeStamp - tap.at < 1400 && Math.hypot(e.pageX - tap.x, e.pageY - tap.y) < 40;
    tap = { x: e.pageX, y: e.pageY, at: e.timeStamp, count: again ? tap.count + 1 : 1 };
    if (tap.count >= 2) {
      food.drop(e.pageX, e.pageY, tap.count === 2 ? 5 : 3);
      return;
    }
    for (const c of cast) if (c.kind.hit(c.s, e.pageX, e.pageY)) c.kind.scare(c.s, e.pageX, e.pageY);
  }, { capture: true, passive: true });

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), states: Object.fromEntries(cast.map((c) => [c.id, c.s])) }));
    } catch {}
  };
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save());
}

if (document.documentElement.classList.contains('motion')) ocean();

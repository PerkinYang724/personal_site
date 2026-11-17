// The cursor is an illuminated arrow that tilts with movement and leaves an impact
// wherever it is pressed.
// Reduced motion and touch screens keep their normal pointer. The native cursor only hides once the arrow has a
// position, so a freshly loaded page is never left without one.
const DURATION = 0.75;
const INTERACTIVE = 'a, button, label, summary, input, textarea, select, [role="button"], [role="tab"]';
const easeOut = (p: number) => 1 - (1 - Math.min(1, p)) ** 3;
const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

interface Impact {
  x: number;
  y: number;
  age: number;
  sparks: { angle: number; reach: number; length: number }[];
}

function lightCursor() {
  const light = document.createElement('i');
  light.className = 'cursor-light';
  light.innerHTML = `<svg viewBox="0 0 26 30" aria-hidden="true">
    <linearGradient id="cursor-edge" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="24" y2="0">
      <stop offset="0" stop-color="#ffe2a0"/><stop offset="0.2" stop-color="#fff"/><stop offset="0.82" stop-color="#fff"/><stop offset="1" stop-color="#b8f1ff"/>
    </linearGradient>
    <path d="M4 4 L21.5 18.5 Q14 19.5 11.5 20.5 Q9 23 4.5 26.5 Z" fill="url(#cursor-edge)" stroke="url(#cursor-edge)" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-impact';
  canvas.hidden = true;
  document.body.append(canvas, light);
  const ctx = canvas.getContext('2d')!;

  let x = 0;
  let y = 0;
  let moveX = 0;
  let lean = 0;
  let grow = 1;
  let growTo = 1;
  let pressAge = Infinity;
  let last = performance.now();
  const impacts: Impact[] = [];

  const fit = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  fit();
  addEventListener('resize', fit);

  const drawImpact = ({ x, y, age, sparks }: Impact) => {
    const p = age / DURATION;
    const fade = (1 - p) ** 2;

    // Flash at the point of contact
    const flash = 1 - Math.min(1, p / 0.32);
    if (flash > 0) {
      const r = 12 + 44 * easeOut(p / 0.32);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(255,255,255,${0.3 * flash})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Light spreads sideways along the surface it hit
    const reach = 18 + 150 * easeOut(p / 0.6);
    const streak = ctx.createLinearGradient(x - reach, 0, x + reach, 0);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5, `rgba(255,255,255,${0.9 * fade})`);
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(x - reach, y - 0.75, reach * 2, 1.5);

    // Shockwave
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * fade})`;
    ctx.lineWidth = 1.2 * (1 - p) + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, 6 + 66 * easeOut(p), 0, Math.PI * 2);
    ctx.stroke();

    // Sparks
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const s of sparks) {
      const near = 8 + s.reach * easeOut(p);
      const far = near + s.length * (1 - p);
      ctx.moveTo(x + Math.cos(s.angle) * near, y + Math.sin(s.angle) * near);
      ctx.lineTo(x + Math.cos(s.angle) * far, y + Math.sin(s.angle) * far);
    }
    ctx.stroke();
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const ease = 1 - Math.exp(-dt * 14);
    const perFrame = dt * 60 || 1;
    lean += (clamp(moveX / perFrame, 28) * 0.5 - lean) * ease;
    grow += (growTo - grow) * ease;
    moveX = 0;

    // A damped bounce: the arrow dips into the click, then springs back.
    pressAge += dt;
    const squash = pressAge < 0.6 ? Math.exp(-pressAge * 8) * Math.cos(pressAge * 24) : 0;
    light.style.transform = `translate(${x}px, ${y}px) rotate(${lean}deg) scale(${grow * (1 - 0.3 * squash)})`;

    if (impacts.length) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = impacts.length - 1; i >= 0; i--) {
        impacts[i].age += dt;
        if (impacts[i].age >= DURATION) impacts.splice(i, 1);
        else drawImpact(impacts[i]);
      }
      if (!impacts.length) canvas.hidden = true;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    moveX += e.clientX - x;
    x = e.clientX;
    y = e.clientY;
    // The first move has no previous position to measure from.
    if (!document.documentElement.classList.contains('light-cursor')) {
      moveX = 0;
      document.documentElement.classList.add('light-cursor');
    }
    light.classList.add('on');
    const near = !!(e.target as Element).closest?.(INTERACTIVE);
    light.classList.toggle('near', near);
    growTo = near ? 1.15 : 1;
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    pressAge = 0;
    canvas.hidden = false;
    impacts.push({
      x: e.clientX,
      y: e.clientY,
      age: 0,
      sparks: Array.from({ length: 9 }, () => ({
        angle: Math.random() * Math.PI * 2,
        reach: 24 + Math.random() * 52,
        length: 6 + Math.random() * 16,
      })),
    });
  }, { capture: true, passive: true });

  document.documentElement.addEventListener('mouseleave', () => light.classList.remove('on'));
}

if (document.documentElement.classList.contains('motion') && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  lightCursor();
}

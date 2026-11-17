// All the motion on the home page. Each init function maps to one section, in page order,
// because pinned ScrollTriggers need to be created top to bottom.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { scramble } from './chrome';

gsap.registerPlugin(ScrollTrigger);

const motion = document.documentElement.classList.contains('motion');
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Runs `draw` each frame only while `el` is on screen, so offscreen canvases cost nothing.
function whileVisible(el: Element, draw: (time: number) => void, everyMs = 0) {
  let visible = false;
  let lastRun = 0;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '80px' }).observe(el);
  gsap.ticker.add((time) => {
    if (!visible || (everyMs && time * 1000 - lastRun < everyMs)) return;
    lastRun = time * 1000;
    draw(time);
  });
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function smoothScroll() {
  const lenis = new Lenis({ duration: 1.15 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// The markup autoplays and loops the video; this pauses it offscreen and resumes it on return or when the tab
// comes back. Safari in Low Power Mode refuses video autoplay, but it will still loop the same MP4 in an <img>,
// so that takes over when play() is refused. Browsers that can't do that fall back to the first click, tap or key.
function heroVideo() {
  const video = $<HTMLVideoElement>('[data-hero-video]')!;
  const events = ['click', 'touchend', 'keydown'];
  let visible = true;
  let image: HTMLImageElement | null = null;
  let tried = false;
  const play = () => {
    if (!visible || document.hidden || image) return;
    video.play().then(
      () => events.forEach((e) => removeEventListener(e, play)),
      () => {
        if (tried) return events.forEach((e) => addEventListener(e, play));
        tried = true;
        image = new Image();
        image.alt = '';
        image.onerror = () => {
          image?.remove();
          image = null;
          events.forEach((e) => addEventListener(e, play));
        };
        image.src = video.currentSrc;
        video.after(image);
      },
    );
  };
  video.muted = true;
  document.addEventListener('visibilitychange', play);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) play();
    else video.pause();
  }).observe(video);
}

// The boxes launch from the middle of the logo's hexagon mark, slow to a stop at their resting spots, then keep wandering.
// A line follows each one back to the mark, so positions are written by hand every frame.
function heroTrackers(root: HTMLElement, logo: HTMLElement, tl: gsap.core.Timeline) {
  const lines = $$<SVGLineElement>('[data-hud-lines] line', root);
  let cx = 0;
  let cy = 0;
  let w = 0;
  let h = 0;
  const trackers = $$('[data-tracker]', root).map((el) => ({
    el,
    x: Number(el.dataset.x) / 100,
    y: Number(el.dataset.y) / 100,
    line: el.dataset.tether === 'true' ? lines.shift() : undefined,
    flight: { p: 0 },
    drift: { x: 0, y: 0 },
  }));

  const measure = () => {
    const a = root.getBoundingClientRect();
    const b = (logo.querySelector('svg') ?? logo).getBoundingClientRect();
    w = a.width;
    h = a.height;
    cx = b.left + b.width / 2 - a.left;
    cy = b.top + b.height / 2 - a.top;
  };
  const render = () => {
    for (const t of trackers) {
      const x = cx + (t.x * w - cx) * t.flight.p + t.drift.x * w;
      const y = cy + (t.y * h - cy) * t.flight.p + t.drift.y * w;
      t.el.style.transform = `translate(${x}px, ${y}px)`;
      t.line?.setAttribute('x1', String(cx));
      t.line?.setAttribute('y1', String(cy));
      t.line?.setAttribute('x2', String(x));
      t.line?.setAttribute('y2', String(y));
    }
  };

  measure();
  render();
  addEventListener('resize', () => {
    measure();
    render();
  });
  whileVisible(root, render);
  tl.to('[data-hud-lines]', { opacity: 1, duration: 0.4 }, 1.7);
  trackers.forEach((t, i) => {
    const at = 1.7 + i * 0.07;
    tl.to(t.el, { opacity: 1, duration: 0.25 }, at).to(t.flight, { p: 1, duration: 2.4, ease: 'expo.out' }, at);
    scramble($('[data-tracker-label]', t.el)!, 900, 250 + (at + 0.25) * 1000);
    const wander = () =>
      gsap.to(t.drift, { x: rand(-0.024, 0.024), y: rand(-0.016, 0.016), duration: rand(3, 5), ease: 'sine.inOut', onComplete: wander });
    wander();
  });
}

// Film texture: each layer jumps to a new offset and flip several times a second, which reads as moving film.
function heroTexture() {
  const flicker = (el: HTMLElement, everyMs: number) =>
    whileVisible(el, () => gsap.set(el, { xPercent: rand(-4, 4), yPercent: rand(-4, 4), scaleX: Math.random() < 0.5 ? -1 : 1, scaleY: Math.random() < 0.5 ? -1 : 1 }), everyMs);
  flicker($('[data-hero-grain]')!, 125);
  flicker($('[data-hero-dust]')!, 400);
}

// Random grid cells light up and fade out.
function heroGrid() {
  const grid = $('[data-hero-grid]')!;
  const layer = $('[data-hero-cells]')!;
  const size = 40;
  const cells = Array.from({ length: 6 }, () => layer.appendChild(document.createElement('i')));
  let next = 0;
  whileVisible(layer, () => {
    if (Math.random() < 0.35) return;
    const [ox, oy] = getComputedStyle(grid).backgroundPosition.split(' ').map(parseFloat);
    const col = Math.floor(rand(-1, (layer.clientWidth - ox) / size));
    const row = Math.floor(rand(0, (layer.clientHeight - oy) / size));
    const cell = cells[next++ % cells.length];
    gsap.killTweensOf(cell);
    gsap.set(cell, { x: ox + col * size + 1, y: oy + row * size + 1 });
    gsap
      .timeline()
      .fromTo(cell, { opacity: 0 }, { opacity: rand(0.05, 0.12), duration: rand(0.6, 1.1), ease: 'power2.out' })
      .to(cell, { opacity: 0, duration: rand(0.9, 1.8), ease: 'sine.in' }, `+=${rand(0.1, 0.6)}`);
  }, 900);
}

// 1. Hero — chromatic logo resolve, wobbling tagline, nav text that decodes, trackers launched from the logo.
function hero() {
  const root = $('[data-hero]')!;
  const logo = $('[data-hero-logo]', root)!;
  const tl = gsap.timeline({ delay: 0.25 });

  $$('[data-nav] [data-scramble]').forEach((el, i) => scramble(el, 900, 900 + i * 90));
  tl.from('.nav-rule', { scaleX: 0, transformOrigin: 'left', duration: 1.4, ease: 'expo.inOut' }, 0)
    .from('.nav-dot', { opacity: 0, duration: 0.4, stagger: 0.8 }, 0.2)
    .from('.nav-left, .nav-right', { opacity: 0, duration: 0.5 }, 0.9)
    .from('.nav-center', { opacity: 0, y: -8, duration: 0.6 }, 0.1)
    .from('[data-hero-bg]', { scale: 1.12, duration: 2.4, ease: 'power2.out' }, 0)
    .fromTo('[data-hero-grid]', { opacity: 0 }, { opacity: 0.05, duration: 1.2, onComplete: heroGrid }, 0.6)
    // Fade a curtain rather than the video: Safari stops autoplay on a video it considers invisible.
    .fromTo('[data-hero-curtain]', { opacity: 1 }, { opacity: 0, duration: 2.4, ease: 'power2.out' }, 0)
    .fromTo(
      logo,
      { opacity: 0, filter: 'blur(14px)', '--split': '16px', clipPath: 'inset(0 62% 0 0)' },
      { opacity: 1, filter: 'blur(0px)', '--split': '0px', clipPath: 'inset(0 0% 0 0)', duration: 1.5, ease: 'power3.out' },
      1.1,
    );

  $$('[data-wave]', root).forEach((line, i) => {
    tl.from(
      $$('.w', line),
      {
        opacity: 0,
        filter: 'blur(6px)',
        y: (n: number) => Math.sin(n * 1.1) * 12 + 10,
        rotate: (n: number) => Math.sin(n * 1.7) * 7,
        duration: 1.1,
        stagger: 0.05,
        ease: 'power3.out',
      },
      1.4 + i * 0.14,
    );
  });
  tl.from('[data-hero-tax] > li', { opacity: 0, duration: 0.5, stagger: 0.05 }, 2.1);

  heroTrackers(root, logo, tl);

  gsap.to('[data-hero-bg]', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
}

// 2. Manifesto — each line starts stretched past the edge of the page, then snaps into a tight paragraph.
function manifesto() {
  const root = $('[data-manifesto]')!;
  const text = $('[data-spread]', root)!;
  const source = text.textContent ?? '';
  let ctx: gsap.Context | undefined;
  let lastWidth = 0;

  const build = () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    ctx?.revert();
    text.setAttribute('aria-label', source);
    text.innerHTML = source
      .split(' ')
      .map((w) => `<span class="sw" aria-hidden="true">${w}</span>`)
      .join(' ');
    const words = $$('.sw', text);
    const lines: HTMLElement[][] = [];
    let top = NaN;
    words.forEach((w) => {
      if (w.offsetTop !== top) {
        top = w.offsetTop;
        lines.push([]);
      }
      lines[lines.length - 1].push(w);
    });

    ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 82%', end: 'top 2%', scrub: 0.6, invalidateOnRefresh: true },
      });
      const spread = innerWidth * 0.05;
      lines.forEach((line, n) => {
        const offset = (n % 3) * innerWidth * 0.07;
        line.forEach((w, i) => {
          tl.fromTo(
            w,
            { x: offset + i * spread * (1 + n * 0.24), opacity: 0.08 },
            { x: 0, opacity: 1, ease: 'power2.out', duration: 1 },
            n * 0.42,
          );
        });
      });
      gsap.from('[data-side]', { opacity: 0, y: 40, scrollTrigger: { trigger: '[data-side]', start: 'top 94%', end: 'top 70%', scrub: true } });
      const path = $<SVGPathElement>('[data-circuit] path')!;
      gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '[data-circuit]', start: 'top 100%', end: 'top 55%', scrub: true } });
    }, root);
    ScrollTrigger.refresh();
  };

  build();
  let timer = 0;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = window.setTimeout(build, 200);
  });
}

// 3. Work — the ticker slides in, the numbers count up, the rows reveal, and the globe turns.
function work() {
  const root = $('[data-work]')!;
  if (motion) workIntro(root);

  $$<HTMLButtonElement>('[data-tab]', root).forEach((tab, _, tabs) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      $$('.wt-row', root).forEach((row) => {
        row.hidden = tab.dataset.tab !== 'All' && row.dataset.cat !== tab.dataset.tab;
      });
      ScrollTrigger.refresh();
    });
  });

  globe($('[data-globe]', root)!);
}

function workIntro(root: HTMLElement) {
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 62%', once: true } });
  tl.from('.work-glow', { opacity: 0, duration: 1.6 }, 0)
    .from('[data-count-title]', { x: -60, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0)
    .from('.work-price > *', { opacity: 0, y: 10, stagger: 0.08, duration: 0.6 }, 0.2)
    .fromTo('[data-trail]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.4)
    .from('.work-sub, .work-stats > div, .work-tabs', { opacity: 0, y: 14, stagger: 0.07, duration: 0.6 }, 0.35)
    .from('.wt-head, .wt-row', { opacity: 0, y: 16, stagger: 0.07, duration: 0.6 }, 0.6)
    .from('.wt-bars i', { scaleY: 0, transformOrigin: 'bottom', stagger: 0.008, duration: 0.5 }, 0.8)
    .from('.layers', { opacity: 0, duration: 0.8 }, 1.1);

  const price = $('[data-price]', root)!;
  const target = Number(price.dataset.to);
  const count = { v: target * 0.7 };
  tl.to(count, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => (price.textContent = count.v.toFixed(2)) }, 0.1);
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count);
    const c = { v: 0 };
    tl.to(c, { v: to, duration: 1.2, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(c.v).toLocaleString()) }, 0.4);
  });

  gsap.to({}, {
    duration: 1.6,
    repeat: -1,
    onRepeat: () => {
      if (ScrollTrigger.isInViewport(price)) price.textContent = (target + rand(-0.4, 0.4)).toFixed(2);
    },
  });
}

async function globe(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>('canvas', root)!;
  const flat: number[] = await fetch('/data/land-dots.json').then((r) => r.json());
  const RAD = Math.PI / 180;
  const dots = [];
  for (let i = 0; i < flat.length; i += 2) {
    const lat = flat[i] * RAD;
    const lon = flat[i + 1] * RAD;
    dots.push({ cos: Math.cos(lat), sin: Math.sin(lat), lon, glow: Math.random() ** 3 });
  }
  let view = fitCanvas(canvas);
  addEventListener('resize', () => (view = fitCanvas(canvas)));
  const tilt = -18 * RAD;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  const draw = (time: number) => {
    const { ctx, width: w, height: h } = view;
    const r = Math.min(w, h) * 0.47;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    const shade = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    shade.addColorStop(0, '#1b1c1e');
    shade.addColorStop(1, '#060607');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.stroke();

    const spin = 20 * RAD - time * 0.07;
    for (const d of dots) {
      const x = d.cos * Math.sin(d.lon + spin);
      const y0 = d.sin;
      const z0 = d.cos * Math.cos(d.lon + spin);
      const y = y0 * cosT - z0 * sinT;
      const z = y0 * sinT + z0 * cosT;
      if (z < 0.02) continue;
      const a = (0.34 + d.glow * 0.66) * Math.min(1, z * 2.2);
      ctx.fillStyle = `rgba(232,238,240,${a})`;
      const s = 1 + d.glow * 1.1;
      ctx.fillRect(cx + x * r, cy - y * r, s, s);
    }

    // Targeting crosshair
    ctx.strokeStyle = 'rgba(255,255,255,.26)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.04, cy);
    ctx.lineTo(cx + r * 1.04, cy);
    ctx.moveTo(cx, cy - r * 1.04);
    ctx.lineTo(cx, cy + r * 1.04);
    ctx.stroke();
    ctx.fillStyle = '#8f83ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6 + Math.sin(time * 3), 0, Math.PI * 2);
    ctx.fill();
  };
  if (motion) whileVisible(root, draw);
  else draw(0);
}

// Hand-drawn looking line: a random walk with an upward drift.
function walk(points: number, up = 0.6) {
  let y = 70;
  return Array.from({ length: points }, () => {
    y = Math.max(6, Math.min(94, y + rand(-11, 11) - up));
    return y;
  });
}

function lineFrom(values: number[], w: number, h: number) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)} ${((v / 100) * h).toFixed(1)}`).join(' ');
}

// 4. Words — live sparklines, a flickering forecast, and a dithered image.
function words() {
  const root = $('[data-words]')!;
  $$('[data-chart]', root).forEach((chart, c) => {
    const svg = $<SVGSVGElement>('svg', chart)!;
    const { width: w, height: h } = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const values = walk(48, c % 2 ? 0.2 : 1.1);
    svg.innerHTML = `<path class="sp" pathLength="1"/><circle class="sp-dot" r="2.6"/>`;
    const path = $<SVGPathElement>('path', svg)!;
    const dot = $<SVGCircleElement>('circle', svg)!;
    const paint = () => {
      path.setAttribute('d', lineFrom(values, w - 6, h));
      dot.setAttribute('cx', String(w - 6));
      dot.setAttribute('cy', String((values[values.length - 1] / 100) * h));
    };
    paint();
    if (!motion) path.removeAttribute('pathLength');
    else gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: root, start: 'top 55%', once: true }, onComplete: () => path.removeAttribute('pathLength') });
    if (motion)
      whileVisible(chart, () => {
        values.shift();
        values.push(Math.max(6, Math.min(94, values[values.length - 1] + rand(-9, 9) - 0.2)));
        paint();
      }, 420);
  });

  const forecast = $('[data-forecast]', root)!;
  const base = Number(forecast.dataset.to);
  if (motion) whileVisible(forecast, () => (forecast.textContent = (base + rand(-0.3, 0.3)).toFixed(2)), 900);

  if (motion) gsap.from('.words-board > *', { opacity: 0, y: 30, stagger: 0.12, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: root, start: 'top 60%', once: true } });
  if (motion) gsap.from('.words-foot [data-rise]', { yPercent: 110, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.words-foot', start: 'top 92%', once: true } });

  dither($('[data-paper]', root)!);
}

// A slowly turning, Bayer-dithered sphere — stands in for a photo on the paper card.
function dither(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>('canvas', root)!;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const CELL = 3;
  const draw = (time: number) => {
    const { width, height } = canvas.getBoundingClientRect();
    const cols = Math.floor(width / CELL);
    const rows = Math.floor(height / CELL);
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(cols, rows);
    const cx = cols * 0.5;
    const cy = rows * 0.52;
    const R = Math.min(cols, rows) * 0.34;
    const lx = Math.cos(time * 0.5) * 0.7;
    const ly = -0.55;
    const lz = 0.55;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = (x - cx) / R;
        const ny = (y - cy) / R;
        const d = nx * nx + ny * ny;
        let lum = 1;
        const dark = [24, 58, 62];
        if (d < 1) {
          const nz = Math.sqrt(1 - d);
          const lit = Math.max(0, nx * lx + ny * ly + nz * lz);
          lum = 0.08 + lit * 0.95;
          const band = Math.sin(Math.atan2(nx, nz) * 6 + time * 0.4) > 0.72 ? -0.24 : 0;
          lum += band;
        } else {
          // Soft contact shadow under the sphere
          const sy = (y - (cy + R * 1.12)) / (R * 0.13);
          const sx = (x - cx) / (R * 0.95);
          const shadow = sx * sx + sy * sy;
          if (shadow < 1) lum = 0.42 + shadow * 0.58;
        }
        const on = lum > (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        const i = (y * cols + x) * 4;
        const [r, g, b] = on ? [226, 228, 222] : dark;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  draw(0);
  if (motion) whileVisible(root, draw, 110);
}

// 5. Tape — a column of flickering rows that races past a fixed white bar.
function tape() {
  const root = $('[data-tape]')!;
  const col = $('[data-tape-col]', root)!;
  const now = $('[data-tape-now]', root)!;
  const symbols: string[] = JSON.parse(col.dataset.symbols ?? '[]');
  const rows = Array.from({ length: 96 }, (_, i) => {
    const row = {
      symbol: symbols[i % symbols.length],
      value: rand(10, 9000),
      change: rand(-6, 9),
      el: document.createElement('div'),
    };
    col.append(row.el);
    return row;
  });
  const text = (r: (typeof rows)[number]) =>
    `${r.symbol} ${r.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}  /  ${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%`;
  rows.forEach((r) => (r.el.textContent = text(r)));

  if (motion) {
    whileVisible(root, () => {
      for (let i = 0; i < 9; i++) {
        const r = rows[Math.floor(Math.random() * rows.length)];
        r.value *= 1 + rand(-0.004, 0.004);
        r.change += rand(-0.06, 0.06);
        r.el.textContent = text(r);
      }
    }, 90);

    gsap.fromTo(col, { yPercent: 6 }, {
      yPercent: -58,
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.4,
        onUpdate: () => {
          const mid = innerHeight / 2;
          const hit = rows.find((r) => {
            const b = r.el.getBoundingClientRect();
            return b.top <= mid && b.bottom >= mid;
          });
          if (hit) now.textContent = text(hit);
        },
      },
    });
    gsap.fromTo('[data-ghost]', { yPercent: 40 }, { yPercent: -30, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

// 6. Timeline — pinned stage. Scroll turns a wheel of titles while photos cross-fade behind it.
function timeline() {
  const root = $('[data-timeline]')!;
  const imgs = $$('[data-tl-img]', root);
  const cards = $$('[data-tl-card]', root);
  const ghosts = $$('[data-tl-ghost]', root);
  const thumbs = $$('[data-tl-thumb]', root);
  const chips = $$('[data-tl-chip]', root);
  const n = $('[data-tl-n]', root)!;
  const count = imgs.length;
  let current = -1;

  const setActive = (i: number) => {
    if (i === current) return;
    current = i;
    n.textContent = String(i + 1).padStart(2, '0');
    cards.forEach((c, k) => c.classList.toggle('on', k === i));
    chips.forEach((c, k) => c.classList.toggle('on', k === i));
  };

  // Everything is a pure function of progress, so scrolling backward works the same as forward.
  const render = (progress: number) => {
    const pos = progress * (count - 1);
    setActive(Math.round(pos));
    imgs.forEach((img, i) => {
      const d = pos - i;
      const a = gsap.utils.clamp(0, 1, 1 - Math.abs(d) * 1.9);
      img.style.opacity = String(i === 0 && d < 0 ? 1 : a);
      img.style.transform = `scale(${1.04 + d * 0.05}) translateY(${d * -3}%)`;
    });
    ghosts.forEach((g, i) => {
      let d = i - pos;
      d = ((d + count / 2) % count + count) % count - count / 2;
      const y = d * 30;
      const near = Math.abs(d);
      g.style.transform = `translate(${near * near * -2.8}vw, ${y}vh)`;
      g.style.opacity = near < 0.5 ? '0' : String(gsap.utils.clamp(0, 0.5, 0.62 - near * 0.12));
    });
    thumbs.forEach((t, i) => {
      let d = i - pos;
      d = ((d + count / 2) % count + count) % count - count / 2;
      const near = Math.abs(d);
      t.style.transform = `translate(${near * near * -1.6}vw, ${d * 27}vh)`;
      t.style.opacity = String(gsap.utils.clamp(0, 1, 1.5 - near * 0.5));
    });
  };

  render(0);
  ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${innerHeight * (count - 1) * 0.85}`,
    pin: true,
    scrub: true,
    onUpdate: (self) => render(self.progress),
  });
}

// 7. Dispatch — a shuffling pixel poster and a fan of letters on a turning carousel.
function dispatch() {
  const root = $('[data-dispatch]')!;
  if (motion) gsap.from('[data-reveal]', { y: 60, opacity: 0, stagger: 0.14, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: root, start: 'top 72%', once: true } });

  const canvas = $<HTMLCanvasElement>('[data-pixels]', root)!;
  const COLORS = ['#7a5cf0', '#f0562a', '#2c2a3a', '#b8a9ee', '#e7e2d3', '#55526a', '#ffffff', '#c2527f', '#8c8a9c'];
  const COLS = 8;
  const ROWS = 9;
  const cells = Array.from({ length: COLS * ROWS }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const paint = () => {
    const { ctx, width, height } = fitCanvas(canvas);
    const cw = width / COLS;
    const ch = height / ROWS;
    cells.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((i % COLS) * cw, Math.floor(i / COLS) * ch, cw + 0.5, ch + 0.5);
    });
  };
  paint();
  addEventListener('resize', paint);
  if (motion)
    whileVisible(canvas, () => {
      for (let i = 0; i < 6; i++) cells[Math.floor(Math.random() * cells.length)] = COLORS[Math.floor(Math.random() * COLORS.length)];
      paint();
    }, 260);

  const leaves = $$('[data-leaf]', root);
  const place = (turn: number) => {
    leaves.forEach((leaf, i) => {
      let d = i - turn;
      d = ((d + leaves.length / 2) % leaves.length + leaves.length) % leaves.length - leaves.length / 2;
      const near = Math.abs(d);
      leaf.style.transform = `translateX(${d * 46}%) translateZ(${-near * 90}px) rotateY(${d * -26}deg) rotateZ(${d * 2.5}deg)`;
      leaf.style.zIndex = String(100 - Math.round(near * 10));
      leaf.style.opacity = String(gsap.utils.clamp(0, 1, 3 - near));
    });
  };
  place(0);
  if (motion) whileVisible($('[data-fan]', root)!, (time) => place(time * 0.16), 16);
}

// 8. Closing — a field of numbers with cells that flare, plus an alert card that jumps between them.
function closing() {
  const root = $('[data-closing]')!;
  if (motion) gsap.from('.closing-copy [data-rise]', { yPercent: 110, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 55%', once: true } });
  if (motion) gsap.from('.closing-copy > *:not(h2), .sig-list', { opacity: 0, y: 14, stagger: 0.08, duration: 0.8, scrollTrigger: { trigger: root, start: 'top 55%', once: true } });

  const canvas = $<HTMLCanvasElement>('[data-heat]', root)!;
  const CELL = 26;
  let view = fitCanvas(canvas);
  let grid: { num: number; heat: number; tone: number }[] = [];
  let cols = 0;
  let rows = 0;
  const seed = () => {
    view = fitCanvas(canvas);
    cols = Math.ceil(view.width / CELL);
    rows = Math.ceil(view.height / CELL);
    grid = Array.from({ length: cols * rows }, () => ({ num: Math.floor(rand(0, 99)), heat: 0, tone: Math.random() }));
  };
  seed();
  addEventListener('resize', seed);

  const pointer = { x: -999, y: -999 };
  root.addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect();
    pointer.x = e.clientX - b.left;
    pointer.y = e.clientY - b.top;
  });

  const draw = () => {
    const { ctx, width, height } = view;
    ctx.clearRect(0, 0, width, height);
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const cell = grid[Math.floor(Math.random() * grid.length)];
      cell.heat = rand(0.4, 1);
      cell.num = Math.floor(rand(0, 99));
    }
    grid.forEach((cell, i) => {
      const x = (i % cols) * CELL;
      const y = Math.floor(i / cols) * CELL;
      const dist = Math.hypot(x + CELL / 2 - pointer.x, y + CELL / 2 - pointer.y);
      if (dist < 70) cell.heat = Math.max(cell.heat, 1 - dist / 90);
      cell.heat *= 0.968;
      if (cell.heat > 0.03) {
        const color = cell.tone > 0.72 ? '232,74,36' : cell.tone > 0.56 ? '122,92,240' : '200,200,204';
        ctx.fillStyle = `rgba(${color},${cell.heat * 0.72})`;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
      ctx.fillStyle = `rgba(255,255,255,${0.1 + cell.heat * 0.5})`;
      ctx.fillText(String(cell.num), x + CELL / 2, y + CELL / 2);
    });
  };
  draw();
  if (motion) whileVisible(canvas, draw, 50);

  const popup = $('[data-popup]', root)!;
  const label = $('[data-popup-title]', popup)!;
  const labels: string[] = JSON.parse(popup.dataset.labels ?? '[]');
  const SPOTS = [[74, 22], [8, 58], [78, 58], [12, 20]];
  let spot = 0;
  const hop = () => {
    const [left, top] = SPOTS[spot % SPOTS.length];
    label.textContent = labels[spot % labels.length];
    spot++;
    gsap.set(popup, { left: `${left}%`, top: `${top}%` });
    gsap.fromTo(popup, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'power2.out' });
    gsap.to(popup, { opacity: 0, duration: 0.3, delay: 2.6, onComplete: hop });
  };
  if (motion) ScrollTrigger.create({ trigger: root, start: 'top 60%', once: true, onEnter: hop });
}

async function start() {
  if (motion) smoothScroll();
  await document.fonts.ready;
  if (motion) {
    heroVideo();
    heroTexture();
    hero();
    manifesto();
  }
  work();
  words();
  tape();
  timeline();
  dispatch();
  closing();
  ScrollTrigger.refresh();
}

start();

// Runs on every page: the glitchy text hover and the top bar that tucks away on scroll.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_/%&';

export function scramble(el: HTMLElement, duration = 700, delay = 0) {
  const text = el.dataset.text ?? (el.dataset.text = el.textContent ?? '');
  const start = performance.now() + delay;
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    if (p < 0) return requestAnimationFrame(tick);
    const done = Math.floor(p * text.length);
    el.textContent = [...text]
      .map((c, i) => (i < done || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join('');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (document.documentElement.classList.contains('motion')) {
  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    el.addEventListener('pointerenter', () => scramble(el, 420));
    el.addEventListener('focus', () => scramble(el, 420));
  });
}

const nav = document.querySelector<HTMLElement>('[data-nav]');
let last = scrollY;
addEventListener(
  'scroll',
  () => {
    const y = scrollY;
    if (Math.abs(y - last) < 6) return;
    nav?.classList.toggle('tucked', y > last && y > 120);
    last = y;
  },
  { passive: true },
);

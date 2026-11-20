// event-horizon: an orange black hole behind the hero text, with tiny luminous figures orbiting it.
const hero = document.querySelector('#home.hero');
const content = hero?.querySelector('.hero-content');

// intro.js also imports this module (a second URL without ?v), so build only once
if (hero && content && !hero.querySelector('.eh')) {
  // sx: which figure of assets/figures-alpha.webp, d: orbit radius in hole radii, a: start angle, h: size in px.
  // One shared period and evenly spaced angles, all clear of the ring's glow, so figures never meet each other or the ring.
  const figures = [0.3, 25.5, 49.15, 72.2, 97.7].map((sx, i) => ({ sx, d: 1.44, t: 120, a: i * 72 + 18, h: 48, tilt: 0 }));

  // the relocation line, worded as in Contact
  content.querySelector('.tagline')?.insertAdjacentHTML('afterend', '<p class="eh-where"><span>Open to relocation in the US</span></p>');

  const eh = document.createElement('div');
  eh.className = 'eh';
  eh.setAttribute('aria-hidden', 'true');
  eh.innerHTML = `
    <div class="eh-dim"></div>
    <div class="eh-spin"><div class="eh-haze"></div><div class="eh-ring"></div></div>
    <div class="eh-arc"></div>
    ${figures.map((f) => `
      <div class="eh-orbit" style="--a:${f.a}deg;--t:${f.t}s">
        <div class="eh-fig${f.fall ? ' eh-fall' : ''}" style="--d:${f.d};--h:${f.h}px;--tilt:${f.tilt}deg;--sx:${f.sx}%"></div>
      </div>`).join('')}`;
  hero.prepend(eh);

  // the shadow must enclose every line of text: farthest inked corner from the block's centre
  // (the tagline types itself out, so it counts at its full block width)
  const nav = document.querySelector('.navbar');
  new ResizeObserver(() => {
    const c = content.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2, range = document.createRange();
    let r = 0;
    for (const child of content.children) {
      range.selectNodeContents(child);
      const b = child.matches('.tagline') ? child.getBoundingClientRect() : range.getBoundingClientRect();
      if (b.width) r = Math.max(r, Math.hypot(Math.max(cx - b.left, b.right - cx), Math.max(cy - b.top, b.bottom - cy)));
    }
    hero.style.setProperty('--fit-r', `${Math.round(r + 22)}px`);
    hero.style.setProperty('--nav-h', `${nav?.offsetHeight || 0}px`);
  }).observe(content);

  // desktop with a fine pointer: the hole leans a few px toward the cursor
  const lean = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 700px) and (prefers-reduced-motion: no-preference)');
  let frame = 0;
  addEventListener('pointermove', (e) => {
    if (!lean.matches || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      eh.style.setProperty('--lx', `${(clamp((e.clientX / innerWidth) * 2 - 1) * 6).toFixed(1)}px`);
      eh.style.setProperty('--ly', `${(clamp((e.clientY / innerHeight) * 2 - 1) * 6).toFixed(1)}px`);
    });
  }, { passive: true });
}

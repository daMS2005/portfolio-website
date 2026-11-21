// fade-to-black: the page ends like the reel's last frame. An ember black hole beside
// "Get in touch" pulls the lava blobs in; on the 404 page, four figures drift toward it.
const root = document.documentElement;
const hole = () => Object.assign(document.createElement('div'), {
  className: 'ftb-hole', innerHTML: '<span class="ftb-rim"></span>',
});

const contact = document.querySelector('#contact .contact-content');
if (contact) {
  const h = hole();
  h.setAttribute('aria-hidden', 'true');
  contact.append(h);
  document.querySelector('footer')?.before(Object.assign(document.createElement('p'), {
    className: 'ftb-end', textContent: '[fade to black]',
  }));

  // the hole lights once; the background dims only while it is in view
  new IntersectionObserver(([e]) => {
    root.classList.toggle('ftb-dim', e.isIntersecting);
    if (e.isIntersecting) root.classList.add('ftb-on');
  }, { threshold: 0.5 }).observe(h);
} else if (document.title.startsWith('Page not found')) {
  // 404: the black hole is the pupil of one drawn eye. It follows the pointer, blinks, looks around,
  // and four figures drift toward it; each figure is a way back in.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // almond from two quadratics (viewBox 400x240); shut = the upper lid swept onto the lower one
  const lid = (s) => Array.from({ length: 17 }, (_, i) => [20 + 22.5 * i, 120 + s * 280 * (i / 16) * (1 - i / 16)]);
  const poly = (u) => `polygon(${[...u, ...lid(1).reverse()].map(([x, y]) => `${x / 4}% ${(y / 2.4).toFixed(2)}%`)})`;
  const orbit = document.createElement('div');
  orbit.className = 'ftb-orbit';
  orbit.innerHTML = `<div class="ftb-eye${still ? '' : ' is-blink'}" aria-hidden="true" style="--open:${poly(lid(-1))};--shut:${poly(lid(1))}">
    <i class="ftb-eye-haze"></i><div class="ftb-ball"><div class="ftb-look"><div class="ftb-hole"><span class="ftb-rim"></span></div></div></div>
    <svg viewBox="0 0 400 240"><path class="ftb-crease" d="M80 72Q200-6 320 72"/><path class="ftb-lid" d="M20 120Q200-20 380 120"/><path d="M20 120Q200 260 380 120"/></svg></div>`;
  // [href, label, full title, x %, y %, pose in figures-alpha.webp, mirrored]
  const figs = [['/', 'Home', 'Back to the homepage', 14, 12, 0, -1], ['/jepa-transformer', 'Forecasting model', 'JEPA Transformer', 86, 12, 4, 1],
    ['/thesis', 'Brain–LLM study', 'Brain–LLM Feature Correspondence', 14, 82, 3, 1], ['/tc-acc', 'Agentic harness', 'TC_ACC Documentary Studio', 86, 82, 1, -1]];
  figs.forEach(([href, label, title, x, y, p, f], i) => {
    const a = Object.assign(document.createElement('a'), { className: 'ftb-fig', href, innerHTML: `<i></i><span>${label}</span><small>${title}</small>` });
    a.style.cssText = `left:${x}%;top:${y}%;--dx:${(50 - x) * 0.3}cqw;--dy:${(50 - y) * 0.3}cqw;--sx:${[0.24, 25.5, 49.15, 72.2, 97.7][p]}%;--f:${f};animation-delay:${-i * 5}s`;
    orbit.append(a);
  });
  document.querySelector('.detail-hero')?.append(orbit);
  document.body.style.background = '#000';
  root.classList.add('ftb-404');
  requestAnimationFrame(() => root.classList.add('ftb-on'));

  const eye = orbit.firstElementChild;
  const look = (x, y) => { eye.style.setProperty('--gx', x.toFixed(1)); eye.style.setProperty('--gy', y.toFixed(1)); };
  const aim = (px, py) => {
    const r = eye.getBoundingClientRect();
    const dx = px - r.left - r.width / 2, dy = py - r.top - r.height / 2;
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    look((dx / d) * 80 * k, (dy / d) * 26 * k);
  };
  const aimAt = (el) => { const r = el.getBoundingClientRect(); aim(r.left + r.width / 2, r.top + r.height / 2); };
  if (!still) {
    const later = (fn, ms) => setTimeout(() => (document.hidden ? later(fn, ms) : fn()), ms);
    const blink = () => { eye.classList.add('is-blink'); setTimeout(() => eye.classList.remove('is-blink'), 150); later(blink, 2600 + Math.random() * 4200); };
    let idle;
    const wander = () => {
      const t = [...orbit.querySelectorAll('.ftb-fig'), null][Math.floor(Math.random() * 5)];
      t ? aimAt(t) : look(0, 0);
      idle = later(wander, 1300 + Math.random() * 1500);
    };
    setTimeout(() => { eye.classList.remove('is-blink'); later(blink, 3000); idle = later(wander, 1800); }, 450);
    let frame = 0;
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; aim(e.clientX, e.clientY); });
      clearTimeout(idle);
      idle = later(wander, 3000);
    });
    orbit.querySelectorAll('.ftb-fig').forEach((a) => a.addEventListener('focus', () => { clearTimeout(idle); aimAt(a); idle = later(wander, 3000); }));
  }
}

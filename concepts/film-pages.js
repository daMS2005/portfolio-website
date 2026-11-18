// film-pages: personal.html (mono-to-gold hero, chapter credits on one spine, the route on the Atlantic,
// a rueda of dancers around 500+, hovers that surface the page's own proof), 404 (nav + footer around
// fade-to-black's eye), legal pages (typography + shared footer).
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const moved = (e) => e.movementX || e.movementY; // a real pointer move, not content scrolled under a resting cursor
const once = (el, fn) => {
  if (still) return fn();
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.15 });
  io.observe(el);
};
const legalLinks = '<p class="footer-legal"><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></p>';
const navLinks = '<li><a href="/">Home</a></li><li><a href="/#research">Research</a></li><li><a href="/#contact">Contact</a></li>';
const navHTML = `<div class="nav-content"><a class="logo logo-link" href="/">DM</a><ul class="nav-links legal-nav">${navLinks}</ul></div>`;

const personal = document.querySelector('main.personal-page');
const kicker = document.querySelector('.detail-kicker');
const legal = document.querySelector('main.legal-doc');

if (personal) {
  root.dataset.fp = 'personal';
  const $$ = (q) => [...personal.querySelectorAll(q)];
  // hero: "Competitive underneath." heats from mono to gold
  const h1 = personal.querySelector('.personal-hero h1');
  const t = h1?.lastChild;
  if (t?.nodeType === 3) {
    const s = document.createElement('span');
    s.className = 'fp-under';
    s.textContent = t.textContent;
    t.replaceWith(s);
    h1.insertAdjacentHTML('afterend', '<i class="fp-heat" aria-hidden="true"></i>');
    setTimeout(() => root.classList.add('fp-hot'), still ? 0 : 450);
  }

  // traits: hover or tap one to see its proof, quoted from "How I tend to work" further down
  const cards = $$('.principle-card');
  const row = personal.querySelector('.personal-trait-row');
  const proofOf = { 'Mellow by default': 0, 'Open-minded': 2, Communicative: 1 };
  if (row && cards.length === 4) {
    const proof = Object.assign(document.createElement('p'), { className: 'fp-proof' });
    proof.setAttribute('aria-live', 'polite');
    row.after(proof);
    row.querySelectorAll('span').forEach((s) => {
      const c = cards[proofOf[s.textContent.trim()]];
      if (!c) return;
      s.tabIndex = 0;
      const show = () => proof.firstChild?.textContent !== c.querySelector('h3').textContent && proof.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: c.querySelector('h3').textContent }), c.querySelector('p').textContent);
      s.addEventListener('pointermove', (e) => moved(e) && show());
      s.addEventListener('focus', show);
    });
  }

  // chapter credits: one hairline strings them together on desktop; each star lights once in view
  const wrap = personal.querySelector('.personal-section');
  const labels = $$('.personal-label');
  if (wrap && labels.length > 1) {
    const spine = () => {
      const a = labels[0].offsetTop, b = labels.at(-1).offsetTop;
      wrap.style.setProperty('--sp-t', `${a + 14}px`);
      wrap.style.setProperty('--sp-h', `${b - a}px`);
    };
    new ResizeObserver(spine).observe(wrap);
    labels.forEach((l) => once(l, () => l.classList.add('is-lit')));
  }

  // route: the five cities on the Atlantic from the homepage planet (earth-atlantic.json), lit in order
  const route = personal.querySelector('.city-route');
  if (route?.children.length === 5) {
    route.classList.add('fp-route', 'fp-armed');
    fetch('/concepts/assets/earth-atlantic.json').then((r) => r.json()).then((e) => {
      const c = e.cities;
      const VB = [104, 136, 372, 170];
      const xy = (i) => `${c[i].x} ${c[i].y}`;
      const legs = [`M${xy(0)}Q238 214 ${xy(1)}`, `M${xy(1)}L${xy(2)}`, `M${xy(2)}L${xy(3)}`, `M${xy(3)}Q250 108 ${xy(4)}`];
      // label anchors: Santo Domingo under its light, Spain fanned out to the right, New York beside it
      const at = [[c[0].x - 6, c[0].y + 12], [370, 186], [370, 208], [370, 164], [c[4].x + 7, c[4].y + 7]];
      const leads = [1, 2, 3].map((i) => `M${c[i].x + 2} ${c[i].y}L366 ${at[i][1]}`).join('');
      route.insertAdjacentHTML('afterbegin', `<svg class="fp-map" aria-hidden="true" viewBox="${VB.join(' ')}">
        <defs><radialGradient id="fpGlow"><stop offset="0" stop-color="#ffb347" stop-opacity=".8"/><stop offset=".35" stop-color="#ff5c2a" stop-opacity=".28"/><stop offset="1" stop-color="#7a1a0a" stop-opacity="0"/></radialGradient>
        ${['x2="1"', 'x2="0" y2="1"'].map((d, i) => `<linearGradient id="fpF${i}" ${d}><stop stop-color="#000"/><stop offset=".12" stop-color="#fff"/><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
        <mask id="fpM${i}"><rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="url(#fpF${i})"/></mask>`).join('')}</defs>
        <g mask="url(#fpM1)"><path class="fp-land" mask="url(#fpM0)" d="${e.landPath}"/></g><path class="fp-lead" d="${leads}"/>
        ${legs.map((d, i) => `<path class="fp-leg" pathLength="1" style="--i:${i}" d="${d}"/>`).join('')}
        <g>${c.map((k, i) => `<g class="fp-city" style="--i:${i}" transform="translate(${k.x} ${k.y})"><circle class="fp-halo" r="${i === 4 ? 16 : 8}" fill="url(#fpGlow)"/><circle class="fp-core" r="${i === 4 ? 2.2 : 1.5}"/></g>`).join('')}</g></svg>`);
      route.querySelectorAll('li').forEach((li, i) => {
        li.style.cssText = `left:${((at[i][0] - VB[0]) / VB[2]) * 100}%;top:${((at[i][1] - VB[1]) / VB[3]) * 100}%`;
      });
      once(route, () => route.classList.add('is-lit'));
    });
  }

  // DR Club: five couples dancing a rueda around 500+; hover or tap turns it and names the event
  const dl = personal.querySelector('.dr-club-stats');
  if (dl) {
    const X = ['0.24%', '25.5%', '49.15%', '72.2%', '97.7%']; // figure centres in figures-alpha.webp
    const rueda = document.createElement('div');
    rueda.className = 'fp-rueda fp-armed';
    rueda.innerHTML = `<div class="fp-ring" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="1"/></svg><div class="fp-dancers">${
      Array.from({ length: 10 }, (_, i) => `<b style="--a:${Math.floor(i / 2) * 72 + (i % 2 ? 14 : -14)}deg;--sx:${X[i % 2 ? 3 : 1]};--f:${i % 2 ? -1 : 1};--i:${i}"></b>`).join('')}</div></div>`;
    dl.replaceWith(rueda);
    rueda.append(dl);
    const event = personal.querySelector('.dr-club-copy p:last-child')?.textContent.match(/the university.s largest student-led diversity event/);
    if (event) dl.children[1]?.insertAdjacentHTML('beforeend', `<dd class="fp-event" aria-hidden="true">${event[0]}</dd>`);
    let turn = 0;
    const on = (v) => {
      if (v && !rueda.classList.contains('is-on') && !still) rueda.style.setProperty('--turn', `${(turn += 72)}deg`);
      rueda.classList.toggle('is-on', v);
    };
    rueda.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && moved(e) && on(true));
    rueda.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && on(false));
    rueda.addEventListener('click', () => on(!rueda.classList.contains('is-on')));
    once(rueda, () => rueda.classList.add('is-lit'));
  }

  // tier list: the three reasons, shown on the exercises they explain
  const why = $$('.tier-commentary p');
  const reasonOf = { 'Cable lateral raise': 0, 'Walking lunge': 1, "Farmer's carry": 1, 'Leg extension': 2 };
  if (why.length === 3) {
    $$('.tier-items span').forEach((s) => {
      const p = why[reasonOf[s.textContent.trim()]];
      if (!p) return;
      s.classList.add('fp-has-why');
      s.tabIndex = 0;
      const em = Object.assign(document.createElement('em'), { className: 'fp-why', textContent: p.textContent });
      em.setAttribute('aria-hidden', 'true');
      s.append(em);
      s.addEventListener('pointermove', (e) => moved(e) && s.classList.add('fp-show'));
      s.addEventListener('pointerleave', () => s.classList.remove('fp-show'));
    });
  }

  const foot = document.querySelector('footer .footer-content');
  // add, never replace: film-frame may already have filled this footer (concept scripts run in any order)
  if (foot && !foot.querySelector('.footer-legal')) foot.insertAdjacentHTML('afterbegin', `<p class="fp-stage">[fade to black]</p>${legalLinks}`);
}

if (legal) {
  root.dataset.fp = 'legal';
  legal.querySelectorAll('a[style]').forEach((a) => a.removeAttribute('style'));
  const list = document.querySelector('.navbar .nav-links');
  if (list) list.innerHTML = navLinks; // only the links: film-frame may already have decorated the logo
}

if (kicker?.textContent.trim() === '404') {
  root.dataset.fp = '404';
  kicker.textContent = '[page not found]';
  document.body.insertAdjacentHTML('afterbegin', `<nav class="navbar" aria-label="Primary navigation">${navHTML}</nav>`);
  document.querySelector('main').insertAdjacentHTML('afterend', `<footer><div class="container"><div class="footer-content">${legalLinks}<p>&copy; 2026 Daniel Mora. All rights reserved.</p></div></div></footer>`);

  // the art is fade-to-black's eye (the black hole as its pupil), so either concept shows the same 404
  if (!root.dataset.concept.split(' ').includes('fade-to-black')) {
    root.dataset.concept += ' fade-to-black';
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `/concepts/fade-to-black.css?v=${Date.now()}` }));
    import(`/concepts/fade-to-black.js?v=${Date.now()}`);
  }
}

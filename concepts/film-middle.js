// film-middle: About (portrait + night-Earth route), More systems, Skills (neurons), Websites (iris).
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const A = '/concepts/assets/';
const once = (el, fn, rootMargin = '0px') => {
  if (!el) return;
  if (RM || !('IntersectionObserver' in window)) return fn();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { threshold: 0.15, rootMargin });
  io.observe(el);
};

/* ---------- About ---------- */
const about = $('#aboutMe');
if (about) {
  // His portrait stands apart from the planet: a small plain frame beside the paragraph.
  const pic = $('.profile-image', about);
  if (new URLSearchParams(location.search).get('film-photo') === 'graded') pic.src = A + 'profile-graded.webp';
  $('.about-text', about).insertAdjacentHTML('afterbegin', '<figure class="fm-portrait"></figure>');
  $('.fm-portrait', about).append(pic);
  const box = $('.about-image', about);

  // Cities in the order of his paragraph; x/y from earth-atlantic.json (orthographic, centre 30N 38W).
  const CITIES = ['Santo Domingo', 'Segovia', 'Madrid', 'San Sebastián', 'the US'];
  const AT = [300, 900, 960, 1080, 1700]; // ms after entering view, when the route reaches each light
  const p = $('.about-text p', about);
  let html = p.innerHTML;
  CITIES.forEach((c, i) => { html = html.replace(c, `<span class="fm-city" data-i="${i}" style="--d:${AT[i]}ms">${c}</span>`); });
  p.innerHTML = html;

  const VB = [-16, -16, 532, 328];
  const pct = (x, y) => `left:${((x - VB[0]) / VB[2]) * 100}%;top:${((y - VB[1]) / VB[3]) * 100}%`;
  box.insertAdjacentHTML('beforeend', `<div class="fm-globe" aria-hidden="true"><svg viewBox="${VB.join(' ')}"></svg></div>`);
  const globe = $('.fm-globe', box);

  fetch(A + 'earth-atlantic.json').then((r) => r.json()).then((e) => {
    const c = e.cities, us = e.usCentre; // c[4] is the East Coast landfall
    const xy = (i) => `${c[i].x} ${c[i].y}`;
    const legs = [ // [path, start ms, duration ms]
      [`M${xy(0)}Q238 214 ${xy(1)}`, 300, 600],
      [`M${xy(1)}L${xy(2)}`, 900, 60],
      [`M${xy(2)}L${xy(3)}`, 960, 120],
      [`M${xy(3)}Q250 108 ${xy(4)}`, 1080, 620],
    ];
    const atmo = (id, a, b) => `<radialGradient id="${id}" cx="250" cy="250" r="266" gradientUnits="userSpaceOnUse">
      <stop offset=".9" stop-color="${a}" stop-opacity="0"/><stop offset=".936" stop-color="${a}" stop-opacity=".12"/>
      <stop offset=".941" stop-color="${a}" stop-opacity=".7"/><stop offset=".955" stop-color="${b}" stop-opacity=".22"/>
      <stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>`;
    $('svg', globe).innerHTML = `<defs>${atmo('fmAtmoM', '#d8d4cc', '#3a3936')}${atmo('fmAtmoG', '#ffb347', '#7a1a0a')}
      <radialGradient id="fmGlow"><stop offset="0" stop-color="#ffb347" stop-opacity=".75"/><stop offset=".35" stop-color="#ff5c2a" stop-opacity=".28"/><stop offset="1" stop-color="#7a1a0a" stop-opacity="0"/></radialGradient></defs>
      <circle class="fm-atmo" cx="250" cy="250" r="266" fill="url(#fmAtmoM)"/>
      <circle class="fm-atmo fm-atmo-g" cx="250" cy="250" r="266" fill="url(#fmAtmoG)"/>
      <circle cx="250" cy="250" r="250" fill="#000"/>
      <path class="fm-grat" d="${e.graticulePath}"/><path class="fm-land" d="${e.landPath}"/>
      ${legs.map(([d, s, t]) => `<path class="fm-leg" pathLength="1" d="${d}" style="--d:${s}ms;--t:${t}ms"/>`).join('')}
      <path class="fm-lead" d="M${c[3].x + 3} ${c[3].y - 1}L368 158M${c[1].x + 3} ${c[1].y - 0.5}L368 186M${c[2].x + 3} ${c[2].y + 1}L368 214"/>
      ${c.slice(0, 4).map((k, i) => `<g class="fm-light" data-i="${i}" style="--d:${AT[i]}ms" transform="translate(${k.x} ${k.y})"><circle class="fm-halo" r="9" fill="url(#fmGlow)"/><circle class="fm-core" r="1.5"/></g>`).join('')}
      <path class="fm-light fm-us" data-i="4" style="--d:${AT[4]}ms" d="${e.usPath}"/>`;
    const labels = [[c[0].x + 7, c[0].y + 1], [370, 186], [370, 214], [370, 158], [us.x - 8, us.y]];
    globe.insertAdjacentHTML('beforeend', labels.map(([x, y], i) =>
      `<span class="fm-label" data-i="${i}" style="${pct(x, y)};--d:${AT[i]}ms">${CITIES[i].replace('the ', '')}</span>`).join(''));

    // Name in the paragraph <-> its light (opt-in flare).
    const flare = (i, on) => $$(`[data-i="${i}"]`, about).forEach((n) => n.classList.toggle('is-flare', on));
    $$('.fm-city, .fm-light, .fm-label', about).forEach((n) => {
      n.addEventListener('pointerenter', () => flare(n.dataset.i, true));
      n.addEventListener('pointerleave', () => flare(n.dataset.i, false));
    });
    once(box, () => about.classList.add('fm-on'));
  });
}

/* ---------- More systems ---------- */
const records = $('#projects .project-records');
if (records) {
  $$('.project-record', records).forEach((r, i) => r.style.setProperty('--i', i));
  // The one media record: hover lifts the grey and shows its first evidence line.
  const media = $('.project-record-with-media', records);
  const cap = media && $('.project-evidence li', media);
  if (cap) $(':scope > img', media).insertAdjacentHTML('afterend', `<p class="fm-cap" aria-hidden="true"><span>${cap.textContent}</span></p>`);
  $('#toggleProjectDetails')?.addEventListener('click', () => {
    records.classList.add('fm-chain');
    setTimeout(() => records.classList.remove('fm-chain'), 1200);
  }, true);
}

/* ---------- Skills: one neuron per group, dendrites = item count ---------- */
const skills = $('#skills .skills-grid');
if (skills) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const f = (n) => n.toFixed(1);
  const cats = $$('.skill-category', skills);
  const cx = 100, cy = 60;
  cats.forEach((cat) => {
    const n = $$('li', cat).length;
    let paths = '';
    const branch = (x, y, a, L, depth) => { // one dendrite segment, then two forks
      const b = (rnd() - 0.5) * 0.6, ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L * 0.75;
      const qx = x + Math.cos(a + b) * L * 0.5, qy = y + Math.sin(a + b) * L * 0.4;
      paths += `<path pathLength="1" class="g${depth}" d="M${f(x)} ${f(y)}Q${f(qx)} ${f(qy)} ${f(ex)} ${f(ey)}"/>`;
      if (depth < 2) [-1, 1].forEach((sg) => branch(ex, ey, a + sg * (0.35 + rnd() * 0.3), L * (0.45 + rnd() * 0.2), depth + 1));
    };
    for (let k = 0; k < n; k++) {
      let a = ((k + 0.5) / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5 - Math.PI / 2;
      if (Math.abs(Math.sin(a)) < 0.3) a += Math.sin(a) < 0 ? -0.35 : 0.35; // keep the axon line clear
      branch(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, a, 26 + rnd() * 12, 0);
    }
    $('h3', cat).insertAdjacentHTML('beforeend', ` <span class="fm-count" aria-hidden="true">· ${n} skills</span>`);
    cat.insertAdjacentHTML('afterbegin', `<svg class="fm-neuron" viewBox="0 0 200 120" aria-hidden="true">
      <g class="fm-dend">${paths}</g><g class="fm-sig">${paths}</g>
      <circle class="fm-soma-glow" cx="${cx}" cy="${cy}" r="14"/><circle class="fm-soma" cx="${cx}" cy="${cy}" r="4.5"/></svg>`);
  });
  // Axons between neighbours (shown only when the five groups sit in one row).
  skills.insertAdjacentHTML('afterbegin', `<svg class="fm-axons" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">${
    [0, 1, 2, 3].map((i) => { const x = 100 + i * 200; return `<path d="M${x + 8} 60C${x + 70} 74 ${x + 130} 46 ${x + 192} 60"/><path class="fm-ax-sig" pathLength="1" data-ax="${i}" d="M${x + 8} 60C${x + 70} 74 ${x + 130} 46 ${x + 192} 60"/>`; }).join('')
  }</svg>`);
  const restart = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
  const last = [], lastAx = [];
  const ax = (k, rev) => { // an axon signal (420ms) in flight is never restarted or reversed
    const p = $(`[data-ax="${k}"]`, skills);
    if (!p || performance.now() - (lastAx[k] || 0) < 440) return;
    lastAx[k] = performance.now();
    p.classList.toggle('rev', rev); restart(p, 'go');
  };
  const fire = (i, chain) => {
    const cat = cats[i];
    if (!cat) return;
    const busy = performance.now() - (last[i] || 0) < 1000; // never cut a discharge short (it runs 920ms)
    if (!busy) { last[i] = performance.now(); restart(cat, 'fm-fire'); }
    if (chain) { ax(i, false); setTimeout(() => fire(i + 1, true), 440); return; } // a hover mid-chain doesn't stop it
    if (!busy) { ax(i, false); ax(i - 1, true); }
  };
  cats.forEach((cat, i) => {
    cat.addEventListener('pointerenter', () => fire(i));
    cat.addEventListener('focusin', () => fire(i));
    cat.addEventListener('click', () => fire(i));
  });
  if (!RM) once(skills, () => fire(0, true));
}

/* ---------- Websites: real screenshots, mono until the iris opens ---------- */
const SHOTS = { 'javis-jet': ['sense', '50% 42%'], reusa: ['reusa', '72% 52%'], soler: ['soler', '50% 37%'] };
$$('#websites .website-card').forEach((card) => {
  const key = Object.keys(SHOTS).find((k) => card.href.includes(k));
  if (!key) return;
  const [file, at] = SHOTS[key];
  const [ix, iy] = at.split(' ');
  const img = `src="${A}middle/${file}.webp" alt="" width="800" height="500" loading="lazy" decoding="async"`;
  const type = $('.website-type', card);
  type.textContent = type.textContent.replace(/\s*·\s*\d+$/, '');
  // Info layer: only what the card below doesn't already say, from the section intro and the link itself.
  const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  const info = `<dl class="fm-info">${row('Role', 'Solo build, from scope and design through launch')}${
    row('Client', 'Worked with me directly')}${row('Live', `${new URL(card.href).host.replace(/^www\./, '')} ↗`)}</dl>`;
  card.insertAdjacentHTML('afterbegin', `<div class="fm-shot" style="--ix:${ix};--iy:${iy}" aria-hidden="true"><img class="fm-shot-mono" ${img}><img class="fm-shot-col" ${img}><i class="fm-ring"></i>${info}</div>`);
  // Touch: the first tap on the picture opens the info, a second tap follows the link.
  card.addEventListener('click', (ev) => {
    if (matchMedia('(hover: hover)').matches || !ev.target.closest('.fm-shot') || card.classList.contains('is-info')) return;
    ev.preventDefault();
    $$('#websites .is-info').forEach((c) => c.classList.remove('is-info'));
    card.classList.add('is-info', 'is-open');
  });
  if (RM || !matchMedia('(hover: hover)').matches) once(card, () => card.classList.add('is-open'));
});

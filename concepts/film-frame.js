// film-frame: corner credits, menu wipe, persistent strip, Contact flare, footer end card,
// and MORA-01 as a character whose eyes follow the cursor and glance at what it names.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
const hide = (n) => (n.setAttribute('aria-hidden', 'true'), n);
const pad = (n) => String(n).padStart(2, '0');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-width: 999px)');
const once = (node, fn, threshold = 0.15) => {
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(node);
};
const path = location.pathname;
const isHome = path === '/' || /\/index(\.html)?$/.test(path);

const SOCIAL = [['GitHub', 'https://github.com/daMS2005'], ['LinkedIn', 'https://www.linkedin.com/in/daniel-arturo-mora-00747524b/'], ['Hugging Face', 'https://huggingface.co/dams2005']]
  .map(([t, h]) => `<a href="${h}" target="_blank" rel="noopener noreferrer">${t}</a>`).join('');
const FLAGSHIPS = [['JEPA Transformer', '/jepa-transformer.html'], ['Brain–LLM Feature Correspondence', '/thesis.html'], ['TC_ACC Documentary Studio', '/tc-acc.html']];

// The hero tagline verbatim; each keyword lights once when its section first enters view.
let LINE = 'I build software that holds up in the real world, from web products to machine-learning systems.';
[['I build', 'aboutMe'], ['software', 'projects'], ['real world', 'contact'], ['web products', 'websites'], ['machine-learning systems', 'research']]
  .forEach(([w, k]) => { LINE = LINE.replace(w, `<span data-k="${k}">${w}</span>`); });
const PRELIT = { thesis: 'research', jepa: 'research', 'tc-acc': 'projects', personal: 'aboutMe' };

// ---------- nav: DM + a two-line corner credit ----------
const nav = $('.navbar');
let creditSub = null;
const defaultSub = isHome ? 'New York · 2026' : document.title.split(' · ')[0];
if (nav) {
  const sentinel = el('div', 'ff-sentinel');
  document.body.prepend(hide(sentinel));
  new IntersectionObserver(([e]) => nav.classList.toggle('ff-solid', !e.isIntersecting)).observe(sentinel);
  const logo = $('.logo-link', nav) || $('.logo', nav);
  const credit = hide(el('span', 'ff-credit', '<b>Daniel Mora</b><span></span>'));
  creditSub = credit.lastChild;
  creditSub.textContent = defaultSub;
  if (logo) logo.tagName === 'A' ? logo.append(credit) : logo.after(credit);
  const list = $('#primary-navigation');
  const research = list && $$('a', list).find((a) => a.getAttribute('href').endsWith('#research'));
  research?.closest('li').after(...FLAGSHIPS.map(([t, h]) => el('li', 'ff-sub', `<a href="${h}">${t}</a>`)));
  if (list && !list.classList.contains('legal-nav')) list.append(el('li', 'ff-social', SOCIAL));
  const setH = () => document.documentElement.style.setProperty('--ff-nav-h', `${nav.offsetHeight}px`);
  setH();
  addEventListener('resize', setH);
}

// ---------- persistent strip + section credits ----------
const strip = hide(el('div', 'ff-strip', `<span class="ff-sec"></span><p class="ff-line">${LINE}</p>`));
document.body.append(strip);
const sec = $('.ff-sec', strip);
const pre = Object.keys(PRELIT).find((k) => path.includes(k));
if (pre) $(`[data-k="${PRELIT[pre]}"]`, strip).classList.add('is-lit');
const sections = [];
let current = null;
function setCurrent(s) {
  if (s === current) return;
  current = s;
  const atHero = s.key === 'home';
  document.documentElement.classList.toggle('ff-at-hero', atHero);
  $$('.nav-links a.ff-here').forEach((a) => a.classList.remove('ff-here'));
  s.link?.classList.add('ff-here');
  $(`[data-k="${s.key}"]`, strip)?.classList.add('is-lit');
  const text = atHero ? '' : s.credit();
  sec.style.opacity = 0;
  setTimeout(() => { sec.textContent = text; sec.style.opacity = 1; }, 160);
  if (creditSub) creditSub.textContent = text || defaultSub; // the nav credit names the section; no bottom strip
  if (!atHero) glance($('h2', s.node) || s.node, 1100);
}
const io = new IntersectionObserver((es) => {
  const hit = es.filter((e) => e.isIntersecting).pop();
  if (hit) setCurrent(sections.find((s) => s.node === hit.target));
}, { rootMargin: '-45% 0px -50% 0px' });
// rebuilt on load and on film:sections (page concepts add, reorder and renumber sections); labels are read when shown
function watch() {
  io.disconnect();
  current = null;
  sections.length = 0;
  sections.push(...(isHome
    ? $$('.nav-links a[href^="#"]').map((a, i) => ({ node: $(a.hash), credit: () => `${pad(i + 1)} · ${a.textContent.trim()}`, link: a, key: a.hash.slice(1) }))
    : $$('main h2').map((h, i) => ({ node: h.closest('section') || h, credit: () => (h.parentElement.matches('.detail-section-header') ? h.previousElementSibling?.textContent : `${pad(i + 1)} · ${h.textContent.trim()}`) }))));
  sections.filter((s) => s.node).forEach((s) => io.observe(s.node));
}
document.addEventListener('film:sections', watch);
document.readyState === 'complete' ? watch() : addEventListener('load', watch);

// ---------- Contact: an anamorphic flare collapses to one point; copy flashes it ----------
const contact = $('#contact');
if (contact) {
  const flare = hide(el('div', 'ff-flare', '<i class="ff-streak"></i><i class="ff-halo"></i><i class="ff-point"></i>'));
  ($('.section-heading', contact) || $('h2', contact)).after(flare);
  once(flare, () => flare.classList.add('is-on'), 0.6);
  // the relocation line sits right under the email, the phrase picked out
  const where = $$('.contact-item', contact).find((n) => /relocation/.test(n.textContent));
  const whereText = where && $('span', where);
  if (whereText) {
    where.classList.add('ff-where');
    whereText.innerHTML = whereText.innerHTML.replace(/Open to relocation[^<]*/, (m) => `<b>${m}</b>`);
  }
  const mail = $('a[href^="mailto:"]', contact);
  if (mail && navigator.clipboard) {
    const btn = el('button', 'ff-copy', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/></svg>');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy email address');
    const live = el('span', 'ff-copied');
    live.setAttribute('aria-live', 'polite');
    mail.after(btn, live);
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(mail.href.replace('mailto:', ''));
      live.textContent = 'Copied';
      flare.classList.remove('is-flash');
      void flare.offsetWidth;
      flare.classList.add('is-flash');
      setTimeout(() => { live.textContent = ''; }, 1600);
    });
  }
}

// ---------- footer: [fade to black] decodes once, then dims ----------
$$('footer .footer-content').forEach((fc) => {
  if (!$('.social-links', fc)) fc.prepend(el('div', 'social-links ff-text', SOCIAL));
  if (!$('.footer-legal', fc)) $('.social-links', fc).after(el('p', 'footer-legal', '<a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a>'));
  const T = '[fade to black]';
  const fade = el('p', 'ff-fade', `<span class="ff-sr">${T}</span><span aria-hidden="true">${T}</span>`);
  fc.prepend(fade);
  const endline = hide(el('p', 'ff-line ff-endline', LINE));
  $$('[data-k]', endline).forEach((k) => k.classList.add('is-lit'));
  fc.append(endline);
  once(fade, () => {
    const out = fade.lastChild;
    if (reduce) return fade.classList.add('is-dim');
    let i = 0;
    const t = setInterval(() => {
      out.textContent = [...T].map((c, j) => (j < i || ' []'.includes(c) ? c : String.fromCharCode(97 + Math.floor(Math.random() * 26)))).join('');
      if (i++ >= T.length) { clearInterval(t); fade.classList.add('is-dim'); }
    }, 40);
  }, 0.5);
});

// ---------- MORA-01: eyes that follow the cursor and glance at what it names ----------
const entry = $('#guideEntry');
const eyes = hide(el('span', 'ff-eyes', '<i></i><i></i>'));
entry?.prepend(eyes);
let px = innerWidth * 0.5, py = innerHeight * 0.4, glanceUntil = 0, raf = 0;
let droidLook = null; // set once the 3D droid is hooked
function aim(x, y) {
  const r = eyes.getBoundingClientRect();
  if (!r.width || reduce) return;
  const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
  eyes.style.setProperty('--ex', `${((dx / d) * k * 3.4).toFixed(2)}px`);
  eyes.style.setProperty('--ey', `${((dy / d) * k * 2.4).toFixed(2)}px`);
}
document.addEventListener('pointermove', (e) => {
  px = e.clientX; py = e.clientY;
  raf ||= requestAnimationFrame(() => { raf = 0; if (performance.now() > glanceUntil) aim(px, py); });
}, { passive: true });
function glance(target, ms = 1400) {
  if (!target || reduce) return;
  const r = target.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const x = r.left + Math.min(r.width, 320) / 2, y = r.top + r.height / 2;
  glanceUntil = performance.now() + ms;
  aim(x, y);
  droidLook?.(x, y);
  setTimeout(() => { if (performance.now() >= glanceUntil) aim(px, py); }, ms + 20);
}
if (entry && !reduce) {
  (function blink() {
    setTimeout(() => {
      if (!document.hidden) { eyes.classList.add('is-blink'); setTimeout(() => eyes.classList.remove('is-blink'), 140); }
      blink();
    }, 3500 + Math.random() * 5000);
  })();
  aim(px, py);
}
entry?.addEventListener('click', () => {
  eyes.classList.add('is-happy');
  setTimeout(() => eyes.classList.remove('is-happy'), 900);
  const poll = setInterval(() => { if (hookDroid()) clearInterval(poll); }, 400);
  setTimeout(() => clearInterval(poll), 30000);
});


// What a line names: a flagship card title if on screen, else the section in view.
function subject(text) {
  const card = (re) => $$('#research h3').find((h) => re.test(h.textContent));
  if (/JEPA|ArgusJEPA|CassaFormer/.test(text)) return card(/JEPA/);
  if (/TC_ACC/.test(text)) return card(/TC_ACC/);
  if (/thesis|Brain/i.test(text)) return card(/Brain/);
  return current && current.key !== 'home' ? $('h2', current.node) : null;
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const paint = (t) => `<span class="ff-say">${esc(t).replace(/(JEPA Transformer|ArgusJEPA|CassaFormer|TC_ACC|MORA-01)|(\d[\d.,]*×?)/g,
  (m, name) => `<b class="${name ? 'ff-name' : 'ff-num'}">${m}</b>`)}</span>`;
let talk = null;
function onBubble(bubble) {
  new MutationObserver(() => {
    if ($('.ff-say', bubble) || !bubble.textContent) return;
    const text = bubble.textContent;
    bubble.innerHTML = paint(text);
    const target = subject(text);
    setTimeout(() => glance(target, 1600), 120);
    talk?.(bubble);
  }).observe(bubble, { childList: true });
}
function onPanel(panel) {
  // steer the starter question toward findings; MORA-01 never discusses the paper's submission
  $$('.guide-suggestions button', panel).forEach((b) => { if (/paper/i.test(b.textContent)) b.textContent = 'What did the thesis find?'; });
  const head = $('.guide-chat-head span', panel);
  if (head) head.textContent = 'Ask MORA-01';
}
new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
  if (n.classList?.contains('guide-bubble')) onBubble(n);
  if (n.classList?.contains('guide-chat-panel')) onPanel(n);
}))).observe(document.body, { childList: true });

// 3D droid (loaded on demand by the page): warm rim light, warm eyes, glances, a "voice".
function hookDroid() {
  const d = window.__droid;
  if (!d?.root?.children.length) return false;
  const { THREE, holder, root, scene } = d;
  const eyeMeshes = [];
  root.traverse((o) => { if (o.isMesh && /^Ellipse/.test(o.name)) eyeMeshes.push(o); });
  const eyeMat = eyeMeshes[0]?.material;
  eyeMat?.color.set(0xfff4dc);
  eyeMat?.emissive.set(0xfff4dc);
  scene.traverse((o) => {
    if (!o.isDirectionalLight) return;
    if (o.color.getHex() === 0xaabbff) { o.color.set(0xff5c2a); o.intensity = 2.4; } else { o.color.set(0xfff1e0); o.intensity = 1.3; }
  });
  const goal = new THREE.Vector3();
  holder.lookAt = function (t) {
    return THREE.Object3D.prototype.lookAt.call(this, performance.now() < glanceUntil ? goal : t);
  };
  droidLook = (x, y) => goal.set((x / innerWidth * 2 - 1) * 1.4 - 0.35, 1.35 - (y / innerHeight * 2 - 1) * 0.9, 2);
  // talking: the eyes brighten and dim with the line; click: a happy squint
  talk = (bubble) => {
    if (!eyeMat || reduce) return;
    const t0 = performance.now();
    (function step(now) {
      const on = bubble.classList.contains('visible') && now - t0 < 6000;
      eyeMat.emissiveIntensity = on ? 1.6 + Math.sin((now - t0) / 70) * 0.45 : 1.6;
      if (on) requestAnimationFrame(step);
    })(t0);
  };
  $('#droid-guide')?.addEventListener('click', () => {
    eyeMeshes.forEach((e) => { e.scale.y = e.scale.x * 0.45; });
    setTimeout(() => eyeMeshes.forEach((e) => { e.scale.y = e.scale.x; }), 700);
  });
  return true;
}

// While the page scrolls, nothing reacts to the pointer, so hover reveals don't pop up under a resting cursor.
let scrollIdle;
addEventListener('scroll', () => {
  document.documentElement.classList.add('fx-scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => document.documentElement.classList.remove('fx-scrolling'), 160);
}, { passive: true });

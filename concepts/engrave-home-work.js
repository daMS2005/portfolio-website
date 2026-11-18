// engrave-home-work: the JEPA and thesis flagship visuals as engraved instrument plates. ?concept=film,engrave
// Linework draws on once in view, a gold copy spreads from each diagram's focal part, then everything holds still.
// Layers over film-flagship / film-middle: their text, notes and iris lens stay; only their art is swapped.
const sec = document.getElementById('research');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const f = (n) => Math.round(n * 10) / 10;
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const el = (tag, cls, txt) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, txt ? { textContent: txt } : {});
const until = (test, ms) => new Promise((r) => { const t0 = Date.now(); const k = () => (test() || Date.now() - t0 > ms ? r() : setTimeout(k, 40)); k(); });
let uid = 0;

// an SVG laid over `host` and redrawn on resize; draw() returns its markup
function overlay(host, cls, draw) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', `egw-svg ${cls}`);
  s.setAttribute('aria-hidden', 'true');
  host.append(s);
  const id = `egw${++uid}`;
  const paint = () => {
    const o = host.getBoundingClientRect();
    if (!o.width) return;
    const rel = (n) => { const r = n.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; };
    s.setAttribute('viewBox', `0 0 ${f(o.width)} ${f(o.height)}`);
    s.innerHTML = draw({ w: o.width, h: o.height, rel, id });
  };
  new ResizeObserver(paint).observe(host);
  paint();
  return paint;
}
// draw-on once in view; egw-done drops the animations so later redraws (resize) never replay them
function enter(node, ms, then) {
  node.classList.add('egw-armed');
  const go = () => {
    if (still) node.classList.add('egw-done');
    node.classList.add('egw-on');
    then?.();
    setTimeout(() => node.classList.add('egw-done'), ms);
  };
  if (still) return go();
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '0px 0px -22% 0px' });
  io.observe(node);
}
const path = (d, cls, extra = '') => (d ? `<path class="${cls}" pathLength="1" d="${d}"${extra}/>` : '');
const corners = (x, y, w, h, k) => `M${f(x)} ${f(y + k)}V${f(y)}H${f(x + k)}M${f(x + w - k)} ${f(y)}H${f(x + w)}V${f(y + k)}M${f(x + w)} ${f(y + h - k)}V${f(y + h)}H${f(x + w - k)}M${f(x + k)} ${f(y + h)}H${f(x)}V${f(y + h - k)}`;
const ring = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
// the gold copy: radial gold gradient at the focal point, revealed by a growing soft disc (as the intro's iris)
const goldDefs = (id, cx, cy, R, w, h) => `<defs>
  <radialGradient id="${id}g" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}"><stop offset=".12" stop-color="#fff4dc"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5c2a"/></radialGradient>
  <radialGradient id="${id}s"><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${f(w)}" height="${f(h)}"><g transform="translate(${f(cx)} ${f(cy)})"><circle class="egw-iris" r="${f(R * 1.05)}" fill="url(#${id}s)"/></g></mask>
</defs>`;

// ---- engraved diagram: hairline frames, a hatched cast shadow per node (cross-hatched on accents), registration marks
function etch(dg, focal) {
  overlay(dg, 'egw-etch', ({ w, h, rel, id }) => {
    const rnd = rng(5);
    let reg = '', hat = '', cross = '';
    const fr = { bone: '', ember: '', amber: '', teal: '' };
    for (const st of dg.querySelectorAll('.dg-stage')) { const r = rel(st); reg += corners(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 9); }
    for (const n of dg.querySelectorAll('.dg-node')) {
      const r = rel(n), x1 = r.x + r.w, y1 = r.y + r.h, s = w < 500 ? 4.5 : 6, g = 2.1;
      const tone = n.matches('.dg-accent') ? 'ember' : n.matches('.dg-row-pair .dg-node:first-child') ? 'amber' : n.matches('.dg-row-pair .dg-node:last-child') ? 'teal' : 'bone';
      fr[tone] += `M${f(r.x)} ${f(r.y)}H${f(x1)}V${f(y1)}H${f(r.x)}Z`;
      const l = () => f(s - 0.6 * rnd()); // a slight burr: some cuts stop a hair short
      for (let x = r.x + s; x < x1; x += g) { const k = l(); hat += `M${f(x)} ${f(y1 + 1)}l${k} ${k}`; }
      for (let y = r.y + s; y < y1; y += g) { const k = l(); hat += `M${f(x1 + 1)} ${f(y)}l${k} ${k}`; }
      if (tone === 'ember') {
        for (let x = r.x + 2 * s; x < x1 + s; x += g * 1.6) { const k = l(); cross += `M${f(x)} ${f(y1 + 1)}l${-k} ${k}`; }
        for (let y = r.y + s; y < y1; y += g * 1.6) { const k = l(); cross += `M${f(x1 + 1 + s)} ${f(y)}l${-k} ${k}`; }
      }
    }
    const c = rel(focal), cx = c.x + c.w / 2, cy = c.y + c.h / 2, R = 140;
    const lines = (k) => `${path(fr.bone, `egw-fr${k}`)}${path(fr.amber, `egw-fr${k} egw-amber`)}${path(fr.teal, `egw-fr${k} egw-teal`)}${path(fr.ember, `egw-fr${k} egw-ember`)}`
      + `${path(hat, `egw-hat${k}`, ' style="--d:350ms"')}${path(cross, `egw-hat${k} egw-cross`, ' style="--d:650ms"')}`;
    return `${goldDefs(id, cx, cy, R, w, h)}${path(reg, 'egw-draw egw-reg')}
      <g class="egw-ink">${lines(' egw-draw')}</g>
      <g class="egw-gold" stroke="url(#${id}g)" mask="url(#${id}m)">${lines('')}</g>`;
  });
}

// ---- 01 JEPA: the embedding space as a stipple plate, one dot per company, Oct 2026 (real cluster of every company)
// island centres, colours and names from javascript-files/jepa-map.js; x calmer -> riskier, y winners -> losers
const VIC = [[.30, .50, '#6ccb5f', 'Low-beta defensives'], [.50, .48, '#b9b39f', 'Average stock, normal market'], [.88, .15, '#c9f04a', 'Volatile growth winners'],
  [.66, .72, '#f28c38', 'Caught in market stress'], [.86, .90, '#ff4d94', 'Crashed cyclicals'], [.06, .22, '#9cc6ff', 'Mega-cap staples'],
  [.10, .60, '#4c8df6', 'Utilities & REITs'], [.08, .88, '#a08cff', 'Foreign large caps'], [.27, .18, '#45c4c0', 'Large quality compounders'],
  [.94, .58, '#e8566c', 'Small & distressed'], [.30, .82, '#6fd3e8', 'Calm large caps, calm market'], [.66, .30, '#e0c068', 'Small, volatile, thin data']];
const OG = [[.42, .52], [.78, .80], [.62, .55], [.70, .20], [.36, .25], [.17, .52], [.90, .14], [.62, .90], [.45, .84], [.07, .86], [.93, .58], [.08, .18]];
const TICK = { AAPL: [14, 11, 'start'], GOOGL: [16, 13, 'start'], MSFT: [-12, 30, 'end'], TSLA: [18, 26, 'start'] }; // label offsets
async function jepa(card) {
  const dg = card.querySelector('.dg');
  let j;
  try { j = await (await fetch('/concepts/assets/engrave/home-work/jepa-oct-2026.json')).json(); } catch { return; } // keep film's galaxy
  const b64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const og = b64(j.og), vic = b64(j.vic), n = vic.length; // rows are ordered largest market cap first
  const cO = Array(12).fill(0), cV = Array(12).fill(0), kO = [], kV = [];
  for (let i = 0; i < n; i++) { kO.push(cO[og[i]]++); kV.push(cV[vic[i]]++); }

  const plate = el('div', 'egw-emb egw-og');
  const head = el('div', 'egw-emb-head'), seg = el('div', 'egw-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Encoder');
  const bOg = el('button', '', 'Original · ≈3 dims'), bVic = el('button', '', 'VICReg · ≈370 dims');
  for (const b of [bOg, bVic]) { b.type = 'button'; seg.append(b); }
  head.append(el('span', '', `Embedding space · Oct 2026 · ${n.toLocaleString('en')} companies, one dot each`), seg);
  const box = el('div', 'egw-emb-box');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${n} companies in October 2026, one dot each, in twelve clusters placed by forecast volatility (calmer left, riskier right) and 12-month momentum (winners up, losers down). The original encoder squeezes them onto one flat axis; with VICReg they separate into islands.`);
  plate.append(head, box, el('p', 'egw-emb-note', 'The first encoder collapsed to about 3 effective dimensions; a VICReg variance–covariance penalty keeps about 370 in use.'));
  (dg.querySelector('.ff-galaxy') || dg.querySelector('.dg-bridge')).after(plate);
  dg.querySelector('.ff-galaxy')?.remove(); // replaced by this plate

  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'egw-svg egw-emb-svg');
  s.setAttribute('aria-hidden', 'true');
  const rnd = rng(3);
  const jit = Array.from({ length: n }, () => [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7]);
  s.innerHTML = `<g class="egw-hud"></g><g class="egw-dots">${Array.from(vic, (c, i) => `<circle r="${f(0.5 + 0.85 / (1 + kV[i] / 10))}" style="--c:${VIC[c][2]}"/>`).join('')}</g>`;
  box.append(s);
  const hud = s.firstChild, dots = [...s.lastChild.children];
  let mode = 'og', P = null;

  // sunflower island: biggest companies at the centre; sizes scale with sqrt(count), as in the map player
  const at = (C, cnt, c, k, flat) => {
    const R = 0.21 * P.k * Math.sqrt(cnt[c] / 324), sp = R / Math.sqrt(cnt[c]), r = sp * Math.sqrt(k + 0.5), a = k * 2.39996;
    let x = P.x + C[c][0] * P.w + r * Math.cos(a), y = P.y + C[c][1] * P.h + r * Math.sin(a);
    if (flat) { // the collapsed encoder: an edge-on disk, tilted a few degrees
      const mx = P.x + P.w / 2, my = P.y + P.h / 2, dx = x - mx, dy = (y - my) * 0.07, t = -0.07;
      x = mx + dx * Math.cos(t) - dy * Math.sin(t); y = my + dx * Math.sin(t) + dy * Math.cos(t);
    }
    return [x, y];
  };
  const isl = (c) => { const R = 0.21 * P.k * Math.sqrt(cV[c] / 324); return [P.x + VIC[c][0] * P.w, P.y + VIC[c][1] * P.h, R]; };
  function place(animate) {
    s.classList.toggle('egw-snap', !animate);
    const fx = P.x + P.w / 2, fy = P.y + P.h / 2, far = Math.hypot(P.w, P.h) / 2;
    dots.forEach((d, i) => {
      const [x, y] = mode === 'vic' ? at(VIC, cV, vic[i], kV[i], false) : at(OG, cO, og[i], kO[i], true);
      const [cx, cy] = isl(vic[i]);
      d.style.transform = `translate(${f(x + jit[i][0])}px,${f(y + jit[i][1])}px)`;
      // opening: islands leave the disk core first; colour spreads outward from the plate's centre (the gold-reveal beat)
      d.style.setProperty('--dl', `${mode === 'vic' ? Math.round(Math.hypot(cx - fx, cy - fy) / far * 450) : Math.round(rnd() * 200)}ms`);
      d.style.setProperty('--dc', `${mode === 'vic' ? 250 + Math.round(Math.hypot(x - fx, y - fy) / far * 900) : 0}ms`);
    });
    plate.classList.toggle('egw-og', mode === 'og');
    plate.classList.toggle('egw-vic', mode === 'vic');
    bOg.setAttribute('aria-pressed', String(mode === 'og'));
    bVic.setAttribute('aria-pressed', String(mode === 'vic'));
  }
  function frame() {
    const W = box.clientWidth, H = box.clientHeight;
    if (!W) return;
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    P = { x: 34, y: 12, w: W - 46, h: H - 36 };
    P.k = Math.min(P.h, P.w * 0.6);
    const x0 = P.x - 10, yB = P.y + P.h + 8;
    let ax = `M${x0} ${P.y}V${yB}H${P.x + P.w}`, tk = '';
    for (let i = 0; i <= 10; i++) {
      const m = i % 5 ? 3 : 6;
      tk += `M${x0} ${f(P.y + (i / 10) * P.h)}h${-m}M${f(P.x + (i / 10) * P.w)} ${yB}v${m}`;
    }
    let rings = '', notes = '', counts = '', ticks = '';
    const room = (x, y, self) => Math.min(x - P.x, P.x + P.w - x, y - P.y + 6, ...VIC.map((_, o) => { const [ox, oy, oR] = isl(o); return o === self ? 99 : Math.hypot(x - ox, y - oy) - oR; }),
      ...Object.values(j.track).map((i) => { const [tx, ty] = at(VIC, cV, vic[i], kV[i], false); return Math.hypot(x - tx, y - ty) - 4; }));
    VIC.forEach(([, , , name], c) => {
      const [cx, cy, R] = isl(c), q = R + 4.5;
      const ey = room(cx, cy - q, c) >= room(cx, cy + q, c) ? -q : q; // the count sits on its ring, top or bottom, whichever is clearer
      rings += `<g class="egw-isl egw-vic-only" data-ff-note="${name}\n${cV[c]} companies · Oct 2026">${path(ring(cx, cy, q), 'egw-draw egw-ring', ` style="--d:${1500 + c * 40}ms"`)}</g>`;
      counts += `<text class="egw-fade egw-vic-only egw-count" x="${f(cx)}" y="${f(cy + ey + 3)}" text-anchor="middle" style="--d:${1900 + c * 40}ms">${cV[c]}</text>`;
      if (c === 1) notes = path(`${ring(cx, cy, q + 7)}M${f(cx)} ${f(cy - q - 7)}v-5M${f(cx)} ${f(cy + q + 7)}v5M${f(cx - q - 7)} ${f(cy)}h-5M${f(cx + q + 7)} ${f(cy)}h5`, 'egw-draw egw-focal egw-vic-only', ' style="--d:1300ms"');
    });
    for (const [sym, [dx, dy, anchor]] of Object.entries(TICK)) {
      const i = j.track[sym];
      if (i == null) continue;
      const [x, y] = at(VIC, cV, vic[i], kV[i], false), lx = x + dx, ly = y + dy;
      ticks += `<g class="egw-vic-only">${path(`${ring(x, y, 3.2)}M${f(x + Math.sign(dx) * 3.2)} ${f(y + Math.sign(dy) * 1)}L${f(lx)} ${f(ly)}h${Math.sign(dx) * 4}`, 'egw-draw egw-lead', ' style="--d:2100ms"')}`
        + `<text class="egw-fade egw-sym" x="${f(lx + Math.sign(dx) * 6)}" y="${f(ly + 3)}" text-anchor="${anchor}" style="--d:2300ms">${sym}</text></g>`;
    }
    const t = (x, y, txt, cls = '', a = 'start', extra = '') => `<text class="egw-fade egw-axis ${cls}" x="${f(x)}" y="${f(y)}" text-anchor="${a}"${extra}>${txt}</text>`;
    hud.innerHTML = path(ax, 'egw-draw egw-axisline') + path(tk, 'egw-draw egw-axisline', ' style="--d:200ms"')
      + path(corners(1, 1, W - 2, H - 2, 8), 'egw-draw egw-reg')
      + t(P.x, H - 3, 'calmer') + t(P.x + P.w / 2, H - 3, 'forecast volatility', 'egw-dim', 'middle') + t(P.x + P.w, H - 3, 'riskier', '', 'end')
      + t(x0 - 9, P.y, 'winners', '', 'end', ` transform="rotate(-90 ${x0 - 9} ${P.y})"`)
      + t(x0 - 9, P.y + P.h, 'losers', '', 'start', ` transform="rotate(-90 ${x0 - 9} ${P.y + P.h})"`)
      + `<g class="egw-og-only">${path(`M${P.x} ${f(P.y + P.h / 2 + P.w * 0.035)}L${P.x + P.w} ${f(P.y + P.h / 2 - P.w * 0.035)}`, 'egw-plane')}`
      + t(P.x + P.w / 2, P.y + 14, '≈3 effective dims', 'egw-ogtxt', 'middle') + t(P.x + P.w / 2, P.y + 27, '80% of the variance on one volatility axis', 'egw-ogtxt', 'middle') + '</g>'
      + rings + notes + counts + ticks;
    place(false);
  }
  const go = (m) => { if (m !== mode) { mode = m; place(!still); } };
  bOg.onclick = () => go('og');
  bVic.onclick = () => go('vic');
  new ResizeObserver(frame).observe(box);
  frame();
  enter(plate, 3200, () => (still ? go('vic') : setTimeout(() => go('vic'), 650)));
}

// ---- 02 thesis: the verdict as two instrument scales (rho on -1..+1; detection of planted agreement vs the 80% target)
function verdictScales(v) {
  const box = el('div', 'egw-gauge');
  v.append(box);
  overlay(box, 'egw-gauge-svg', ({ w, id }) => {
    const L = 2, R = w - 2, X = (u) => L + u * (R - L), y1 = 32, y2 = 90, rho = -0.056, mx = X((rho + 1) / 2);
    let t1 = `M${L} ${y1}H${R}`, t2 = `M${L} ${y2}H${R}`, hat = '';
    for (let i = 0; i <= 20; i++) t1 += `M${f(X(i / 20))} ${y1}v${i % 10 ? (i % 5 ? 3 : 5) : 7}`;
    for (let i = 0; i <= 10; i++) t2 += `M${f(X(i / 10))} ${y2}v${i % 5 ? 3 : 7}`;
    for (let x = L - 8; x < X(0.1); x += 2.2) { const a = Math.max(x, L), b = Math.min(x + 8, X(0.1)); if (b > a) hat += `M${f(a)} ${f(y2 - 2 - (a - x))}L${f(b)} ${f(y2 - 2 - (b - x))}`; }
    const txt = (x, y, s, cls = '', a = 'start') => `<text class="egw-fade egw-axis ${cls}" x="${f(x)}" y="${y}" text-anchor="${a}">${s}</text>`;
    return `<defs><linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="#fff4dc"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5c2a"/></linearGradient></defs>
      ${txt(L, 9, 'Feature-order agreement vs null, 12 conditions', 'egw-dim')}
      ${path(t1, 'egw-draw egw-axisline')}
      ${txt(X(0), y1 + 16, '−1')}${txt(X(0.5), y1 + 16, '0', '', 'middle')}${txt(X(1), y1 + 16, '+1', '', 'end')}
      ${path(`M${f(mx)} ${y1 - 10}V${y1 + 7}M${f(mx - 3.5)} ${y1 - 14}h7l-3.5 4z`, 'egw-draw egw-mark', ` style="--d:500ms;stroke:url(#${id}h)"`)}
      ${txt(mx - 8, y1 - 5, 'ρ = −.056 · p = .805', 'egw-val', 'end')}
      ${txt(L, y2 - 24, 'Planted agreement found, share of runs', 'egw-dim')}
      ${path(t2, 'egw-draw egw-axisline', ' style="--d:250ms"')}
      ${path(hat, 'egw-draw egw-hatch', ' style="--d:700ms"')}
      ${path(`M${f(X(0.8))} ${y2 - 12}V${y2 + 7}`, 'egw-draw egw-target', ' style="--d:900ms"')}
      ${txt(X(0.1) + 5, y2 - 4, '≤ 10%', 'egw-val')}${txt(X(0.8) - 4, y2 - 4, '80% target', 'egw-tgt', 'end')}
      ${txt(X(0), y2 + 16, '0')}${txt(X(0.5), y2 + 16, '50%', '', 'middle')}${txt(X(1), y2 + 16, '100%', '', 'end')}`;
  });
}

// ---- boot: wait for film's scenes (modules load async), then layer on top
(async () => {
  if (!sec) return;
  await until(() => sec.querySelector('.ff-fil'), 3000);
  const jc = sec.querySelector('.flagship-jepa'), tc = sec.querySelector('.flagship-thesis');
  for (const [card, focal] of [[jc, '.dg-accent'], [tc, '.dg-accent']]) {
    const dg = card?.querySelector('.dg');
    if (!dg) continue;
    etch(dg, dg.querySelector(focal));
    enter(dg, 2400);
  }
  const v = tc?.querySelector('.dg-verdict');
  if (v) verdictScales(v);
  jepa(jc);
})();

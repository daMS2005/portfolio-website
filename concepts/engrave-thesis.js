// engrave-thesis: the thesis page's model side in the opening's engraved line art (?concept=film,engrave).
// The locked 16 x 16 bank of 256 feature IDs beside six layer plates in depth, drawn once in SVG; the rest of the page stays film.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1 = (n) => n.toFixed(1);
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const T = (x, y, s, cls = 'tk', a = 'start') => `<text x="${f1(x)}" y="${f1(y)}" class="${cls}" text-anchor="${a}">${s}</text>`;
const draw = (d, w, extra = '', delay = 0) => d ? `<path d="${d}" stroke-width="${w}" pathLength="1" class="egt-draw" style="--d:${delay}s" ${extra}/>` : '';
const corners = (x, y, w, h, l = 6) => [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]].map(([a, b, i, j]) => `M${f1(a)} ${f1(b + j * l)}V${f1(b)}H${f1(a + i * l)}`).join('');
const square = (x, y, a) => `M${f1(x)} ${f1(y)}h${f1(a)}v${f1(a)}h${f1(-a)}Z`;

// once in view: armed (undrawn) -> on (lines draw on), then still
function onView(el, thr = 0.25) {
  if (still) return el.classList.add('egt-on');
  el.classList.add('egt-armed');
  new IntersectionObserver(([e], io) => {
    if (e.intersectionRatio >= thr - 0.01) { io.disconnect(); el.classList.add('egt-on'); }
  }, { threshold: thr }).observe(el);
}
// an SVG built at its box's own pixel width (text stays 12px on phones), rebuilt only when the width changes
function sized(el, build) {
  let last = 0;
  const go = () => { const w = Math.round(el.clientWidth); if (w && w !== last) { last = w; el.innerHTML = build(w); } };
  new ResizeObserver(go).observe(el);
  go();
}
// replace the film canvas with an engraved stage that keeps its accessible description
function stage(cv, cls) {
  const el = document.createElement('div');
  el.className = `egt-art ${cls}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', cv.getAttribute('aria-label') || '');
  cv.before(el);
  cv.classList.add('egt-hidden');
  cv.removeAttribute('role');
  cv.setAttribute('aria-hidden', 'true');
  return el;
}

/* ---------- model side: the locked bank and six layer plates in depth ---------- */
function model(cv) {
  const el = stage(cv, 'egt-model');
  sized(el, (w) => {
    const h = Math.round(w / 2.2), q = Math.min(10, (h * 0.62) / 16), bx = 6, by = (h - 16 * q) / 2;
    const ph = h * 0.74, dx = Math.min(ph * 0.3, (w - bx - 16 * q) * 0.07), dy = ph * 0.14, y0 = (h - ph) / 2 + dy / 2;
    const x0 = bx + 16 * q + Math.max(40, w * 0.16), step = (w - 8 - dx - x0) / 5, COLS = 5, ROWS = 12, rnd = rng(23);
    const at = (i, u, v) => [x0 + i * step + u * dx, y0 + v * ph - u * dy];
    let plates = '', grid = '', lit = '', links = '', fan = '';
    const LIT = [];
    for (let i = 0; i < 6; i++) {
      const c = [at(i, 0, 0), at(i, 1, 0), at(i, 1, 1), at(i, 0, 1)];
      plates += `M${c.map((p) => p.map(f1).join(' ')).join('L')}Z`;
      for (let u = 1; u < COLS; u++) { const a = at(i, u / COLS, 0), b = at(i, u / COLS, 1); grid += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
      for (let v = 1; v < ROWS; v++) { const a = at(i, 0, v / ROWS), b = at(i, 1, v / ROWS); grid += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; }
      // plate thickness, engraved as short ticks along the near edge
      for (let v = 0; v <= 1.001; v += 1 / 36) { const [x, y] = at(i, 0, v); plates += `M${f1(x)} ${f1(y)}l-2.5 1.2`; }
      LIT[i] = [0, 1, 2].map(() => [(rnd() * COLS) | 0, (rnd() * ROWS) | 0]);
      for (const [u, v] of LIT[i]) for (let k = 1; k < 4; k++) {
        const a = at(i, (u + 0.15) / COLS, (v + k / 4) / ROWS), b = at(i, (u + 0.85) / COLS, (v + k / 4) / ROWS);
        lit += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
      }
    }
    const mid = (i, [u, v]) => at(i, (u + 0.5) / COLS, (v + 0.5) / ROWS);
    for (let i = 0; i < 5; i++) for (const a of LIT[i]) for (const b of LIT[i + 1]) if (rnd() < 0.35) {
      const [ax, ay] = mid(i, a), [bx2, by2] = mid(i + 1, b);
      links += `M${f1(ax)} ${f1(ay)}C${f1((ax + bx2) / 2)} ${f1(ay)} ${f1((ax + bx2) / 2)} ${f1(by2)} ${f1(bx2)} ${f1(by2)}`;
    }
    const picks = [37, 90, 141, 203, 230];
    for (const [k, id] of picks.entries()) {
      const [tx, ty] = mid(0, LIT[0][k % 3]), sx = bx + (id & 15) * q + q / 2, sy = by + (id >> 4) * q + q / 2;
      fan += `M${f1(sx)} ${f1(sy)}C${f1(sx + (tx - sx) * 0.55)} ${f1(sy)} ${f1(tx - (tx - sx) * 0.35)} ${f1(ty)} ${f1(tx)} ${f1(ty)}`;
    }
    const bank = [...Array(256).keys()].map((i) => square(bx + (i & 15) * q + q * 0.2, by + (i >> 4) * q + q * 0.2, q * 0.6)).join('');
    const pickD = picks.map((id) => { let d = ''; for (let k = 1; k < 4; k++) d += `M${f1(bx + (id & 15) * q + q * 0.28)} ${f1(by + (id >> 4) * q + q * (0.2 + k * 0.15))}h${f1(q * 0.44)}`; return d; }).join('');
    const ry = y0 + ph + 8, xs = [0, 1, 2, 3, 4, 5].map((i) => x0 + i * step + dx / 2);
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <g fill="none" stroke="#d8d4cc">${draw(bank, 0.6, 'stroke-opacity=".45"')}${draw(corners(bx - 4, by - 4, 16 * q + 8, 16 * q + 8), 0.8, 'stroke-opacity=".7"', 0.2)}</g>
      ${T(bx + 8 * q, by - 10, '16 × 16 = 256', 'tk egt-label', 'middle')}
      <g fill="none" stroke="#8fcac5">${draw(plates, 0.7, 'stroke-opacity=".6"', 0.2)}${draw(grid, 0.5, 'stroke-opacity=".2"', 0.4)}${draw(pickD, 1.1, '', 0.6)}${draw(lit, 1.1, '', 1)}
        ${draw(fan, 0.7, 'stroke-opacity=".5"', 0.8)}${draw(links, 0.6, 'stroke-opacity=".35"', 1)}</g>
      <g fill="none" stroke="#8fcac5" stroke-opacity=".45">${draw(`M${f1(xs[0])} ${f1(ry)}H${f1(xs[5] + 10)}m-4 -3l4 3l-4 3` + xs.map((x) => `M${f1(x)} ${f1(ry - 3)}v6`).join(''), 0.6, '', 1)}</g>
    </svg>`;
  });
  onView(el, 0.3);
}

function start() {
  const cv = document.querySelector('.ft-ai canvas');
  if (cv) model(cv);
}
if (location.pathname.includes('thesis')) {
  if (document.querySelector('.ft-ai canvas')) start();
  else document.addEventListener('film:sections', start, { once: true });
}

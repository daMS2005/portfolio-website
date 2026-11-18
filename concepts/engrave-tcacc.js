// engrave-tcacc: tc-acc.html in the opening's engraved-instrument language (?concept=film,engrave).
// Title card: the pipeline engraved as a reel, one turn per stage (26 production stages + 2 Showrunner review gates).
const main = document.querySelector('main.case-page');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1 = (n) => n.toFixed(1);
const SEQ = [['Research', 5], ['Story', 4], ['Assets', 7], ['gate', 1], ['Animation', 2], ['gate', 1], ['Publishing', 8]]; // index.html .pipeline-strip

const until = (sel) => new Promise((res) => {
  const t0 = performance.now();
  (function f() { const el = document.querySelector(sel); if (el || performance.now() - t0 > 4000) res(el); else setTimeout(f, 30); })();
});
const once = (el, fn, threshold = 0.3) => {
  if (reduced) return fn(el);
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(el); } }, { threshold });
  io.observe(el);
};
const lit = (el) => el.classList.add('egc-on');

// stage numbers per block in pipeline order: departments 1-26, gates 27 and 28
const blocks = (() => {
  let s = 1, g = 27, t = 0;
  return SEQ.map(([name, n]) => {
    const b = name === 'gate' ? { name: 'Showrunner review', from: g, to: g++, gate: true } : { name, from: s, to: (s += n) - 1 };
    b.t0 = t; b.n = n; t += n;
    return b;
  });
})();

async function run() {
  if (!main) return;
  await until('.tc-title');
  reel();
}

// ---------- title card: the reel. 28 turns wound out from the hub, gold spreading from the hub like the iris
function reel() {
  const title = main.querySelector('.tc-title'), stats = title?.querySelector('.stat-row');
  if (!stats) return;
  const W = 400, H = 300, cx = 136, cy = 150, r0 = 24, r1 = 128, pitch = (r1 - r0) / 28, a0 = -Math.PI / 2;
  const R = (t) => r0 + pitch * t, P = (t) => [cx + R(t) * Math.cos(a0 + t * 2 * Math.PI), cy + R(t) * Math.sin(a0 + t * 2 * Math.PI)];
  const turn = (k) => { let d = ''; for (let j = 0; j <= 72; j++) { const [x, y] = P(k + j / 72); d += `${j ? 'L' : 'M'}${f1(x)} ${f1(y)}`; } return d; };
  let turns = '', gold = '', perf = '';
  blocks.forEach((b, i) => {
    for (let k = b.t0; k < b.t0 + b.n; k++) {
      const d = turn(k);
      turns += `<path pathLength="1" class="${b.gate ? 'egc-gt' : `egc-d${i % 2}`}" style="--k:${k}" d="${d}"/>`;
      gold += `<path d="${d}"/>`;
      if (b.gate) for (let j = 0; j < 24; j++) { // the gate turn is perforated: a check at every 15 degrees
        const t = k + j / 24, a = a0 + t * 2 * Math.PI, r = R(t);
        perf += `M${f1(cx + (r - 2.2) * Math.cos(a))} ${f1(cy + (r - 2.2) * Math.sin(a))}L${f1(cx + (r + 2.2) * Math.cos(a))} ${f1(cy + (r + 2.2) * Math.sin(a))}`;
      }
    }
  });
  // hub: radial hatching around a square spindle
  let hub = '';
  for (let j = 0; j < 40; j++) { const a = (j / 40) * 2 * Math.PI; hub += `M${f1(cx + 9 * Math.cos(a))} ${f1(cy + 9 * Math.sin(a))}L${f1(cx + 16 * Math.cos(a))} ${f1(cy + 16 * Math.sin(a))}`; }
  // dial: 28 ticks on an outer ring, majors where a block starts
  let dial = '';
  const starts = new Set(blocks.map((b) => b.t0));
  for (let k = 0; k < 28; k++) {
    const a = a0 + (k / 28) * 2 * Math.PI, l = starts.has(k) ? 7 : 3.5, r = r1 + 8;
    dial += `M${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}L${f1(cx + (r + l) * Math.cos(a))} ${f1(cy + (r + l) * Math.sin(a))}`;
  }
  // callouts: each block's middle turn, read off where a straight leader from its label meets the spiral
  const xL = 286, gap = (H - 56) / (blocks.length - 1);
  const call = blocks.map((b, i) => {
    const y = 28 + i * gap, ang = Math.atan2(y - cy, xL - cx), mid = b.t0 + Math.floor(b.n / 2);
    const t = mid + ((ang - a0 + 4 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI), [x0, y0] = P(t);
    const range = b.from === b.to ? `${b.from}` : `${b.from}–${b.to}`;
    return `<path pathLength="1" class="egc-lead${b.gate ? ' egc-lg' : ''}" d="M${f1(x0)} ${f1(y0)}L${xL} ${f1(y)}h6"/><circle class="egc-pin${b.gate ? ' egc-lg' : ''}" cx="${f1(x0)}" cy="${f1(y0)}" r="1.6"/>
      <text x="${xL + 9}" y="${f1(y + 3.5)}"><tspan class="egc-nm${b.gate ? ' egc-lg' : ''}">${b.name}</tspan><tspan class="egc-rg" dx="5">${range}</tspan></text>`;
  }).join('');
  const fig = document.createElement('figure');
  fig.className = 'egc-reel';
  fig.setAttribute('aria-hidden', 'true');
  fig.innerHTML = `<svg viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="egcRg" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r1}"><stop offset=".12" stop-color="#fff4dc"/><stop offset=".32" stop-color="#ffb347"/><stop offset=".75" stop-color="#ff5c2a"/></radialGradient>
      <radialGradient id="egcRs"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="egcRm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><circle class="egc-grow" cx="${cx}" cy="${cy}" r="${r1 * 0.85}" fill="url(#egcRs)"/></mask>
    </defs>
    <path class="egc-dial" d="${dial}"/>
    <g class="egc-turns">${turns}</g>
    <path class="egc-perf" d="${perf}"/>
    <g class="egc-goldt" mask="url(#egcRm)">${gold}</g>
    <circle class="egc-hubr" cx="${cx}" cy="${cy}" r="16"/><path class="egc-hub" d="${hub}"/><rect class="egc-hubr" x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7"/>
    <g class="egc-call">${call}</g>
  </svg><figcaption>One turn per stage, wound out from the hub: 26 production stages, 2 Showrunner review gates.</figcaption>`;
  stats.before(fig);
  once(fig, lit, 0.3);
}

run();

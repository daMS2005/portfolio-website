// Thesis art: every mark is a measured value from the thesis artifacts (data/thesis-art.json).
// I   the story: group-mean cleaned BOLD (200 parcels) above, Gemma 2 2B SAE features (256) below, one playhead
// II  the brain: listener agreement (ISC) next to held-out prediction r of the feature bank, same scale
// III the test: observed brain-model reliance agreement against 199 retimed refits, then the calibration
import { BAYER, clamp01, seg } from './film.js';

const BG = [8, 9, 10], INK = '#f5f3ef', MUTED = '#9b968f', FAINT = '#5f5b56', ORANGE = '#ff5c2a';
const NET_NAMES = ['Visual', 'Somatomotor', 'Dorsal attn', 'Ventral attn', 'Limbic', 'Control', 'Default'];
const R_MAX = 0.75; // both maps share one correlation scale
const T = { sweep: [0.03, 0.43], x1: [0.46, 0.54], x2: [0.72, 0.78], nulls: [0.79, 0.88], calib: [0.88, 0.95] };

const ramp = stops => {
  const L = new Uint8ClampedArray(768);
  for (let i = 0; i < 256; i++) {
    const v = i / 255; let k = 1;
    while (k < stops.length - 1 && stops[k][0] < v) k++;
    const [a, ca] = stops[k - 1], [b, cb] = stops[k], f = clamp01((v - a) / (b - a));
    for (let c = 0; c < 3; c++) L[i * 3 + c] = ca[c] + (cb[c] - ca[c]) * f;
  }
  return L;
};
const WARM = ramp([[0, BG], [0.3, [58, 22, 14]], [0.55, [168, 56, 26]], [0.78, [255, 104, 50]], [1, [255, 228, 200]]]);
const COOL = ramp([[0, BG], [0.25, [18, 36, 58]], [0.6, [66, 136, 202]], [1, [228, 242, 255]]]);
const MAPC = ramp([[0, [34, 29, 27]], [0.22, [96, 36, 20]], [0.5, [214, 76, 32]], [0.75, [255, 150, 92]], [1, [255, 232, 208]]]);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const mmss = s => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
const f3 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace(/^0/, '');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const reduced = o => o.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export async function load(url = new URL('./data/thesis-art.json', import.meta.url)) {
  const j = await (await fetch(url)).json();
  const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rle = bytes(j.views.rle), lab = new Uint8Array(4 * j.views.w * j.views.h);
  for (let i = 0, o = 0; i < rle.length; i += 2) lab.fill(rle[i], o, (o += rle[i + 1]));
  // BOLD stored as z in [-3, 3] -> 1..255 (0 = no data); show z in [-2.5, 2.5] on the warm ramp
  const boldLut = new Uint8Array(256);
  for (let q = 1; q < 256; q++) boldLut[q] = Math.round(clamp01(((q - 1) / 254 * 6 - 3 + 2.5) / 5) * 255);
  const runs = a => a.reduce((g, v) => (g.length && g[g.length - 1].v === v ? g[g.length - 1].n++ : g.push({ v, n: 1 }), g), []);
  const s = {
    ...j, lab, boldQ: bytes(j.bold).map(q => boldLut[q]), featQ: bytes(j.feat),
    netGroups: runs(j.parcelOrder.map(p => j.parcelNet[p])), layerGroups: runs(j.featLayer),
    iscMean: mean(j.isc), trMean: mean(j.trR), cache: null, still: null,
  };
  try { await Promise.race([document.fonts.load('500 11px "IBM Plex Mono"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* system mono */ }
  return s;
}

// ---------- pixel renderers (run once per canvas size) ----------
// Ordered colour dither on the device grid: each channel snaps to 5 levels by the Bayer threshold.
// Precomputed per (value, Bayer cell) as packed RGBA, so a pixel is one table lookup.
const BG32 = (255 << 24) | (BG[2] << 16) | (BG[1] << 8) | BG[0];
const tables = new Map();
function table(lut) {
  if (tables.has(lut)) return tables.get(lut);
  const t = new Uint32Array(256 * 64), s = 4;
  for (let q = 0; q < 256; q++) for (let k = 0; k < 64; k++) {
    const b = BAYER[k >> 3][k & 7], ch = c => Math.min(s, Math.floor(lut[q * 3 + c] / 255 * s + b)) / s * 255;
    t[q * 64 + k] = !q && lut[0] === BG[0] ? BG32 : ((255 << 24) | (ch(2) << 16) | (ch(1) << 8) | ch(0)) >>> 0; // zero stays empty
  }
  tables.set(lut, t);
  return t;
}
const bayerIdx = (n, cell) => Uint8Array.from({ length: n }, (_, i) => ((i / cell) | 0) & 7);

// Rows split into groups with `gap` px between them; one column per TR (nearest), no smoothing.
function rowMap(h, groups, gap) {
  const n = groups.reduce((a, g) => a + g.n, 0), avail = h - gap * (groups.length - 1), map = new Int16Array(h).fill(-1), spans = [];
  let y = 0, r0 = 0;
  for (const g of groups) {
    const gh = Math.round(avail * (r0 + g.n) / n) - Math.round(avail * r0 / n);
    for (let k = 0; k < gh && y + k < h; k++) map[y + k] = r0 + Math.min(g.n - 1, Math.floor(k * g.n / gh));
    spans.push({ v: g.v, y, h: gh }); y += gh + gap; r0 += g.n;
  }
  return { map, spans };
}

function raster(w, h, Q, nT, nR, groups, gap, lut, cell) {
  const c = mk(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), out = new Uint32Array(img.data.buffer), t = table(lut);
  const { map, spans } = rowMap(h, groups, gap), col = new Int32Array(w), bx = bayerIdx(w, cell), by = bayerIdx(h, cell);
  for (let i = 0; i < w; i++) col[i] = Math.min(nT - 1, Math.floor(i * nT / w)) * nR;
  for (let y = 0; y < h; y++) {
    const r = map[y], row = y * w, b = by[y] * 8;
    if (r < 0) continue;
    for (let i = 0; i < w; i++) out[row + i] = t[Q[col[i] + r] * 64 + b + bx[i]];
  }
  x.putImageData(img, 0, 0);
  return { c, spans };
}

// Four atlas views (LH lateral, RH lateral, LH medial, RH medial); parcels filled by value, edges left dark.
function brainMap(s, vals, cols, scale, gap, cell) {
  const vw = s.views.w, vh = s.views.h, rows = 4 / cols, w = Math.round(cols * vw * scale + (cols - 1) * gap), h = Math.round(rows * vh * scale + (rows - 1) * gap);
  const c = mk(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), out = new Uint32Array(img.data.buffer), t = table(MAPC), q = new Uint8Array(201);
  for (let p = 0; p < 200; p++) q[p + 1] = Math.round(clamp01(vals[p] / R_MAX) * 255);
  const pw = Math.floor(vw * scale), ph = Math.floor(vh * scale), bx = bayerIdx(w, cell), by = bayerIdx(h, cell);
  const sx = Int32Array.from({ length: pw + 1 }, (_, i) => Math.min(vw - 1, Math.floor(i / scale))), sy = Int32Array.from({ length: ph + 1 }, (_, i) => Math.min(vh - 1, Math.floor(i / scale)) * vw);
  for (let k = 0; k < 4; k++) {
    const x0 = Math.round((k % cols) * (vw * scale + gap)), y0 = Math.round(((k / cols) | 0) * (vh * scale + gap)), L = s.lab.subarray(k * vw * vh, (k + 1) * vw * vh);
    for (let py = 0; py < ph; py++) {
      const row = (y0 + py) * w + x0, b = by[y0 + py] * 8;
      for (let px = 0; px < pw; px++) {
        const l = L[sy[py] + sx[px]];
        if (!l) continue;
        const r = px + 1 < pw ? L[sy[py] + sx[px + 1]] : 0, d = py + 1 < ph ? L[sy[py + 1] + sx[px]] : 0;
        out[row + px] = (r && r !== l) || (d && d !== l) ? BG32 : t[q[l] * 64 + b + bx[x0 + px]];
      }
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function bar(w, h, cell) {
  const c = mk(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), out = new Uint32Array(img.data.buffer), t = table(MAPC), bx = bayerIdx(w, cell), by = bayerIdx(h, cell);
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) out[y * w + i] = t[Math.round(i / (w - 1) * 255) * 64 + by[y] * 8 + bx[i]];
  x.putImageData(img, 0, 0);
  return c;
}

// ---------- text ----------
function label(x, s, px, py, size, color = MUTED, align = 'left', base = 'alphabetic') {
  x.font = `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
  x.letterSpacing = `${(size * 0.05).toFixed(2)}px`;
  x.fillStyle = color; x.textAlign = align; x.textBaseline = base;
  x.fillText(s, px, py);
}

// ---------- layout + caches ----------
function build(s, W, H, u) {
  const narrow = W / u < 600, fs = (narrow ? 9.5 : 10.5) * u, cell = Math.max(1, Math.round(u)), C = { W, H, u, narrow, fs, nT: s.nT };

  // I · score
  const gut = narrow ? 0 : Math.round(92 * u), top = Math.round(24 * u), axis = Math.round(30 * u), bot = Math.round(24 * u), gap = Math.max(1, Math.round(1.5 * u));
  const bw = W - gut, bandH = Math.floor((H - top - axis - bot) / 2);
  const brain = raster(bw, bandH, s.boldQ, s.nT, 200, s.netGroups, gap, WARM, cell);
  const model = raster(bw, bandH, s.featQ, s.nT, 256, s.layerGroups, gap, COOL, cell);
  const by = top, my = top + bandH + axis;
  const chrome = mk(W, H), cx = chrome.getContext('2d');
  label(cx, narrow ? 'BRAIN · BOLD, 200 PARCELS' : 'BRAIN · CLEANED BOLD, MEAN OF 59 LISTENERS · 200 PARCELS', gut, by - 9 * u, fs, INK);
  label(cx, narrow ? 'MODEL · 256 SAE FEATURES' : 'MODEL · GEMMA 2 2B · 256 SAE FEATURES · DARK COLUMNS: NO WORDS SPOKEN', gut, my + bandH + 17 * u, fs, INK);
  const secs = s.nT * s.tr, step = narrow ? 120 : 60;
  for (let t = 0; t <= secs; t += step) {
    const x = gut + t / secs * bw;
    cx.fillStyle = FAINT; cx.fillRect(Math.round(x), by + bandH + 4 * u, Math.max(1, u), 5 * u);
    label(cx, mmss(t), x, by + bandH + 21 * u, fs, MUTED, t === 0 ? 'left' : 'center');
  }
  if (!narrow) {
    for (const g of brain.spans) if (g.h > fs) label(cx, NET_NAMES[g.v], gut - 10 * u, by + g.y + g.h / 2, fs * 0.92, MUTED, 'right', 'middle');
    for (const g of model.spans) if (g.h > fs) label(cx, `layer ${g.v}`, gut - 10 * u, my + g.y + g.h / 2, fs * 0.92, MUTED, 'right', 'middle');
  }
  C.score = { brain: brain.c, model: model.c, chrome, gut, bw, bandH, by, my };
  C.scoreFull = mk(W, H);
  drawScore(C.scoreFull.getContext('2d'), C, s.nT, false);

  // II · maps
  const titleH = Math.round(44 * u), barH = Math.round(46 * u), mgap = Math.round((narrow ? 14 : 36) * u), vgap = Math.round(6 * u);
  let best = null;
  for (const side of [true, false]) for (const cols of [2, 4]) {
    const aw = side ? (W - mgap) / 2 : W, ah = side ? H - titleH - barH : (H - barH - mgap) / 2 - titleH;
    const sc = Math.min((aw - (cols - 1) * vgap) / (cols * s.views.w), (ah - (4 / cols - 1) * vgap) / ((4 / cols) * s.views.h));
    if (!best || sc > best.sc) best = { side, cols, sc };
  }
  const mw = Math.round(best.cols * s.views.w * best.sc + (best.cols - 1) * vgap), mh = Math.round((4 / best.cols) * s.views.h * best.sc + (4 / best.cols - 1) * vgap);
  const blockW = best.side ? 2 * mw + mgap : mw, blockH = best.side ? titleH + mh : 2 * (titleH + mh) + mgap, top0 = Math.round((H - blockH - barH) / 2), left0 = Math.round((W - blockW) / 2);
  const maps = [[s.isc, 'LISTENERS AGREE', `leave-one-out ISC · mean ${f3(s.iscMean)}`], [s.trR, 'FEATURES PREDICT', `held-out r, other story · mean ${f3(s.trMean)}`]];
  C.maps = mk(W, H);
  const mx = C.maps.getContext('2d');
  mx.fillStyle = `rgb(${BG})`; mx.fillRect(0, 0, W, H);
  maps.forEach(([vals, t1, t2], i) => {
    const m = brainMap(s, vals, best.cols, best.sc, vgap, cell);
    const x0 = left0 + (best.side ? i * (mw + mgap) : 0), y0 = top0 + titleH + (best.side ? 0 : i * (titleH + mh + mgap));
    label(mx, t1, x0, y0 - 24 * u, fs, INK); label(mx, t2, x0, y0 - 10 * u, fs, MUTED);
    mx.drawImage(m, x0, y0);
  });
  const bwid = Math.round(Math.min(W * 0.6, 280 * u)), bx = Math.round((W - bwid) / 2), byy = top0 + blockH + Math.round(16 * u);
  mx.drawImage(bar(bwid, Math.round(6 * u), cell), bx, byy);
  [0, 0.25, 0.5, 0.75].forEach(v => label(mx, v ? f3(v).replace(/0+$/, '') : '0', bx + v / R_MAX * bwid, byy + 22 * u, fs, MUTED, v === 0 ? 'left' : v === R_MAX ? 'right' : 'center'));
  label(mx, 'r', bx - 10 * u, byy + 7 * u, fs, MUTED, 'right');

  // III · the test
  C.test = layoutTest(s, W, H, u, narrow, fs);
  C.testBase = mk(W, H); drawTest(C.testBase.getContext('2d'), s, C, 0, 0);
  C.testFull = mk(W, H); drawTest(C.testFull.getContext('2d'), s, C, 1, 1);

  // dissolve masks: Bayer + low-frequency field, N thresholds, built once
  const mc = Math.round(6 * u), cw = Math.ceil(W / mc), ch = Math.ceil(H / mc), N = 24;
  const field = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let i = 0; i < cw; i++)
    field[y * cw + i] = 0.55 * BAYER[y & 7][i & 7] + 0.45 * (0.5 + 0.25 * Math.sin(i * 0.11 + y * 0.07) + 0.25 * Math.sin(i * 0.03 - y * 0.13 + 1.7));
  C.masks = [];
  for (let k = 0; k < N; k++) {
    const m = mk(cw, ch), x = m.getContext('2d'), img = x.createImageData(cw, ch), th = (k + 1) / (N + 1);
    for (let i = 0; i < field.length; i++) img.data[i * 4 + 3] = field[i] < th ? 255 : 0;
    x.putImageData(img, 0, 0); C.masks.push(m);
  }
  C.tmp = mk(W, H); C.blank = mk(W, H);
  const bx2 = C.blank.getContext('2d'); bx2.fillStyle = `rgb(${BG})`; bx2.fillRect(0, 0, W, H);
  C.key = `${W}x${H}@${u}`;
  return C;
}

function drawScore(x, C, head, ghost) {
  const { brain, model, chrome, gut, bw, bandH, by, my } = C.score, px = Math.round(head / C.nT * bw);
  x.fillStyle = `rgb(${BG})`; x.fillRect(0, 0, C.W, C.H);
  if (ghost && px < bw) {
    x.globalAlpha = 0.16;
    x.drawImage(brain, px, 0, bw - px, bandH, gut + px, by, bw - px, bandH);
    x.drawImage(model, px, 0, bw - px, bandH, gut + px, my, bw - px, bandH);
    x.globalAlpha = 1;
  }
  if (px > 0) {
    x.drawImage(brain, 0, 0, px, bandH, gut, by, px, bandH);
    x.drawImage(model, 0, 0, px, bandH, gut, my, px, bandH);
  }
  x.drawImage(chrome, 0, 0);
  if (ghost) {
    x.fillStyle = INK;
    x.fillRect(gut + Math.min(px, bw - C.u), by - 4 * C.u, Math.max(1, Math.round(C.u)), my + bandH - by + 8 * C.u);
  }
}

function layoutTest(s, W, H, u, narrow, fs) {
  const g = Math.round((narrow ? 28 : 56) * u), side = !narrow;
  const pw = side ? (W - g) / 2 : W, ph = side ? Math.min(H, pw * 0.85) : (H - g) / 2, oy = side ? (H - ph) / 2 : 0;
  const panel = (i) => ({ x: side ? i * (pw + g) : 0, y: oy + (side ? 0 : i * (ph + g)), w: pw, h: ph });
  // null: dot histogram of the 199 retimed refits (bins of .01 in rho)
  const A = panel(0), lo = Math.floor(Math.min(...s.test.null) / 0.05) * 0.05, hi = Math.ceil(Math.max(...s.test.null) / 0.05) * 0.05, bin = 0.01, nb = Math.round((hi - lo) / bin), cnt = new Int16Array(nb), slot = [];
  const order = s.test.null.map((_, i) => i).sort((a, b) => ((a * 7919) % 199) - ((b * 7919) % 199)); // arrival order of the dots
  for (const i of order) { const b = Math.min(nb - 1, Math.floor((s.test.null[i] - lo) / bin)); slot[i] = [b, cnt[b]++]; }
  const plotTop = A.y + 64 * u, plotBot = A.y + A.h - 34 * u, maxC = Math.max(...cnt);
  const d = Math.min(A.w / nb, (plotBot - plotTop) / maxC);
  // calibration: 64 planted cells, one tick per cell, a row per planted rho
  const B = panel(1), keys = ['0.8', '0.6', '0.4', '0.2'], lab = 40 * u, cx0 = B.x + lab, cw = B.w - lab - 6 * u;
  const rTop = B.y + (narrow ? 54 : 70) * u, rh = (B.y + B.h - 30 * u - rTop) / 4;
  const ticks = keys.flatMap((k, ri) => s.calib.cells[k].map(v => [cx0 + v * cw, rTop + rh * (ri + 0.2)]));
  return { A, B, lo, hi, nb, slot, order, plotTop, plotBot, d, keys, cx0, cw, rTop, rh, ticks, fs };
}

function drawTest(x, s, C, pNull, pCal) {
  const L = C.test, u = C.u, fs = L.fs, { A, B } = L;
  x.fillStyle = `rgb(${BG})`; x.fillRect(0, 0, C.W, C.H);
  const X = v => A.x + (v - L.lo) / (L.hi - L.lo) * A.w;
  label(x, 'DO BRAIN AND MODEL RELY ON THE SAME FEATURES?', A.x, A.y + 14 * u, fs, INK);
  label(x, `mean ρ over ${s.test.cells.length} tests vs ${s.test.null.length} retimed refits`, A.x, A.y + 30 * u, fs, MUTED);
  x.fillStyle = FAINT; x.fillRect(A.x, L.plotBot + 2 * u, A.w, Math.max(1, u));
  for (let v = Math.ceil(L.lo * 10) / 10; v <= L.hi + 1e-9; v += 0.1) label(x, Math.abs(v) < 1e-9 ? '0' : f3(v).replace(/0+$/, ''), X(v), L.plotBot + 18 * u, fs, MUTED, v < L.lo + 0.02 ? 'left' : v > L.hi - 0.02 ? 'right' : 'center');
  const n = Math.round(pNull * L.order.length);
  x.fillStyle = MUTED;
  for (let k = 0; k < n; k++) {
    const i = L.order[k], [b, h] = L.slot[i];
    x.beginPath(); x.arc(X(L.lo + (b + 0.5) * 0.01), L.plotBot - (h + 0.5) * L.d, L.d * 0.38, 0, 6.2832); x.fill();
  }
  if (pNull >= 1) {
    const ox = Math.round(X(s.test.obs));
    x.fillStyle = ORANGE; x.fillRect(ox, L.plotTop - 8 * u, Math.max(1, Math.round(1.5 * u)), L.plotBot - L.plotTop + 10 * u);
    label(x, `observed ${f3(s.test.obs)}`, ox - 6 * u, L.plotTop - 1 * u, fs, ORANGE, 'right');
    label(x, `${s.test.exceed} of ${s.test.null.length} ≥ observed · p = ${f3(s.test.p)}`, A.x + A.w, A.y + 48 * u, fs, MUTED, 'right');
  }

  const CX = v => L.cx0 + v * L.cw, bot = L.rTop + 4 * L.rh;
  label(x, 'CAN THE TEST FIND PLANTED AGREEMENT?', B.x, B.y + 14 * u, fs, INK);
  label(x, 'each tick: one simulated design', B.x, B.y + 30 * u, fs, MUTED);
  L.keys.forEach((k, ri) => label(x, `ρ ${k.replace(/^0/, '')}`, B.x, L.rTop + L.rh * (ri + 0.5), fs, MUTED, 'left', 'middle'));
  x.fillStyle = FAINT; x.fillRect(L.cx0, bot + 2 * u, L.cw, Math.max(1, u));
  [0, 0.5, 1].forEach(v => label(x, `${v * 100}%`, CX(v), bot + 18 * u, fs, MUTED, v === 0 ? 'left' : v === 1 ? 'right' : 'center'));
  const fx = Math.round(CX(s.calib.fpr)), kx = Math.round(CX(s.calib.criterion));
  for (let y = L.rTop - 6 * u; y < bot; y += 6 * u) { x.fillStyle = FAINT; x.fillRect(fx, y, Math.max(1, u), 3 * u); }
  x.fillStyle = INK; x.fillRect(kx, L.rTop - 6 * u, Math.max(1, u), bot - L.rTop + 6 * u);
  label(x, `${s.calib.criterion * 100}% needed`, kx - 6 * u, L.rTop - 10 * u, fs, INK, 'right');
  label(x, `${s.calib.fpr * 100}% by chance`, fx + 6 * u, L.rTop - 10 * u, fs, MUTED, 'left');
  const m = Math.round(pCal * L.ticks.length), tw = Math.max(1, Math.round(1.2 * u));
  x.fillStyle = INK; x.globalAlpha = 0.6;
  for (let k = 0; k < m; k++) x.fillRect(Math.round(L.ticks[k][0]), L.ticks[k][1], tw, L.rh * 0.6);
  x.globalAlpha = 1;
}

// Dither dissolve A -> empty -> B, so one act's text never lands on the other's art.
function dissolve(x, C, A, B, t) {
  if (t <= 0) return x.drawImage(A, 0, 0);
  if (t >= 1) return x.drawImage(B, 0, 0);
  if (t < 0.5) { B = C.blank; t *= 2; } else { A = C.blank; t = t * 2 - 1; }
  const tx = C.tmp.getContext('2d'), k = Math.min(C.masks.length - 1, Math.floor(t * C.masks.length));
  x.drawImage(A, 0, 0);
  tx.globalCompositeOperation = 'copy'; tx.drawImage(B, 0, 0);
  tx.globalCompositeOperation = 'destination-in'; tx.imageSmoothingEnabled = false;
  tx.drawImage(C.masks[k], 0, 0, C.W, C.H);
  tx.globalCompositeOperation = 'source-over';
  x.drawImage(C.tmp, 0, 0);
}

const cacheFor = (s, ctx, opts) => {
  const W = ctx.canvas.width, H = ctx.canvas.height, u = opts.dpr || (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  if (!s.cache || s.cache.key !== `${W}x${H}@${u}`) s.cache = build(s, W, H, u);
  return s.cache;
};

export function drawChapter(ctx, state, t, opts = {}) {
  const C = cacheFor(state, ctx, opts), rm = reduced(opts);
  const cut = (a, b) => (rm ? (t < (a + b) / 2 ? 0 : 1) : seg(t, a, b));
  if (t < T.x1[0] || (rm && t < (T.x1[0] + T.x1[1]) / 2)) return drawScore(ctx, C, seg(t, ...T.sweep) * state.nT, true);
  if (t < T.x1[1]) return dissolve(ctx, C, C.scoreFull, C.maps, cut(...T.x1));
  if (t < T.x2[1]) return dissolve(ctx, C, C.maps, C.testBase, cut(...T.x2));
  if (rm) return ctx.drawImage(C.testFull, 0, 0);
  drawTest(ctx, state, C, seg(t, ...T.nulls), seg(t, ...T.calib));
}

// The full story as one image: brain voice above, model voice below, no text.
export function drawStill(ctx, state, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, u = opts.dpr || (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1), key = `${W}x${H}@${u}`;
  if (!state.still || state.still.key !== key) {
    const cell = Math.max(1, Math.round(u)), gap = Math.max(1, Math.round(1.5 * u)), mid = Math.round(Math.max(6 * u, H * 0.035)), bh = Math.floor((H - mid) / 2);
    const c = mk(W, H), x = c.getContext('2d');
    x.fillStyle = `rgb(${BG})`; x.fillRect(0, 0, W, H);
    x.drawImage(raster(W, bh, state.boldQ, state.nT, 200, state.netGroups, gap, WARM, cell).c, 0, 0);
    x.drawImage(raster(W, bh, state.featQ, state.nT, 256, state.layerGroups, gap, COOL, cell).c, 0, H - bh);
    state.still = { key, c };
  }
  ctx.drawImage(state.still.c, 0, 0);
}

export function caption(state, t) {
  if (t < T.x1[0] + (T.x1[1] - T.x1[0]) / 2) {
    const now = seg(t, ...T.sweep) * state.nT * state.tr;
    return `Cleaned BOLD, mean of ${state.listeners} listeners, 200 parcels · ${state.model} SAE features, 256 · ${mmss(now)} / ${mmss(state.nT * state.tr)}`;
  }
  if (t < T.x2[0] + (T.x2[1] - T.x2[0]) / 2)
    return `Listeners agree: leave-one-out ISC · features predict: held-out r of the 256-feature bank fit on the other story, mean ${f3(state.trMean)} over 6 models · same scale`;
  return `Brain–model reliance agreement ρ = ${f3(state.test.obs)}; ${state.test.exceed} of ${state.test.null.length} retimed refits do as well · planted agreement found in at most ${Math.round(Math.max(...Object.values(state.calib.cells).flat()) * 1000) / 10}% of runs · inconclusive`;
}

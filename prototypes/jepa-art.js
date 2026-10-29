// JEPA art. Every mark is one company at one month-end (Jan 2010 - Oct 2026), placed where the VICReg encoder's
// embedding puts it: the UMAP of the case-study risk map, rotated so volatility runs left to right
// (cluster means: r = 0.90). Rows come from /assets/jepa-map.json; coordinates from data/jepa-umap.bin
// (uint16 x, y per row, same order). Nothing here is a price, a return or a forecast.
import { BAYER, clamp01, monthLabel } from './film.js';

const BG = '#08090a', BONE = '#ece6da', MUTED = '#8d877d', TAU = Math.PI * 2;
const FONT = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const VIEW = [0.02, 0.025, 0.98, 0.89];           // 0.2-99.8 percentile box of all rows, in file units
const ASPECT = (VIEW[2] - VIEW[0]) / (VIEW[3] - VIEW[1]);
const T0 = 0.03, T1 = 0.9;                       // chapter t where Jan 2010 starts and Oct 2026 lands
export const TRACKED = [['WMT', 1007, '#75d69c'], ['GME', 1465, '#ff5fa2'], ['CCL', 2557, '#ff8a3d'], ['INTC', 1059, '#72b8ff']];
const cache = new WeakMap();

export async function load() {
  const [j, buf] = await Promise.all([
    fetch('/assets/jepa-map.json?v=1').then(r => r.json()),
    fetch(new URL('./data/jepa-umap.bin', import.meta.url)).then(r => r.arrayBuffer())]);
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const id = new Uint16Array(b64(j.id).buffer), mc = new Int8Array(b64(j.mcap).buffer), q = new Uint16Array(buf);
  const N = id.length, M = j.counts.length, x = new Float32Array(N), y = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = (q[2 * i] / 65535 - VIEW[0]) / (VIEW[2] - VIEW[0]);
    y[i] = (q[2 * i + 1] / 65535 - VIEW[1]) / (VIEW[3] - VIEW[1]);
    size[i] = mc[i] === -128 ? 0.8 : 1 + 0.28 * Math.min(3, Math.max(-1.5, mc[i] / 10)); // coarse market-cap score
  }
  const off = new Int32Array(M + 1);
  for (let m = 0; m < M; m++) off[m + 1] = off[m] + j.counts[m];
  // same company in the next month (rows are sorted by company within a month)
  const next = new Int32Array(N).fill(-1), hasPrev = new Uint8Array(N);
  for (let m = 0; m < M - 1; m++) {
    let a = off[m], b = off[m + 1];
    while (a < off[m + 1] && b < off[m + 2]) {
      if (id[a] === id[b]) { next[a] = b; hasPrev[b] = 1; a++; b++; } else if (id[a] < id[b]) a++; else b++;
    }
  }
  const mean = new Float32Array(M);
  for (let m = 0; m < M; m++) { let s = 0; for (let r = off[m]; r < off[m + 1]; r++) s += x[r]; mean[m] = s / (off[m + 1] - off[m]); }
  const find = (m, cid) => {
    let lo = off[m], hi = off[m + 1] - 1;
    while (lo <= hi) { const k = (lo + hi) >> 1; if (id[k] === cid) return k; if (id[k] < cid) lo = k + 1; else hi = k - 1; }
    return -1;
  };
  const tracks = TRACKED.map(([sym, cid, col]) => ({ sym, col, rows: Int32Array.from({ length: M }, (_, m) => find(m, cid)), hx: 0, hy: 0, a: 0, ly: 0, lx: 0, w: 0 }));
  // pacing: a month-to-month step gets more scroll the further the whole market moves in it
  let dsum = 0; for (let m = 1; m < M; m++) dsum += Math.abs(mean[m] - mean[m - 1]);
  const cw = new Float64Array(M);
  for (let m = 1; m < M; m++) cw[m] = cw[m - 1] + 1 + Math.min(5, 1.5 * Math.abs(mean[m] - mean[m - 1]) / (dsum / (M - 1)));
  let calm = 0, wild = 0;
  for (let m = 1; m < M; m++) { if (mean[m] < mean[calm]) calm = m; if (mean[m] > mean[wild]) wild = m; }
  const monthAt = t => {
    const u = clamp01((t - T0) / (T1 - T0)) * cw[M - 1];
    let k = 0; while (k < M - 2 && cw[k + 1] <= u) k++;
    return Math.min(M - 1, k + (u - cw[k]) / (cw[k + 1] - cw[k]));
  };
  const tAt = fm => { const k = Math.min(M - 2, Math.floor(fm)); return T0 + (cw[k] + (fm - k) * (cw[k + 1] - cw[k])) / cw[M - 1] * (T1 - T0); };
  return { N, M, dates: j.dates, counts: j.counts, id, x, y, size, off, next, hasPrev, mean, tracks, calm, wild, monthAt, tAt };
}

// ---------- layout + long-exposure grid, cached per canvas ----------
function layout(ctx, s, dpr, strip) {
  const c = ctx.canvas, W = c.width, H = c.height;
  let L = cache.get(c);
  if (L && L.W === W && L.H === H && L.dpr === dpr && L.strip === strip) return L;
  const u = dpr, pad = Math.max(14 * u, Math.round(Math.min(W, H) * 0.035));
  const stripH = strip ? Math.round(Math.min(100 * u, Math.max(72 * u, H * 0.15))) : 0, axisH = Math.round(34 * u);
  const aw = W - 2 * pad, ah = H - 2 * pad - stripH - axisH;
  const mw = Math.round(aw / ah > ASPECT ? ah * ASPECT : aw), mh = Math.round(mw / ASPECT);
  const mx = Math.round(pad + (aw - mw) / 2), my = Math.round(pad + (ah - mh) / 2);
  const cell = Math.max(2, Math.round(1.5 * u)), gw = Math.ceil(mw / cell), gh = Math.ceil(mh / cell);
  const bin = new Int32Array(s.N), full = new Uint16Array(gw * gh);
  for (let i = 0; i < s.N; i++) {
    const gx = Math.floor(s.x[i] * gw), gy = Math.floor(s.y[i] * gh);
    bin[i] = gx >= 0 && gx < gw && gy >= 0 && gy < gh ? gy * gw + gx : -1;
    if (bin[i] >= 0) full[bin[i]]++;
  }
  const sorted = Array.from(full).filter(v => v).sort((a, b) => a - b);
  const exp = document.createElement('canvas'); exp.width = gw; exp.height = gh;
  const ectx = exp.getContext('2d');
  L = { W, H, dpr, strip, u, pad, mx, my, mw, mh, cell, gw, gh, bin, grid: new Uint16Array(gw * gh), upto: -1,
    norm: Math.log1p(sorted[Math.floor(sorted.length * 0.995)] || 1), exp, ectx, img: ectx.createImageData(gw, gh), drawn: -2,
    sy: H - pad - stripH, sh: stripH, ay: my + mh, dot: Math.max(0.9 * u, Math.min(1.5 * u, mw / 560)), vis: [],
    f10: `${10 * u}px ${FONT}`, f105: `${10.5 * u}px ${FONT}`, fLab: `500 ${10.5 * u}px ${FONT}` };
  if (strip) {
    let lo = Infinity, hi = -Infinity;
    for (const v of s.mean) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const top = L.sy + 26 * u, bot = L.sy + stripH - 20 * u, line = new Path2D(), area = new Path2D();
    L.sx = (k) => mx + k / (s.M - 1) * mw;
    L.syv = v => bot - (v - lo) / (hi - lo) * (bot - top);
    area.moveTo(mx, bot);
    for (let k = 0; k < s.M; k++) { (k ? line.lineTo : line.moveTo).call(line, L.sx(k), L.syv(s.mean[k])); area.lineTo(L.sx(k), L.syv(s.mean[k])); }
    area.lineTo(L.sx(s.M - 1), bot); area.closePath();
    Object.assign(L, { line, area, bot });
  }
  cache.set(c, L);
  return L;
}

// exposure = every company-month up to and including month m, as a 3-tone ordered dither
function exposure(ctx, s, L, m) {
  if (m !== L.upto) {
    const g = L.grid, b = L.bin;
    if (m > L.upto) for (let r = s.off[L.upto + 1]; r < s.off[m + 1]; r++) { if (b[r] >= 0) g[b[r]]++; }
    else for (let r = s.off[m + 1]; r < s.off[L.upto + 1]; r++) { if (b[r] >= 0) g[b[r]]--; }
    L.upto = m;
  }
  if (L.drawn !== m) {
    const d = L.img.data, g = L.grid, gw = L.gw, k = 1 / L.norm;
    for (let gy = 0, i = 0; gy < L.gh; gy++) {
      const row = BAYER[gy & 7];
      for (let gx = 0; gx < gw; gx++, i++) {
        const n = g[i];
        const lv = n ? Math.min(3, Math.floor(Math.min(1, Math.log1p(n) * k) ** 1.6 * 3 + row[gx & 7])) : 0;
        const o = i * 4; d[o] = 150; d[o + 1] = 143; d[o + 2] = 132; d[o + 3] = lv * 42;
      }
    }
    L.ectx.putImageData(L.img, 0, 0);
    L.drawn = m;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(L.exp, L.mx, L.my, L.gw * L.cell, L.gh * L.cell);
}

const smooth = f => f * f * (3 - 2 * f);

// this month's companies, gliding toward their next month-end position
function swarm(ctx, s, L, m, f, color, alpha, scale = 1) {
  const e = smooth(f), r0 = L.dot * scale, X = L.mx, Y = L.my, w = L.mw, h = L.mh;
  ctx.fillStyle = color;
  for (let pass = 0; pass < 3; pass++) {           // 0: staying, 1: leaving, 2: arriving
    if (pass && !f) break;
    ctx.globalAlpha = alpha * (pass === 0 ? 1 : pass === 1 ? 1 - e : e);
    ctx.beginPath();
    const a = pass === 2 ? s.off[m + 1] : s.off[m], b = pass === 2 ? s.off[m + 2] : s.off[m + 1];
    for (let r = a; r < b; r++) {
      const n = s.next[r];
      if (pass === 0 && f && n < 0) continue;
      if (pass === 1 && n >= 0) continue;
      if (pass === 2 && s.hasPrev[r]) continue;
      let px = s.x[r], py = s.y[r];
      if (pass === 0 && f) { px += (s.x[n] - px) * e; py += (s.y[n] - py) * e; }
      const cx = X + px * w, cy = Y + py * h, rad = r0 * s.size[r];
      ctx.moveTo(cx + rad, cy); ctx.arc(cx, cy, rad, 0, TAU);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// tracked companies: one dot per past month-end (their own long exposure) and a labelled head
function tracks(ctx, s, L, fm) {
  const u = L.u, m = Math.floor(fm), e = smooth(fm - m), X = L.mx, Y = L.my, w = L.mw, h = L.mh, rd = L.dot * 1.15;
  for (const T of s.tracks) {
    const R = T.rows;
    ctx.fillStyle = T.col; ctx.beginPath();
    for (let k = 0; k <= m; k++) {
      const r = R[k]; if (r < 0) continue;
      const cx = X + s.x[r] * w, cy = Y + s.y[r] * h;
      ctx.moveTo(cx + rd, cy); ctx.arc(cx, cy, rd, 0, TAU);
    }
    ctx.globalAlpha = 0.7; ctx.fill();
    const a = R[m], b = m + 1 < s.M ? R[m + 1] : -1;
    T.a = a >= 0 && b >= 0 ? 1 : a >= 0 ? 1 - e : b >= 0 ? e : 0;
    if (!T.a) continue;
    const p = a >= 0 ? a : b, q = b >= 0 ? b : a;
    T.hx = X + (s.x[p] + (s.x[q] - s.x[p]) * e) * w; T.hy = Y + (s.y[p] + (s.y[q] - s.y[p]) * e) * h;
    ctx.globalAlpha = T.a;
    ctx.beginPath(); ctx.arc(T.hx, T.hy, 3.6 * u, 0, TAU);
    ctx.fillStyle = T.col; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = BG; ctx.stroke();
  }
  labels(ctx, s, L);
  ctx.globalAlpha = 1;
}

function labels(ctx, s, L) {
  const u = L.u, lh = 16 * u, vis = L.vis;
  vis.length = 0; for (const T of s.tracks) if (T.a > 0.02) vis.push(T);
  ctx.font = L.fLab; ctx.textBaseline = 'middle';
  for (const T of vis) {
    T.w = ctx.measureText(T.sym).width + 10 * u;
    T.lx = T.hx + 9 * u + T.w > L.mx + L.mw + L.pad * 0.6 ? T.hx - 9 * u - T.w : T.hx + 9 * u;
    T.ly = T.hy;
  }
  vis.sort((A, B) => A.ly - B.ly);
  for (let it = 0; it < 4; it++) for (let i = 1; i < vis.length; i++) {
    const A = vis[i - 1], B = vis[i];
    if (B.ly - A.ly < lh && A.lx < B.lx + B.w && B.lx < A.lx + A.w) { const d = (lh - (B.ly - A.ly)) / 2; A.ly -= d; B.ly += d; }
  }
  for (const T of vis) {
    ctx.globalAlpha = T.a;
    ctx.fillStyle = 'rgba(8,9,10,0.82)';
    ctx.beginPath(); ctx.roundRect(T.lx, T.ly - lh / 2 + u, T.w, lh - 2 * u, 3 * u); ctx.fill();
    ctx.fillStyle = T.col; ctx.fillText(T.sym, T.lx + 5 * u, T.ly + 0.5 * u);
  }
}

function axis(ctx, L, left, right, lc = MUTED, rc = MUTED) {
  const u = L.u, y = L.ay + 16 * u;
  ctx.font = L.f105; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillStyle = lc; ctx.fillText(left, L.mx, y);
  // too narrow for both on one line: the right label drops below
  const wrap = ctx.measureText(left).width + ctx.measureText(right).width + 12 * u > L.mw;
  ctx.textAlign = 'right'; ctx.fillStyle = rc; ctx.fillText(right, L.mx + L.mw, wrap ? y + 15 * u : y);
  ctx.textAlign = 'left';
}

// the market's average position on the calm-volatile axis, month by month
function strip(ctx, s, L, fm) {
  const u = L.u, cx = L.sx(fm), m = Math.floor(fm), f = fm - m;
  const v = m + 1 < s.M ? s.mean[m] + (s.mean[m + 1] - s.mean[m]) * f : s.mean[m];
  ctx.lineWidth = 1.2 * u; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(236,230,218,0.16)'; ctx.setLineDash([2 * u, 3 * u]); ctx.stroke(L.line); ctx.setLineDash([]);
  ctx.save(); ctx.beginPath(); ctx.rect(L.mx - u, L.sy, cx - L.mx + u, L.sh); ctx.clip();
  ctx.fillStyle = 'rgba(236,230,218,0.07)'; ctx.fill(L.area);
  ctx.strokeStyle = 'rgba(236,230,218,0.8)'; ctx.stroke(L.line);
  ctx.restore();
  ctx.fillStyle = 'rgba(236,230,218,0.09)'; ctx.fillRect(L.mx, L.sy, L.mw, u);
  ctx.fillStyle = 'rgba(236,230,218,0.22)'; ctx.fillRect(Math.round(cx), L.sy + 22 * u, u, L.bot - L.sy - 22 * u);
  ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(cx, L.syv(v), 2.6 * u, 0, TAU); ctx.fill();
  ctx.font = L.f10; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = MUTED;
  ctx.fillText('market average, month by month', L.mx, L.sy + 16 * u);
  ctx.textAlign = 'right'; ctx.fillStyle = '#6f6a63'; ctx.fillText('↑ more volatile', L.mx + L.mw, L.sy + 16 * u); ctx.textAlign = 'left';
  const step = L.mw / u < 420 ? 8 : 4, yb = L.sy + L.sh - 4 * u;
  for (let yr = 2010; yr <= 2026; yr += step) {
    const k = (yr - 2010) * 12, tx = L.sx(k);
    ctx.fillStyle = 'rgba(236,230,218,0.25)'; ctx.fillRect(Math.round(tx), L.bot + 2 * u, u, 4 * u);
    const lw = ctx.measureText(String(yr)).width;
    ctx.fillStyle = MUTED; ctx.fillText(String(yr), Math.min(L.mx + L.mw - lw, Math.max(L.mx, tx - lw / 2)), yb);
  }
}

// t in [0,1]: Jan 2010 -> Oct 2026, slowed down where the whole market moves most
export function drawChapter(ctx, s, t, opts = {}) {
  const L = layout(ctx, s, opts.dpr || 1, true), fm = s.monthAt(t), m = Math.floor(fm);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, L.W, L.H);
  exposure(ctx, s, L, m);
  swarm(ctx, s, L, m, m + 1 < s.M ? fm - m : 0, BONE, 0.88);
  tracks(ctx, s, L, fm);
  axis(ctx, L, '← calmer', 'more volatile →');
  strip(ctx, s, L, fm);
}

// one still: all 201,560 company-months, with the calmest and the most volatile month-end on top
export function drawStill(ctx, s, opts = {}) {
  const L = layout(ctx, s, opts.dpr || 1, false);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, L.W, L.H);
  exposure(ctx, s, L, s.M - 1);
  swarm(ctx, s, L, s.calm, 0, '#72b8ff', 0.9, 1.15);
  swarm(ctx, s, L, s.wild, 0, '#ff8a3d', 0.9, 1.15);
  axis(ctx, L, `● ${monthLabel(s.dates[s.calm])} · calmest`, `most volatile · ${monthLabel(s.dates[s.wild])} ●`, '#72b8ff', '#ff8a3d');
}

export function caption(s, t) {
  if (t == null) return `VICReg encoder · UMAP · ${s.N.toLocaleString('en-US')} company-months · 2010–2026`;
  const m = Math.round(s.monthAt(t));
  return `VICReg encoder · UMAP · ${s.counts[m].toLocaleString('en-US')} companies · ${monthLabel(s.dates[m])}`;
}

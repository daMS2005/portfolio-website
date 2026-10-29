// Prototype engine v2: every visual is rendered from Daniel's real artifacts.
// - JEPA: the real embedding clusters, 1,000 companies a month, 2010-2026
// - Thesis: the cleaned BOLD signal from the thesis figure (200 parcels x story time)
// - TC_ACC: real frames from the October 2026 episode
export const BAYER = (() => {
  const m = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
  return m.map(r => r.map(v => (v + 0.5) / 64));
})();

export const clamp01 = v => Math.min(1, Math.max(0, v));
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

// ---------- dither dissolve between two drawings ----------
export function makeDissolver(cell = 6) {
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
  let noise = null;
  return (ctx, drawA, drawB, t) => {
    const W = ctx.canvas.width, H = ctx.canvas.height, cw = Math.ceil(W / cell), ch = Math.ceil(H / cell);
    if (mask.width !== cw || mask.height !== ch || tmp.width !== W || tmp.height !== H) {
      mask.width = cw; mask.height = ch; tmp.width = W; tmp.height = H;
      noise = new Float32Array(cw * ch);
      for (let i = 0; i < noise.length; i++) { const x = i % cw, y = (i / cw) | 0; noise[i] = 0.5 + 0.25 * Math.sin(x * 0.11 + y * 0.07) + 0.25 * Math.sin(x * 0.03 - y * 0.13 + 1.7); }
    }
    if (t <= 0) return drawA(ctx);
    if (t >= 1) return drawB(ctx);
    const img = mctx.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = y * cw + x; d[i * 4 + 3] = 0.55 * BAYER[y & 7][x & 7] + 0.45 * noise[i] < t ? 255 : 0; }
    mctx.putImageData(img, 0, 0);
    drawA(ctx);
    tctx.clearRect(0, 0, W, H); drawB(tctx);
    tctx.globalCompositeOperation = 'destination-in'; tctx.imageSmoothingEnabled = false;
    tctx.drawImage(mask, 0, 0, W, H); tctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  };
}

// ---------- image renderers ----------
function cover(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), s = Math.max(w / img.width, h / img.height);
  x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  return x.getImageData(0, 0, w, h).data;
}

// Newspaper halftone: one dot per cell, radius from brightness, single ink on black.
export function halftone(img, w, h, ink = '#ff6a3d', cell = 7, bg = '#0a0a0a') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), src = cover(img, w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = ink;
  for (let yy = 0; yy < h; yy += cell) for (let xx = (yy / cell) % 2 ? cell / 2 : 0; xx < w; xx += cell) {
    const i = ((yy + (cell >> 1)) * w + Math.min(w - 1, xx + (cell >> 1))) * 4;
    const lum = (0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2]) / 255;
    const r = Math.pow(lum, 0.85) * cell * 0.62;
    if (r > 0.35) { x.beginPath(); x.arc(xx + cell / 2, yy + cell / 2, r, 0, 6.283); x.fill(); }
  }
  return c;
}

// Ordered colour dither: keeps the figure's real colours, rendered as grain.
export function colorDither(img, w, h, cell = 3, levels = 3) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), src = cover(img, w, h), q = levels - 1;
  for (let yy = 0; yy < h; yy += cell) for (let xx = 0; xx < w; xx += cell) {
    const i = (yy * w + xx) * 4, t = BAYER[(yy / cell) & 7][(xx / cell) & 7] - 0.5;
    const ch = k => Math.round(clamp01(src[i + k] / 255 + t / q) * q) / q * 255;
    x.fillStyle = `rgb(${ch(0)},${ch(1)},${ch(2)})`; x.fillRect(xx, yy, cell, cell);
  }
  return c;
}

// ---------- JEPA data ----------
export const ISLANDS = [['Low-beta defensives', '#6ccb5f', .30, .50], ['Average stock, normal market', '#b9b39f', .50, .48], ['Volatile growth winners', '#c9f04a', .88, .15],
  ['Caught in market stress', '#f28c38', .66, .72], ['Crashed cyclicals', '#ff4d94', .86, .90], ['Mega-cap staples', '#9cc6ff', .06, .22],
  ['Utilities & REITs', '#4c8df6', .10, .60], ['Foreign large caps', '#a08cff', .08, .88], ['Large quality compounders', '#45c4c0', .27, .18],
  ['Small & distressed', '#e8566c', .94, .58], ['Calm large caps, calm market', '#6fd3e8', .30, .82], ['Small, volatile, thin data', '#e0c068', .66, .30]];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = d => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

// All 202 months. Each company keeps one fixed spot inside whatever island it is in,
// so its movement from month to month is only its change of cluster: smooth trails.
export async function loadMarket() {
  const j = await (await fetch('/assets/jepa-map.json?v=1')).json();
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const id = new Uint16Array(b64(j.id).buffer), cl = b64(j.enc.vicreg.c);
  const frames = []; let off = 0;
  for (let f = 0; f < j.counts.length; f++) {
    const n = j.counts[f], counts = new Array(12).fill(0);
    for (let r = off; r < off + n; r++) counts[cl[r]]++;
    frames.push({ off, n, counts, date: j.dates[f] });
    off += n;
  }
  const most = Math.max(...frames.flatMap(fr => fr.counts));
  const sp = 0.19 / Math.sqrt(most);
  const track = new Map(Object.entries(j.track).map(([s, i]) => [i, s]));
  const bySym = Object.fromEntries(Object.entries(j.track));
  // position of row r in frame f, in plot fractions (x scaled later by aspect)
  const pos = (f, r, aspect) => {
    const c = cl[r], fr = frames[f], R = sp * Math.sqrt(fr.counts[c]), u = hash(id[r]), th = hash(id[r] + 7919) * 6.283;
    const rad = R * Math.sqrt(u);
    return [ISLANDS[c][2] + rad * Math.cos(th) * aspect, ISLANDS[c][3] + rad * Math.sin(th), c];
  };
  const rowOf = (f, companyId) => { const fr = frames[f]; for (let r = fr.off; r < fr.off + fr.n; r++) if (id[r] === companyId) return r; return -1; };
  return { frames, id, cl, pos, rowOf, track, bySym, sp };
}

// ---------- sticky scroll film ----------
export function mountFilm(section, canvas, render) {
  const ctx = canvas.getContext('2d');
  let raf = 0;
  const frame = () => {
    raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const r = section.getBoundingClientRect(), p = clamp01(-r.top / (r.height - innerHeight));
    render(ctx, p, dpr);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  kick();
  return kick;
}

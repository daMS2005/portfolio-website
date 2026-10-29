// Embedding map of the JEPA encoders (jepa-transformer.html, section 07).
// Every dot is one company at one month-end, placed by a UMAP of the encoder's embedding and turned so
// volatility runs left to right, coloured by the encoder's cluster. The grey haze is every month played so far.
(() => {
  const root = document.getElementById('jtMap');
  if (!root) return;

  const NOTE = {
    og: '<b>Original encoder.</b> Its embedding collapsed to about 3 effective dimensions, with 80% of the variance on a single volatility axis.',
    vicreg: '<b>Retrained with a VICReg penalty.</b> A variance–covariance term keeps about 370 effective dimensions in use, so the clusters separate by risk, momentum and size.',
  };
  // the encoder's twelve clusters: name and colour, indexed by cluster code
  const CL = {
    og: [['Average, uneasy market', '#b9b39f'], ['Small & beaten down', '#e8566c'], ['Caught in market stress', '#f28c38'], ['Small high-flyers', '#6ccb5f'],
      ['Quiet mid-caps', '#45c4c0'], ['Calm, steady large caps', '#4c8df6'], ['Momentum growth', '#c9f04a'], ['Commodity distress', '#b9634f'],
      ['Market-sensitive cyclicals', '#e0c068'], ['Foreign large caps', '#a08cff'], ['Fallen high-beta', '#ff4d94'], ['Mega-cap quality', '#9cc6ff']],
    vicreg: [['Low-beta defensives', '#6ccb5f'], ['Average stock, normal market', '#b9b39f'], ['Volatile growth winners', '#c9f04a'], ['Caught in market stress', '#f28c38'],
      ['Crashed cyclicals', '#ff4d94'], ['Mega-cap staples', '#9cc6ff'], ['Utilities & REITs', '#4c8df6'], ['Foreign large caps', '#a08cff'],
      ['Large quality compounders', '#45c4c0'], ['Small & distressed', '#e8566c'], ['Calm large caps, calm market', '#6fd3e8'], ['Small, volatile, thin data', '#e0c068']],
  };
  const NAMES = { AAPL: 'Apple', MSFT: 'Microsoft', NVDA: 'Nvidia', GOOGL: 'Alphabet', AMZN: 'Amazon', META: 'Meta', AVGO: 'Broadcom', TSM: 'TSMC',
    ORCL: 'Oracle', AMD: 'AMD', MU: 'Micron', TSLA: 'Tesla', PLTR: 'Palantir', SMCI: 'Supermicro', WMT: 'Walmart', XOM: 'ExxonMobil',
    INTC: 'Intel', CCL: 'Carnival', GME: 'GameStop' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BAYER = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]].map(r => r.map(v => (v + 0.5) / 64));
  const BG = '#07090b', BONE = '#ece6da', MUTED = '#8d877d', ACCENT = '#75d69c', TAU = Math.PI * 2;
  const STEP = 330, MORPH = 900; // ms per month during playback; ms for an encoder switch
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const canvas = $('jtMapCanvas'), ctx = canvas.getContext('2d');
  const playBtn = $('jtMapPlay'), range = $('jtMapRange'), dateEl = $('jtMapDate'), cos = $('jtMapCos'), legend = $('jtMapLegend');
  const segBtns = [...root.querySelectorAll('.jt-seg button')];
  const controls = [playBtn, range, ...segBtns];
  controls.forEach(c => { c.disabled = true; });

  let D = null, L = null, enc = 'vicreg', from = null, t0 = 0, K = 1, pending = null;
  let fm = 0, playing = false, last = 0, visible = false, userPaused = false, shown = -1, sel = null, pinned = null, raf = 0;
  const E = {};
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const smooth = f => f * f * (3 - 2 * f);
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const label = m => { const [y, mo] = D.dates[m].split('-'); return `${MONTHS[+mo - 1]} ${y}`; };

  // per-encoder coordinates in a shared unit square, plus the market's mean position per month
  async function coords(e) {
    if (E[e]) return;
    const buf = await (await fetch(`assets/jepa-umap-${e}.bin?v=1`)).arrayBuffer();
    const [w, h] = new Float32Array(buf, 0, 2), q = new Uint16Array(buf, 8), x = new Float32Array(D.N), y = new Float32Array(D.N);
    for (let i = 0; i < D.N; i++) {
      x[i] = q[2 * i] / 65535 * 1.5 - 0.25 + (1 - w) / 2;
      y[i] = q[2 * i + 1] / 65535 * 1.5 - 0.25 + (1 - h) / 2;
    }
    const mean = new Float32Array(D.M);
    for (let m = 0; m < D.M; m++) { let s = 0; for (let r = D.off[m]; r < D.off[m + 1]; r++) s += x[r]; mean[m] = s / D.counts[m]; }
    E[e] = { x, y, mean, lo: Math.min(...mean), hi: Math.max(...mean) };
  }

  async function load() {
    try {
      const j = await (await fetch('assets/jepa-map.json?v=3')).json();
      const id = new Uint16Array(b64(j.id).buffer), mc = new Int8Array(b64(j.mcap).buffer), N = id.length, M = j.counts.length;
      const off = new Int32Array(M + 1);
      for (let m = 0; m < M; m++) off[m + 1] = off[m] + j.counts[m];
      // the same company in the next month (rows are sorted by company within a month)
      const next = new Int32Array(N).fill(-1), hasPrev = new Uint8Array(N);
      for (let m = 0; m < M - 1; m++) {
        let a = off[m], b = off[m + 1];
        while (a < off[m + 1] && b < off[m + 2]) {
          if (id[a] === id[b]) { next[a] = b; hasPrev[b] = 1; a++; b++; } else if (id[a] < id[b]) a++; else b++;
        }
      }
      const find = (m, cid) => {
        let lo = off[m], hi = off[m + 1] - 1;
        while (lo <= hi) { const k = (lo + hi) >> 1; if (id[k] === cid) return k; if (id[k] < cid) lo = k + 1; else hi = k - 1; }
        return -1;
      };
      const tracks = Object.entries(j.track).map(([sym, cid]) => ({ sym, rows: Int32Array.from({ length: M }, (_, m) => find(m, cid)) }));
      const size = Float32Array.from(mc, v => (v === -128 ? 0.8 : 1 + 0.28 * Math.min(3, Math.max(-1.5, v / 10)))); // coarse market cap
      const cl = Object.fromEntries(Object.entries(j.enc).map(([e, v]) => [e, b64(v.c)]));
      D = { N, M, dates: j.dates, counts: j.counts, off, next, hasPrev, tracks, size, cl };
      await coords(enc);
    } catch {
      $('jtMapStatus').textContent = 'The map could not be loaded.';
      return;
    }
    $('jtMapStatus').remove();
    range.max = D.M - 1;
    cos.innerHTML = D.tracks.map(t => `<li><button type="button" aria-pressed="false" data-sym="${t.sym}"><b>${t.sym}</b> <span>${NAMES[t.sym] || ''}</span></button></li>`).join('');
    controls.forEach(c => { c.disabled = false; });
    describe(enc);
    fm = reduced ? D.M - 1 : 0;
    if (visible && !reduced) play(true);
    kick();
  }

  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (L && L.W === W && L.H === H) return;
    canvas.width = W; canvas.height = H;
    const u = dpr, pad = 14 * u, sh = Math.round(Math.min(96 * u, Math.max(72 * u, H * 0.16))), axisH = 34 * u;
    const ms = Math.round(Math.min(W - 2 * pad, H - 2 * pad - sh - axisH)), cell = Math.max(2, Math.round(1.5 * u));
    L = { W, H, u, pad, ms, mx: Math.round((W - ms) / 2), my: pad, cell, gw: Math.ceil(ms / cell), gh: Math.ceil(ms / cell),
      sy: H - pad - sh, sh, dot: Math.max(1.1 * u, Math.min(2.2 * u, ms / 330)), ex: {}, path: {} };
  }

  // the long exposure: every company-month up to month m, as a three-tone ordered dither
  function exposure(e, m, alpha) {
    let X = L.ex[e];
    if (!X) {
      const { x, y } = E[e], bin = new Int32Array(D.N), full = new Uint16Array(L.gw * L.gh);
      for (let i = 0; i < D.N; i++) {
        const gx = Math.floor(x[i] * L.gw), gy = Math.floor(y[i] * L.gh);
        bin[i] = gx >= 0 && gx < L.gw && gy >= 0 && gy < L.gh ? gy * L.gw + gx : -1;
        if (bin[i] >= 0) full[bin[i]]++;
      }
      const sorted = full.filter(v => v).sort(), c = document.createElement('canvas');
      c.width = L.gw; c.height = L.gh;
      const cx = c.getContext('2d');
      X = L.ex[e] = { bin, grid: new Uint16Array(L.gw * L.gh), upto: -1, drawn: -1, k: 1 / Math.log1p(sorted[Math.floor(sorted.length * 0.995)] || 1), c, cx, img: cx.createImageData(L.gw, L.gh) };
    }
    if (m !== X.upto) {
      if (m > X.upto) for (let r = D.off[X.upto + 1]; r < D.off[m + 1]; r++) { if (X.bin[r] >= 0) X.grid[X.bin[r]]++; }
      else for (let r = D.off[m + 1]; r < D.off[X.upto + 1]; r++) { if (X.bin[r] >= 0) X.grid[X.bin[r]]--; }
      X.upto = m;
    }
    if (X.drawn !== m) {
      const d = X.img.data;
      for (let gy = 0, i = 0; gy < L.gh; gy++) {
        const row = BAYER[gy & 7];
        for (let gx = 0; gx < L.gw; gx++, i++) {
          const n = X.grid[i], lv = n ? Math.min(3, Math.floor(Math.min(1, Math.log1p(n) * X.k) ** 1.6 * 3 + row[gx & 7])) : 0;
          d[i * 4] = 150; d[i * 4 + 1] = 143; d[i * 4 + 2] = 132; d[i * 4 + 3] = lv * 42;
        }
      }
      X.cx.putImageData(X.img, 0, 0);
      X.drawn = m;
    }
    ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(X.c, L.mx, L.my, L.gw * L.cell, L.gh * L.cell);
    ctx.globalAlpha = 1;
  }

  // row r on screen, gliding by f toward row n (the same company next month), mid-morph between encoders
  function pos(r, n, f) {
    const a = E[enc], b = from && E[from];
    let x = a.x[r], y = a.y[r];
    if (n >= 0 && f) { x += (a.x[n] - x) * f; y += (a.y[n] - y) * f; }
    if (b) {
      let bx = b.x[r], by = b.y[r];
      if (n >= 0 && f) { bx += (b.x[n] - bx) * f; by += (b.y[n] - by) * f; }
      x = bx + (x - bx) * K; y = by + (y - by) * K;
    }
    return [L.mx + x * L.ms, L.my + y * L.ms];
  }

  function swarm(m, f) {
    const e = smooth(f), cl = D.cl[enc];
    for (let pass = 0; pass < 3; pass++) { // staying, leaving the sample, joining it
      if (pass && !f) break;
      const paths = CL[enc].map(() => new Path2D());
      const a = D.off[pass === 2 ? m + 1 : m], b = D.off[pass === 2 ? m + 2 : m + 1];
      for (let r = a; r < b; r++) {
        const n = D.next[r];
        if ((pass === 0 && f && n < 0) || (pass === 1 && n >= 0) || (pass === 2 && D.hasPrev[r])) continue;
        const [x, y] = pos(r, pass === 0 ? n : -1, e), rad = L.dot * D.size[r], P = paths[cl[r]];
        P.moveTo(x + rad, y); P.arc(x, y, rad, 0, TAU);
      }
      ctx.globalAlpha = 0.9 * (pass === 0 ? 1 : pass === 1 ? 1 - e : e);
      paths.forEach((P, c) => { ctx.fillStyle = CL[enc][c][1]; ctx.fill(P); });
    }
    ctx.globalAlpha = 1;
  }

  // notable companies: a ringed dot and ticker each; the selected one also shows its path so far
  function companies(m, f) {
    const u = L.u, e = smooth(f), heads = [];
    for (const T of D.tracks) {
      const a = T.rows[m], b = m + 1 < D.M ? T.rows[m + 1] : -1;
      const alpha = a >= 0 && b >= 0 ? 1 : a >= 0 ? 1 - e : b >= 0 ? e : 0;
      if (alpha) heads.push({ sym: T.sym, alpha, col: CL[enc][D.cl[enc][a >= 0 ? a : b]][1], p: a >= 0 ? pos(a, b, b >= 0 ? e : 0) : pos(b, -1, 0) });
      if (T.sym !== sel) continue;
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.beginPath();
      for (let k = 0; k <= m; k++) {
        if (T.rows[k] < 0) continue;
        const [x, y] = pos(T.rows[k], -1, 0);
        ctx.moveTo(x + 1.6 * u, y); ctx.arc(x, y, 1.6 * u, 0, TAU);
      }
      ctx.fill();
    }
    heads.sort((p, q) => (q.sym === sel) - (p.sym === sel) || p.p[1] - q.p[1]);
    for (const H of heads) {
      const on = H.sym === sel;
      ctx.globalAlpha = H.alpha;
      ctx.beginPath(); ctx.arc(H.p[0], H.p[1], (on ? 5.5 : 4) * u, 0, TAU);
      ctx.fillStyle = H.col; ctx.fill(); ctx.lineWidth = (on ? 2 : 1.5) * u; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // tickers: try a few spots around the dot, skip the ticker when none is free
    const placed = [], lh = 15 * u;
    ctx.font = `600 ${11 * u}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
    for (const H of heads) {
      const on = H.sym === sel, w = ctx.measureText(H.sym).width + 8 * u, [x, y] = H.p;
      let box = null;
      for (const dy of [0, -lh, lh, -2 * lh, 2 * lh]) {
        for (const side of x > L.mx + L.ms - 60 * u ? [-1, 1] : [1, -1]) {
          const x0 = side > 0 ? x + 7 * u : x - 7 * u - w, b = [x0, y + dy - lh / 2 + u, x0 + w, y + dy + lh / 2 - u];
          if (b[0] >= 2 * u && b[2] <= L.W - 2 * u && !placed.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { box = b; break; }
        }
        if (box) break;
      }
      if (!box) continue;
      placed.push(box);
      ctx.globalAlpha = H.alpha * (sel && !on ? 0.45 : 1);
      ctx.fillStyle = 'rgba(7,9,11,0.82)'; ctx.beginPath(); ctx.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], 3 * u); ctx.fill();
      ctx.fillStyle = on ? ACCENT : '#f5f3ef'; ctx.fillText(H.sym, box[0] + 4 * u, (box[1] + box[3]) / 2 + 0.5 * u);
    }
    ctx.globalAlpha = 1;
  }

  // calmer/volatile axis under the map, then the market's average position month by month
  function strip(fm) {
    const u = L.u, x0 = L.pad, w = L.W - 2 * L.pad, top = L.sy + 26 * u, bot = L.sy + L.sh - 20 * u, S = E[enc];
    const sx = k => x0 + k / (D.M - 1) * w, sv = v => bot - (v - S.lo) / (S.hi - S.lo) * (bot - top);
    ctx.font = `${10.5 * u}px ui-monospace, Menlo, monospace`; ctx.textBaseline = 'middle'; ctx.fillStyle = MUTED;
    const ay = L.my + L.ms + 16 * u;
    ctx.textAlign = 'left'; ctx.fillText('← calmer', L.mx, ay);
    ctx.textAlign = 'right'; ctx.fillText('more volatile →', L.mx + L.ms, ay);
    if (!L.path[enc]) {
      const line = new Path2D(), area = new Path2D();
      area.moveTo(x0, bot);
      for (let k = 0; k < D.M; k++) { (k ? line.lineTo : line.moveTo).call(line, sx(k), sv(S.mean[k])); area.lineTo(sx(k), sv(S.mean[k])); }
      area.lineTo(sx(D.M - 1), bot); area.closePath();
      L.path[enc] = { line, area };
    }
    const P = L.path[enc], cx = sx(fm), m = Math.floor(fm);
    const v = m + 1 < D.M ? S.mean[m] + (S.mean[m + 1] - S.mean[m]) * (fm - m) : S.mean[m];
    ctx.lineWidth = 1.2 * u; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(236,230,218,0.16)'; ctx.setLineDash([2 * u, 3 * u]); ctx.stroke(P.line); ctx.setLineDash([]);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - u, L.sy, cx - x0 + u, L.sh); ctx.clip();
    ctx.fillStyle = 'rgba(236,230,218,0.07)'; ctx.fill(P.area);
    ctx.strokeStyle = 'rgba(236,230,218,0.8)'; ctx.stroke(P.line);
    ctx.restore();
    ctx.fillStyle = 'rgba(236,230,218,0.09)'; ctx.fillRect(x0, L.sy, w, u);
    ctx.fillStyle = 'rgba(236,230,218,0.22)'; ctx.fillRect(Math.round(cx), L.sy + 20 * u, u, bot - L.sy - 20 * u);
    ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(cx, sv(v), 2.6 * u, 0, TAU); ctx.fill();
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = MUTED;
    ctx.textAlign = 'left'; ctx.fillText('market average, month by month', x0, L.sy + 16 * u);
    if (ctx.measureText('market average, month by month ↑ more volatile').width + 16 * u < w) { ctx.textAlign = 'right'; ctx.fillText('↑ more volatile', x0 + w, L.sy + 16 * u); }
    ctx.textAlign = 'left';
    const step = w / u < 420 ? 4 : 2;
    for (let yr = 2010; yr <= 2026; yr += step) {
      const tx = sx((yr - 2010) * 12), lw = ctx.measureText(String(yr)).width;
      ctx.fillStyle = 'rgba(236,230,218,0.25)'; ctx.fillRect(Math.round(tx), bot + 2 * u, u, 4 * u);
      ctx.fillStyle = MUTED; ctx.fillText(String(yr), Math.min(x0 + w - lw, Math.max(x0, tx - lw / 2)), L.sy + L.sh - 4 * u);
    }
  }

  function draw(now) {
    raf = 0;
    if (!D) return;
    layout();
    if (playing) {
      fm = Math.min(D.M - 1, fm + (now - last) / STEP); last = now;
      if (fm >= D.M - 1) play(false);
    }
    K = from ? smooth(Math.min(1, (now - t0) / MORPH)) : 1;
    const m = Math.min(D.M - 1, Math.floor(fm)), f = m < D.M - 1 ? fm - m : 0;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, L.W, L.H);
    if (from) exposure(from, m, 1 - K);
    exposure(enc, m, from ? K : 1);
    swarm(m, f);
    companies(m, f);
    strip(fm);
    if (K >= 1) from = null;
    if (m !== shown) { shown = m; dateEl.textContent = label(m); range.value = m; range.setAttribute('aria-valuetext', label(m)); }
    if (playing || from) kick();
  }

  function play(on) {
    if (on && fm >= D.M - 1) fm = 0;
    playing = on; last = performance.now();
    playBtn.textContent = on ? '❚❚ Pause' : '▶ Play';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    kick();
  }

  async function setEnc(e) {
    pending = e;
    segBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.enc === e)));
    describe(e);
    await coords(e); // the original encoder loads on first use
    if (pending !== e || e === enc) return;
    from = enc; enc = e; t0 = performance.now() - (reduced ? MORPH : 0);
    kick();
  }

  function describe(e) {
    $('jtMapNote').innerHTML = NOTE[e];
    legend.innerHTML = CL[e].map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
  }

  const seek = m => { userPaused = true; play(false); fm = m; kick(); };
  playBtn.addEventListener('click', () => { userPaused = playing; play(!playing); });
  range.addEventListener('input', () => seek(+range.value));
  segBtns.forEach(b => b.addEventListener('click', () => setEnc(b.dataset.enc)));
  // the market-average strip doubles as a timeline: press or drag on it to jump to a month
  const stripMonth = ev => {
    const r = canvas.getBoundingClientRect(), u = L.u, x = (ev.clientX - r.left) * u, y = (ev.clientY - r.top) * u;
    return y >= L.sy ? Math.round(Math.min(1, Math.max(0, (x - L.pad) / (L.W - 2 * L.pad))) * (D.M - 1)) : -1;
  };
  canvas.addEventListener('pointerdown', ev => { if (!D) return; const m = stripMonth(ev); if (m >= 0) { canvas.setPointerCapture(ev.pointerId); seek(m); } });
  canvas.addEventListener('pointermove', ev => {
    if (!D) return;
    if (canvas.hasPointerCapture(ev.pointerId)) seek(Math.max(0, stripMonth({ clientX: ev.clientX, clientY: canvas.getBoundingClientRect().bottom })));
    else canvas.style.cursor = stripMonth(ev) >= 0 ? 'pointer' : '';
  });
  // hover or focus a company to preview its path; click to keep it selected
  const preview = ev => { const b = ev.target.closest('button'); if (b) { sel = b.dataset.sym; kick(); } };
  const unpreview = () => { sel = pinned; kick(); };
  cos.addEventListener('pointerover', preview);
  cos.addEventListener('focusin', preview);
  cos.addEventListener('pointerleave', unpreview);
  cos.addEventListener('focusout', unpreview);
  cos.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    pinned = sel = pinned === b.dataset.sym ? null : b.dataset.sym;
    cos.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sym === pinned)));
    kick();
  });
  addEventListener('resize', kick);

  // load when the section approaches; play only while it is on screen
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load(); } }, { rootMargin: '600px 0px' }).observe(root);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!D || reduced) return;
    if (!visible && playing) play(false);
    else if (visible && !playing && !userPaused && fm < D.M - 1) play(true);
  }, { threshold: 0.35 }).observe(root);
})();

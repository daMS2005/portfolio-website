// Brain-data figures (thesis.html, section 04), drawn from the thesis data in assets/thesis-brain.json:
// the story as brain and model heard it (group-mean BOLD above, SAE features below, one time axis),
// and where listeners agree (ISC) next to where the features predict (held-out r), on one colour scale.
(() => {
  const story = document.getElementById('thesisStory'), maps = document.getElementById('thesisMaps');
  if (!story || !maps) return;

  const INK = '#f5f3ef', MUTED = '#aaa7a2', FAINT = '#5f5b56', ORANGE = '#ff5c2a', BAR = '#77736d', R_MAX = 0.75;
  const FONT = getComputedStyle(document.body).fontFamily;
  const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ramp = stops => Array.from({ length: 256 }, (_, i) => {
    let k = 1;
    while (k < stops.length - 1 && stops[k][0] < i / 255) k++;
    const [a, ca] = stops[k - 1], [b, cb] = stops[k], f = clamp01((i / 255 - a) / (b - a));
    return ca.map((c, j) => c + (cb[j] - c) * f);
  });
  const WARM = ramp([[0, [8, 9, 10]], [0.3, [58, 22, 14]], [0.55, [168, 56, 26]], [0.78, [255, 104, 50]], [1, [255, 228, 200]]]);
  const COOL = ramp([[0, [8, 9, 10]], [0.25, [18, 36, 58]], [0.6, [66, 136, 202]], [1, [228, 242, 255]]]);
  const MAPC = ramp([[0, [34, 29, 27]], [0.22, [96, 36, 20]], [0.5, [214, 76, 32]], [0.75, [255, 150, 92]], [1, [255, 232, 208]]]);

  // Ordered dither: each channel snaps to 5 levels by an 8x8 Bayer threshold. Packed RGBA per (value, Bayer cell);
  // idx maps a stored byte to a ramp index, and a negative index stays transparent.
  const dither = (lut, idx = q => q) => {
    const t = new Uint32Array(256 * 64);
    for (let q = 0; q < 256; q++) {
      const i = idx(q);
      if (i >= 0) for (let k = 0; k < 64; k++) {
        const ch = c => Math.min(4, Math.floor(lut[i][c] / 255 * 4 + BAYER[k])) * 63.75;
        t[q * 64 + k] = ((255 << 24) | (ch(2) << 16) | (ch(1) << 8) | ch(0)) >>> 0;
      }
    }
    return t;
  };
  const PAL = {
    bold: dither(WARM, q => (q ? Math.round(clamp01(((q - 1) / 254 * 6 - 3 + 2.5) / 5) * 255) : -1)), // stored z in [-3, 3], shown over [-2.5, 2.5]
    feat: dither(COOL, q => q || -1), warm: dither(WARM), cool: dither(COOL), map: dither(MAPC),
  };
  const EDGE = 0xff0a0908; // parcel borders: rgb(8, 9, 10)

  const mmss = s => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
  const dec = (v, n) => (v ? v.toFixed(n).replace(/^0/, '') : '0');
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

  // ---------- drawing surface: pixel blocks in device px, text and lines in CSS px ----------
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  // Available width, floored to whole device pixels so the bitmap maps 1:1 onto the screen.
  const width = c => { c.style.width = ''; return Math.floor(c.getBoundingClientRect().width * dpr()) / dpr(); };
  function sheet(w, h) {
    const u = dpr(), c = document.createElement('canvas');
    h = Math.round(h * u) / u;
    c.width = Math.round(w * u); c.height = Math.round(h * u);
    const x = c.getContext('2d');
    x.setTransform(u, 0, 0, u, 0, 0);
    return { c, x, u, w, h, cell: Math.max(1, Math.round(u)) };
  }
  const dev = (s, v) => Math.round(v * s.u);
  function pixels(s, x0, y0, w, h, f) {
    const X0 = dev(s, x0), Y0 = dev(s, y0), W = dev(s, w), H = dev(s, h), img = s.x.createImageData(W, H), out = new Uint32Array(img.data.buffer);
    for (let j = 0; j < H; j++) {
      const by = (((Y0 + j) / s.cell) & 7) * 8;
      for (let i = 0; i < W; i++) out[j * W + i] = f(i, j, by + (((X0 + i) / s.cell) & 7));
    }
    s.x.putImageData(img, X0, Y0);
  }
  function text(s, str, x, y, size, color = MUTED, align = 'left', weight = 500) {
    const c = s.x;
    c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    c.fillText(str, x, y);
    return c.measureText(str).width;
  }
  const scale = (s, x0, y0, w, h, pal) => { const W = dev(s, w); pixels(s, x0, y0, w, h, (i, j, k) => pal[Math.round(i / (W - 1) * 255) * 64 + k]); };

  // Time-by-row raster: one column per TR, rows in groups split by a small gap. Returns each group's name and centre y.
  function raster(s, x0, y0, w, h, Q, groups, pal) {
    const W = dev(s, w), H = dev(s, h), gap = dev(s, 1.5), nR = groups.reduce((a, g) => a + g[1], 0), avail = H - gap * (groups.length - 1);
    const row = new Int16Array(H).fill(-1), col = Int32Array.from({ length: W }, (_, i) => Math.floor(i * D.nT / W) * nR), mids = [];
    let y = 0, r0 = 0;
    for (const [name, n] of groups) {
      const gh = Math.round(avail * (r0 + n) / nR) - Math.round(avail * r0 / nR);
      for (let k = 0; k < gh; k++) row[y + k] = r0 + Math.floor(k * n / gh);
      mids.push([name, y0 + (y + gh / 2) / s.u]); y += gh + gap; r0 += n;
    }
    pixels(s, x0, y0, w, h, (i, j, k) => (row[j] < 0 ? 0 : pal[Q[col[i] + row[j]] * 64 + k]));
    return mids;
  }

  // Four atlas views (left and right lateral above, left and right medial below); parcels filled by value, borders dark.
  function brain(s, x0, y0, sc, gap, vals) {
    const { w: vw, h: vh } = D.views, k = sc * s.u, pw = dev(s, vw * sc), ph = dev(s, vh * sc);
    const q = Uint8Array.from({ length: 201 }, (_, l) => (l ? Math.round(clamp01(vals[l - 1] / R_MAX) * 255) : 0));
    for (let v = 0; v < 4; v++) {
      const L = D.lab.subarray(v * vw * vh, (v + 1) * vw * vh), at = (i, j) => (i < pw && j < ph ? L[Math.floor(j / k) * vw + Math.floor(i / k)] : 0);
      pixels(s, x0 + (v % 2) * (vw * sc + gap), y0 + (v >> 1) * (vh * sc + gap), vw * sc, vh * sc, (i, j, b) => {
        const l = at(i, j), r = at(i + 1, j), d = at(i, j + 1);
        return !l ? 0 : (r && r !== l) || (d && d !== l) ? EDGE : PAL.map[q[l] * 64 + b];
      });
    }
  }

  // Panel header: name, detail, and a colour key (lo, ramp, hi) at the right edge.
  function header(s, y, name, detail, lo, hi, pal, fs) {
    text(s, detail, text(s, name, 0, y, fs + 1, INK, 'left', 600) + 8, y, fs);
    const x1 = s.w - text(s, hi, s.w, y, fs, MUTED, 'right') - 6, bl = fs * 5;
    scale(s, x1 - bl, y - 3, bl, 6, pal);
    text(s, lo, x1 - bl - 6, y, fs, MUTED, 'right');
  }

  // ---------- figure 1: the story ----------
  let D = null, S = null, drawn = '';
  function drawStory() {
    const w = width(story), narrow = w < 560, fs = narrow ? 10 : 12;
    const band = narrow ? 150 : Math.round(Math.min(220, Math.max(150, w * 0.2))), y1 = 26, y2 = y1 + band + 38, axis = y2 + band, s = sheet(w, axis + 28);
    s.x.font = `500 ${fs}px ${FONT}`;
    const gut = Math.ceil(Math.max(...[...D.nets, ...D.layers].map(g => s.x.measureText(g[0]).width))) + 12, bw = w - gut, X = t => gut + t / D.nT * bw;
    for (const [name, y] of raster(s, gut, y1, bw, band, D.bold, D.nets, PAL.bold)) text(s, name, gut - 8, y, fs, MUTED, 'right');
    for (const [name, y] of raster(s, gut, y2, bw, band, D.feat, D.layers, PAL.feat)) text(s, name, gut - 8, y, fs, MUTED, 'right');
    header(s, y1 - 13, 'Brain', narrow ? `mean of ${D.listeners} listeners` : `cleaned BOLD, mean of ${D.listeners} listeners, 200 parcels`, 'z  −2.5', '+2.5', PAL.warm, fs);
    header(s, y2 - 13, 'Model', narrow ? '256 SAE features' : `${D.model}, 256 sparse-autoencoder features`, '0', 'peak', PAL.cool, fs);

    const secs = D.nT * D.tr, step = narrow ? 120 : 60, ticks = [];
    for (let t = 0; secs - t > step * 0.4; t += step) ticks.push(t);
    ticks.push(secs);
    ticks.forEach((t, i) => {
      const x = X(t / D.tr), end = i === ticks.length - 1;
      s.x.fillStyle = FAINT; s.x.fillRect(Math.min(x - 0.5, w - 1), axis + 3, 1, 4);
      text(s, mmss(t), x, axis + 17, fs, MUTED, !i ? 'left' : end ? 'right' : 'center');
    });
    s.x.fillStyle = ORANGE; // censored scans: no group-mean BOLD
    for (const t of D.censored) s.x.fillRect(X(t), axis + 1, bw / D.nT, 2);

    S = { s, gut, bw, y1, y2, band, axis, fs };
    show(story, s);
  }

  // Optional readout: a hairline through both rasters and the time under it.
  function hover(t) {
    const x = story.getContext('2d'), { s, gut, bw, y1, y2, band, axis, fs } = S, cx = gut + (t + 0.5) / D.nT * bw;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, s.c.width, s.c.height); x.drawImage(s.c, 0, 0);
    if (t < 0) return;
    x.setTransform(s.u, 0, 0, s.u, 0, 0);
    x.fillStyle = INK; x.fillRect(cx - 0.5, y1, 1, band); x.fillRect(cx - 0.5, y2, 1, band);
    const str = [mmss(t * D.tr), D.censored.has(t) && 'BOLD censored', D.silent.has(t) && 'no speech'].filter(Boolean).join(' · ');
    x.font = `600 ${fs}px ${FONT}`;
    const tw = x.measureText(str).width + 14, bx = Math.min(Math.max(cx - tw / 2, 0), s.w - tw);
    x.beginPath(); x.roundRect(bx, axis + 7, tw, 20, 10); x.fill();
    x.fillStyle = '#0b0b0b'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, bx + tw / 2, axis + 17);
  }
  const point = e => { if (S) { const t = Math.floor((e.clientX - story.getBoundingClientRect().left - S.gut) / S.bw * D.nT); hover(t >= 0 && t < D.nT ? t : -1); } };
  story.addEventListener('pointermove', point);
  story.addEventListener('pointerdown', point);
  story.addEventListener('pointerleave', () => S && hover(-1));

  // ---------- figure 2: the maps ----------
  function drawMaps() {
    const w = width(maps), side = w >= 520, fs = w < 560 ? 10 : 12, gap = 28, vg = 6, bins = 30;
    const cw = side ? (w - gap) / 2 : w, { w: vw, h: vh } = D.views, sc = (cw - vg) / (2 * vw), hy = 44 + 2 * vh * sc + vg + 18, hh = side ? 52 : 44, by = hy + hh + 3, bh = by + 26;
    const s = sheet(w, side ? bh : 2 * bh + 32);
    const panels = [[D.isc, 'Where listeners agree', 'leave-one-out ISC'], [D.trR, 'Where the features predict', 'held-out prediction r']].map(([v, ...t]) => {
      const c = new Array(bins).fill(0);
      for (const r of v) c[Math.min(bins - 1, Math.floor(clamp01(r / R_MAX) * bins))]++;
      return [v, c, ...t];
    });
    const top = Math.max(...panels.flatMap(p => p[1]));
    panels.forEach(([v, c, title, detail], i) => {
      const x0 = side ? i * (cw + gap) : 0, y0 = side ? 0 : i * (bh + 32), X = r => x0 + r / R_MAX * cw, m = mean(v);
      text(s, title, x0, y0 + 8, fs + 1, INK, 'left', 600);
      text(s, `${detail} · mean ${dec(m, 3)}`, x0, y0 + 26, fs);
      brain(s, x0, y0 + 44, sc, vg, v);
      s.x.fillStyle = BAR; // parcels per bin, one height scale for both panels
      c.forEach((n, b) => { if (n) { const bhgt = Math.max(1.5, n / top * hh); s.x.fillRect(x0 + b * cw / bins + 0.5, y0 + by - 3 - bhgt, cw / bins - 1, bhgt); } });
      text(s, '200 parcels', x0 + cw, y0 + hy + 5, fs, MUTED, 'right');
      s.x.fillStyle = INK; s.x.fillRect(X(m) - 0.5, y0 + hy, 1, by - hy - 2);
      scale(s, x0, y0 + by, cw, 7, PAL.map);
      [0, 0.25, 0.5, 0.75].forEach((r, k) => text(s, dec(r, 2), X(r), y0 + by + 19, fs, MUTED, !k ? 'left' : k === 3 ? 'right' : 'center'));
    });
    show(maps, s);
  }

  function show(canvas, s) {
    canvas.style.width = `${s.w}px`; canvas.style.height = `${s.h}px`; canvas.width = s.c.width; canvas.height = s.c.height;
    canvas.getContext('2d').drawImage(s.c, 0, 0);
  }

  function draw() {
    const key = `${story.parentElement.clientWidth}/${maps.parentElement.clientWidth}@${devicePixelRatio}`;
    if (!D || key === drawn) return;
    drawn = key; drawStory(); drawMaps();
  }

  function load() {
    fetch('assets/thesis-brain.json?v=1').then(r => r.json()).then(j => {
      const b64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0)), rle = b64(j.views.rle), lab = new Uint8Array(4 * j.views.w * j.views.h);
      for (let i = 0, o = 0; i < rle.length; i += 2) lab.fill(rle[i], o, (o += rle[i + 1]));
      D = { ...j, bold: b64(j.bold), feat: b64(j.feat), lab, censored: new Set(j.censored), silent: new Set(j.silent) };
      draw();
    }).catch(() => { story.hidden = maps.hidden = true; });
  }

  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(draw, 150); });
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load(); } }, { rootMargin: '600px 0px' }).observe(story);
})();

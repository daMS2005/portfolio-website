// Animated PCA map of JEPA embeddings (jepa-transformer.html, section 03).
(() => {
  const root = document.getElementById('jtMap');
  if (!root) return;

  const ENC = {
    og: {
      note: v => `<b>Original encoder.</b> The embedding collapsed: PC1 alone holds ${Math.round(v[0] * 100)}% of the variance, leaving about 3 effective dimensions. Almost everything lines up along one volatility axis.`,
      CL: [['Average, uneasy market', '#b9b39f'], ['Small & beaten down', '#e8566c'], ['Caught in market stress', '#f28c38'], ['Small high-flyers', '#6ccb5f'],
        ['Quiet mid-caps', '#45c4c0'], ['Calm, steady large caps', '#4c8df6'], ['Momentum growth', '#c9f04a'], ['Commodity distress', '#b9634f'],
        ['Market-sensitive cyclicals', '#e0c068'], ['Foreign large caps', '#a08cff'], ['Fallen high-beta', '#ff4d94'], ['Mega-cap quality', '#9cc6ff']],
      flipX: true, // its PC1 points the other way; flip so right is riskier for both
    },
    vicreg: {
      note: v => `<b>Retrained with a VICReg penalty.</b> A variance–covariance term keeps the dimensions in use: about 370 effective dimensions, so no single axis dominates (PC1 ${Math.round(v[0] * 1000) / 10}%, PC2 ${Math.round(v[1] * 1000) / 10}%) and clusters separate by risk, momentum and size.`,
      CL: [['Low-beta defensives', '#6ccb5f'], ['Average stock, normal market', '#b9b39f'], ['Volatile growth winners', '#c9f04a'], ['Caught in market stress', '#f28c38'],
        ['Crashed cyclicals', '#ff4d94'], ['Mega-cap staples', '#9cc6ff'], ['Utilities & REITs', '#4c8df6'], ['Foreign large caps', '#a08cff'],
        ['Large quality compounders', '#45c4c0'], ['Small & distressed', '#e8566c'], ['Calm large caps, calm market', '#6fd3e8'], ['Small, volatile, thin data', '#e0c068']],
      flipX: false,
    },
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const canvas = $('jtMapCanvas'), ctx = canvas.getContext('2d');
  const playBtn = $('jtMapPlay'), range = $('jtMapRange'), dateEl = $('jtMapDate');
  const segBtns = [...root.querySelectorAll('.jt-seg button')];

  let D = null, off = [], enc = 'vicreg', frame = 0, playing = false, timer = 0, visible = false;
  // current tween: from/to positions per row of the target frame
  let anim = null;

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function load() {
    fetch('assets/jepa-pca.json?v=2').then(r => r.json()).then(j => {
      D = { dates: j.dates, counts: j.counts, id: new Uint16Array(b64(j.id).buffer), enc: {},
        track: new Map(Object.entries(j.track).map(([sym, id]) => [id, sym])) };
      for (const k in j.enc) D.enc[k] = { p: b64(j.enc[k].p), c: b64(j.enc[k].c), v: j.enc[k].var };
      off = [0]; D.counts.forEach(n => off.push(off[off.length - 1] + n));
      range.max = D.dates.length - 1;
      $('jtMapStatus').remove();
      setEnc(enc, false);
      show(0, false);
      if (visible && !reduced) play(true);
    }).catch(() => { $('jtMapStatus').textContent = 'The embedding map could not be loaded.'; });
  }

  // position of row r in encoder e, in 0..1
  function pos(e, r) {
    const p = D.enc[e].p, x = p[2 * r] / 255;
    return [ENC[e].flipX ? 1 - x : x, 1 - p[2 * r + 1] / 255];
  }

  function rowsOf(f) {
    const m = new Map();
    for (let r = off[f]; r < off[f + 1]; r++) m.set(D.id[r], r);
    return m;
  }

  // Build a tween to frame f in encoder e, starting from what is on screen now.
  function target(f, e, ms) {
    const prev = anim ? currentPositions() : null;
    const items = [];
    for (let r = off[f]; r < off[f + 1]; r++) {
      const to = pos(e, r), from = prev && prev.get(D.id[r]);
      items.push({ id: D.id[r], from: from || to, to, a0: from ? 1 : 0, a1: 1, col: ENC[e].CL[D.enc[e].c[r]][1] });
    }
    if (prev) { // fade out companies that leave
      const here = new Set(items.map(i => i.id));
      prev.forEach((p, id) => { if (!here.has(id)) items.push({ id, from: p, to: p, a0: p[2], a1: 0, col: p[3] }); });
    }
    anim = { items, t0: performance.now(), ms: reduced ? 0 : ms };
    requestAnimationFrame(draw);
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function progress() { return anim.ms ? Math.min(1, (performance.now() - anim.t0) / anim.ms) : 1; }

  function currentPositions() {
    const k = ease(progress()), m = new Map();
    for (const it of anim.items) {
      const a = it.a0 + (it.a1 - it.a0) * k;
      if (a > 0.01) m.set(it.id, [it.from[0] + (it.to[0] - it.from[0]) * k, it.from[1] + (it.to[1] - it.from[1]) * k, a, it.col]);
    }
    return m;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    return dpr;
  }

  function draw() {
    if (!anim) return;
    const dpr = resize(), W = canvas.width, H = canvas.height, pad = 28 * dpr;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(W / 2, pad / 2); ctx.lineTo(W / 2, H - pad / 2); ctx.moveTo(pad / 2, H / 2); ctx.lineTo(W - pad / 2, H / 2); ctx.stroke();
    const rad = (W < 700 * dpr ? 1.9 : 2.4) * dpr, pts = currentPositions(), named = [];
    const px = x => pad + x * (W - 2 * pad), py = y => pad + y * (H - 2 * pad);
    pts.forEach(([x, y, a, col], id) => {
      ctx.globalAlpha = 0.82 * a; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px(x), py(y), rad, 0, 6.283); ctx.fill();
      if (D.track.has(id)) named.push([px(x), py(y), a, col, D.track.get(id)]);
    });
    // notable companies: ringed dot and ticker on top of the cloud
    ctx.font = `700 ${11 * dpr}px system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const [x, y, a, col, sym] of named) {
      ctx.globalAlpha = a;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad * 1.9, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      const left = x > W - 70 * dpr, tx = left ? x - 7 * dpr : x + 7 * dpr;
      ctx.textAlign = left ? 'right' : 'left';
      ctx.strokeStyle = 'rgba(7,9,11,0.9)'; ctx.lineWidth = 3 * dpr; ctx.strokeText(sym, tx, y);
      ctx.fillStyle = '#fff'; ctx.fillText(sym, tx, y);
    }
    ctx.globalAlpha = 1;
    if (progress() < 1) requestAnimationFrame(draw);
  }

  function label(f) { const [y, m] = D.dates[f].split('-'); return `${MONTHS[+m - 1]} ${y}`; }

  function show(f, tween = true) {
    frame = f; range.value = f; dateEl.textContent = label(f);
    target(f, enc, tween ? 240 : 0);
  }

  function setEnc(e, tween = true) {
    enc = e;
    segBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.enc === e)));
    $('jtMapNote').innerHTML = ENC[e].note(D.enc[e].v);
    $('jtMapLegend').innerHTML = ENC[e].CL.map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
    if (tween) target(frame, enc, 900);
  }

  function play(on) {
    playing = on;
    playBtn.textContent = on ? '❚❚ Pause' : '▶ Play';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    clearTimeout(timer);
    if (on) tick();
  }

  function tick() {
    if (!playing) return;
    const last = frame >= D.dates.length - 1;
    show(last ? 0 : frame + 1, !last);
    timer = setTimeout(tick, last ? 1400 : 260);
  }

  playBtn.addEventListener('click', () => { if (D) play(!playing); });
  range.addEventListener('input', () => { if (!D) return; play(false); show(+range.value, false); });
  segBtns.forEach(b => b.addEventListener('click', () => { if (D && b.dataset.enc !== enc) setEnc(b.dataset.enc); }));
  addEventListener('resize', () => { if (anim) requestAnimationFrame(draw); });

  // load when the section approaches; play only while it is on screen
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load(); } }, { rootMargin: '600px 0px' }).observe(root);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!D || reduced) return;
    if (!visible && playing) play(false);
    else if (visible && !playing && frame === 0) play(true);
  }, { threshold: 0.35 }).observe(root);
})();

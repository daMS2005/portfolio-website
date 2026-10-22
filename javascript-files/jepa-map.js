// Animated risk map of JEPA embeddings (jepa-transformer.html, section 03).
// Each cluster is an island placed by forecast volatility (x) and 12-month momentum (y);
// companies glide between islands as their cluster changes month to month.
(() => {
  const root = document.getElementById('jtMap');
  if (!root) return;

  // cluster name, colour, island centre (x: calmer -> riskier, y: winners -> losers)
  const ENC = {
    og: {
      note: '<b>Original encoder.</b> Its embedding collapsed to about 3 effective dimensions, with 80% of the variance on a single volatility axis.',
      CL: [['Average, uneasy market', '#b9b39f', .42, .52], ['Small & beaten down', '#e8566c', .78, .80], ['Caught in market stress', '#f28c38', .62, .55],
        ['Small high-flyers', '#6ccb5f', .70, .20], ['Quiet mid-caps', '#45c4c0', .36, .25], ['Calm, steady large caps', '#4c8df6', .17, .52],
        ['Momentum growth', '#c9f04a', .90, .14], ['Commodity distress', '#b9634f', .62, .90], ['Market-sensitive cyclicals', '#e0c068', .45, .84],
        ['Foreign large caps', '#a08cff', .07, .86], ['Fallen high-beta', '#ff4d94', .93, .58], ['Mega-cap quality', '#9cc6ff', .08, .18]],
    },
    vicreg: {
      note: '<b>Retrained with a VICReg penalty.</b> A variance–covariance term keeps about 370 effective dimensions in use, so the clusters separate by risk, momentum and size.',
      CL: [['Low-beta defensives', '#6ccb5f', .30, .50], ['Average stock, normal market', '#b9b39f', .50, .48], ['Volatile growth winners', '#c9f04a', .88, .15],
        ['Caught in market stress', '#f28c38', .66, .72], ['Crashed cyclicals', '#ff4d94', .86, .90], ['Mega-cap staples', '#9cc6ff', .06, .22],
        ['Utilities & REITs', '#4c8df6', .10, .60], ['Foreign large caps', '#a08cff', .08, .88], ['Large quality compounders', '#45c4c0', .27, .18],
        ['Small & distressed', '#e8566c', .94, .58], ['Calm large caps, calm market', '#6fd3e8', .30, .82], ['Small, volatile, thin data', '#e0c068', .66, .30]],
    },
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const canvas = $('jtMapCanvas'), ctx = canvas.getContext('2d');
  const playBtn = $('jtMapPlay'), range = $('jtMapRange'), dateEl = $('jtMapDate');
  const segBtns = [...root.querySelectorAll('.jt-seg button')];

  let D = null, off = [], enc = 'vicreg', frame = 0, playing = false, timer = 0, visible = false, anim = null, spacing = 0.01;

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function load() {
    fetch('assets/jepa-map.json?v=1').then(r => r.json()).then(j => {
      D = { dates: j.dates, counts: j.counts, id: new Uint16Array(b64(j.id).buffer), mcap: new Int8Array(b64(j.mcap).buffer), enc: {},
        track: new Map(Object.entries(j.track).map(([sym, id]) => [id, sym])) };
      for (const k in j.enc) D.enc[k] = b64(j.enc[k].c);
      off = [0]; D.counts.forEach(n => off.push(off[off.length - 1] + n));
      // one dot spacing for every month and encoder, so the biggest island always fits
      let most = 0;
      for (const k in D.enc) for (let f = 0; f < D.counts.length; f++) {
        const n = new Array(12).fill(0);
        for (let r = off[f]; r < off[f + 1]; r++) n[D.enc[k][r]]++;
        most = Math.max(most, ...n);
      }
      spacing = 0.19 / Math.sqrt(most);
      range.max = D.dates.length - 1;
      $('jtMapStatus').remove();
      setEnc(enc, false);
      show(0, false);
      if (visible && !reduced) play(true);
    }).catch(() => { $('jtMapStatus').textContent = 'The map could not be loaded.'; });
  }

  // Island layout for frame f: biggest companies at the centre, a sunflower spiral outwards.
  // Positions are fractions of the plot; offsets are scaled by height so islands stay round.
  function layout(f, e) {
    const aspect = canvas.clientHeight / canvas.clientWidth, groups = Array.from({ length: 12 }, () => []);
    for (let r = off[f]; r < off[f + 1]; r++) groups[D.enc[e][r]].push(r);
    const out = new Map(), islands = [];
    groups.forEach((rows, c) => {
      if (!rows.length) return;
      rows.sort((a, b) => D.mcap[b] - D.mcap[a]);
      const [, col, cx, cy] = ENC[e].CL[c];
      rows.forEach((r, k) => {
        const rad = spacing * Math.sqrt(k + 0.5), th = k * 2.39996;
        out.set(r, [cx + rad * Math.cos(th) * aspect, cy + rad * Math.sin(th), col]);
      });
      islands.push([c, cx, cy, spacing * Math.sqrt(rows.length)]);
    });
    return { pos: out, islands };
  }

  function target(f, e, ms) {
    const prev = anim ? currentPositions() : null, L = layout(f, e), items = [];
    for (let r = off[f]; r < off[f + 1]; r++) {
      const [x, y, col] = L.pos.get(r), from = prev && prev.get(D.id[r]);
      items.push({ id: D.id[r], from: from || [x, y], to: [x, y], a0: from ? 1 : 0, a1: 1, col });
    }
    if (prev) {
      const here = new Set(items.map(i => i.id));
      prev.forEach((p, id) => { if (!here.has(id)) items.push({ id, from: p, to: p, a0: p[2], a1: 0, col: p[3] }); });
    }
    anim = { items, islands: L.islands, e, t0: performance.now(), ms: reduced ? 0 : ms };
    requestAnimationFrame(draw);
  }

  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const progress = () => (anim.ms ? Math.min(1, (performance.now() - anim.t0) / anim.ms) : 1);

  function currentPositions() {
    const k = ease(progress()), m = new Map();
    for (const it of anim.items) {
      const a = it.a0 + (it.a1 - it.a0) * k;
      if (a > 0.01) m.set(it.id, [it.from[0] + (it.to[0] - it.from[0]) * k, it.from[1] + (it.to[1] - it.from[1]) * k, a, it.col]);
    }
    return m;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  function draw() {
    if (!anim) return;
    const dpr = resize(), W = canvas.width, H = canvas.height, padX = 34 * dpr, padY = 30 * dpr;
    const px = x => padX + x * (W - 2 * padX), py = y => padY + y * (H - 2 * padY);
    ctx.clearRect(0, 0, W, H);
    const rad = Math.max(1.2 * dpr, spacing * (H - 2 * padY) * 0.42), pts = currentPositions(), named = [];
    pts.forEach(([x, y, a, col], id) => {
      ctx.globalAlpha = 0.9 * a; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px(x), py(y), rad, 0, 6.283); ctx.fill();
      if (D.track.has(id)) named.push([px(x), py(y), a, col, D.track.get(id)]);
    });

    // cluster names above their islands, fading in once a switch or month change settles
    const placed = [], lh = 12 * dpr, k = ease(progress());
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `700 ${11 * dpr}px system-ui, sans-serif`;
    for (const [c, cx, cy, r] of anim.islands) {
      const [name, col] = ENC[anim.e].CL[c], w = ctx.measureText(name).width;
      const x = Math.min(Math.max(px(cx) - w / 2, 4 * dpr), W - w - 4 * dpr), y = Math.max(py(cy - r) - 9 * dpr, lh);
      placed.push([x, y - lh / 2, x + w, y + lh / 2]);
      ctx.globalAlpha = 0.95 * k; ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(7,9,11,0.85)'; ctx.lineWidth = 3 * dpr; ctx.strokeText(name, x, y);
      ctx.fillStyle = col; ctx.fillText(name, x, y);
    }

    // notable companies: ringed dot and ticker, nudged so labels do not overlap
    named.sort((p, q) => p[1] - q[1]);
    for (const [x, y, a, col] of named) {
      ctx.globalAlpha = a;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, Math.max(rad * 1.8, 3.2 * dpr), 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    }
    for (const [x, y, a, , sym] of named) {
      ctx.globalAlpha = a;
      const w = ctx.measureText(sym).width, prefer = x > W - 70 * dpr ? [-1, 1] : [1, -1];
      let box = null;
      for (const dy of [0, -lh, lh, -2 * lh, 2 * lh, -3 * lh, 3 * lh]) {
        for (const side of prefer) {
          const x0 = side > 0 ? x + 7 * dpr : x - 7 * dpr - w, b = [x0, y + dy - lh / 2, x0 + w, y + dy + lh / 2];
          if (!placed.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { box = b; break; }
        }
        if (box) break;
      }
      if (!box) continue; // no free spot: keep the ringed dot, skip the ticker
      placed.push(box);
      ctx.strokeStyle = 'rgba(7,9,11,0.9)'; ctx.lineWidth = 3 * dpr; ctx.strokeText(sym, box[0], (box[1] + box[3]) / 2);
      ctx.fillStyle = '#fff'; ctx.fillText(sym, box[0], (box[1] + box[3]) / 2);
    }
    ctx.globalAlpha = 1;
    if (progress() < 1) requestAnimationFrame(draw);
  }

  function label(f) { const [y, m] = D.dates[f].split('-'); return `${MONTHS[+m - 1]} ${y}`; }

  function show(f, tween = true) {
    frame = f; range.value = f; dateEl.textContent = label(f);
    target(f, enc, tween ? 300 : 0);
  }

  function setEnc(e, tween = true) {
    enc = e;
    segBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.enc === e)));
    $('jtMapNote').innerHTML = ENC[e].note;
    if (tween) target(frame, enc, 1000);
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
    timer = setTimeout(tick, last ? 1400 : 330);
  }

  playBtn.addEventListener('click', () => { if (D) play(!playing); });
  range.addEventListener('input', () => { if (!D) return; play(false); show(+range.value, false); });
  segBtns.forEach(b => b.addEventListener('click', () => { if (D && b.dataset.enc !== enc) setEnc(b.dataset.enc); }));
  addEventListener('resize', () => { if (D) target(frame, enc, 0); });

  // load when the section approaches; play only while it is on screen
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load(); } }, { rootMargin: '600px 0px' }).observe(root);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!D || reduced) return;
    if (!visible && playing) play(false);
    else if (visible && !playing && frame === 0) play(true);
  }, { threshold: 0.35 }).observe(root);
})();

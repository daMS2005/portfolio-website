// film-flagship: Flagship work as three scenes. JEPA = galaxy islands forming from an edge-on disk;
// thesis = filaments from the feature bank forking into Brain and Model; TC_ACC = letterbox frame, edit
// timeline and a film strip of the real episodes. An iris lens on hover shows each diagram's lit layer.
const html = document.documentElement;
const sec = document.getElementById('research');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 4); // ≈ --fx-ignite
const el = (tag, cls, txt) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, txt ? { textContent: txt } : {});

// switch ?film-eyebrow=keep|credit|none (default keep), remembered for the session
{
  let v = new URLSearchParams(location.search).get('film-eyebrow');
  try { v ? sessionStorage.setItem('film-eyebrow', v) : (v = sessionStorage.getItem('film-eyebrow')); } catch {}
  html.dataset.filmEyebrow = ['keep', 'credit', 'none'].includes(v) ? v : 'keep';
}

// ---- ignition (from concepts/diagram-light.js): nodes light in data-flow order, links reach from both ends
const RUN = 600;
function reach(link, delay = 0) {
  link.style.setProperty('--d', `${delay}ms`);
  link.classList.remove('ff-run');
  void link.offsetWidth;
  link.classList.add('ff-run');
  clearTimeout(link.ffTimer);
  link.ffTimer = setTimeout(() => link.classList.remove('ff-run'), delay + RUN);
}
function igniteDg(dg) {
  let t = 0;
  for (const n of dg.querySelectorAll('.dg-node, .dg-link, .dg-tokens i')) {
    if (n.matches('.dg-link')) { reach(n, t); continue; }
    t += n.matches('i') ? 35 : 70;
    n.style.setProperty('--d', `${t}ms`);
  }
  dg.classList.replace('ff-armed', 'ff-on');
  return t;
}
// lens callouts: extra facts per element, each taken from the project's case-study page
const note = (els, texts) => els.forEach((n, i) => { if (texts[i]) n.dataset.ffNote = texts[i]; });
function once(target, fn) { // reduced motion: end state at once
  if (still) return target.classList.add('ff-on');
  target.classList.add('ff-armed');
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.25 });
  io.observe(target);
}
for (const link of sec.querySelectorAll('.flagship-visual .dg-link')) {
  link.prepend(...['ff-h', 'ff-h', 'ff-spark'].map((c) => el('b', c)));
}
for (const node of sec.querySelectorAll('.flagship-visual .dg-node')) {
  // on the first real move inside the node: content scrolled under a resting cursor moves it by 0 and stays dark
  node.addEventListener('pointerleave', () => { node.ffIn = false; });
  const fire = (e) => {
    if (node.ffIn || (e.pointerType === 'mouse' && !e.movementX && !e.movementY)) return;
    node.ffIn = true;
    for (const s of [node.previousElementSibling, node.nextElementSibling]) if (s?.matches('.dg-link')) reach(s);
  };
  node.addEventListener('pointermove', fire);
  node.addEventListener('pointerdown', fire); // touch
}

// ---- the eye: an iris lens that follows the pointer and shows a cloned, lit copy of the diagram (same labels)
// plus hidden text: the extra facts (data-ff-note) of the part nearest the pointer, written in the middle of the lens
// and visible only through it. Touch: tap to open or move it, tap inside it or anywhere outside the diagram to close.
function lens(visual, content, paint) {
  const wrap = el('div', 'ff-lens'), ring = el('i', 'ff-iris'), read = el('span', 'ffl-read');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.inert = true;
  ring.setAttribute('aria-hidden', 'true');
  visual.append(wrap, ring);
  let raf = 0, x = 0, y = 0, on = null;
  const aim = (t) => {
    if (t === on) return;
    on = t;
    read.textContent = t ? t.dataset.ffNote : '';
    visual.classList.toggle('ff-noted', !!t);
  };
  // the bubble always carries facts: the noted element nearest the pointer, within the lens radius
  const nearest = (px, py) => {
    let best = null, bd = 110;
    for (const n of visual.querySelectorAll('[data-ff-note]')) {
      if (n.closest('.ff-lens')) continue; // skip the lit copy inside the lens
      const r = n.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom));
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };
  const move = (e) => {
    const r = visual.getBoundingClientRect();
    // the lens (radius 84 + 8 ring) stays inside the frame, so its text is never cut at the edge
    const k = (v, max) => Math.min(Math.max(v, 92), Math.max(max - 92, 92));
    x = k(e.clientX - r.left, r.width); y = k(e.clientY - r.top, r.height);
    aim(e.target.closest('[data-ff-note]') || nearest(e.clientX, e.clientY));
    raf ||= requestAnimationFrame(() => { raf = 0; visual.style.setProperty('--lx', `${x}px`); visual.style.setProperty('--ly', `${y}px`); });
  };
  const open = (e) => {
    const c = content.cloneNode(true);
    for (const n of [c, ...c.querySelectorAll('.ff-armed')]) n.classList.replace('ff-armed', 'ff-on');
    Object.assign(c.style, { position: 'absolute', margin: 0, left: `${content.offsetLeft}px`, top: `${content.offsetTop}px`, width: `${content.offsetWidth}px` });
    wrap.replaceChildren(c, read);
    paint?.(c);
    move(e);
    visual.classList.add('ff-looking');
  };
  const close = () => { visual.classList.remove('ff-looking'); aim(null); paint?.(null); };
  const mouse = (e) => e.pointerType === 'mouse';
  // only a moving mouse opens the lens: content scrolling under a resting cursor must not pop it up, and scrolling closes it
  const moved = (e) => e.movementX || e.movementY;
  addEventListener('scroll', () => visual.classList.contains('ff-looking') && close(), { passive: true });
  visual.addEventListener('pointermove', (e) => {
    if (!mouse(e) || !moved(e)) return;
    visual.classList.contains('ff-looking') ? move(e) : open(e);
  });
  visual.addEventListener('pointerleave', (e) => mouse(e) && close());
  visual.addEventListener('pointerup', (e) => {
    if (mouse(e) || e.target.closest('a, button')) return;
    const r = visual.getBoundingClientRect();
    if (!visual.classList.contains('ff-looking')) open(e);
    else if (Math.hypot(e.clientX - r.left - x, e.clientY - r.top - y) < 60) close();
    else move(e);
  });
  document.addEventListener('pointerdown', (e) => { if (!mouse(e) && !visual.contains(e.target)) close(); });
}

// ---- 01 JEPA: twelve islands open out of an edge-on disk (≈3 dims) into the VICReg map (≈370 dims)
{
  const card = sec.querySelector('.flagship-jepa');
  const visual = card.querySelector('.flagship-visual');
  const dg = visual.querySelector('.dg');
  note([...dg.querySelectorAll('.dg-node'), dg.querySelector('.dg-bridge')], [ // jepa-transformer.html §01–05
    'IBKR daily bars · SEC EDGAR filings\nFRED/ALFRED macro by vintage · options\nA value enters once it was public',
    'Hides 50% of available features\n≥ 1 visible, ≥ 1 hidden per row\nMissing values masked, never imputed',
    'Same architecture, EMA weights\nUpdated after every Adam step, no gradients\nLoss: mean |ẑ − sg(z)| in latent space',
    '6 blocks · full multi-head, no GQA\nRoPE base 10⁴ · FlashAttention on sm80+\nNo tokenizer, no position table',
    'Middle blocks only · dropless top-k\nTriton: up to 3.6× per layer,\nup to 2.4× full model vs torch.compile',
    'μ, σ = softplus + ε\nν = 2 + softplus · NLL\nHeavy tails, finite variance\nLabels shifted to each horizon',
    'Fit on the training period only, then frozen\nOne embedding per asset and day\nThe two models never share gradients']);
  // island centres (x: calmer → riskier, y: winners → losers) and colours from javascript-files/jepa-map.js
  const OG = [[.42, .52], [.78, .80], [.62, .55], [.70, .20], [.36, .25], [.17, .52], [.90, .14], [.62, .90], [.45, .84], [.07, .86], [.93, .58], [.08, .18]];
  const VIC = [[.30, .50, '#6ccb5f'], [.50, .48, '#b9b39f'], [.88, .15, '#c9f04a'], [.66, .72, '#f28c38'], [.86, .90, '#ff4d94'], [.06, .22, '#9cc6ff'],
    [.10, .60, '#4c8df6'], [.08, .88, '#a08cff'], [.27, .18, '#45c4c0'], [.94, .58, '#e8566c'], [.30, .82, '#6fd3e8'], [.66, .30, '#e0c068']];
  // companies per cluster, Oct 2026 (1,000 that month), precomputed from assets/jepa-map.json; one dot per 5
  const N_OG = [181, 74, 59, 224, 31, 257, 103, 4, 9, 22, 11, 25], N_VIC = [75, 324, 117, 88, 17, 4, 41, 24, 64, 52, 55, 139];
  const END = 1.05, SILVER = [216, 212, 204], rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  visual.setAttribute('role', 'group'); // the toggle must stay reachable for assistive tech
  const band = el('div', 'ff-galaxy');
  const head = el('div', 'ff-gx-head');
  const seg = el('div', 'ff-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Encoder');
  const bOg = el('button', '', 'Original · ≈3 dims'), bVic = el('button', '', 'VICReg · ≈370 dims');
  for (const b of [bOg, bVic]) { b.type = 'button'; seg.append(b); }
  head.append(el('span', '', 'Embedding space · Oct 2026 · 12 clusters'), seg);
  const cv = el('canvas');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Twelve company clusters in October 2026, one dot per five companies, placed by volatility (calmer left, riskier right) and momentum (winners up, losers down). The original encoder squeezes them onto one flat axis; with VICReg they spread into separate islands.');
  band.append(head, cv, el('p', 'ff-gx-note', 'The first encoder collapsed to about 3 effective dimensions; a VICReg variance–covariance penalty keeps about 370 in use.'));
  dg.querySelector('.dg-bridge').after(band);

  let W = 0, H = 0, dpr = 1, states = null, cur = null, from = null, to = 'vic', t0 = 0, ms = 0, raf = 0, lit = null;
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    for (const c of [cv, lit]) if (c) { c.width = W * dpr; c.height = H * dpr; }
    const pad = 10, w = W - 2 * pad, h = H - 2 * pad, sp = (h * 0.14) / Math.sqrt(65);
    const build = (CL, N) => {
      const pts = [];
      CL.forEach(([cx, cy, col], c) => {
        for (let i = 0, k = Math.max(1, Math.round(N[c] / 5)); i < k; i++) {
          const r = sp * Math.sqrt(i + 0.5), th = i * 2.39996;
          pts.push([(pad + cx * w + r * Math.cos(th)) / W, (pad + cy * h + r * Math.sin(th)) / H, col ? rgb(col) : SILVER]);
        }
      });
      return pts.sort((a, b) => a[0] - b[0]); // pair dots left to right so matter flows rather than scatters
    };
    states = { og: { p: build(OG, N_OG), flat: 0.07 }, vic: { p: build(VIC, N_VIC), flat: 1 } };
  }
  // positions live in disk space; `flat` squashes the disk toward edge-on, tilted a few degrees
  function frame(t) {
    const A = from || states[to], B = states[to], n = Math.min(A.p.length, B.p.length), out = [];
    const flatK = A.flat + (B.flat - A.flat) * ease(t);
    for (let i = 0; i < n; i++) {
      const [x0, y0, c0] = A.p[i], [x1, y1, c1] = B.p[i];
      const r0 = Math.hypot(x0 - .5, y0 - .5), r1 = Math.hypot(x1 - .5, y1 - .5);
      const e = ease((t - r1 * 0.5) / 0.75); // the core forms first, the outer islands last
      let a0 = Math.atan2(y0 - .5, x0 - .5), a1 = Math.atan2(y1 - .5, x1 - .5);
      a1 = a0 + ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      const r = r0 + (r1 - r0) * e, a = a0 + (a1 - a0) * e;
      out.push([.5 + r * Math.cos(a), .5 + r * Math.sin(a), c0.map((v, j) => Math.round(v + (c1[j] - v) * e))]);
    }
    return { p: out, flat: flatK };
  }
  function paint(c, s, glow) {
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const tilt = -0.07 * (1 - s.flat), cos = Math.cos(tilt), sin = Math.sin(tilt);
    if (s.flat < 0.9) { // the disk plane, visible while it is edge-on
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, 'rgba(216,212,204,0)'); gr.addColorStop(0.5, `rgba(216,212,204,${0.35 * (1 - s.flat)})`); gr.addColorStop(1, 'rgba(216,212,204,0)');
      g.save(); g.translate(W / 2, H / 2); g.rotate(tilt); g.fillStyle = gr; g.fillRect(-W / 2, -0.5, W, 1); g.restore();
    }
    if (glow) g.globalCompositeOperation = 'lighter';
    for (const [x, y, col] of s.p) {
      const dx = (x - .5) * W, dy = (y - .5) * H * s.flat;
      const px = W / 2 + dx * cos - dy * sin, py = H / 2 + dx * sin + dy * cos;
      if (glow) { g.fillStyle = `rgba(${col},.22)`; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); }
      g.fillStyle = `rgb(${col})`;
      g.beginPath(); g.arc(px, py, glow ? 1.9 : 1.4, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function draw() {
    const t = Math.min(ms ? (performance.now() - t0) / ms : END, END);
    cur = frame(t);
    paint(cv, cur, false);
    if (lit) paint(lit, cur, true);
    raf = t < END ? requestAnimationFrame(draw) : 0;
  }
  function go(target, dur) {
    from = cur ? { p: cur.p.map(([x, y, c]) => [x, y, c]), flat: cur.flat } : null;
    to = target; t0 = performance.now(); ms = still ? 0 : dur;
    bOg.setAttribute('aria-pressed', String(target === 'og'));
    bVic.setAttribute('aria-pressed', String(target === 'vic'));
    cancelAnimationFrame(raf);
    draw();
  }
  bOg.onclick = () => to !== 'og' && go('og', 1000);
  bVic.onclick = () => to !== 'vic' && go('vic', 1300);
  new ResizeObserver(() => { layout(); from = null; ms = 0; cur = null; if (!raf) draw(); }).observe(cv);
  layout();
  go(still ? 'vic' : 'og', 0);
  once(dg, () => { igniteDg(dg); setTimeout(() => go('vic', 1300), 500); });
  lens(visual, dg, (c) => { lit = c?.querySelector('canvas') || null; if (lit) { lit.width = W * dpr; lit.height = H * dpr; paint(lit, cur, true); } });
}

// ---- 02 Thesis: one bundle of filaments leaves the feature bank, runs down the bridge, forks into Brain and Model
{
  const visual = sec.querySelector('.flagship-thesis .flagship-visual');
  const dg = visual.querySelector('.dg');
  const [, bank, brain, model] = dg.querySelectorAll('.dg-node');
  note([...dg.querySelectorAll('.dg-node, .dg-bridge, .dg-verdict')], [ // thesis.html §03–06
    'shapesphysical, one spoken description\n59 participants, Narratives fMRI\nWords timed to the 1.5 s TR grid',
    'Chosen on description A alone, before BOLD\nNested banks of 64 to 1,024 features\n6 SAE systems · 3 families · 1B–12B',
    'Description B: shapessocial\nsame animation, same 59 listeners',
    '200 Schaefer cortical parcels\nMotion and physiology regressed out\nHeld-out r = .068–.092',
    'Final hidden state, unlagged\nSame features, matched ridge model\nContiguous folds, purged test blocks',
    'ρ = −.056 over 12 conditions, p = .805\nPlanted agreement found in ≤ 10% of runs,\nagainst an 80% target']);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ff-fil');
  svg.setAttribute('aria-hidden', 'true');
  dg.append(svg);
  // orthogonal polyline with 6px rounded corners
  const path = (pts) => pts.reduce((d, [x, y], i) => {
    if (!i) return `M${x} ${y}`;
    if (i === pts.length - 1) return `${d} L${x} ${y}`;
    const [px, py] = pts[i - 1], [nx, ny] = pts[i + 1], r = 6;
    const ix = Math.sign(x - px) * r, iy = Math.sign(y - py) * r, ox = Math.sign(nx - x) * r, oy = Math.sign(ny - y) * r;
    return `${d} L${x - ix} ${y - iy} Q${x} ${y} ${x + ox} ${y + oy}`;
  }, '');
  function lay() {
    const o = dg.getBoundingClientRect();
    const R = (n) => { const r = n.getBoundingClientRect(); return { cx: (r.left + r.right) / 2 - o.left, l: r.left - o.left, t: r.top - o.top, b: r.bottom - o.top, m: (r.top + r.bottom) / 2 - o.top }; };
    const B = R(bank), Br = R(brain), M = R(model), x0 = 10, y1 = B.b + 9, yF = Br.t - 6.5;
    let out = '';
    const stacked = M.t > Br.b; // phones: Model sits under Brain, so both branches leave the rail sideways
    for (const k of [-3.6, -1.2, 1.2, 3.6]) {
      const f = Br.cx - 10, rail = [[B.cx + k, B.b + 2], [B.cx + k, y1 + k], [x0 + k, y1 + k]];
      if (stacked) {
        out += `<path class="ff-trunk" pathLength="1" d="${path([...rail, [x0 + k, Br.m - 12]])}"/>`
          + `<path class="ff-brain" pathLength="1" d="${path([[x0 + k, Br.m - 12], [x0 + k, Br.m + k], [Br.l - 1, Br.m + k]])}"/>`
          + `<path class="ff-model" pathLength="1" d="${path([[x0 + k, Br.m - 12], [x0 + k, M.m + k], [M.l - 1, M.m + k]])}"/>`;
        continue;
      }
      out += `<path class="ff-trunk" pathLength="1" d="${path([[B.cx + k, B.b + 2], [B.cx + k, y1 + k], [x0 + k, y1 + k], [x0 + k, yF + k], [f, yF + k]])}"/>`
        + `<path class="ff-brain" pathLength="1" d="${path([[f, yF + k], [Br.cx + k, yF + k], [Br.cx + k, Br.t - 2]])}"/>`
        + `<path class="ff-model" pathLength="1" d="${path([[f, yF + k], [M.cx + k, yF + k], [M.cx + k, M.t - 2]])}"/>`;
    }
    svg.innerHTML = out;
  }
  new ResizeObserver(lay).observe(dg);
  once(dg, () => {
    const t = igniteDg(dg);
    // trunk after the bank lights, then both branches, then the two targets
    dg.style.setProperty('--d-trunk', '220ms');
    dg.style.setProperty('--d-fork', '820ms');
    brain.style.setProperty('--d', '1220ms');
    model.style.setProperty('--d', `${Math.max(1290, t)}ms`);
  });
  lens(visual, dg);
}

// ---- 03 TC_ACC: a letterboxed frame of the real episodes, the pipeline as an edit timeline, a film strip to cut
{
  const visual = sec.querySelector('.flagship-tcacc .flagship-visual');
  const strip = visual.querySelector('.pipeline-strip');
  // posters, names and runtimes from tc-acc.html's episode archive
  const EP = [['tcacc-animation-only', 'Animation study', '6:53', 'Animation-only TC_ACC render'],
    ['tcacc-full-july', 'First full pass', '13:14', 'First full TC_ACC production pass'],
    ['tcacc-full-august', 'Refined pass', '9:56', 'Refined TC_ACC production pass'],
    ['tcacc-episode-2026-10', 'Latest episode', '6:28', 'Latest TC_ACC episode, October 2026']];
  const title = (i) => (i === 3 ? 'Latest episode · Oct 2026' : EP[i][1]);
  const src = (i) => `/images/${EP[i][0]}.webp`;
  let cur = 3;

  const cine = el('div', 'ff-cine');
  const shot = el('a', 'ff-shot');
  shot.href = '/tc-acc';
  shot.setAttribute('aria-label', 'Watch the TC_ACC episodes in the case study');
  const img = Object.assign(el('img'), { src: src(cur), alt: `Still from the ${EP[cur][3]}`, width: 854, height: 480, loading: 'lazy', decoding: 'async' });
  const name = el('span', 'ff-cr', title(cur)), run = el('span', 'ff-cr', EP[cur][2]);
  const top = el('span', 'ff-bar ff-bar-t'), bot = el('span', 'ff-bar ff-bar-b');
  top.append(name); bot.append(run);
  shot.append(img, el('span', 'ffl-wipe'), top, bot);
  // the latest episode plays as a muted 5× preview loop (9 s, 320 KB), fetched only once the frame is in view
  const vid = !still && !navigator.connection?.saveData && Object.assign(el('video', 'ff-vid'), { muted: true, loop: true, playsInline: true, preload: 'none' });
  let inView = false;
  const sync = () => {
    if (!vid) return;
    shot.classList.toggle('ff-vid-on', cur === 3);
    run.textContent = cur === 3 ? `${EP[3][2]} · 5× preview` : EP[cur][2];
    if (inView && cur === 3) vid.play().catch(() => {}); else vid.pause();
  };
  if (vid) {
    vid.setAttribute('aria-hidden', 'true');
    img.after(vid);
    new IntersectionObserver(([e]) => {
      inView = e.intersectionRatio >= 0.3;
      if (inView && !vid.src) Object.assign(vid, { poster: '/concepts/assets/flagship/tcacc-loop-poster.webp', src: '/concepts/assets/flagship/tcacc-loop.mp4' });
      sync();
    }, { threshold: [0, 0.3] }).observe(shot);
  }
  note([shot], ['Turns a case link into a 10-minute episode\nAbout 5 hours, no human steps\nReference run: 9:55 · 1920×1080 · 128 shots']); // tc-acc.html

  strip.classList.add('ff-tl');
  strip.setAttribute('aria-label', 'TC_ACC production pipeline: research 5 stages, story 4, assets 7, showrunner review gate, animation 2, showrunner review gate, publishing 8');
  for (const li of strip.children) {
    li.style.setProperty('--n', parseInt(li.textContent.match(/\d+/)?.[0] || 1, 10));
    if (li.matches('.pipeline-gate')) li.querySelector('span').textContent = 'Showrunner review gate';
  }
  note([...strip.children], [ // tc-acc.html, public system overview
    'Research · 5 stages\nSource intake, research, evidence assembly', 'Story · 4 stages\nStory development, script, narration, voice',
    'Assets · 7 stages\nVisual planning, acquisition, review', 'Showrunner review gate\none of the 2 gate stages (27–28), before animation',
    'Animation · 2 stages\nEditorial assembly and motion', 'Showrunner review gate\none of the 2 gate stages (27–28), before publishing',
    'Publishing · 8 stages\nBranding, rendering, metadata, delivery']);
  const track = el('div', 'ff-track'), head = el('i', 'ff-head');
  strip.before(track);
  track.append(strip, head);
  const legend = el('p', 'ff-legend');
  legend.append(el('i'), el('span', '', 'Showrunner review gate · 26 stages + 2 gates = 28'));

  const film = el('div', 'ffl-strip');
  film.setAttribute('role', 'group');
  film.setAttribute('aria-label', 'Episodes');
  const btns = EP.map(([, label, time, alt], i) => {
    const b = el('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i === cur));
    b.setAttribute('aria-label', `Show ${alt}, ${time}`);
    b.append(Object.assign(el('img'), { src: src(i), alt: '', width: 854, height: 480, loading: 'lazy', decoding: 'async' }), el('span', '', label), el('small', '', time));
    b.onclick = () => cut(i);
    film.append(b);
    return b;
  });
  cine.append(shot, track, legend, film);
  visual.append(cine);

  // the cut: a black panel with an ember edge wipes down over the shot, the still swaps under it
  let swapT = 0;
  function cut(i) {
    if (i === cur) return;
    cur = i;
    btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const swap = () => { img.src = src(i); img.alt = `Still from the ${EP[i][3]}`; name.textContent = title(i); run.textContent = EP[i][2]; sync(); };
    if (still) return swap();
    shot.classList.remove('ff-cutting');
    void shot.offsetWidth;
    shot.classList.add('ff-cutting');
    clearTimeout(swapT);
    swapT = setTimeout(swap, 300);
  }

  once(cine, () => {
    cine.classList.replace('ff-armed', 'ff-on');
    // stages light left to right after the bars close; the playhead holds at each gate
    let t = 450;
    const keys = [], left = strip.getBoundingClientRect().left;
    for (const li of strip.querySelectorAll('li')) {
      t += 90;
      li.style.setProperty('--d', `${t}ms`);
      const r = li.getBoundingClientRect(), x = r.left - left + r.width / 2;
      keys.push([t, x]);
      if (li.matches('.pipeline-gate')) { t += 220; keys.push([t, x]); }
    }
    const T = t + 200;
    head.animate([{ transform: `translateX(${keys[0][1]}px)`, opacity: 0, offset: 0 },
      ...keys.map(([k, x]) => ({ transform: `translateX(${x}px)`, opacity: 1, offset: k / T })),
      { transform: `translateX(${keys.at(-1)[1]}px)`, opacity: 0, offset: 1 }], { duration: T, easing: 'linear', fill: 'both' });
  });
  lens(visual, cine, (c) => c?.querySelector('video')?.remove()); // the lens shows the live clip through, never a second copy
}

// Dark live redraws of the four thesis figures. Values: concepts/assets/thesis-brain.json + thesis-bold.json
// (real arrays), detectability panel C read from images/thesis-detectability.webp (ideas/thesis.md §5, ±0.02).
import { drawBrain, fit, brainView, gold, diverging, blend } from './film-thesis-brain.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const once = (el, fn, threshold = 0.25) => new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { threshold }).observe(el);
// End state first, so it shows even if the observer never fires; blanked only while fully offscreen, played once in view.
export const reveal = (el, blank, play, threshold) => {
  let armed = false;
  new IntersectionObserver(([e], io) => {
    if (!armed && !still && !e.intersectionRatio) { armed = true; return blank(); }
    if (armed && e.intersectionRatio < threshold) return;
    io.disconnect(); play(armed);
  }, { threshold }).observe(el);
};
const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const T = (x, y, s, cls = '', a = 'start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${a}">${s}</text>`;
const L = (x1, y1, x2, y2, cls = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
const orig = (src) => `<a class="ft-orig" href="${src}" target="_blank" rel="noopener">View original figure</a>`;
// re-render an SVG panel at the container's own pixel width so text stays 12px on phones
const panel = (el, h, body) => {
  let last = 0;
  const draw = () => { const w = Math.round(el.clientWidth); if (w && w !== last) { last = w; el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body(w)}</svg>`; } };
  new ResizeObserver(draw).observe(el);
  el.addEventListener('ft-redraw', () => { last = 0; draw(); });
  draw();
};
const axisY = (x, ys, ticks, fmt) => ticks.map((t) => L(x - 4, ys(t), x, ys(t), 'ax') + T(x - 7, ys(t) + 4, fmt(t), 'tk', 'end')).join('') + L(x, ys(ticks[0]), x, ys(ticks.at(-1)), 'ax');
const axisX = (y, xs, ticks, fmt) => ticks.map((t) => L(xs(t), y, xs(t), y + 4, 'ax') + T(xs(t), y + 17, fmt(t), 'tk', 'middle')).join('');

/* ---------- Fig. brain data: A motion, B BOLD matrix, C ISC brain + "Play the story" ---------- */
export async function storyFigure(fig, B, brain) {
  const bold = await fetch('/concepts/assets/thesis-bold.json').then((r) => r.json());
  const [NP, NB] = bold.shape, M = Int8Array.from(atob(bold.data_b64), (c) => c.charCodeAt(0));
  const SEC = bold.n_tr * bold.tr_s, BIN = bold.bin_tr * bold.tr_s, cens = new Set(bold.censored_tr);
  fig.querySelector('a').outerHTML = `
    <div class="ft-story">
      <div class="ft-story-brain">
        <canvas role="img" aria-label="The 200 cortical parcels in a lateral view, coloured by leave-one-participant-out inter-subject correlation from 0 to 0.79, strongest around superior temporal cortex. Play the story to color them by the cleaned BOLD run."></canvas>
        <p class="ft-credit ft-brain-say"></p>
      </div>
      <div class="ft-story-panels">
        <div class="ft-pa" role="img" aria-label="Framewise displacement over 457 seconds of one run, peaking at 0.74 mm, with a 0.5 mm censoring threshold. ${cens.size} frames are censored, most between 117 and 285 seconds."></div>
        <div class="ft-pb" role="img" aria-label="Cleaned, standardized BOLD for 200 cortical parcels over the story, z from -2.5 to 2.5. Drag to scrub."></div>
        <button class="ft-play" type="button"><i aria-hidden="true"></i><span>Play the story</span></button>
      </div>
    </div>${orig('images/thesis-brain-data.webp')}`;
  const cv = fig.querySelector('canvas'), say = fig.querySelector('.ft-brain-say'), btn = fig.querySelector('.ft-play');
  const ML = 46, MR = 52;
  // matrix image, 61 bins x 200 parcels, diverging colours
  const img = Object.assign(document.createElement('canvas'), { width: NB, height: NP }), ix = img.getContext('2d'), id = ix.createImageData(NB, NP);
  for (let p = 0; p < NP; p++) for (let b = 0; b < NB; b++) {
    const [r, g, bl, a] = diverging(M[p * NB + b] / 40), o = (p * NB + b) * 4;
    id.data.set([r * a, g * a, bl * a, 255], o);
  }
  ix.putImageData(id, 0, 0);
  const url = img.toDataURL();
  const grad = `<linearGradient id="ft-z" x1="0" y1="1" x2="0" y2="0">${[-2.5, -1.25, -0.2, 0, 0.2, 1.25, 2.5].map((z) => { const [r, g, b, a] = diverging(z); return `<stop offset="${(z + 2.5) / 5}" stop-color="rgb(${r * a | 0},${g * a | 0},${b * a | 0})"/>`; }).join('')}</linearGradient>`;
  const beam = (h) => `<g class="ft-beam" style="visibility:hidden"><rect x="-36" y="${h[0]}" width="36" height="${h[1] - h[0]}" fill="url(#ft-trail)"/><rect x="-1" y="${h[0]}" width="2" height="${h[1] - h[0]}" class="ft-beam-core"/></g>`;
  const trail = '<linearGradient id="ft-trail"><stop offset="0" stop-color="#ff5c2a" stop-opacity="0"/><stop offset="1" stop-color="#ffb347" stop-opacity=".45"/></linearGradient>';
  panel(fig.querySelector('.ft-pa'), 206, (w) => {
    const xs = lin(0, SEC, ML, w - MR), ys = lin(0, 0.75, 152, 56);
    const line = bold.fd_mm.map((v, i) => `${xs(i * bold.tr_s).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
    return `<defs>${trail}</defs>${T(0, 14, 'A  Motion and censoring, one run', 'tt')}${T(ML, 31, 'framewise displacement (mm)', 'tk')}
      ${axisY(ML, ys, [0, 0.2, 0.4, 0.6], (t) => t.toFixed(1))}${L(ML, 152, w - MR, 152, 'ax')}
      ${L(ML, ys(0.5), w - MR, ys(0.5), 'thr')}${T(w - MR, 47, '- - 0.5 mm censoring threshold', 'tk thr-t', 'end')}
      <polyline points="${line}" class="fd" pathLength="1"/>
      ${bold.censored_tr.map((t) => `<rect x="${xs(t * bold.tr_s).toFixed(1)}" y="156" width="${Math.max(1.5, xs(bold.tr_s) - ML - 0.5).toFixed(1)}" height="7" class="cens"/>`).join('')}
      ${axisX(166, xs, [0, 100, 200, 300, 400], String)}${T(w - MR, 202, 'story time (s)', 'tk', 'end')}${beam([56, 163])}`;
  });
  panel(fig.querySelector('.ft-pb'), 276, (w) => {
    const xs = lin(0, SEC, ML, w - MR), ys = lin(0, 200, 40, 240), bx = w - MR + 12, zs = lin(-2.5, 2.5, 240, 40);
    return `<defs>${grad}${trail}</defs>${T(0, 14, 'B  Cleaned, standardized BOLD target (one run)', 'tt')}${T(ML, 31, 'cortical parcel', 'tk')}
      <image href="${url}" x="${ML}" y="40" width="${w - MR - ML}" height="200" preserveAspectRatio="none" class="mx"/>
      ${axisY(ML, ys, [0, 50, 100, 150, 200], String)}${axisX(240, xs, [0, 100, 200, 300, 400], String)}${T(w - MR, 274, 'story time (s)', 'tk', 'end')}
      <rect x="${bx}" y="40" width="8" height="200" fill="url(#ft-z)"/>${[-2, -1, 0, 1, 2].map((z) => T(bx + 13, zs(z) + 4, z < 0 ? `−${-z}` : z, 'tk')).join('')}${T(bx + 4, 32, 'z', 'tk', 'middle')}
      ${beam([40, 240])}<rect x="${ML}" y="40" width="${w - MR - ML}" height="200" class="ft-scrub"/>`;
  });

  // brain: ISC at rest (panel C), BOLD while playing
  const isc = brain.isc.map((v) => v / 0.79);
  let t = null, dim = 1, back = 1, lit = 1, raf = 0, last = 0, playing = false;
  const zAt = (i, s) => { const f = Math.min(NB - 1, Math.max(0, s / BIN - 0.5)), b = f | 0, k = f - b; return (M[i * NB + b] * (1 - k) + M[i * NB + Math.min(NB - 1, b + 1)] * k) / 40; };
  const render = () => {
    const { ctx, w, h } = fit(cv);
    const v = brainView(0, 0, w, h - 4);
    drawBrain(ctx, B, v, (i) => {
      const rest = blend([216, 212, 204, 0.3], gold(isc[i]), lit);
      return t === null && back >= 1 ? rest : blend(diverging(t === null ? 0 : zAt(i, t)), rest, back);
    }, t === null ? 1 : dim);
    say.textContent = t === null || back > 0.5 ? 'C  Shared stimulus-locked response: leave-one-participant-out ISC (ShapesSocial), 0 to 0.79'
      : `Cleaned BOLD, one run · ${Math.round(t)} s${cens.has(Math.floor(t / bold.tr_s)) ? ' · censored frame' : ''}`;
    fig.querySelectorAll('.ft-beam').forEach((g) => {
      const pw = g.ownerSVGElement.viewBox.baseVal.width;
      g.style.visibility = t === null ? 'hidden' : '';
      if (t === null) return;
      const x = lin(0, SEC, ML, pw - MR)(t), tw = Math.min(36, x - ML); // the trail never crosses the y axis
      g.setAttribute('transform', `translate(${x},0)`);
      g.firstElementChild.setAttribute('x', -tw); g.firstElementChild.setAttribute('width', tw);
    });
  };
  const loop = (now) => {
    const dt = Math.min(64, now - (last || now)); last = now;
    if (playing) { t = Math.min(SEC, (t ?? 0) + (dt / 14000) * SEC); if (t >= SEC) stop(true); }
    const target = t !== null && cens.has(Math.floor(t / bold.tr_s)) ? 0.22 : 1;
    dim += (target - dim) * Math.min(1, dt / 140); // eased, never a hard flash
    if (t === null && back < 1) back = Math.min(1, back + dt / 900);
    if (lit < 1) lit = Math.min(1, lit + dt / 900);
    render();
    raf = playing || back < 1 || lit < 1 || Math.abs(target - dim) > 0.01 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const stop = (end) => { playing = false; btn.querySelector('span').textContent = 'Play the story'; btn.classList.remove('is-on'); if (end) { t = null; back = 0; } kick(); };
  btn.addEventListener('click', () => {
    if (playing) return stop(false);
    playing = true; back = 0; if (t === null || t >= SEC) t = 0;
    btn.querySelector('span').textContent = 'Pause'; btn.classList.add('is-on'); kick();
  });
  const scrub = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    t = Math.max(0, Math.min(SEC, ((e.clientX - r.left) / r.width) * SEC)); back = 0; kick();
  };
  fig.querySelector('.ft-pb').addEventListener('pointerdown', (e) => {
    const hit = e.target.closest('.ft-scrub');
    if (!hit) return;
    if (playing) stop(false);
    hit.setPointerCapture(e.pointerId);
    scrub({ currentTarget: hit, clientX: e.clientX });
    hit.onpointermove = (m) => scrub({ currentTarget: hit, clientX: m.clientX });
    hit.onpointerup = () => { hit.onpointermove = null; };
  });
  new ResizeObserver(() => render()).observe(cv);
  render();
  reveal(fig, () => { lit = 0; fig.classList.add('is-armed'); render(); }, () => { fig.classList.add('is-lit'); kick(); }, 0.25);
}

/* ---------- Fig. brain encoding: transfer-r brain, parcels fall into the exact histogram ---------- */
export function fallFigure(fig, B, brain) {
  const r = brain.transfer_r, lo = Math.min(...r), hi = Math.max(...r), bw = (hi - lo) / 36, mean = r.reduce((a, b) => a + b) / r.length;
  const bin = r.map((v) => Math.min(35, Math.floor((v - lo) / bw)));
  const stack = r.map((v, i) => r.filter((u, j) => bin[j] === bin[i] && (u < v || (u === v && j < i))).length);
  fig.querySelector('a').outerHTML = `<canvas class="ft-fall" role="img" aria-label="Held-out transfer r for each of the 200 parcels, highest bilaterally in superior temporal cortex, and its distribution: mean ${mean.toFixed(3)}, range ${lo.toFixed(3)} to ${hi.toFixed(3)}, ${r.filter((v) => v > 0.2).length} parcels above 0.2. The shaded range marks condition means of .068 to .092."></canvas>
    <p class="ft-credit ft-fall-say" aria-live="polite">Point at a parcel to see its r.</p>${orig('images/thesis-brain-encoding.webp')}`;
  const cv = fig.querySelector('canvas'), say = fig.querySelector('.ft-fall-say');
  let prog = 1, hover = -1, geo;
  const layout = (w) => {
    const wide = w >= 600, h = wide ? 320 : 520;
    const br = wide ? [0, 30, w * 0.46 - 50, 270] : [0, 30, w - 70, 200];
    const hp = wide ? [w * 0.5 + 44, 50, w - 8, 284] : [44, 290, w - 8, 484]; // x0, y0, x1, y1 of the histogram plot
    return { h, wide, br, hp, xs: lin(0, 0.55, hp[0], hp[2]), ys: lin(0, 48, hp[3], hp[1]) };
  };
  const draw = () => {
    cv.style.height = `${layout(cv.clientWidth).h}px`;
    const { ctx, w } = fit(cv), G = (geo = layout(w)), { wide, br, hp, xs, ys } = G;
    const pitch = ys(0) - ys(1), rad = Math.min(pitch, xs(lo + bw) - xs(lo)) * 0.42;
    ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.fillStyle = '#f5f3ef';
    ctx.fillText('A  Held-out transfer r by parcel', 0, 14);
    ctx.fillText('B  Distribution over 200 parcels', hp[0] - 44, wide ? 14 : hp[1] - 30);
    // colour bar, the figure's diverging -0.53..0.53 scale (every parcel is positive)
    const bx = br[0] + br[2] + 16, by = br[1] + 10, bh = br[3] - 30, bs = lin(-0.53, 0.53, by + bh, by);
    for (let y = 0; y < bh; y++) { const v = lin(by + bh, by, -0.53, 0.53)(by + y); const q = v < 0 ? [143, 202, 197, -v / 0.53 * 0.8] : gold(v / 0.53); ctx.fillStyle = `rgba(${q[0]},${q[1]},${q[2]},${v < 0 ? q[3] : q[3] * Math.min(1, v / 0.1)})`; ctx.fillRect(bx, by + y, 8, 1); }
    ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillStyle = '#aaa7a2';
    for (const v of [-0.53, -0.27, 0, 0.27, 0.53]) ctx.fillText(v < 0 ? `−${(-v).toFixed(2)}` : v ? v.toFixed(2) : '0', bx + 12, bs(v) + 4);
    // ghost brain: each parcel dims as it leaves
    const P = drawBrain(ctx, B, brainView(br[0], br[1], br[2], br[3]), (i) => {
      const q = gold(r[i] / 0.535), on = hover >= 0 && (i === hover || (r[hover] > 0.2 && r[i] > 0.2));
      return on ? [255, 244, 220, 1] : [q[0], q[1], q[2], q[3] * (1 - 0.5 * Math.min(1, prog * 1.4))];
    });
    // axes
    ctx.strokeStyle = 'rgba(216,212,204,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(hp[0], hp[1]); ctx.lineTo(hp[0], hp[3]); ctx.lineTo(hp[2], hp[3]); ctx.stroke();
    ctx.textAlign = 'center';
    for (const v of [0, 0.2, 0.4]) ctx.fillText(v.toFixed(1), xs(v), hp[3] + 17);
    ctx.fillText('parcel-mean r', (hp[0] + hp[2]) / 2, hp[3] + 34);
    ctx.textAlign = 'right';
    for (const v of [0, 20, 40]) ctx.fillText(String(v), hp[0] - 7, ys(v) + 4);
    ctx.textAlign = 'left'; ctx.fillText('parcels', hp[0] + 6, hp[1] - 8);
    // shaded condition range + mean, last
    const end = Math.max(0, (prog - 0.85) / 0.15);
    if (end) {
      ctx.globalAlpha = end;
      ctx.fillStyle = 'rgba(255,179,71,.14)'; ctx.fillRect(xs(0.068), hp[1], xs(0.092) - xs(0.068), hp[3] - hp[1]);
      ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(xs(mean), hp[1]); ctx.lineTo(xs(mean), hp[3]); ctx.stroke();
      const lx = xs(0.13);
      ctx.strokeStyle = 'rgba(216,212,204,.35)'; ctx.beginPath(); ctx.moveTo(xs(mean), hp[1] + 8); ctx.lineTo(lx - 6, hp[1] + 8); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.fillText(`mean ${mean.toFixed(3)}`, lx, hp[1] + 12);
      ctx.fillStyle = '#aaa7a2'; ctx.fillText('shaded: range of condition', lx, hp[1] + 30); ctx.fillText('means (.068–.092)', lx, hp[1] + 46);
      ctx.globalAlpha = 1;
    }
    // dots: brain position -> histogram slot, staggered by bin, falling (expo-in)
    ctx.globalCompositeOperation = 'lighter';
    r.forEach((v, i) => {
      const d = Math.min(1, Math.max(0, (prog * 1.6 - bin[i] / 60 - stack[i] / 140) / 0.75)), e = d ** 3;
      const tx = xs(lo + (bin[i] + 0.5) * bw), ty = ys(stack[i] + 0.5);
      const x = P[i][0] + (tx - P[i][0]) * (1 - (1 - d) ** 2), y = P[i][1] + (ty - P[i][1]) * e;
      if (d <= 0) return;
      const on = hover >= 0 && (i === hover || (r[hover] > 0.2 && v > 0.2)), q = on ? [255, 244, 220, 1] : gold(v / 0.535);
      ctx.beginPath(); ctx.arc(x, y, on ? rad * 1.4 : rad, 0, 7);
      ctx.fillStyle = `rgba(${q[0] | 0},${q[1] | 0},${q[2] | 0},${Math.max(0.55, q[3])})`; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  };
  const pick = (e) => {
    if (prog < 1) return;
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, { xs, ys } = geo;
    let best = -1, bd = 14 ** 2;
    r.forEach((v, i) => { const d = (xs(lo + (bin[i] + 0.5) * bw) - x) ** 2 + (ys(stack[i] + 0.5) - y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best === hover) return;
    hover = best;
    say.textContent = best < 0 ? 'Point at a parcel to see its r.' : r[best] > 0.2
      ? `r = ${r[best].toFixed(3)} · the ${r.filter((v) => v > 0.2).length} parcels above r = 0.2, lit together in the brain`
      : `r = ${r[best].toFixed(3)} · lit in the brain`;
    draw();
  };
  cv.addEventListener('pointermove', pick);
  cv.addEventListener('pointerdown', pick);
  cv.addEventListener('pointerleave', () => { hover = -1; say.textContent = 'Point at a parcel to see its r.'; draw(); });
  new ResizeObserver(() => draw()).observe(cv);
  reveal(cv, () => { prog = 0; draw(); }, (play) => {
    if (!play) return;
    const t0 = performance.now();
    const step = (now) => { prog = Math.min(1, (now - t0) / 1600); draw(); if (prog < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 0.35);
}

/* ---------- Fig. detectability: three dark small multiples ---------- */
export const BANK = { K: [24, 32, 48, 64, 96, 128, 192, 256], within: [0.68, 0.55, 0.41, 0.19, 0.10, 0.04, 0.00, 0.04], transfer: [0.56, 0.45, 0.39, 0.18, 0.12, 0.12, 0.06, 0.02] };
export function detectFigure(link) {
  const fig = document.createElement('figure');
  fig.className = 'ft-detect';
  fig.innerHTML = `<div class="ft-detect-grid">
      <div role="img" aria-label="A, detection fraction against planted rho from 0 to 0.8. Every line stays between about 0.02 and 0.10, far under the 0.8 target."></div>
      <div role="img" aria-label="B, recovered rho against planted rho for Gemma 2 2B and Llama 3.1 8B, near zero at every planted strength."></div>
      <div role="img" aria-label="C, median recovered rho against bank size K. Transfer: ${BANK.K.map((k, i) => `K ${k}, ${BANK.transfer[i]}`).join('; ')}. Within description: ${BANK.K.map((k, i) => `K ${k}, ${BANK.within[i]}`).join('; ')}. Target 0.8; the paper uses K = 256."></div>
    </div>
    <figcaption><span class="ft-key"><i class="k-g"></i>Gemma 2 2B</span><span class="ft-key"><i class="k-l"></i>Llama 3.1 8B</span><span class="ft-key"><i class="k-t"></i>Transfer</span><span class="ft-key"><i class="k-w"></i>Within description</span>
      <span class="ft-credit">In A and B, bands span every plotted line (1× and 2× residual SD). C values are read from the figure.</span> ${orig('images/thesis-detectability.webp')}</figcaption>`;
  link.replaceWith(fig);
  const [a, b, c] = fig.querySelectorAll('.ft-detect-grid > div');
  const H = 250, top = 44, bot = 206;
  panel(a, H, (w) => {
    const xs = lin(-0.03, 0.83, 44, w - 10), ys = lin(0, 1, bot, top);
    return `${T(0, 14, 'A  Detection', 'tt')}${T(44, 34, 'Detection fraction', 'tk')}${axisY(44, ys, [0, 0.5, 1], (t) => t.toFixed(1))}${L(44, bot, w - 10, bot, 'ax')}
      ${L(xs(0), ys(0.8), xs(0.8), ys(0.8), 'tgt')}${T(xs(0.8), ys(0.8) - 6, '80% target', 'tk', 'end')}
      <polygon points="${xs(0)},${ys(0.02)} ${xs(0.8)},${ys(0.02)} ${xs(0.8)},${ys(0.1)} ${xs(0)},${ys(0.1)}" class="band"/>
      ${T(xs(0.4), ys(0.1) - 8, '≤ 10% at every planted strength', 'tk em', 'middle')}
      ${axisX(bot, xs, [0, 0.4, 0.8], (t) => t.toFixed(1))}${T(w - 10, H - 4, 'Planted ρ', 'tk', 'end')}`;
  });
  panel(b, H, (w) => {
    const xs = lin(-0.03, 0.83, 44, w - 10);
    const sub = (y0, name, cls, top2) => {
      const ys = lin(-0.1, 0.1, y0 + 62, y0);
      return `${T(48, y0 - 6, name, `tk ${cls}`)}${axisY(44, ys, [-0.1, 0, 0.1], (t) => (t < 0 ? '−0.1' : t.toFixed(1)))}
        <rect x="${xs(0)}" y="${ys(0.09)}" width="${xs(0.8) - xs(0)}" height="${ys(-0.09) - ys(0.09)}" class="spread ${cls}"/>
        ${L(xs(0), ys(0), xs(0.8), ys(0), 'zero')}<rect x="${xs(0)}" y="${ys(top2)}" width="${xs(0.8) - xs(0)}" height="${ys(0) - ys(top2)}" class="band ${cls}"/>`;
    };
    return `${T(0, 14, 'B  Correspondence', 'tt')}${T(44, 34, 'Recovered ρ', 'tk')}${sub(56, 'Gemma 2 2B', 'g', 0.04)}${sub(140, 'Llama 3.1 8B', 'l', 0.02)}
      ${axisX(bot, xs, [0, 0.4, 0.8], (t) => t.toFixed(1))}${T(w - 10, H - 4, 'Planted ρ', 'tk', 'end')}`;
  });
  let cur = -1;
  panel(c, H, (w) => {
    const xs = (k) => lin(Math.log(22), Math.log(270), 44, w - 10)(Math.log(k)), ys = lin(0, 1, bot, top);
    const path = (v, cls) => `<polyline points="${BANK.K.map((k, i) => `${xs(k)},${ys(v[i])}`).join(' ')}" class="ln ${cls}"/>` +
      BANK.K.map((k, i) => `<circle cx="${xs(k)}" cy="${ys(v[i])}" r="3.5" class="pt ${cls}${i === cur ? ' on' : ''}"/>`).join('');
    return `${T(0, 14, 'C  Bank size', 'tt')}${T(44, 34, 'Median recovered ρ', 'tk')}${axisY(44, ys, [0, 0.5, 1], (t) => t.toFixed(1))}${L(44, bot, w - 10, bot, 'ax')}
      ${L(44, ys(0.8), w - 10, ys(0.8), 'tgt')}${L(xs(256), top, xs(256), bot, 'k256')}${cur < 0 ? '' : L(xs(BANK.K[cur]), top, xs(BANK.K[cur]), bot, 'ft-kline')}
      ${path(BANK.within, 'w')}${path(BANK.transfer, 't')}
      ${BANK.K.map((k, i) => `<rect x="${xs(k) - 9}" y="${top}" width="18" height="${bot - top}" class="khit" data-i="${i}"/>`).join('')}
      ${axisX(bot, xs, [24, 64, 256], String)}${T(w - 10, H - 4, 'Bank size K', 'tk', 'end')}`;
  });
  // C and the hands below share one K: click a K column, or move the hands' slider
  const show = (i) => {
    cur = i;
    c.innerHTML = ''; c.dispatchEvent(new Event('ft-redraw'));
  };
  c.addEventListener('click', (e) => { const h = e.target.closest('.khit'); if (h) document.dispatchEvent(new CustomEvent('ft-k', { detail: +h.dataset.i })); });
  document.addEventListener('ft-k', (e) => show(e.detail));
  once(fig, () => fig.classList.add('is-lit'));
  return fig;
}

/* ---------- Fig. method: the five-step design as one dark diagram (text verbatim from thesis-method.webp) ---------- */
export function methodFigure(link) {
  const fig = document.createElement('figure');
  fig.className = 'ft-method';
  const prof = (who) => `<div class="ft-node"><b>${who} profile</b><p><strong>Remove feature k</strong><br>measure held-out prediction</p><p class="ft-chips"><span>source CV</span><span>held-out transfer</span></p></div>`;
  fig.innerHTML = `<ol>
      <li class="ft-node"><i>1</i><b>Pair two descriptions of one animation</b><p class="ft-chips"><span><strong>Source</strong> selects bank</span><span><strong>Held-out</strong> transfer only</span></p><small>Roles reverse for the opposite direction</small></li>
      <li class="ft-node"><i>2</i><b>Select the source-only SAE basis</b><p>Rank SAE features only on the source description</p><small>Project both descriptions to TRs with the same feature IDs</small></li>
      <li class="ft-lanes"><i>3</i>
        <div class="ft-lane ft-bold"><div class="ft-node"><b>Participant BOLD outcome</b><p>one ridge map per participant<br>0–4 TR lagged prediction</p><small>same selected feature IDs</small></div>${prof('Participant BOLD')}</div>
        <div class="ft-lane ft-lm"><div class="ft-node"><b>LM hidden-state outcome</b><p>final hidden-state target<br>causal, same-TR ridge</p><small>same selected feature IDs</small></div>${prof('LM hidden-state')}</div></li>
      <li class="ft-node"><i>4</i><b>Compare BOLD and LM profiles</b><p>Conditional and grouped correspondence</p><small>Source-CV and held-out-transfer results stay separate</small></li>
      <li class="ft-node"><i>5</i><b>Test against structured nulls</b><p class="ft-split"><span><strong>Temporal structure</strong>199 fully re-tuned shifts</span><span><strong>Feature identity</strong>10,000 matched draws</span></p></li>
    </ol><figcaption>${orig('images/thesis-method.webp')}</figcaption>`;
  link.replaceWith(fig);
  if (still) fig.classList.add('is-lit'); else once(fig, () => fig.classList.add('is-lit'), 0.15);
}

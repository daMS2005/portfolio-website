// film-jepa: jepa-transformer.html as one reel. The hero holds the collapsed encoder (a mono edge-on disk of
// the real Mar 2020 companies), a frame per section walks it from black hole to galaxy, and section 07 plays it
// (jepa-map.js, gated on this concept). Data: concepts/assets/jepa/hero.json, sliced from assets/jepa-map.json.
import { argus, cassa } from './film-jepa-svg.js';

const main = document.querySelector('main.jt');
if (main) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const once = (els, fn, threshold = 0.15) => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), { threshold });
    els.forEach(el => io.observe(el));
  };

  // Phone twins of both architecture diagrams; the pane headers in sentence case
  const [argusSvg, cassaSvg] = main.querySelectorAll('.jt-diagram svg.d');
  argusSvg.insertAdjacentHTML('afterend', argus);
  cassaSvg.insertAdjacentHTML('afterend', cassa);
  const SENT = { 'ATTENTION SUB-LAYER · EVERY BLOCK': 'Attention sub-layer · every block', 'MIDDLE BLOCKS · MIXTURE OF EXPERTS': 'Middle blocks · mixture of experts',
    'FEED-FORWARD SUB-LAYER · AFTER RMSNorm (ln2)': 'Feed-forward sub-layer · after RMSNorm (ln2)' };
  cassaSvg.querySelectorAll('text').forEach(el => { if (SENT[el.textContent]) el.textContent = SENT[el.textContent]; });

  // Hero: the collapsed encoder as an edge-on disk around a black core
  const card = main.querySelector('.detail-status-card');
  card.insertAdjacentHTML('afterbegin', `<figure class="fj-hero" aria-hidden="true"><div class="fj-tilt"><i></i></div><b class="fj-hole"></b><div class="fj-tilt fj-front"><i></i></div></figure>
    <p class="fj-cap">Original encoder: 1,000 companies in ≈3 dimensions. <a href="#jtMap">What the encoder learned, month by month →</a></p>`);
  const hero = card.querySelector('.fj-hero');
  new IntersectionObserver(([e]) => hero.classList.toggle('is-off', !e.isIntersecting)).observe(hero);

  // A film frame per section: the same companies, from black hole (01) to galaxy (07)
  const marks = [...main.querySelectorAll('.detail-section-header')].map(h => {
    const m = document.createElement('div'), c = document.createElement('canvas');
    m.className = 'fj-mark'; c.width = c.height = 128; c.setAttribute('aria-hidden', 'true');
    m.append(c, h.querySelector('span')); h.prepend(m);
    return c;
  });
  once(marks.map(c => c.parentNode), m => m.classList.add('is-lit'), 0.6);

  // Benchmark streaks draw in once
  once([main.querySelector('.jt-table')], t => t.classList.add('is-lit'), 0.3);

  // Effective-dimensions gauge beside the encoder switch
  const seg = main.querySelector('#jtMap .jt-seg');
  const g = document.createElement('span');
  g.className = 'fj-gauge';
  g.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="11"/><circle class="fj-arc" cx="14" cy="14" r="11" pathLength="370"/></svg><span><b></b> effective dims</span>';
  seg.after(g);
  const arc = g.querySelector('.fj-arc'), num = g.querySelector('b'), og = seg.querySelector('[data-enc="og"]');
  let gt = 0;
  const gauge = instant => {
    const dims = og.getAttribute('aria-pressed') === 'true' ? 3 : 370, ms = instant || reduced ? 0 : 1100;
    arc.style.transitionDuration = `${ms}ms`;
    arc.style.strokeDashoffset = 370 - dims;
    clearTimeout(gt);
    gt = setTimeout(() => { num.textContent = `≈${dims}`; }, ms / 2);
  };
  gauge(true);
  new MutationObserver(() => gauge()).observe(og, { attributes: true, attributeFilter: ['aria-pressed'] });

  // Geometry shared by the hero disk and the frames (same rules as the section 07 scene)
  const OGX = [.42, .78, .62, .70, .36, .17, .90, .62, .45, .07, .93, .08];
  const VIC = [['#6ccb5f', .30, .50], ['#b9b39f', .50, .48], ['#c9f04a', .88, .15], ['#f28c38', .66, .72], ['#ff4d94', .86, .90], ['#9cc6ff', .06, .22],
    ['#4c8df6', .10, .60], ['#a08cff', .08, .88], ['#45c4c0', .27, .18], ['#e8566c', .94, .58], ['#6fd3e8', .30, .82], ['#e0c068', .66, .30]];
  const RING_AT = [0, .22, .32, .42, .55, .66, .75, .84, 1];
  const RING = [['#d8d4cc', '#3a3936', '#1a1918', '#3a3936', '#d8d4cc', '#eceae5', '#ffffff', '#eceae5', '#d8d4cc'],
    ['#ff5c2a', '#7a1a0a', '#4a0f06', '#7a1a0a', '#ff5c2a', '#ffb347', '#fff4dc', '#ffb347', '#ff5c2a']];
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { t = Math.min(1, Math.max(0, t)); const p = hex(a), q = hex(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * t))})`; };

  fetch('/concepts/assets/jepa/hero.json').then(r => r.json()).then(j => {
    const og = b64(j.og), vic = b64(j.vicreg), cap = new Int8Array(b64(j.mcap).buffer), n = og.length;
    const groups = VIC.map(() => []);
    for (let i = 0; i < n; i++) groups[vic[i]].push(i);
    const spacing = 0.19 / Math.sqrt(Math.max(...groups.map(x => x.length))), dots = [];
    groups.forEach((rows, c) => rows.sort((a, b) => cap[b] - cap[a]).forEach((i, k) => {
      const rad = spacing * Math.sqrt(k + 0.5), x1 = VIC[c][1] + rad * Math.cos(k * 2.39996), y1 = VIC[c][2] + rad * Math.sin(k * 2.39996);
      const r0 = 0.11 + Math.abs(OGX[og[i]] - 0.5) * 0.75 + (i % 13) * 0.005, t0 = (OGX[og[i]] < 0.5 ? Math.PI : 0) + ((i * 0.618) % 1 - 0.5) * 2.2;
      const r1 = Math.hypot(x1 - 0.5, y1 - 0.5), t1 = Math.atan2(y1 - 0.5, x1 - 0.5);
      dots.push({ r0, t0, r1, dt: ((t1 - t0) % 6.283 + 6.283) % 6.283 + Math.PI, col: VIC[c][0], cl: c, m: (cap[i] + 128) / 255 });
    }));

    // hero: the face-on disk drawn once; CSS tilts it edge-on and turns it slowly
    const S = 640, cv = document.createElement('canvas'), cx = cv.getContext('2d');
    cv.width = cv.height = S;
    for (const d of dots) {
      const r = (d.r0 / 0.56) * S * 0.48, th = d.t0 + (d.m * 7.1 + d.cl) % 6.283;
      cx.globalAlpha = 0.5 + 0.5 * d.m; cx.fillStyle = "#d8d4cc";
      cx.beginPath(); cx.arc(S / 2 + r * Math.cos(th), S / 2 + r * Math.sin(th), 2.4 + 3 * d.m, 0, 6.283); cx.fill();
    }
    const url = `url(${cv.toDataURL()})`;
    hero.querySelectorAll('i').forEach(i => { i.style.backgroundImage = url; });
    requestAnimationFrame(() => hero.classList.add('is-on'));

    // frames: 01 the mono disk, 02 ignited, 03–07 spiralling out as colour floods in
    marks.forEach((c, f) => {
      const x = c.getContext('2d'), W = c.width, k = f < 2 ? 0 : ease((f - 1) / (marks.length - 2)), tilt = 0.06 + 0.94 * k;
      if (k < 1) {
        const R = W * 0.07, g = x.createConicGradient?.(-Math.PI / 2, W / 2, W / 2);
        if (g) {
          RING_AT.forEach((o, j) => g.addColorStop(o, RING[f ? 1 : 0][j]));
          x.globalAlpha = 1 - k; x.fillStyle = g;
          x.beginPath(); x.arc(W / 2, W / 2, R * 1.3, 0, 6.283); x.arc(W / 2, W / 2, R, 0, 6.283, true); x.fill();
        }
      }
      for (const d of dots) {
        const r = d.r0 + (d.r1 - d.r0) * k, th = d.t0 + d.dt * k;
        x.globalAlpha = 0.85;
        x.fillStyle = f === 0 ? '#d8d4cc' : f === 1 ? '#ffb347' : mix('#ffb347', d.col, (k - 0.1 - d.cl * 0.04) / 0.3);
        x.fillRect(W / 2 + r * Math.cos(th) * W * 0.9 - 0.9, W / 2 + r * Math.sin(th) * tilt * W * 0.9 - 0.9, 1.8, 1.8);
      }
    });
  }).catch(() => hero.remove());
}

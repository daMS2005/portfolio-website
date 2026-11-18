// Brain hand (left) and model hand (right) reach for shared structure; the gap is the inconclusive result.
const A = '/concepts/assets/';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = () => {
  const s = document.createElement('div');
  s.className = 'th-stage';
  s.innerHTML = `<img class="th-hand th-brain" src="${A}hand-human.webp" alt="" decoding="async"><img class="th-hand th-model" src="${A}hand-model.webp" alt="" decoding="async"><i class="th-hole"></i>`;
  if (still) s.classList.add('is-lit');
  else new IntersectionObserver(([e], io) => { if (e.isIntersecting) { s.classList.add('is-lit'); io.disconnect(); } }, { threshold: 0.4 }).observe(s);
  return s;
};

// (a) homepage: slim band between the Brain/Model pair and the verdict
const pair = document.querySelector('.flagship-thesis .dg-row-pair');
if (pair) {
  const band = document.createElement('div');
  band.className = 'th-band';
  band.setAttribute('aria-hidden', 'true');
  band.append(stage());
  band.insertAdjacentHTML('beforeend', '<p class="th-rho">ρ = −.06</p>');
  pair.after(band);
}

// (b) thesis.html: planted-agreement slider above the result cards
const results = document.querySelector('.result-band');
if (results && location.pathname.includes('thesis')) {
  const fig = document.createElement('figure');
  fig.className = 'th-play';
  const s = stage();
  fig.append(s);
  fig.insertAdjacentHTML('beforeend', `
    <div class="th-controls">
      <label>Planted agreement <span>weak</span><input type="range" min="0" max="100" value="0"><span>strong</span></label>
      <div class="th-meter"><span>Detected</span><div class="th-track"><i class="th-fill"></i><i class="th-tick"><b>80% target</b></i></div><strong>≤ 10%</strong></div>
    </div>
    <figcaption>Even strong planted agreement is detected in at most about 10% of runs (80% target).</figcaption>`);
  results.before(fig);
  const input = fig.querySelector('input');
  const set = () => {
    const t = input.value / 100;
    s.style.setProperty('--gap', `${56 - 30 * t}px`);
    fig.style.setProperty('--detect-scale', 0.05 + 0.05 * t); // thesis figure: detection stays near 5–10% at every planted strength
  };
  input.addEventListener('input', set);
  set();
}

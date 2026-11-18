// film-thesis: thesis.html told as Human <-> AI (x-ray head and model head around one feature bank), sections in story order,
// play the story, parcels falling into the histogram, dark figure redraws, drawn hands. Only runs on thesis.html.
import { brainData, buildBrain } from './film-thesis-brain.js';
import { storyFigure, fallFigure, detectFigure, methodFigure, reveal } from './film-thesis-figs.js';
import { handsFigure } from './film-thesis-hands.js';
import { scene } from './film-thesis-ai.js';

const CHAPTERS = [['Question', 'ft-question', 'The question'], ['Brain data', 'ft-human', 'The human side'], [null, 'ft-model', 'The model side'],
  ['Scale', 'ft-scale', 'Scale'], ['Pipeline', 'ft-test', 'The test'], ['Result', 'ft-result', 'The result'], ['Interpretation', 'ft-meaning', 'What it means'], ['Evolution', 'ft-evolution', 'How the idea evolved']];

const hero = document.querySelector('.detail-hero');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const once = (el, fn, threshold = 0.15) => new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { threshold }).observe(el);

if (hero && location.pathname.includes('thesis')) {
  // static restructuring first, so nothing shifts once the data arrives
  hero.insertAdjacentHTML('beforeend', `<figure class="ft-head">
      <canvas role="img" aria-label="Human and AI face each other. On the left, an x-ray head shows the 200 cortical parcels at their atlas positions, gold where the 59 listeners responded alike. On the right, the same head is drawn as a language model, with six layer bands of grid cells and a few sparse features lit in teal. Between them, one bank of 256 feature IDs links to both."></canvas>
      <div class="ft-head-labels" aria-hidden="true"><span>Human<small>200 cortical parcels</small></span><span>Same features<small>256 feature IDs, locked</small></span><span>AI<small>language model, six layers</small></span></div>
      <figcaption>Do the brain and the model rely on the same features? Gold marks where the 59 listeners responded alike (inter-subject correlation, max 0.79). Teal marks sparse model features, drawn for illustration.</figcaption>
    </figure>`);
  hero.querySelector('div').insertAdjacentHTML('beforeend', `<nav class="ft-chapters" aria-label="The story">${CHAPTERS.filter(([, id]) => id !== 'ft-scale').slice(0, 5).map(([, id, name]) => `<a href="#${id}">${name}</a>`).join('')}</nav>`);
  storyOrder();
  document.dispatchEvent(new Event('film:sections')); // the frame's section credits are read before this reorder
  const methodLink = document.querySelector('.research-figure-tall')?.closest('a');
  if (methodLink) methodFigure(methodLink);
  const detectLink = document.querySelector('.research-figure:not(.research-figure-tall)')?.closest('a');
  const detect = detectLink && detectFigure(detectLink);
  if (detect) handsFigure(detect);
  document.querySelectorAll('.research-pipeline').forEach((el) => reveal(el, () => el.classList.add('is-armed'), () => el.classList.add('is-lit'), 0.15));

  brainData.then((data) => {
    const B = buildBrain(data.parcels);
    ignite(hero.querySelector('.ft-head canvas'), (cv, t, yaw) => scene(cv, { B, isc: data.isc, t, yaw }), true);
    ignite(document.querySelector('.ft-ai canvas'), (cv, t) => scene(cv, { t, human: false }));
    const [story, fall] = document.querySelectorAll('.brain-data-figure');
    if (story) storyFigure(story, B, data); // built at once (16 KB of BOLD), so nothing above you shifts later
    if (fall) fallFigure(fall, B, data);
  });
}

// The page as one story: question -> human side -> model side -> the test -> the result, then what it means and how it evolved.
// [original credit, id, new credit]; the model side is a new section built only from the page's own facts.
function storyOrder() {
  const main = hero.parentElement, end = main.querySelector('.detail-links');
  const byCredit = (c) => [...main.querySelectorAll('.detail-section')].find((s) => s.querySelector('.detail-section-header span')?.textContent.includes(c));
  CHAPTERS.forEach(([from, id, name], n) => {
    let sec = from ? byCredit(from) : null;
    if (!from) {
      sec = document.createElement('section');
      sec.className = 'detail-section';
      sec.innerHTML = `<div class="detail-section-header"><span></span><h2>The model side</h2></div>
        <figure class="ft-ai"><canvas role="img" aria-label="The language model drawn as a head of six layer bands of grid cells, a few sparse features lit in teal and linked across layers, beside a bank of 256 feature IDs."></canvas>
          <div class="ft-head-labels" aria-hidden="true"><span>256 feature IDs<small>locked on the source description</small></span><span>Six depth-spaced layers<small>a few sparse features active at once</small></span></div></figure>
        <div class="detail-grid">
          <div class="detail-panel"><h3>Hidden states</h3><p>Each timed transcript runs through the model in causal context windows. Hidden states and residual-stream SAE activations are kept from six depth-spaced layers.</p></div>
          <div class="detail-panel"><h3>Sparse features</h3><p>A sparse autoencoder (SAE) rewrites each hidden state as a few active features out of many. For the paper's test, nested banks of 64 to 1,024 feature IDs are chosen on one description and then locked. The choice never looks at BOLD, model targets, or the second description. The headline result uses 256.</p></div>
        </div>`;
    }
    if (!sec) return;
    sec.id = id;
    sec.querySelector('.detail-section-header span').textContent = `${String(n + 1).padStart(2, '0')} · ${name}`;
    main.insertBefore(sec, end);
  });
}

// Draw once at rest, ignite once on view (about 2 s of frames), then idle. The hero's brain turns a little under the pointer (opt-in).
function ignite(cv, draw, turn) {
  if (!cv) return;
  let t = still || !turn ? 9 : 0, yaw = -0.22, aim = -0.22, raf = 0, t0 = 0;
  const tick = (now) => {
    t0 ||= now - t * 1000;
    if (!still) t = Math.min(9, (now - t0) / 1000);
    yaw += (aim - yaw) * 0.12;
    draw(cv, t, yaw);
    raf = t < 2.2 || Math.abs(aim - yaw) > 0.002 ? requestAnimationFrame(tick) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  if (turn) {
    cv.addEventListener('pointermove', (e) => {
      const b = cv.getBoundingClientRect();
      aim = -0.22 - ((e.clientX - b.left) / b.width - 0.5) * 0.5;
      go();
    });
    cv.addEventListener('pointerleave', () => { aim = -0.22; go(); });
  }
  new ResizeObserver(() => draw(cv, t, yaw)).observe(cv);
  draw(cv, t, yaw);
  if (turn) once(cv, () => setTimeout(go, still ? 0 : 300), 0.3); // the hero ignites on load
  else reveal(cv, () => { t = 0; draw(cv, t, yaw); }, (play) => play && setTimeout(go, 300), 0.3);
}

// diagram-light: each flagship diagram ignites once when it enters view; hovering a node replays its links.
const RUN = 600;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function reach(link, delay = 0) {
  link.style.setProperty('--d', `${delay}ms`);
  link.classList.remove('dl-run');
  void link.offsetWidth; // restart the animation on replay
  link.classList.add('dl-run');
  clearTimeout(link.dlTimer);
  link.dlTimer = setTimeout(() => link.classList.remove('dl-run'), delay + RUN);
}

function ignite(el) {
  let t = 0;
  if (el.matches('.pipeline-strip')) {
    for (const li of el.children) {
      t += 90;
      li.style.setProperty('--d', `${t}ms`);
      if (li.matches('.pipeline-gate')) t += 220; // the gate holds the light
    }
  } else {
    for (const n of el.querySelectorAll('.dg-node, .dg-link, .dg-tokens i')) {
      if (n.matches('.dg-link')) { reach(n, t); continue; }
      t += n.matches('i') ? 35 : 70;
      n.style.setProperty('--d', `${t}ms`);
    }
  }
  el.classList.replace('dl-armed', 'dl-lit'); // animations fill backwards, so the pre-state holds until each delay
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); ignite(e.target); }
}, { threshold: 0.25 });

for (const link of document.querySelectorAll('.flagship-visual .dg-link')) {
  link.prepend(...['dl-h', 'dl-h', 'dl-spark'].map((c) => Object.assign(document.createElement('b'), { className: c })));
}
for (const node of document.querySelectorAll('.flagship-visual .dg-node')) {
  node.addEventListener('pointerenter', () => {
    for (const s of [node.previousElementSibling, node.nextElementSibling]) if (s?.matches('.dg-link')) reach(s);
  });
}
if (!still) {
  for (const el of document.querySelectorAll('.flagship-visual .dg, .flagship-visual .pipeline-strip')) {
    el.classList.add('dl-armed');
    io.observe(el);
  }
}

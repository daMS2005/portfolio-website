// Effective-dimensions gauge beside the encoder toggle; the collapse itself is drawn by jepa-map.js.
const seg = document.querySelector('#jtMap .jt-seg');
if (seg) {
  const g = document.createElement('span');
  g.className = 'jc-gauge';
  g.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="11"/><circle class="jc-arc" cx="14" cy="14" r="11" pathLength="370"/></svg><span><b></b> effective dims</span>';
  seg.after(g);
  const arc = g.querySelector('.jc-arc'), num = g.querySelector('b'), og = seg.querySelector('[data-enc="og"]');
  let t = 0;
  const set = (instant) => {
    const dims = og.getAttribute('aria-pressed') === 'true' ? 3 : 370;
    const ms = instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : dims === 3 ? 800 : 1150;
    arc.style.transitionDuration = `${ms}ms`;
    arc.style.strokeDashoffset = 370 - dims;
    clearTimeout(t);
    t = setTimeout(() => { num.textContent = `≈${dims}`; }, ms / 2);
  };
  set(true);
  new MutationObserver(() => set()).observe(og, { attributes: true, attributeFilter: ['aria-pressed'] });
}

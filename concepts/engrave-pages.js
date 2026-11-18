// engrave: personal page. Gym, chess and markets each get one small engraved instrument, drawn from facts on the card.
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const f = (n) => n.toFixed(2);
const TAU = 2 * Math.PI;
const onView = (el, fn, threshold = 0.3) => {
  if (RM) return fn();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(el);
};
const draw = (d, cls = '') => `<path class="ege-draw ${cls}" pathLength="1" d="${d}"/>`;

const personal = $('main.personal-page');
if (personal) {
  // gym, chess, markets: one small instrument each, drawn from facts on the card
  const P = (x, y) => `${f(x)} ${f(y)}`;
  const inst = {
    Training: () => { // range of motion on a protractor; the stretched end is where he trains
      const cx = 80, cy = 58, R = 46, deg = (d) => (d * Math.PI) / 180;
      let ticks = '', hatch = '', gold = '';
      for (let d = 180; d <= 360; d += 5) ticks += `M${P(cx + R * Math.cos(deg(d)), cy + R * Math.sin(deg(d)))}L${P(cx + (R - (d % 30 ? 2.5 : 5)) * Math.cos(deg(d)), cy + (R - (d % 30 ? 2.5 : 5)) * Math.sin(deg(d)))}`;
      for (let d = 196; d <= 334; d += 3.5) {
        const seg = `M${P(cx + 15 * Math.cos(deg(d)), cy + 15 * Math.sin(deg(d)))}L${P(cx + (R - 8) * Math.cos(deg(d)), cy + (R - 8) * Math.sin(deg(d)))}`;
        d < 226 ? (gold += seg) : (hatch += seg);
      }
      const arm = (d) => `M${cx} ${cy}L${P(cx + (R - 2) * Math.cos(deg(d)), cy + (R - 2) * Math.sin(deg(d)))}`;
      return `${draw(`M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}M${cx - R - 6} ${cy}H${cx + R + 6}`)}${draw(ticks, 'ege-thin')}
        <g class="ege-tone"><path d="${hatch}"/><path class="ege-gold" d="${gold}"/></g>${draw(arm(196) + arm(334), 'ege-arm')}
        <circle cx="${cx}" cy="${cy}" r="1.6"/><text x="${cx - R - 2}" y="${cy - 34}" text-anchor="end">stretch</text>`;
    },
    Chess: () => { // a chess clock: two faces, both set to ten minutes
      let out = draw('M22 14H138M40 14V9H60V14M100 14V9H120V14');
      [[50, 'ege-gold'], [110, '']].forEach(([cx, cls]) => {
        const cy = 38, R = 20;
        let ticks = '', hatch = '';
        for (let m = 0; m < 60; m++) {
          const a = (m / 60) * TAU - Math.PI / 2, r1 = m % 5 ? R - 2 : R - 4;
          ticks += `M${P(cx + R * Math.cos(a), cy + R * Math.sin(a))}L${P(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))}`;
        }
        for (let m = 0; m <= 10; m += 0.45) {
          const a = (m / 60) * TAU - Math.PI / 2;
          hatch += `M${P(cx + 2.5 * Math.cos(a), cy + 2.5 * Math.sin(a))}L${P(cx + (R - 5) * Math.cos(a), cy + (R - 5) * Math.sin(a))}`;
        }
        const ha = (10 / 60) * TAU - Math.PI / 2;
        out += `<circle class="ege-draw" pathLength="1" cx="${cx}" cy="${cy}" r="${R}"/>${draw(ticks, 'ege-thin')}
          <g class="ege-tone"><path class="${cls}" d="${hatch}"/></g>${draw(`M${cx} ${cy}L${P(cx + (R - 4) * Math.cos(ha), cy + (R - 4) * Math.sin(ha))}`, 'ege-arm')}
          <text x="${cx}" y="${cy + R + 7}" text-anchor="middle">10:00</text>`;
      });
      return out;
    },
    Markets: () => { // a thesis as a one-sided test: the region that would prove it wrong, hatched
      const mu = 80, sd = 22, base = 54, H = 42, y = (x) => base - H * Math.exp(-(((x - mu) / sd) ** 2) / 2), xc = mu + 1.645 * sd;
      let curve = `M8 ${f(y(8))}`, fill = '', tail = '', region = `M${f(xc)} ${base}`;
      for (let x = 8; x <= 152; x += 2) curve += `L${f(x)} ${f(y(x))}`;
      for (let x = 10; x < xc; x += 3) fill += `M${f(x)} ${base}V${f(y(x) + 1)}`;
      for (let x = xc; x <= 152; x += 2) region += `L${f(x)} ${f(y(x))}`;
      for (let k = xc - 30; k < 160; k += 2.4) tail += `M${f(k)} ${base}l20 -20M${f(k)} ${base - 20}l20 20`;
      return `${draw(`M4 ${base}H156`, 'ege-thin')}${draw(curve)}<clipPath id="egeTail"><path d="${region}L152 ${base}Z"/></clipPath>
        <g class="ege-tone"><path d="${fill}"/><path class="ege-gold" clip-path="url(#egeTail)" d="${tail}"/></g>
        ${draw(`M${f(xc)} ${base + 3}V${f(y(xc) - 14)}`, 'ege-arm')}<text x="${f(xc + 3)}" y="${f(y(xc) - 9)}">α = .05</text><text x="${mu}" y="${base + 9}" text-anchor="middle">H₀</text>`;
    },
  };
  $$('.interest-card', personal).forEach((card) => {
    const k = $('.interest-card-top span', card)?.textContent.trim();
    if (!inst[k]) return;
    card.insertAdjacentHTML('afterbegin', `<svg class="ege-inst" viewBox="0 0 160 64" aria-hidden="true">${inst[k]()}</svg>`);
    onView(card, () => card.classList.add('ege-on'), 0.4);
  });
}

// Human <-> AI: the x-ray head with the 200 real parcels (facing right), the locked bank of 256 feature IDs
// (a 16 x 16 grid) in the gap, and the language model as the same head mirrored, filled with six layer bands
// of grid cells (the "six depth-spaced layers"), a few sparse features lit. Teal = AI, gold = brain.
import { drawBrain, drawHead, fit, gold, blend, HEAD } from './film-thesis-brain.js';

let seed;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp = (v) => Math.min(1, Math.max(0, v));
const pip = ([y, z]) => { // point in the head polygon (mm)
  let r = false;
  for (let i = 0, j = HEAD.length - 1; i < HEAD.length; j = i++) {
    const [y1, z1] = HEAD[i], [y2, z2] = HEAD[j];
    if ((z1 > z) !== (z2 > z) && y < ((y2 - y1) * (z - z1)) / (z2 - z1) + y1) r = !r;
  }
  return r;
};

// cells in mm: 6 bands x 2 columns, inset 10 mm from the skull; 3 sparse features lit per band
seed = 7;
const CELLS = [];
for (let b = 0; b < 6; b++) for (let c = 0; c < 2; c++) for (let z = 82; z >= -40; z -= 10) {
  const y = 64 - b * 29 - c * 10;
  if ([[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]].every(([dy, dz]) => pip([y + dy, z + dz]))) CELLS.push({ y, z, b, lit: false });
}
for (let b = 0; b < 6; b++) {
  const band = CELLS.filter((c) => c.b === b);
  for (let k = 0; k < 3; k++) band[(rnd() * band.length) | 0].lit = true;
}
const LIT = CELLS.filter((c) => c.lit);
const LINKS = LIT.flatMap((a) => LIT.filter((c) => c.b === a.b + 1 && rnd() < 0.6).map((c) => [a, c]));

// t: seconds since ignition (9 = at rest). human: draw the brain side. Returns nothing; pure draw.
export function scene(cv, { B, isc, t, yaw = 0, human = true }) {
  const { ctx, w, h } = fit(cv);
  const s = human ? Math.min((w * 0.4) / 236, (h - 6) / 258) : (h - 6) / 258, cy = 4 + 108 * s;
  const aiX = w - 2 - 118 * s; // AI head: posterior on the right edge, facing left
  const huX = 2 + 118 * s; // human head (mirrored): posterior on the left edge, facing right
  const gapL = human ? huX + 116 * s : 0, gapR = aiX - 116 * s;
  const q = Math.min(human ? 5.5 : 8, ((gapR - gapL) * 0.5) / 16), bx = human ? (gapL + gapR) / 2 - 8 * q : 4, by = cy - 15 * s - 8 * q;
  const fan = clamp((t - 1.3) / 0.5);
  ctx.lineCap = 'round';

  // brain side
  let P = [];
  if (human) {
    const ear = [-20, -15];
    ctx.save(); ctx.translate(huX, 0); ctx.scale(-1, 1);
    const view = { cx: 0, cy, s, yaw };
    drawHead(ctx, view);
    P = drawBrain(ctx, B, view, (i) => blend([216, 212, 204, 0.34], gold(isc[i] / 0.79), clamp((t - Math.hypot(B.pts[i][1] - ear[0], B.pts[i][2] - ear[1]) / 130) / 0.5)));
    ctx.restore();
    // fan from the bank to the ten most shared parcels
    if (fan) {
      const top = isc.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 10);
      ctx.lineWidth = 1;
      for (const [, i] of top) {
        const x = huX - P[i][0], y = P[i][1], y0 = by + 8 * q + (y - cy) * 0.15;
        const g = ctx.createLinearGradient(bx, 0, x, 0);
        g.addColorStop(0, `rgba(216,212,204,${0.4 * fan})`); g.addColorStop(1, `rgba(255,179,71,${0.55 * fan})`);
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(bx - 3, y0); ctx.bezierCurveTo(bx - 3 - (bx - x) * 0.5, y0, x + (bx - x) * 0.3, y, x, y); ctx.stroke();
      }
    }
  }

  // model side: the same head, mirrored, in teal
  const X = (c) => aiX - c.y * s, Y = (c) => cy - c.z * s, cs = 6.4 * s;
  drawHead(ctx, { cx: aiX, cy, s }, '143,202,197');
  ctx.lineWidth = Math.max(0.6, s * 0.6);
  for (const [a, c] of LINKS) {
    const al = clamp((t - 1.1 - c.b * 0.12) / 0.4);
    if (!al) continue;
    ctx.strokeStyle = `rgba(143,202,197,${0.25 * al})`;
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.bezierCurveTo((X(a) + X(c)) / 2, Y(a), (X(a) + X(c)) / 2, Y(c), X(c), Y(c)); ctx.stroke();
  }
  for (const c of CELLS) {
    const on = clamp((t - 0.7 - c.b * 0.12) / 0.4), hot = c.lit ? clamp((t - 1.0 - c.b * 0.12) / 0.4) : 0;
    if (hot > 0.5) {
      const g = ctx.createRadialGradient(X(c), Y(c), 0, X(c), Y(c), cs * 2.2);
      g.addColorStop(0, `rgba(143,202,197,${0.35 * hot})`); g.addColorStop(1, 'rgba(143,202,197,0)');
      ctx.fillStyle = g; ctx.fillRect(X(c) - cs * 2.2, Y(c) - cs * 2.2, cs * 4.4, cs * 4.4);
    }
    ctx.fillStyle = `rgba(143,202,197,${(0.1 + 0.08 * on + 0.82 * hot)})`;
    ctx.beginPath(); ctx.roundRect(X(c) - cs / 2, Y(c) - cs / 2, cs, cs, Math.min(2, cs / 3)); ctx.fill();
  }
  if (fan) { // bank to the lit features of the nearest layer band
    ctx.lineWidth = 1;
    for (const c of LIT.filter((c) => c.b === 0)) {
      const x0 = bx + 16 * q + 2, y0 = by + 8 * q + (Y(c) - cy) * 0.15;
      ctx.strokeStyle = `rgba(143,202,197,${0.5 * fan})`;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + (X(c) - x0) * 0.5, y0, X(c) - (X(c) - x0) * 0.3, Y(c), X(c) - cs / 2, Y(c)); ctx.stroke();
    }
  }

  // the bank: exactly 256 cells, mono, lit once from the centre out
  for (let i = 0; i < 256; i++) {
    const r = i >> 4, c = i & 15, al = clamp((t - 0.5 - Math.hypot(r - 7.5, c - 7.5) / 30) / 0.4);
    ctx.fillStyle = `rgba(245,243,239,${0.14 + 0.5 * al})`;
    ctx.fillRect(bx + c * q + q * 0.15, by + r * q + q * 0.15, q * 0.7, q * 0.7);
  }
}

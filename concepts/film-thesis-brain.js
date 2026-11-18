// The 200 Schaefer parcels (real MNI centroids, concepts/assets/thesis-brain.json) drawn as a filament nebula.
// Lateral view: anterior to the left, screen x = -y, screen y = -z, a small yaw separates the hemispheres.
export const brainData = fetch('/concepts/assets/thesis-brain.json').then((r) => r.json());

let seed = 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function buildBrain(parcels) {
  const pts = parcels.map((p) => [p.x, p.y, p.z]), n = pts.length, links = new Map();
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const add = (i, j) => { const k = Math.min(i, j) * n + Math.max(i, j); if (!links.has(k)) links.set(k, [i, j, rnd() - 0.5]); };
  seed = 3;
  pts.forEach((p, i) => {
    const same = pts.map((q, j) => j).filter((j) => j !== i && Math.sign(pts[j][0]) === Math.sign(p[0]));
    same.sort((a, b) => d2(p, pts[a]) - d2(p, pts[b])).slice(0, 3).forEach((j) => add(i, j));
    const mirror = [-p[0], p[1], p[2]];
    let best = 0;
    pts.forEach((q, j) => { if (Math.sign(q[0]) !== Math.sign(p[0]) && d2(mirror, q) < d2(mirror, pts[best])) best = j; });
    add(i, best); // homologue in the other hemisphere
  });
  const wisps = pts.map(() => [0, 1, 2].map(() => [(rnd() - 0.5) * 16, (rnd() - 0.5) * 16, (rnd() - 0.5) * 16, rnd() - 0.5]));
  return { pts, links: [...links.values()], wisps };
}

// Colour ramps. Each returns [r, g, b, alpha]; alpha also scales dot size and glow.
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const SILVER = [216, 212, 204], EMBER = [255, 92, 42], CORE = [255, 179, 71], TEAL = [143, 202, 197];
export const mono = () => [...SILVER, 0.32];
export const gold = (v) => { // 0..1, mono at rest to gold where the value is high
  v = Math.max(0, Math.min(1, v));
  const c = v < 0.45 ? mix(SILVER, EMBER, v / 0.45) : mix(EMBER, CORE, (v - 0.45) / 0.55);
  return [...c, 0.3 + 0.7 * v];
};
export const diverging = (z) => { // standardized BOLD: positive ember to gold, negative teal
  const t = Math.min(1, Math.abs(z) / 2.5);
  if (t < 0.08) return [...SILVER, 0.12];
  return z > 0 ? [...mix(EMBER, CORE, t), 0.25 + 0.75 * t] : [...TEAL, 0.2 + 0.6 * t];
};
export const blend = (a, b, t) => [...mix(a, b, t), lerp(a[3], b[3], t)];

// view = { cx, cy, s (px per mm), yaw (rad) }. col(i) -> [r,g,b,a]. Returns projected points.
export function drawBrain(ctx, B, view, col, dim = 1) {
  const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
  const P = B.pts.map(([x, y, z]) => {
    const yy = y * c - x * s, xx = y * s + x * c;
    return [view.cx - yy * view.s, view.cy - z * view.s, 0.55 + 0.45 * Math.min(1, Math.max(0, (70 - xx) / 140))];
  });
  const C = B.pts.map((_, i) => col(i));
  const rgba = (q, a) => `rgba(${q[0] | 0},${q[1] | 0},${q[2] | 0},${a.toFixed(3)})`;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(0.6, view.s * 0.35);
  for (const [i, j, k] of B.links) {
    const a = P[i], b = P[j], q = C[i][3] > C[j][3] ? C[i] : C[j];
    const al = Math.min(C[i][3], C[j][3]) * 0.42 * dim * (a[2] + b[2]) / 2;
    if (al < 0.01) continue;
    const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * k * 0.5, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * k * 0.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]);
    ctx.strokeStyle = rgba(q, al); ctx.stroke();
  }
  ctx.lineWidth = Math.max(0.5, view.s * 0.25);
  B.wisps.forEach((ws, i) => {
    const p = P[i], al = C[i][3] * 0.3 * dim * p[2];
    if (al < 0.01) return;
    ctx.strokeStyle = rgba(C[i], al);
    for (const [dx, dy, , k] of ws) {
      const ex = p[0] + dx * view.s, ey = p[1] + dy * view.s;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo((p[0] + ex) / 2 + dy * k * view.s, (p[1] + ey) / 2 - dx * k * view.s, ex, ey);
      ctx.stroke();
    }
  });
  P.forEach((p, i) => {
    const q = C[i], a = q[3] * dim * p[2], r = view.s * (0.7 + 1.6 * q[3]);
    if (q[3] > 0.55 && dim > 0.3) {
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 5);
      g.addColorStop(0, rgba(q, a * 0.45)); g.addColorStop(1, rgba(q, 0));
      ctx.fillStyle = g; ctx.fillRect(p[0] - r * 5, p[1] - r * 5, r * 10, r * 10);
    }
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = rgba(q, Math.min(1, a * 1.2)); ctx.fill();
  });
  ctx.restore();
  return P;
}

// X-ray head in profile (mm, MNI-like y forward / z up), facing left, one faint 1px line, plus the ear.
export const HEAD = [[25, -150], [28, -118], [55, -108], [86, -98], [92, -80], [97, -72], [94, -64], [99, -58], [97, -50], [104, -44],
  [116, -36], [104, -14], [92, -2], [94, 20], [88, 52], [62, 86], [20, 104], [-30, 104], [-75, 84], [-104, 48], [-118, 0],
  [-114, -40], [-96, -80], [-84, -110], [-86, -150]];
const EAR = [[-6, 2], [-22, 8], [-34, -6], [-34, -30], [-24, -48], [-12, -50], [-8, -38]];
const curve = (ctx, pts, view) => {
  const xy = pts.map(([y, z]) => [view.cx - y * view.s, view.cy - z * view.s]);
  ctx.moveTo(...xy[0]);
  for (let i = 1; i < xy.length - 1; i++) ctx.quadraticCurveTo(...xy[i], (xy[i][0] + xy[i + 1][0]) / 2, (xy[i][1] + xy[i + 1][1]) / 2);
  ctx.lineTo(...xy[xy.length - 1]);
};
export function drawHead(ctx, view, rgb = '216,212,204') {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${rgb},.32)`;
  ctx.beginPath(); curve(ctx, HEAD, view); ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},.18)`;
  ctx.beginPath(); curve(ctx, EAR, view); ctx.stroke();
  ctx.restore();
}

// canvas sized to its CSS box at <= 2x DPR
export function fit(cv) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// brain-only view that fits the parcels (y -97..64, z -39..70) into a w x h box
export function brainView(x, y, w, h, yaw = -0.3) {
  const s = Math.min(w / 205, h / 130);
  return { cx: x + w / 2 - 15 * s, cy: y + h / 2 + 16 * s, s, yaw };
}

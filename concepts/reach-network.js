// reach-network: one reaching hand drawn twice, a stippled human hand and its mirror as a lattice network,
// fingertips held apart by a tiny black hole. Silhouette comes from hand-human.webp, thresholded at runtime.
const hero = document.querySelector('section#home.hero');
const CROP = [230, 185, 490, 260]; // x, y, w, h of the hand in the 1536x640 source; fingertip at (712, 232)
const TIP = [482 / 490, 47 / 260];
const MW = 245, MH = 130;

if (hero) {
  hero.insertAdjacentHTML('beforeend', `
    <div class="rn-stage" aria-hidden="true">
      <figure class="rn-human"><canvas></canvas><figcaption>Human<small>neurons</small></figcaption></figure>
      <span class="rn-signal"></span>
      <figure class="rn-ai"><canvas></canvas><figcaption>AI<small>network</small></figcaption></figure>
    </div>`);
  const [human, ai] = hero.querySelectorAll('.rn-stage canvas');
  const img = new Image();
  img.src = '/concepts/assets/hand-human.webp';
  img.decode().then(() => {
    const off = Object.assign(document.createElement('canvas'), { width: MW, height: MH }).getContext('2d', { willReadFrequently: true });
    off.filter = 'blur(1px)';
    off.drawImage(img, ...CROP, 0, 0, MW, MH);
    const px = off.getImageData(0, 0, MW, MH).data;
    const mask = new Uint8Array(MW * MH).map((_, i) => 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2] > 90);
    let lastW = 0;
    const render = (intro) => {
      if (human.clientWidth === lastW) return;
      lastW = human.clientWidth;
      const scenes = [[human, stipple(human, mask)], [ai, lattice(ai, mask)]];
      const t0 = performance.now();
      const frame = (now) => {
        const p = intro ? Math.min(1, (now - t0) / 1200) : 1;
        for (const [cv, ops] of scenes) paint(cv, ops, p);
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    render(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    let timer;
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => render(false), 150); });
  });
}

let seed;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function setup(cv, mask) {
  const w = cv.clientWidth, h = cv.clientHeight;
  seed = 7;
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[((y / h) * MH | 0) * MW + ((x / w) * MW | 0)];
  return { w, h, k: w / 380, inside, tx: w * TIP[0], ty: h * TIP[1] };
}

// Human: jittered stipple of warm dots, a few curved dendrites, ember gathered at the fingertip
function stipple(cv, mask) {
  const { w, h, k, inside, tx, ty } = setup(cv, mask);
  const s = Math.max(1.6, 2.6 * k), e = 2 * s, ops = [], dots = [];
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
    const d = { x: x + rnd() * s, y: y + rnd() * s, r: (0.4 + rnd() ** 3 * 1.4) * Math.max(0.7, k) };
    const edge = !(inside(d.x + e, d.y) && inside(d.x - e, d.y) && inside(d.x, d.y + e) && inside(d.x, d.y - e));
    if (inside(d.x, d.y) && rnd() < (edge ? 0.8 : 0.28)) dots.push(d);
  }
  for (let i = 0; i < dots.length; i += 18) {
    const a = dots[i], b = dots.find((d) => d !== a && Math.hypot(d.x - a.x, d.y - a.y) < 8 * s && rnd() < 0.08);
    if (!b) continue;
    const cx = (a.x + b.x) / 2 + (b.y - a.y) * (rnd() - 0.5), cy = (a.y + b.y) / 2 - (b.x - a.x) * (rnd() - 0.5);
    ops.push({ x: Math.min(a.x, b.x), f: (c) => {
      c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(cx, cy, b.x, b.y);
      c.strokeStyle = 'rgba(245,243,239,.3)'; c.lineWidth = 0.6; c.stroke();
    } });
  }
  for (const d of dots) {
    const heat = Math.exp(-Math.hypot(d.x - tx, d.y - ty) / (55 * k));
    const col = `rgba(${245 + 10 * heat | 0},${243 - 151 * heat | 0},${239 - 197 * heat | 0},${0.5 + 0.5 * heat})`;
    ops.push({ x: d.x, f: (c) => { c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fillStyle = col; c.fill(); } });
  }
  return ops;
}

// AI: nodes on a regular lattice, straight 1px edges to grid neighbours, the wrist-to-fingertip path lit ember
function lattice(cv, mask) {
  const { w, h, k, inside } = setup(cv, mask);
  const g = Math.min(9, Math.max(4, 9 * k)), cols = Math.ceil(w / g), rows = Math.ceil(h / g), ops = [];
  const at = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && inside(i * g + g / 2, j * g + g / 2);
  const pos = (n) => [(n % cols) * g + g / 2, (n / cols | 0) * g + g / 2];
  const nodes = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (at(i, j)) nodes.push(j * cols + i);
  // breadth-first from the fingertip node; light the route back from the middle of the farthest-left reachable column
  const tip = nodes.filter((n) => at(n % cols - 1, n / cols | 0)).reduce((a, b) => (b % cols > a % cols ? b : a));
  const prev = new Map([[tip, -1]]), queue = [tip];
  for (const n of queue) {
    const i = n % cols, j = n / cols | 0;
    for (const [di, dj] of (i + j) % 2 ? [[-1, 0], [0, 1], [0, -1], [1, 0]] : [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const m = (j + dj) * cols + i + di;
      if (at(i + di, j + dj) && !prev.has(m)) { prev.set(m, n); queue.push(m); }
    }
  }
  const left = Math.min(...queue.map((n) => n % cols)), wrist = queue.filter((n) => n % cols === left).sort((a, b) => a - b);
  const path = [];
  for (let n = wrist[wrist.length >> 1]; n !== -1; n = prev.get(n)) path.push(n);
  const lit = new Set(path);
  for (const n of nodes) {
    const [x, y] = pos(n), i = n % cols, j = n / cols | 0;
    for (const [m, ok] of [[n + 1, at(i + 1, j)], [n + cols, at(i, j + 1)]]) {
      if (!ok) continue;
      const [x2, y2] = pos(m);
      ops.push({ x, f: (c) => {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2);
        c.strokeStyle = 'rgba(121,190,184,.38)'; c.lineWidth = 1; c.stroke();
      } });
    }
  }
  for (let p = 1; p < path.length; p++) {
    const [x, y] = pos(path[p - 1]), [x2, y2] = pos(path[p]);
    ops.push({ x: Math.min(x, x2), f: (c) => {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2);
      c.strokeStyle = '#ff5c2a'; c.lineWidth = 1.4; c.shadowColor = '#ff5c2a'; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
    } });
  }
  for (const n of nodes) {
    const [x, y] = pos(n), i = n % cols, j = n / cols | 0, on = lit.has(n), r = (on ? 1.6 : 1.1) * Math.max(0.8, k);
    const col = n === tip ? '#ffb347' : on ? '#ff5c2a' : at(i + 1, j) && at(i - 1, j) && at(i, j + 1) && at(i, j - 1) ? 'rgba(143,202,197,.5)' : '#8fcac5';
    ops.push({ x, f: (c) => { c.beginPath(); c.arc(x, y, n === tip ? r * 1.5 : r, 0, 7); c.fillStyle = col; c.fill(); } });
  }
  return ops;
}


// intro: every op fades in as the sweep passes its x (wrist to fingertip)
function paint(cv, ops, p) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  for (const op of ops) {
    const a = Math.min(1, (p * 1.3 - op.x / w) * 4);
    if (a <= 0) continue;
    c.globalAlpha = a;
    op.f(c);
  }
  c.globalAlpha = 1;
}

// thesis-hands-drawn: reach-engrave's two drawn hands, small, in the thesis card between the Brain/Model pair and the verdict
const pair = document.querySelector('.flagship-thesis .dg-row-pair');
const SRC = { x: 0, y: 150, w: 750, h: 320, tx: 712, ty: 80 }; // crop of hand-human.webp, fingertip in crop coords

if (pair) {
  pair.insertAdjacentHTML('afterend', `
    <div class="thd-band" aria-hidden="true">
      <div class="thd-hands"><canvas class="thd-human"></canvas><canvas class="thd-ai"></canvas><i class="thd-hole"></i></div>
      <div class="thd-labels"><span>Human · brain</span><span class="thd-rho">ρ = −.06</span><span>AI · model</span></div>
    </div>`);
  const band = pair.nextElementSibling;
  const [human, ai] = band.querySelectorAll('canvas');
  const img = new Image();
  img.src = '/concepts/assets/hand-human.webp';
  let W, H, tx, ty, lum, lit = false;
  const at = (x, y) => lum[Math.min(H - 1, Math.round(y)) * W + Math.min(W - 1, Math.round(x))];

  const prep = (c) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  // Human: horizontal engraving strokes, weight and lift follow the hand's brightness (as reach-engrave)
  const engrave = (p) => {
    const ctx = prep(human), s = Math.max(2.4, W / 120);
    const ink = ctx.createRadialGradient(tx, ty, 0, tx, ty, W * 0.3);
    ink.addColorStop(0, '#ff5c2a'); ink.addColorStop(0.25, '#ffb79f'); ink.addColorStop(0.6, '#f5f3ef');
    ctx.fillStyle = ink;
    for (let y = s / 2; y < H; y += s) {
      let top = [], bot = [];
      for (let x = 0; x <= W * p + 1; x++) {
        const v = x <= W * p ? at(x, y) : 0;
        if (v) {
          const t = s * (0.08 + 0.18 * v), lift = v * s * 0.35;
          top.push(x, y - lift - t); bot.push(x, y - lift + t);
        } else if (top.length) {
          ctx.beginPath();
          for (let i = 0; i < top.length; i += 2) ctx.lineTo(top[i], top[i + 1]);
          for (let i = bot.length - 2; i >= 0; i -= 2) ctx.lineTo(bot[i], bot[i + 1]);
          ctx.fill();
          top = []; bot = [];
        }
      }
    }
    if (p >= 1) {
      const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, W * 0.06);
      glow.addColorStop(0, 'rgba(255,179,71,.7)'); glow.addColorStop(0.4, 'rgba(255,92,42,.3)'); glow.addColorStop(1, 'rgba(122,26,10,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // AI: the same silhouette as grid cells at the .dg-tokens opacity steps, sweeping wrist to fingertip
  const quantize = (p) => {
    const ctx = prep(ai), g = Math.max(4, Math.round(W / 60)), c = g - Math.max(1, g / 4);
    for (let y = 0; y < H; y += g) {
      for (let x = 0; x < W * p; x += g) {
        const v = at(x + g / 2, y + g / 2);
        if (!v) continue;
        const hot = Math.hypot(x + g / 2 - tx, y + g / 2 - ty) < g * 2.6 || x > W * p - g * 2;
        ctx.fillStyle = hot ? '#ff5c2a' : '#8fcac5';
        ctx.globalAlpha = hot ? 1 : v < 0.33 ? 0.25 : v < 0.66 ? 0.45 : 0.7;
        ctx.beginPath();
        ctx.roundRect(x + (g - c) / 2, y + (g - c) / 2, c, c, Math.min(2, c / 3));
        ctx.fill();
      }
    }
  };

  const draw = (intro) => {
    W = Math.round(human.clientWidth); H = Math.round(W * SRC.h / SRC.w);
    tx = W * SRC.tx / SRC.w; ty = H * SRC.ty / SRC.h;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.drawImage(img, SRC.x, SRC.y, SRC.w, SRC.h, 0, 0, W, H);
    const d = o.getImageData(0, 0, W, H).data;
    lum = new Float32Array(W * H);
    for (let i = 0; i < lum.length; i++) {
      const l = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;
      lum[i] = l > 0.28 ? Math.max(0.01, (l - 0.28) / 0.62) : 0;
    }
    band.classList.add('is-lit');
    if (!intro) return engrave(1), quantize(1);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1000), e = 1 - (1 - p) ** 3;
      engrave(e); quantize(e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  img.decode().then(() => {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      lit = true;
      draw(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    }, { threshold: 0.5 }).observe(band);
    let timer, lastW = innerWidth;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (lit && innerWidth !== lastW) { lastW = innerWidth; draw(false); } }, 200);
    });
  });
}

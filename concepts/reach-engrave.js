// reach-engrave: one hand pose drawn twice below the hero buttons, engraved (human) and gridded (AI), reaching for a spark
const hero = document.querySelector('section#home.hero');
const SRC = { x: 0, y: 150, w: 750, h: 320, tx: 712, ty: 80 }; // crop of hand-human.webp, fingertip in crop coords

if (hero) {
  hero.insertAdjacentHTML('beforeend', `
    <div class="re-stage" aria-hidden="true">
      <figure class="re-hand re-human"><canvas></canvas><figcaption>Human<small>continuous</small></figcaption></figure>
      <span class="re-signal"></span>
      <figure class="re-hand re-ai"><canvas></canvas><figcaption>AI<small>discrete</small></figcaption></figure>
    </div>`);
  const [human, ai] = hero.querySelectorAll('.re-hand canvas');
  const img = new Image();
  img.src = '/concepts/assets/hand-human.webp';
  let W, H, tx, ty, lum;
  const at = (x, y) => lum[Math.min(H - 1, Math.round(y)) * W + Math.min(W - 1, Math.round(x))];

  const prep = (c) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  // Human: horizontal engraving strokes, weight and lift follow the hand's brightness
  const engrave = (p) => {
    const ctx = prep(human), s = Math.max(2.6, W / 120);
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
      const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, W * 0.05);
      glow.addColorStop(0, 'rgba(255,179,71,.7)'); glow.addColorStop(0.4, 'rgba(255,92,42,.3)'); glow.addColorStop(1, 'rgba(122,26,10,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // AI: the same silhouette on the site's grid, cells at the .dg-tokens opacity steps, sweeping wrist to fingertip
  const quantize = (p) => {
    const ctx = prep(ai), g = Math.max(4, Math.round(W / 70)), c = g - Math.max(1, g / 4);
    ctx.strokeStyle = 'rgba(143,202,197,.12)';
    ctx.beginPath();
    for (let x = 0.5; x < W; x += g * 6) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0.5; y < H; y += g * 6) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    const fade = ctx.createRadialGradient(W * 0.6, H * 0.4, 0, W * 0.6, H * 0.4, H * 0.75);
    fade.addColorStop(0, '#000'); fade.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
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
    if (!intro) return engrave(1), quantize(1);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1400), e = 1 - (1 - p) ** 3;
      engrave(e); quantize(e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  img.decode().then(() => {
    draw(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    let timer, lastW = innerWidth;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; draw(false); } }, 200);
    });
  });
}

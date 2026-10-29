// Homepage background A/B test: each page load keeps the lava blobs or gets rising embers, at random.
// The variant goes out with every analytics event so the stats page can compare them. ?bg=embers forces one.
(() => {
  const asked = new URLSearchParams(location.search).get('bg');
  const bg = ['blobs', 'embers'].includes(asked) ? asked : Math.random() < 0.5 ? 'embers' : 'blobs';
  document.documentElement.dataset.bg = bg;
  if (bg !== 'embers') return;

  document.querySelector('.lava-lamp')?.remove();
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;'
    + 'background:radial-gradient(ellipse 80% 45% at 50% 110%,rgba(255,69,0,.22),transparent 70%)';
  document.body.prepend(c);
  const ctx = c.getContext('2d');

  // one pre-drawn glow, stamped per ember: far cheaper than building a gradient every frame
  const glow = document.createElement('canvas');
  glow.width = glow.height = 32;
  const g = glow.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  [[0, 'rgba(255,240,200,1)'], [0.15, 'rgba(255,170,60,.9)'], [0.4, 'rgba(255,90,0,.25)'], [1, 'rgba(255,69,0,0)']].forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);

  // soft glows need no retina pixels: 1x density draws a quarter of the pixels on a phone
  let w = 0, h = 0, mx = -1e4, my = -1e4, lastY = scrollY, boost = 0, last = 0;
  const resize = () => { w = innerWidth; h = innerHeight; c.width = w; c.height = h; };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const spawn = (anywhere) => ({ x: Math.random() * w, y: anywhere ? Math.random() * h : h + 8, r: 0.6 + Math.random() * 1.8, v: 0.25 + Math.random() * 0.7, ph: Math.random() * 6.3 });
  const embers = Array.from({ length: w < 768 ? 45 : 90 }, () => spawn(true));

  // embers drift up, flicker, fade as they rise, scatter from the cursor and speed up while scrolling
  function draw(t) {
    boost = Math.max(boost * 0.9, Math.min(6, Math.abs(scrollY - lastY) / 12));
    lastY = scrollY;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of embers) {
      p.y -= p.v * (1 + boost);
      p.x += Math.sin(t * 0.8 + p.ph) * 0.35;
      const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 14400) { const k = (1 - d2 / 14400) * 2.2 / Math.sqrt(d2 + 1); p.x += dx * k; p.y += dy * k; }
      if (p.y < -10) Object.assign(p, spawn(false));
      ctx.globalAlpha = (0.55 + 0.45 * Math.sin(t * 4 + p.ph * 3)) * Math.min(1, p.y / h + 0.15);
      const s = p.r * 8;
      ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);
    }
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return draw(0);
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (now - last < 33) return; // 30 fps is plenty for slow embers
    last = now;
    draw(now / 1000);
  };
  requestAnimationFrame(tick);
})();

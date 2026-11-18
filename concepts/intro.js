// intro: the opening shot, once per session. ?concept=event-horizon,intro&intro=eye|flare|name (any intro= value replays).
// A black cover goes up at once; a pupil-sized window in it dives open until its ring is the hero's ring (match cut).
const pick = new URLSearchParams(location.search).get('intro');
const kind = pick === 'flare' || pick === 'name' ? pick : 'eye';
const html = document.documentElement;
let ok = false;
try {
  const nav = performance.getEntriesByType('navigation')[0];
  const internal = document.referrer && new URL(document.referrer).origin === location.origin;
  ok = !location.hash && nav?.type !== 'back_forward' && document.visibilityState === 'visible'
    && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData
    && (pick !== null || (!internal && !sessionStorage.fxIntroSeen));
} catch { ok = false; }

const IGN = 'cubic-bezier(.16,1,.3,1)', FALL = 'cubic-bezier(.7,0,.84,0)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SRC = { x: 0, y: 150, w: 750, h: 320, tx: 712, ty: 80 }; // reach-engrave's crop of hand-human.webp

if (ok) {
  html.classList.add('fx-intro');
  const fi = document.createElement('div');
  fi.className = 'fi';
  fi.setAttribute('aria-hidden', 'true');
  fi.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000;animation:fi-failsafe 0s 4.5s forwards';
  document.body.append(fi);
  const born = performance.now();
  const anims = [];
  let done = false, fading = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    fi.remove();
    html.classList.replace('fx-intro', 'fx-intro-done');
    for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(t, skip, true);
  };
  const out = (ms) => {
    if (fading || done) return;
    fading = true;
    fi.animate({ opacity: [1, 0] }, { duration: ms, fill: 'forwards' }).finished.then(cleanup);
  };
  function skip() { if (anims.length) { anims.forEach((a) => a.finish()); out(120); } else cleanup(); }
  for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(t, skip, { capture: true, passive: true });
  setTimeout(cleanup, 4500);

  const img = new Image();
  if (kind === 'eye') img.src = '/concepts/assets/hand-human.webp';
  run().catch(cleanup);

  async function run() {
    // the hero ring must exist and be styled and sized before we measure it
    if (html.dataset.concept.split(' ').includes('event-horizon')) await import('./event-horizon.js');
    const sheets = [...document.querySelectorAll('link[href^="/concepts/"]')]
      .map((l) => l.sheet || new Promise((r) => { l.addEventListener('load', r); l.addEventListener('error', r); }));
    await Promise.race([Promise.all(sheets), wait(400)]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hands = kind === 'eye' && await Promise.race([img.decode().then(() => true, () => false), wait(120)]);
    const eh = document.querySelector('.hero .eh'), dim = eh?.querySelector('.eh-dim');
    if (done || !dim || performance.now() - born > 1500) return cleanup();
    try { sessionStorage.fxIntroSeen = 1; } catch {} // seen only once it really plays

    const W = innerWidth, H = innerHeight, phone = W < 700;
    const { left: cx, top: cy } = eh.getBoundingClientRect();
    const R = (dim.offsetWidth - 80) / 2;
    if (cy < 0 || cy > H) return cleanup();

    // variant: pupil radius p, start point (sx, sy), dive window D0..D1 (ms)
    let p, sx = cx, sy = phone ? Math.round(H * 0.44) : cy, D0, D1, art = '', name;
    if (kind === 'eye') { p = phone ? 6 : 12; D0 = 1150; D1 = phone ? 1700 : 1850; }
    if (kind === 'flare') { p = 6; D0 = 820; D1 = 1350; }
    if (kind === 'name') { p = phone ? 5 : 9; D0 = 900; D1 = 1700; name = nameLayer(W, H, p); sx = name.ox; sy = name.oy; }
    const k = R / p, dx = cx - sx, dy = cy - sy, T = D1;

    if (kind === 'eye') art = eyeArt(phone ? 300 : 560, phone ? 56 : 105, p, !phone);
    if (kind === 'flare') art = `<div class="fi-flare" style="top:${sy}px;transform-origin:${sx}px 50%"></div><div class="fi-point" style="left:${sx}px;top:${sy}px"></div>`;
    fi.innerHTML = `
      <div class="fi-cam" style="transform-origin:${sx}px ${sy}px">
        <svg class="fi-win" width="${W}" height="${H}"><path fill-rule="evenodd" d="M0 0H${W}V${H}H0ZM${sx - p} ${sy}a${p} ${p} 0 1 0 ${2 * p} 0a${p} ${p} 0 1 0 ${-2 * p} 0Z"/></svg>
        ${name ? name.html : ''}${kind === 'eye' ? `<div class="fi-art" style="left:${sx}px;top:${sy}px">${art}</div>` : art}
      </div>
      <div class="fi-ring" style="left:${sx}px;top:${sy}px;--r:${R}px">
        <div class="fi-plug"></div>
        <div class="eh fi-mono"><div class="eh-spin"><div class="eh-ring"></div></div></div>
        <div class="eh fi-gold"><div class="eh-dim"></div><div class="eh-spin"><div class="eh-haze"></div><div class="eh-ring"></div></div><div class="eh-arc"></div></div>
      </div>`;
    if (name) fi.querySelector('.fi-type text').style.fontFamily = name.font;
    fi.style.background = 'transparent';

    const $ = (s) => fi.querySelector(s);
    const play = (el, fr) => {
      if (!el) return;
      if (fr[0][0] > 0) fr.unshift([0, fr[0][1]]);
      if (fr.at(-1)[0] < T) fr.push([T, fr.at(-1)[1]]);
      anims.push(el.animate(fr.map(([t, f, e]) => ({ ...f, offset: t / T, easing: e || IGN })), { duration: T, fill: 'both' }));
    };

    // the dive: log-spaced scale (constant perceived speed) under one ease-in-out, panning to the hero hole
    const cam = [[D0, { transform: 'translate(0px,0px) scale(1)' }]], ring = [[D0, { transform: `translate(0px,0px) scale(${1 / k})` }]];
    for (let i = 1; i <= 16; i++) {
      const u = i / 16, e = u < 0.5 ? 4 * u ** 3 : 1 - (2 - 2 * u) ** 3 / 2, s = k ** e;
      const tr = `translate(${(dx * e).toFixed(2)}px,${(dy * e).toFixed(2)}px)`;
      cam.push([D0 + u * (D1 - D0), { transform: `${tr} scale(${s})` }, 'linear']);
      ring.push([D0 + u * (D1 - D0), { transform: `${tr} scale(${s / k})` }, 'linear']);
    }
    cam[0][2] = ring[0][2] = 'linear';
    play($('.fi-cam'), cam);
    play($('.fi-ring'), ring);
    play($('.fi-plug'), [[D0 + 0.4 * (D1 - D0), { opacity: 1 }], [D0 + 0.65 * (D1 - D0), { opacity: 0 }]]); // late, so the pan never shows the hero ring off-centre
    const mid = (f) => D0 + f * (D1 - D0);

    if (kind === 'eye') {
      play($('.fi-line'), [[60, { transform: 'scaleX(0)', opacity: 1 }], [380, { transform: 'scaleX(1)', opacity: 1 }], [520, { transform: 'scaleX(1)', opacity: 0 }]]);
      play($('.fi-art svg'), [[300, { transform: 'scaleY(0)', opacity: 1 }], [720, { transform: 'scaleY(1)', opacity: 1 }], [mid(0.15), { transform: 'scaleY(1)', opacity: 1 }, 'linear'], [mid(0.65), { transform: 'scaleY(1)', opacity: 0 }]]);
      play($('.fi-iris'), [[850, { transform: 'scale(0)' }], [1150, { transform: 'scale(1)' }]]);
      play($('.fi-mono'), [[300, { opacity: 0 }], [600, { opacity: 1 }], [850, { opacity: 1 }], [1150, { opacity: 0 }]]);
      play($('.fi-gold'), [[850, { opacity: 0 }], [1150, { opacity: 1 }]]);
      if (hands) {
        const hw = phone ? 150 : 280, { human, ai, h, tx, ty } = drawHands(hw, img);
        for (const [c, dir] of [[human, -1], [ai, 1]]) {
          const el = document.createElement('div');
          el.className = 'fi-hand';
          const tipX = dir < 0 ? tx : hw - tx;
          el.style.cssText = `left:${sx + dir * (p + 3) - tipX}px;top:${sy - ty}px;width:${hw}px;height:${h}px;transform-origin:${tipX}px ${ty}px`;
          if (dir > 0) c.style.scale = '-1 1';
          el.append(c);
          fi.append(el);
          play(el, [[380, { transform: `translateX(${dir * 45}%) scale(1)`, opacity: 0 }], [580, { opacity: 1 }], [900, { transform: 'translateX(0%) scale(1)' }],
            [D0, { transform: 'translateX(0%) scale(1)', opacity: 1 }, FALL], [D0 + 300, { transform: `translateX(${dir * 60}vw) scale(3)`, opacity: 0 }]]);
        }
      }
    }
    if (kind === 'flare') {
      play($('.fi-flare'), [[80, { transform: 'scaleX(0)', opacity: 1 }], [480, { transform: 'scaleX(1)', opacity: 1 }, FALL], [820, { transform: 'scaleX(.01)', opacity: 1 }], [860, { transform: 'scaleX(.01)', opacity: 0 }]]);
      play($('.fi-point'), [[480, { transform: 'scale(.4)', opacity: 0 }], [820, { transform: 'scale(1)', opacity: 1 }], [880, { transform: 'scale(1)', opacity: 0 }]]);
      play($('.fi-mono'), [[0, { opacity: 0 }]]);
      play($('.fi-gold'), [[800, { opacity: 0 }], [840, { opacity: 1 }]]);
    }
    if (kind === 'name') {
      play($('.fi-glow'), [[0, { transform: 'rotate(0deg)', opacity: 1 }, 'linear'], [mid(0.3), { transform: 'rotate(40deg)', opacity: 1 }, 'linear'], [mid(0.7), { transform: 'rotate(52deg)', opacity: 0 }]]);
      play($('.fi-glow-gold'), [[0, { opacity: 0 }], [600, { opacity: 1 }]]);
      play($('.fi-mono'), [[0, { opacity: 1 }], [600, { opacity: 0 }]]);
      play($('.fi-gold'), [[0, { opacity: 0 }], [600, { opacity: 1 }]]);
    }
    Promise.all(anims.map((a) => a.finished)).then(() => out(150), () => {});
  }
}

// the eye: almond lids, mono iris fibres with a gold copy revealed from the pupil, optional HUD rings
function eyeArt(w, ri, p, hud) {
  const h = Math.ceil(ri * 3.4), f = (n) => n.toFixed(1);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pt = (r, a) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
  const fib = ['', '', ''];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * 2 * Math.PI + rnd() * 0.03, r0 = p + 2, r1 = ri * (0.55 + 0.45 * rnd()), am = a + (rnd() - 0.5) * 0.14;
    fib[i % 3] += `M${pt(r0, a)}Q${pt((r0 + r1) / 2, am)} ${pt(r1, a)}`;
  }
  let zig = 'M';
  for (let i = 0; i <= 40; i++) zig += `${pt(ri * (i % 2 ? 0.42 : 0.36), (i / 40) * 2 * Math.PI)} `;
  const almond = `M${-w / 2} 0Q0 ${-1.75 * ri} ${w / 2} 0Q0 ${1.6 * ri} ${-w / 2} 0Z`;
  const fibres = (op) => fib.map((d, i) => `<path d="${d}" stroke-opacity="${op[i]}"/>`).join('') + `<path d="${zig}Z" stroke-opacity="${op[1]}"/>`;
  return `<div class="fi-line" style="left:${-w / 2}px;width:${w}px"></div>
    <svg width="${w}" height="${h}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" style="left:${-w / 2}px;top:${-h / 2}px">
      <defs>
        <clipPath id="fiAlmond"><path d="${almond}"/></clipPath>
        <radialGradient id="fiGold" gradientUnits="userSpaceOnUse" r="${ri}"><stop offset=".2" stop-color="#fff4dc"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5c2a"/></radialGradient>
        <radialGradient id="fiSoft"><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <mask id="fiReveal" maskUnits="userSpaceOnUse" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"><circle class="fi-iris" r="${ri * 1.1}" fill="url(#fiSoft)"/></mask>
        <linearGradient id="fiLid"><stop offset="0" stop-color="#d8d4cc" stop-opacity="0"/><stop offset=".22" stop-color="#d8d4cc"/><stop offset=".78" stop-color="#d8d4cc"/><stop offset="1" stop-color="#d8d4cc" stop-opacity="0"/></linearGradient>
      </defs>
      ${hud ? `<g stroke="#d8d4cc" stroke-opacity=".1" fill="none"><circle r="${ri * 1.25}"/><circle r="${ri * 1.6}"/><path d="M0 ${-ri * 1.6}v-6M0 ${ri * 1.6}v6M${-ri * 1.6} 0h-6M${ri * 1.6} 0h6"/></g>` : ''}
      <g clip-path="url(#fiAlmond)" fill="none" stroke-width=".8">
        <g stroke="#d8d4cc">${fibres([0.25, 0.42, 0.6])}</g>
        <g stroke="url(#fiGold)" mask="url(#fiReveal)">${fibres([0.55, 0.75, 0.95])}</g>
        <circle r="${ri}" stroke="rgba(245,243,239,.16)" stroke-width="2"/>
      </g>
      <g fill="none" stroke="url(#fiLid)"><path d="M${-w / 2} 0Q0 ${-1.75 * ri} ${w / 2} 0" stroke-opacity=".7"/><path d="M${-w / 2} 0Q0 ${1.6 * ri} ${w / 2} 0" stroke-opacity=".4"/></g>
    </svg>`;
}

// the name as a window onto the ring's light; the tiny hole sits in the counter of the "o" of Mora
function nameLayer(W, H, p) {
  const font = getComputedStyle(document.querySelector('.hero h1') || html).fontFamily;
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden';
  probe.innerHTML = '<text font-weight="700" letter-spacing="-0.05em" text-anchor="middle">Daniel Mora</text>';
  const t = probe.firstChild;
  t.style.fontFamily = font;
  document.body.append(probe);
  let fs = Math.min(240, W * 0.17);
  t.setAttribute('font-size', fs);
  const len = t.getComputedTextLength();
  if (len > W * 0.92) t.setAttribute('font-size', (fs *= (W * 0.92) / len));
  const y = Math.round(H / 2 + fs * 0.35);
  t.setAttribute('x', W / 2);
  t.setAttribute('y', y);
  const o = t.getExtentOfChar(8);
  probe.remove();
  const ox = o.x + o.width / 2, oy = y - fs * 0.27, D = Math.ceil(Math.hypot(W, H));
  return {
    font, ox, oy,
    html: `<div class="fi-glow" style="left:${ox - D}px;top:${oy - D}px;width:${2 * D}px;height:${2 * D}px;--p:${p}px"><div></div><div class="fi-glow-gold"></div></div>
      <svg class="fi-type" width="${W}" height="${H}"><mask id="fiName"><rect width="${W}" height="${H}" fill="#fff"/>
        <text x="${W / 2}" y="${y}" font-size="${fs}" font-weight="700" letter-spacing="-0.05em" text-anchor="middle">Daniel Mora</text>
        <circle cx="${ox}" cy="${oy}" r="${p}"/></mask><rect width="${W}" height="${H}" mask="url(#fiName)"/></svg>`,
  };
}

// reach-engrave's two hands at intro size, end state only: engraved Human, gridded AI (mirrored by CSS)
function drawHands(W, img) {
  const H = Math.round((W * SRC.h) / SRC.w), tx = (W * SRC.tx) / SRC.w, ty = (H * SRC.ty) / SRC.h;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const o = off.getContext('2d', { willReadFrequently: true });
  o.drawImage(img, SRC.x, SRC.y, SRC.w, SRC.h, 0, 0, W, H);
  const d = o.getImageData(0, 0, W, H), lum = new Float32Array(W * H);
  for (let i = 0; i < lum.length; i++) {
    const l = (0.3 * d.data[i * 4] + 0.59 * d.data[i * 4 + 1] + 0.11 * d.data[i * 4 + 2]) / 255;
    lum[i] = l > 0.28 ? Math.max(0.01, (l - 0.28) / 0.62) : 0;
    d.data.set([0, 0, 0, lum[i] ? 255 : 0], i * 4); // black silhouette: the hand hides the iris it crosses
  }
  o.putImageData(d, 0, 0);
  const at = (x, y) => lum[Math.min(H - 1, Math.round(y)) * W + Math.min(W - 1, Math.round(x))];
  const make = () => {
    const c = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.drawImage(off, 0, 0);
    return [c, ctx];
  };

  const [human, hc] = make(), s = Math.max(2.4, W / 120);
  const ink = hc.createRadialGradient(tx, ty, 0, tx, ty, W * 0.3);
  ink.addColorStop(0, '#ff5c2a'); ink.addColorStop(0.25, '#ffb79f'); ink.addColorStop(0.6, '#f5f3ef');
  hc.fillStyle = ink;
  for (let y = s / 2; y < H; y += s) {
    let top = [], bot = [];
    for (let x = 0; x <= W + 1; x++) {
      const v = x < W ? at(x, y) : 0;
      if (v) {
        const t = s * (0.08 + 0.18 * v), lift = v * s * 0.35;
        top.push(x, y - lift - t); bot.push(x, y - lift + t);
      } else if (top.length) {
        hc.beginPath();
        for (let i = 0; i < top.length; i += 2) hc.lineTo(top[i], top[i + 1]);
        for (let i = bot.length - 2; i >= 0; i -= 2) hc.lineTo(bot[i], bot[i + 1]);
        hc.fill();
        top = []; bot = [];
      }
    }
  }

  const [ai, ac] = make(), g = Math.max(3, W / 50), c = g - Math.max(1, g / 4);
  for (let y = 0; y < H; y += g) {
    for (let x = 0; x < W; x += g) {
      const v = at(x + g / 2, y + g / 2);
      if (!v) continue;
      const hot = Math.hypot(x + g / 2 - tx, y + g / 2 - ty) < g * 2.6;
      ac.fillStyle = hot ? '#ff5c2a' : '#8fcac5';
      ac.globalAlpha = hot ? 1 : v < 0.33 ? 0.25 : v < 0.66 ? 0.45 : 0.7;
      ac.beginPath();
      ac.roundRect(x + (g - c) / 2, y + (g - c) / 2, c, c, Math.min(2, c / 3));
      ac.fill();
    }
  }

  // both fingertips catch the pupil's light
  for (const ctx of [hc, ac]) {
    const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(6, W * 0.05));
    glow.addColorStop(0, 'rgba(255,179,71,.7)'); glow.addColorStop(0.4, 'rgba(255,92,42,.3)'); glow.addColorStop(1, 'rgba(122,26,10,0)');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
  return { human, ai, h: H, tx, ty };
}

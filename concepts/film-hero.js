// film-hero: an Interstellar black hole (canvas, drawn once per size) above the title card,
// a fast typed tagline, and "See flagship work" flying the camera into the hole.
const html = document.documentElement;
const hero = document.querySelector('#home.hero');
const content = hero?.querySelector('.hero-content');

if (hero && content) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const store = (k, v) => { try { return v ? sessionStorage.setItem(k, v) : sessionStorage.getItem(k); } catch { return null; } };
  const navType = performance.getEntriesByType('navigation')[0]?.type;
  // end state at once: reduced motion, hash, back/forward, or already seen this session
  const calm = reduce.matches || !!location.hash || navType === 'back_forward' || !!store('fh-seen');
  // the intro (another concept) owns the arrival; we only finish the tagline after its cut
  const intro = html.classList.contains('fx-intro') || /(^| )(film-)?intro( |$)/.test(html.dataset.concept || '');
  if (!calm) store('fh-seen', '1');

  const art = document.createElement('div');
  art.className = 'fh-art';
  art.setAttribute('aria-hidden', 'true');
  // .eh/.eh-dim: the anchor intro.js measures for its match cut (centre, and radius = (width - 80) / 2)
  art.innerHTML = '<canvas></canvas><div class="fh-shimmer"></div><div class="eh"><div class="eh-dim"></div></div>';
  hero.prepend(art);
  const cv = art.firstChild;

  // ---- the hole: shadow, photon ring, edge-on disk (back half behind, front half across), lensed arcs
  function paint(r) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(10 * r * dpr);
    cv.height = Math.round(3.1 * r * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 5 * r * dpr, 1.7 * r * dpr);
    c.rotate(-0.07);
    let s = 11;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const heat = (u) => (u < 0.1 ? '255,244,220' : u < 0.32 ? '255,179,71' : u < 0.68 ? '255,92,42' : '122,26,10');
    const dop = (t) => 0.25 + 0.75 * (1 - Math.cos(t)) / 2; // approaching side (left) is brighter
    const glow = (k, r1, stops) => {
      c.save();
      c.scale(1, k);
      const g = c.createRadialGradient(0, 0, r * 0.9, 0, 0, r1);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      c.fillStyle = g;
      c.fillRect(-r1, -r1, 2 * r1, 2 * r1);
      c.restore();
    };
    // smooth half-annulus under the streaks so the disk reads as matter, not Saturn's rings
    const band = (k, r0, r1, below, stops) => {
      c.save();
      c.beginPath();
      c.rect(-5 * r, below ? 0 : -5 * r, 10 * r, 5 * r);
      c.clip();
      c.scale(1, k);
      const g = c.createRadialGradient(0, 0, r0, 0, 0, r1);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, r1, 0, 2 * Math.PI);
      c.arc(0, 0, r0, 0, 2 * Math.PI, true);
      c.fill();
      c.restore();
    };
    const disk = [[0, 'rgba(255,244,220,.5)'], [0.12, 'rgba(255,179,71,.32)'], [0.4, 'rgba(255,92,42,.14)'], [0.75, 'rgba(122,26,10,.06)'], [1, 'rgba(122,26,10,0)']];
    const streaks = (n, r0, r1, k, a0, a1, amax) => {
      for (let i = 0; i < n; i++) {
        const u = rnd() ** 1.7; // denser and hotter near the inner edge
        const rho = r0 + (r1 - r0) * u;
        const t0 = a0 + (a1 - a0) * rnd();
        const t1 = Math.min(a1, t0 + 0.3 + rnd() * 1.8);
        const a = amax * (1 - u) ** 1.1 * (0.45 + 0.55 * rnd());
        c.lineWidth = 0.5 + rnd() * 1.2;
        for (let t = t0; t < t1; t += 0.12) {
          c.strokeStyle = `rgba(${heat(u)},${(a * dop(t + 0.06)).toFixed(3)})`;
          c.beginPath();
          c.ellipse(0, 0, rho, rho * k, 0, t, Math.min(t1, t + 0.13));
          c.stroke();
        }
      }
    };
    c.globalCompositeOperation = 'lighter';
    glow(0.2, 4.8 * r, [[0, 'rgba(255,179,71,.2)'], [0.35, 'rgba(255,92,42,.09)'], [0.7, 'rgba(122,26,10,.05)'], [1, 'rgba(122,26,10,0)']]);
    glow(1, 2.1 * r, [[0, 'rgba(255,92,42,.14)'], [0.5, 'rgba(122,26,10,.06)'], [1, 'rgba(122,26,10,0)']]);
    band(0.16, 1.3 * r, 4.6 * r, false, disk);
    streaks(220, 1.3 * r, 4.6 * r, 0.16, Math.PI, 2 * Math.PI, 0.5); // disk, far half
    band(0.9, 1.02 * r, 1.7 * r, false, [[0, 'rgba(255,244,220,.85)'], [0.12, 'rgba(255,179,71,.55)'], [0.45, 'rgba(255,92,42,.24)'], [0.8, 'rgba(122,26,10,.08)'], [1, 'rgba(122,26,10,0)']]);
    streaks(220, 1.03 * r, 1.7 * r, 0.9, Math.PI - 0.06, 2 * Math.PI + 0.06, 0.75); // lensed arc over the top
    band(0.97, 1.02 * r, 1.2 * r, true, [[0, 'rgba(255,179,71,.4)'], [0.4, 'rgba(255,92,42,.15)'], [1, 'rgba(122,26,10,0)']]);
    streaks(40, 1.03 * r, 1.16 * r, 0.97, 0.2, Math.PI - 0.2, 0.4); // thin lensed arc underneath
    c.lineWidth = 1.3;
    for (let t = 0; t < 2 * Math.PI; t += 0.07) { // photon ring
      c.strokeStyle = `rgba(255,${Math.round(150 + 94 * dop(t))},${Math.round(60 + 160 * dop(t))},${(0.95 * dop(t)).toFixed(3)})`;
      c.beginPath();
      c.arc(0, 0, r * 1.012, t, t + 0.075);
      c.stroke();
    }
    glow(0.035, 4.8 * r, [[0, 'rgba(255,244,220,.5)'], [0.3, 'rgba(255,179,71,.22)'], [0.7, 'rgba(255,92,42,.06)'], [1, 'rgba(255,92,42,0)']]); // mid-plane line
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, 0, r, 0, 2 * Math.PI);
    c.fill();
    c.globalCompositeOperation = 'lighter';
    band(0.16, 1.3 * r, 4.6 * r, true, disk);
    streaks(220, 1.3 * r, 4.6 * r, 0.16, 0, Math.PI, 0.7); // disk, near half crossing the shadow
  }

  // size from CSS (--fh-r); expose the hole for the intro's match cut as page px
  let lastR = 0;
  new ResizeObserver(() => {
    const r = Math.round(art.clientHeight / 3.1);
    const b = art.getBoundingClientRect();
    hero.style.setProperty('--hole-x', `${Math.round(b.left + b.width / 2 + scrollX)}px`);
    hero.style.setProperty('--hole-y', `${Math.round(b.top + 1.7 * r + scrollY)}px`);
    hero.style.setProperty('--hole-r', `${r}px`);
    if (r && r !== lastR) { lastR = r; paint(r); }
  }).observe(hero);

  // own entrance only when nothing else arrives: mono hole dollies in, gold irises out from the bright edge
  if (!calm && !intro) {
    requestAnimationFrame(() => {
      const mono = cv.cloneNode();
      mono.className = 'fh-mono';
      mono.getContext('2d').drawImage(cv, 0, 0);
      cv.after(mono);
      art.classList.add('fh-ignite');
      mono.addEventListener('animationend', (e) => e.animationName === 'fh-iris' && mono.remove());
    });
  }

  // ambient shimmer pauses off-screen
  new IntersectionObserver(([e]) => hero.classList.toggle('fh-off', !e.isIntersecting)).observe(hero);

  // desktop with a fine pointer: the hole leans a few px toward the cursor
  const lean = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 700px) and (prefers-reduced-motion: no-preference)');
  let frame = 0;
  addEventListener('pointermove', (e) => {
    if (!lean.matches || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const k = (v) => (Math.max(-1, Math.min(1, v)) * 6).toFixed(1) + 'px';
      art.style.setProperty('--lx', k((e.clientX / innerWidth) * 2 - 1));
      art.style.setProperty('--ly', k((e.clientY / innerHeight) * 2 - 1));
    });
  }, { passive: true });

  // ---- tagline: main.js types it at 35 ms/char with reflow; replace it with a reserved line that types in <= 1.5 s
  const tag = content.querySelector('.tagline');
  const text = tag?.dataset.text || 'I build software that holds up in the real world, from web products to machine-learning systems.';
  if (tag && text.startsWith(tag.textContent)) {
    const line = tag.cloneNode(false);
    tag.replaceWith(line); // main.js keeps appending to the detached node, harmlessly
    if (calm) line.textContent = text;
    else {
      line.innerHTML = '<span class="fh-sr"></span><span aria-hidden="true"><span class="fh-typed"></span><i class="fh-caret"></i><span class="fh-rest"></span></span>';
      const [sr, typed, rest] = ['.fh-sr', '.fh-typed', '.fh-rest'].map((s) => line.querySelector(s));
      sr.textContent = rest.textContent = text;
      let i = 0;
      let timer = 0;
      const step = Math.min(22, (intro ? 1000 : 1500) / text.length);
      const show = (n) => { typed.textContent = text.slice(0, n); rest.textContent = text.slice(n); };
      const finish = () => { clearTimeout(timer); show(text.length); line.classList.add('fh-done'); off(); };
      const tick = () => {
        show(++i);
        if (i >= text.length) return finish();
        timer = setTimeout(tick, step + (text[i - 1] === ',' ? 140 : 0));
      };
      const skip = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
      const off = () => skip.forEach((t) => removeEventListener(t, finish));
      skip.forEach((t) => addEventListener(t, finish, { passive: true }));
      if (!intro) timer = setTimeout(tick, 350);
      else {
        // start on the intro's cut (fx-intro-done), or right away if the intro decided not to play
        const go = () => { mo.disconnect(); clearTimeout(timer); if (i === 0) tick(); };
        const mo = new MutationObserver(() => html.classList.contains('fx-intro-done') && go());
        mo.observe(html, { attributes: true, attributeFilter: ['class'] });
        timer = setTimeout(() => html.classList.contains('fx-intro') || go(), 600);
      }
    }
  }

  // ---- bottom credit line: the three flagship works (titles as on their cards)
  const credits = document.createElement('p');
  credits.className = 'fh-credits';
  credits.innerHTML = '<a href="/jepa-transformer.html">JEPA Transformer</a> · <a href="/thesis.html">Brain–LLM Feature Correspondence</a> · <a href="/tc-acc.html">TC_ACC Documentary Studio</a>';
  hero.append(credits);

  // ---- "See flagship work": fall into the hole, the work irises open from the same point
  addEventListener('click', (e) => {
    const a = e.target.closest?.('#home .primary-btn[href^="#"]');
    const target = a && document.querySelector(a.hash);
    if (!target || !document.startViewTransition || reduce.matches || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // main.js would smooth-scroll instead
    const b = art.getBoundingClientRect();
    const r = lastR;
    // aim just above the disk band, inside the shadow; fall back to the button if the hole is off-screen
    let x = b.left + b.width / 2;
    let y = b.top + 1.35 * r;
    if (y < 0) { const p = a.getBoundingClientRect(); x = p.left + p.width / 2; y = p.top + p.height / 2; }
    html.style.setProperty('--fh-vx', `${Math.round(x)}px`);
    html.style.setProperty('--fh-vy', `${Math.round(y)}px`);
    html.classList.add('fh-flying');
    const vt = document.startViewTransition(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
    vt.ready.catch(() => {}); // aborted (e.g. tab hidden): the jump still happens
    vt.finished.finally(() => {
      html.classList.remove('fh-flying');
      target.dispatchEvent(new CustomEvent('fx:arrived', { bubbles: true }));
    });
  }, true);
}

// Loads the site's "film" design (concepts/*.css + .js). ?concept=a,b loads other prototypes; ?concept= shows the plain site.
(() => {
  const param = new URLSearchParams(location.search).get('concept');
  const name = param ?? 'film';
  if (!/^[a-z0-9-]+(,[a-z0-9-]+)*$/.test(name)) return;
  // "film" = the chosen designs for whichever page this is (the page designs share class names, so never mix them)
  const p = location.pathname;
  const film = p.includes('thesis') ? ['film-thesis', 'film-frame']
    : p.includes('jepa') ? ['film-jepa', 'film-frame']
    : p.includes('tc-acc') ? ['film-tcacc', 'film-frame']
    : document.title.startsWith('Page not found') ? ['fade-to-black', 'film-pages'] // the host serves 404.html at any missing path
    : /personal|privacy|terms/.test(p) ? ['film-pages', 'film-frame']
    : ['event-horizon', 'film-middle', 'film-flagship', 'film-frame', 'fade-to-black', 'intro'];
  const names = name.split(',').flatMap((n) => (n === 'film' ? film : [n]));
  document.documentElement.dataset.concept = names.join(' ');
  // hide the page until the design's CSS and scripts are in, so the plain site never shows and then rebuilds
  const root = document.documentElement.style;
  root.visibility = 'hidden';
  let shown = false;
  const show = () => { if (!shown) { shown = true; root.visibility = ''; setTimeout(watch, 1000); } };
  setTimeout(show, 3000);
  let pending = names.length * 2;
  const done = () => { if (!--pending) show(); };
  for (const n of names) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `/concepts/${n}.css`;
    css.onload = css.onerror = done;
    document.head.append(css);
    const js = document.createElement('script');
    js.type = 'module';
    js.src = `/concepts/${n}.js`;
    js.onload = done;
    js.onerror = () => { js.remove(); done(); };
    document.body.append(js);
  }
  // slow hardware: if frames drop, freeze the endless decorative loops (ring spin, orbits, lava) rather than stutter
  function watch() {
    if (document.documentElement.classList.contains('fx-intro')) return setTimeout(watch, 500); // the intro's own frames don't count
    let n = 0, slow = 0, last = performance.now();
    requestAnimationFrame(function f() {
      const t = performance.now(); // the rAF timestamp hides dropped frames in Chrome
      if (t - last > 34) slow++;
      last = t;
      if (++n < 120) return requestAnimationFrame(f);
      if (slow < 30 || document.hidden) return;
      document.documentElement.classList.add('fx-lite');
      const freeze = () => document.getAnimations().forEach((a) => a.effect?.getTiming().iterations === Infinity && a.pause());
      freeze();
      setInterval(freeze, 2000);
    });
  }
  // keep a hand-picked concept when following links between pages
  if (param) document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/"]');
    if (!a) return;
    const url = new URL(a.href);
    if (!url.searchParams.has('concept')) { url.searchParams.set('concept', param); a.href = url.href; }
  });
})();

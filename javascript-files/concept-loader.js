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
  // hide the page until the design's CSS is in, so the plain site never flashes first
  const root = document.documentElement.style;
  root.visibility = 'hidden';
  const show = () => { root.visibility = ''; };
  setTimeout(show, 2500);
  let pending = names.length;
  for (const n of names) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `/concepts/${n}.css`;
    css.onload = css.onerror = () => { if (!--pending) show(); };
    document.head.append(css);
    const js = document.createElement('script');
    js.type = 'module';
    js.src = `/concepts/${n}.js`;
    js.onerror = () => js.remove();
    document.body.append(js);
  }
  // keep a hand-picked concept when following links between pages
  if (param) document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/"]');
    if (!a) return;
    const url = new URL(a.href);
    if (!url.searchParams.has('concept')) { url.searchParams.set('concept', param); a.href = url.href; }
  });
})();

// engrave demo: the opening's engraved, generative line-art language across the site. ?concept=film,engrave
// Each area module lives in its own concepts/engrave-<area>.css/js; a missing one is skipped.
const p = location.pathname;
const areas = p.includes('thesis') ? ['thesis']
  : p.includes('jepa') ? []
  : p.includes('tc-acc') ? ['tcacc']
  : p.includes('personal') ? ['pages']
  : document.title.startsWith('Page not found') ? []
  : /privacy|terms/.test(p) ? []
  : ['home-work']; // kept: the pieces Daniel picked (flagship JEPA + thesis, model side, gym/chess/markets, the TC_ACC reel)
for (const a of areas) {
  const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `/concepts/engrave-${a}.css` });
  css.onerror = () => css.remove();
  document.head.append(css);
  import(`./engrave-${a}.js`).catch((e) => console.warn(`engrave-${a}`, e));
}

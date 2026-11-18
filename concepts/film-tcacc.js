// film-tcacc: tc-acc.html as the film about the film. Title card, screening room,
// edit timeline (26 production stages + 2 Showrunner review gates = 28), disclosure
// tracks, end credits, [fade to black]. Every label/number comes from tc-acc.html or
// the homepage .pipeline-strip (stage counts).
const main = document.querySelector('main.case-page');
if (main) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const once = (el, fn, threshold = 0.15) => {
    if (still) return fn();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { threshold });
    io.observe(el);
  };
  const root = document.documentElement;

  // ---- acts: group the flat page into sections at each h2; credits move to the end
  const acts = [];
  let act = null;
  for (const el of [...main.children]) {
    if (el.tagName === 'H2') { act = make('section', 'tc-act'); el.before(act); acts.push(act); }
    if (act && !el.matches('.case-links')) act.append(el);
  }
  const techAct = $('.provider-list', main)?.closest('.tc-act');
  $('.disclosure', main)?.closest('.tc-act')?.after(techAct);
  acts.forEach((a) => once(a, () => a.classList.add('is-lit')));

  // ---- title card: kicker becomes a corner credit; stat tiles become a running-time readout
  const kicker = $('.case-kicker', main);
  const title = make('header', 'tc-title');
  const bar = make('div', 'tc-title-bar');
  kicker.textContent = 'Agentic systems · case study';
  bar.append(kicker, make('span', '', 'Daniel Mora'));
  const text = make('div', 'tc-title-text');
  const h1 = $('h1', main);
  h1.before(title);
  text.append(h1, $('.case-lede', main));
  const readout = $('.stat-row', main);
  readout.setAttribute('aria-label', 'Running time and scope');
  $$('.stat', readout).forEach((s, i) => s.style.setProperty('--i', i));
  $$('.stat .l', readout).forEach((l) => { if (l.textContent === 'Review gates') l.textContent = 'Showrunner review gates'; });
  title.append(bar, text, readout);

  // ---- cold open: the stills cropped to scope, credits above and below (static, so nothing delays the screening room)
  const fig = $('.tcacc-case-image', main);
  if (fig) {
    const img = $('img', fig), cap = $('figcaption', fig);
    const [credit, logline] = cap.textContent.split('·').map((s) => s.trim());
    const top = make('div', 'tc-lb');
    top.append(make('span', '', credit), make('span', '', 'TC_ACC'));
    img.before(top);
    cap.textContent = logline.charAt(0).toUpperCase() + logline.slice(1);
    cap.className = 'tc-lb tc-lb-bottom';
  }

  // ---- screening room: posters in colour at once, runtime bars on a shared scale, house lights
  const eps = $$('.episode', main);
  const secs = eps.map((e) => {
    const [, m, s] = $('.episode-meta', e).textContent.match(/(\d+):(\d+)/);
    return +m * 60 + +s;
  });
  const longest = Math.max(...secs);
  const dim = make('div', 'tc-dim');
  dim.setAttribute('aria-hidden', 'true');
  document.body.append(dim);
  let screening = null;
  const lightsUp = () => { root.classList.remove('tc-lights-down'); screening?.classList.remove('is-screening'); screening = null; };
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting && e.target === screening) lightsUp(); }), { threshold: 0.35 });
  eps.forEach((ep, i) => {
    ep.style.setProperty('--rt', secs[i] / longest);
    const video = $('video', ep);
    seen.observe(ep);
    video.addEventListener('play', () => {
      lightsUp();
      screening = ep;
      ep.classList.add('is-screening', 'is-played');
      root.classList.add('tc-lights-down');
    });
    video.addEventListener('pause', () => { if (screening === ep) lightsUp(); });
    video.addEventListener('ended', () => { if (screening === ep) lightsUp(); });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') lightsUp(); });

  // ---- edit timeline: clip widths = published stage counts; gates are stages 27-28
  const STAGES = { Research: 5, Story: 4, Assets: 7, Animation: 2, Publishing: 8 }; // index.html .pipeline-strip
  const pipe = $('.pipeline', main);
  if (pipe) {
    const wedges = '<svg class="tc-wedge" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true"><path class="h" d="M0 0L5 5L0 10ZM10 0L5 5L10 10Z"/><path class="v" d="M0 0L5 5L10 0ZM0 10L5 5L10 10Z"/></svg>';
    let gate = 27;
    const ol = make('ol', 'tc-tl');
    ol.setAttribute('aria-label', 'TC_ACC production pipeline');
    const cols = [];
    for (const row of pipe.children) {
      const li = make('li', '');
      li.tabIndex = 0;
      if (row.classList.contains('gate')) {
        li.className = 'tc-gate';
        li.innerHTML = `${wedges}<span class="tc-gl"><b>Showrunner review gate</b><span class="tc-n">Stage ${gate++}</span></span>`;
        cols.push('var(--gw)');
      } else {
        const name = $('.name', row).textContent, n = STAGES[name];
        li.className = 'tc-clip';
        li.style.setProperty('--n', n);
        li.innerHTML = `<b>${name}</b><span class="tc-n">${n} stages</span><span class="tc-what">${$('.what', row).textContent}</span>`;
        cols.push(`minmax(4.75rem, ${n}fr)`);
      }
      ol.append(li);
    }
    ol.style.setProperty('--cols', cols.join(' '));
    const last = eps.at(-1);
    const intro = pipe.previousElementSibling;
    if (intro?.tagName === 'P') intro.textContent = intro.textContent.replace('independent review gates', 'Showrunner review gates');
    const mon = make('div', 'tc-mon', `<div class="tc-mon-card"><b>${$('.name', pipe).textContent}</b><span>${$('.what', pipe).textContent}</span></div><div class="tc-mon-gate"><b>Showrunner review gate</b><span></span></div><img alt="" src="${$('video', last).getAttribute('poster')}"><p class="tc-mon-credit">${$('h3', last).textContent} · ${$('.episode-meta', last).textContent}</p>`);
    mon.setAttribute('aria-hidden', 'true');
    const track = make('div', 'tc-track');
    const ph = make('div', 'tc-ph');
    ph.setAttribute('aria-hidden', 'true');
    track.append(ol, ph);
    pipe.before(mon, track);
    pipe.hidden = true;

    const lis = $$('li', ol);
    const vertical = () => matchMedia('(max-width: 1179px)').matches;
    const show = (i) => {
      lis.forEach((li, j) => { li.classList.toggle('is-on', j === i); li.classList.toggle('is-past', j < i); });
      const li = lis[i];
      mon.classList.toggle('is-dip', li.classList.contains('tc-gate'));
      if (li.classList.contains('tc-gate')) $('.tc-mon-gate span', mon).textContent = $('.tc-n', li).textContent;
      else {
        $('.tc-mon-card b', mon).textContent = $('b', li).textContent;
        $('.tc-mon-card span', mon).textContent = $('.tc-what', li).textContent;
      }
    };
    const place = (px) => { ph.style.transform = vertical() ? `translateY(${px}px)` : `translateX(${px}px)`; };
    const end = () => {
      lis.forEach((li) => { li.classList.remove('is-on'); li.classList.add('is-past'); });
      mon.classList.remove('is-dip');
      mon.classList.add('is-end');
      track.classList.add('is-parked');
      ph.style.transform = '';
    };
    let raf = 0;
    const sweep = () => {
      const v = vertical();
      const segs = lis.map((li) => ({
        a: v ? li.offsetTop : li.offsetLeft,
        len: v ? li.offsetHeight : li.offsetWidth,
        ms: li.classList.contains('tc-gate') ? 700 : +li.style.getPropertyValue('--n') * (v ? 85 : 115),
      }));
      const total = segs.reduce((t, s) => t + s.ms, 0);
      let t0 = 0, cur = -1;
      track.classList.add('is-running');
      const tick = (now) => {
        t0 ||= now;
        let t = now - t0;
        if (t >= total) { track.classList.remove('is-running'); return end(); }
        let i = 0;
        while (t > segs[i].ms) t -= segs[i++].ms;
        if (i !== cur) show(cur = i);
        place(segs[i].a + segs[i].len * (t / segs[i].ms));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const seek = (li) => {
      cancelAnimationFrame(raf);
      track.classList.remove('is-running', 'is-parked');
      mon.classList.remove('is-end');
      show(lis.indexOf(li));
      place(vertical() ? li.offsetTop + li.offsetHeight / 2 : li.offsetLeft + li.offsetWidth / 2);
    };
    lis.forEach((li) => li.addEventListener('click', () => seek(li)));
    ol.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const i = lis.indexOf(document.activeElement);
      if (!step || i < 0 || !lis[i + step]) return;
      e.preventDefault();
      lis[i + step].focus();
      seek(lis[i + step]);
    });
    if (still) end(); else once(track, sweep, 0.4);
    // scrolled away mid-sweep: stop the loop and park at the end
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && track.classList.contains('is-running')) { cancelAnimationFrame(raf); track.classList.remove('is-running'); end(); }
    }).observe(track);
  }

  // ---- disclosure as tracks: what the public repo carries, what is offline (verbatim lists)
  const disc = $('.disclosure', main);
  if (disc) {
    const tracks = [
      ['Included', 'in', ['Selected modules', 'Tests', 'Redacted configuration structure', 'Explanatory docs']],
      ['Omitted', 'off', ['The entry point', 'Dependency manifest', 'Environment template', 'Most production modules']],
      ['Intentionally withheld', 'off', ['Prompts', 'Tuned configuration values', 'Production orchestration', 'Resume and reuse machinery', 'Provider integrations', 'Research/search logic', 'The brand and animation system', 'Most of the TypeScript renderer and agent implementation']],
    ];
    const box = make('div', 'tc-disc', tracks.map(([h, k, items]) =>
      `<div class="tc-trk" data-k="${k}"><p class="tc-trk-h">${h}</p><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join(''));
    disc.before(box);
    $('p', disc).hidden = true;
    once(box, () => box.classList.add('is-lit'), 0.3);
  }

  // ---- end credits for the stack (roles are the page's own "for the ..." phrases)
  const stack = $('.stack-line', main), providers = $('.provider-list', main);
  if (stack && providers) {
    const credits = [
      ['Pipeline', 'Python 3.12'], ['Rendering', 'TypeScript'], ['Public architecture', 'LangGraph, Pydantic'],
      ['Video', 'Remotion, ffmpeg'], ['Published tests', 'pytest'],
      ['Model and voice providers', 'OpenAI, Gemini, Qwen, ElevenLabs, Fish Audio'],
    ];
    const dl = make('dl', 'tc-credits', credits.map(([r, n], i) => `<div style="--i:${i}"><dt>${r}</dt><dd>${n}</dd></div>`).join(''));
    stack.before(dl);
    [stack, providers.previousElementSibling, providers].forEach((el) => { el.hidden = true; });
    providers.nextElementSibling?.classList.add('tc-credits-note');
  }

  // ---- fade to black (skipped when the frame concept already owns the footer end card)
  if (!/(^| )film-frame( |$)/.test(root.dataset.concept)) {
    const ftb = make('p', 'tc-ftb', '[fade to black]');
    ftb.setAttribute('aria-hidden', 'true');
    $('.case-links', main)?.after(ftb);
    once(ftb, () => ftb.classList.add('is-lit'), 0.5);
  }
}

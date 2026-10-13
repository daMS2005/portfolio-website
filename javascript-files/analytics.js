// Cookieless analytics: rich session data, zero device storage.
// A session id lives in a JS variable for the life of the tab - it is never
// written to cookies/localStorage, so no consent banner is required.
(function () {
  const sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const start = Date.now();
  const params = new URLSearchParams(location.search);

  function send(e, m, extra) {
    try {
      const body = JSON.stringify(Object.assign({ e, m, sid }, extra || {}));
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      }
    } catch (err) { /* analytics must never break the page */ }
  }
  window.track = send;

  // ---- session start: everything we can learn without storing anything ----
  send('pageview', location.pathname, {
    ref: document.referrer || '',
    utm: params.get('utm_source') || params.get('ref') || '',
    campaign: params.get('utm_campaign') || '',
    sw: screen.width,
    sh: screen.height,
    vw: innerWidth,
    vh: innerHeight,
    dpr: Math.round((devicePixelRatio || 1) * 100) / 100,
    lang: navigator.language || '',
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
    touch: (navigator.maxTouchPoints || 0) > 0,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  // ---- scroll depth funnel ----
  const marks = [25, 50, 75, 100];
  const hit = new Set();
  function onScroll() {
    const h = document.documentElement.scrollHeight - innerHeight;
    const pct = h > 0 ? Math.min(100, Math.round((scrollY / h) * 100)) : 100;
    for (const m of marks) {
      if (pct >= m && !hit.has(m)) { hit.add(m); send('scroll', String(m)); }
    }
  }
  addEventListener('scroll', onScroll, { passive: true });

  // ---- which sections people actually look at, and for how long ----
  const dwell = {};
  let currentSection = null;
  let sectionEnter = Date.now();
  const sections = [...document.querySelectorAll('section[id]')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && en.intersectionRatio > 0.4) {
          const id = en.target.id;
          if (id !== currentSection) {
            if (currentSection) {
              dwell[currentSection] = (dwell[currentSection] || 0) + Math.round((Date.now() - sectionEnter) / 1000);
            }
            currentSection = id;
            sectionEnter = Date.now();
            send('section', id);
          }
        }
      }
    }, { threshold: [0.4] });
    sections.forEach((s) => io.observe(s));
  }

  // ---- clicks ----
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('a, button, .project-card');
    if (!el) return;

    if (el.classList.contains('resume-btn')) return send('resume-download');
    if (el.id === 'learnMoreBtn') return send('cta-learn-more');
    if (el.classList.contains('guide-chat-btn')) return send('chat-open');
    if (el.closest('#droid-guide')) return send('droid-click');

    const href = el.getAttribute && el.getAttribute('href');
    if (href) {
      if (href.includes('huggingface.co')) return send('outbound-hf', href.slice(0, 80));
      if (href.includes('anonymous.4open.science')) return send('outbound-paper', href.slice(0, 80));
      if (href.includes('github.com')) return send('outbound-github', href.slice(0, 80));
      if (href.includes('linkedin.com')) return send('outbound-linkedin');
      if (href.includes('instagram.com')) return send('outbound-instagram');
      if (href.includes('streamlit.app')) return send('outbound-learnmate');
      if (href === 'thesis.pdf') return send('thesis-download');
      if (href.startsWith('mailto:')) return send('contact-email');
      if (href.startsWith('#')) return send('nav', href);
      if (el.classList.contains('website-card')) {
        const h = el.querySelector('h3');
        return send('website-card', h ? h.textContent.slice(0, 40) : href.slice(0, 60));
      }
    }

    const card = el.closest && el.closest('.project-card');
    if (card) {
      const h = card.querySelector('h3');
      return send('project-card', h ? h.textContent.slice(0, 40) : 'unknown');
    }
  }, { capture: true, passive: true });

  // ---- end of visit: total time + per-section dwell ----
  let sent = false;
  function finish() {
    if (sent) return;
    sent = true;
    if (currentSection) {
      dwell[currentSection] = (dwell[currentSection] || 0) + Math.round((Date.now() - sectionEnter) / 1000);
    }
    send('visit-end', String(Math.round((Date.now() - start) / 1000)), { dwell });
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') finish(); });
  addEventListener('pagehide', finish);
})();

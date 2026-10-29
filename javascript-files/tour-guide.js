// Droid tour guide behavior: hops in a moment after load, greets, comments
// on each section while you scroll, and quips when clicked.
export function initTourGuide({ container, api, immediate = false, entry = null }) {
  const bubble = document.createElement('div');
  bubble.className = 'guide-bubble';
  document.body.appendChild(bubble);

  let bubbleTimer = null;
  function say(text, ms = 4800) {
    bubble.textContent = text;
    bubble.classList.add('visible');
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.remove('visible'), ms);
  }

  // entrance: hop in after the page has had a beat to breathe
  let arrived = false;
  window.setTimeout(() => {
    container.classList.add('arrived');
    api.resize();
    window.setTimeout(() => {
      arrived = true;
      api.react?.('wave');
      say("I'm MORA-01. Ask me about the JEPA Transformer, the thesis, or TC_ACC.");
    }, immediate ? 280 : 750);
  }, immediate ? 60 : 2200);

  // section commentary (scroll-position based; robust everywhere)
  const LINES = {
    aboutMe: "That's Daniel. Builds AI things. Occasionally sleeps.",
    research: 'The flagship floor: one research question, one autonomous studio, and one model still earning its results.',
    projects: 'Smaller builds live here. Useful work, without pretending every repo is a flagship.',
    skills: 'The honest list - everything here shows up in a repo somewhere.',
    websites: 'Websites built for real, paying clients.',
    contact: 'Like me? Daniel builds things like this. Say hi.',
  };
  let currentSection = 'home';
  function checkSection() {
    if (!arrived) return;
    const mid = window.scrollY + window.innerHeight * 0.45;
    let active = 'home';
    for (const id of Object.keys(LINES)) {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= mid) active = id;
    }
    if (active !== currentSection) {
      currentSection = active;
      if (LINES[active]) {
        api.react?.('nod');
        say(LINES[active]);
      }
    }
  }
  let scrollFrame = 0;
  window.addEventListener('scroll', () => { scrollFrame ||= requestAnimationFrame(() => { scrollFrame = 0; checkSection(); }); }, { passive: true });
  window.setInterval(checkSection, 350);

  // click: spin + quip
  const QUIPS = [
    'Hello there.',
    'Got a question? Open the chat and ask me anything about Daniel.',
    'The flagship section is the good stuff, in my opinion.',
    'The JEPA Transformer pretrains ArgusJEPA, freezes it, then forecasts with CassaFormer.',
    'I am rendered in three.js, in case you were wondering.',
  ];
  let quipIndex = 0;
  container.addEventListener('click', () => {
    api.react?.('spin');
    say(QUIPS[quipIndex % QUIPS.length], 3200);
    quipIndex += 1;
  });
  container.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    container.click();
  });

  // ---- ask-me chat panel (answers come from /api/chat on Vercel) ----
  const chatBtn = document.createElement('button');
  chatBtn.className = 'guide-chat-btn';
  chatBtn.type = 'button';
  chatBtn.setAttribute('aria-label', 'Ask the droid a question');
  chatBtn.setAttribute('aria-controls', 'guideChatPanel');
  chatBtn.setAttribute('aria-expanded', 'false');
  chatBtn.innerHTML = '<i class="fas fa-comment-dots"></i>';
  document.body.appendChild(chatBtn);

  const panel = document.createElement('div');
  panel.className = 'guide-chat-panel';
  panel.id = 'guideChatPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask MORA-01 about Daniel');
  panel.innerHTML = `
    <div class="guide-chat-head">
      <span><i class="fas fa-comment-dots"></i> Ask about Daniel</span>
      <button type="button" class="guide-chat-close" aria-label="Close chat">&times;</button>
    </div>
    <div class="guide-chat-log" aria-live="polite"></div>
    <div class="guide-suggestions">
      <button type="button">What is the paper about?</button>
      <button type="button">What is the JEPA Transformer?</button>
      <button type="button">Is he open to work?</button>
    </div>
    <form class="guide-chat-form">
      <input type="text" maxlength="300" placeholder="Ask a question..." aria-label="Your question">
      <button type="submit" aria-label="Send"><i class="fas fa-paper-plane"></i></button>
    </form>`;
  document.body.appendChild(panel);

  const log = panel.querySelector('.guide-chat-log');
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const suggestions = panel.querySelector('.guide-suggestions');
  const history = [];

  // minimal, safe markdown: escape first, then allow **bold**, *italic*,
  // `code` and [text](url). Never insert raw model output as HTML.
  // Escapes first, then renders the small markdown subset the droid actually
  // uses: headings, bullets, bold/italic/code and links. Block structure is
  // handled line-by-line so lists come out as real <ul>s instead of stray "*".
  function inlineMd(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\$(?!\s)([^$\n]{1,60}?)(?<!\s)\$(?!\d)/g, '$1') // drop stray LaTeX delimiters
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');
  }

  function mdToHtml(text) {
    const esc = String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const out = [];
    let inList = false;
    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

    for (const line of esc.split('\n')) {
      const t = line.trim();
      if (!t) { closeList(); continue; }

      const bullet = t.match(/^[-*•]\s+(.*)$/);
      if (bullet) {
        if (!inList) { out.push('<ul class="guide-list">'); inList = true; }
        out.push('<li>' + inlineMd(bullet[1]) + '</li>');
        continue;
      }

      closeList();
      const head = t.match(/^#{1,6}\s+(.*)$/);
      if (head) {
        out.push('<p class="guide-h">' + inlineMd(head[1].replace(/[:\s]+$/, '')) + '</p>');
      } else {
        out.push('<p>' + inlineMd(t) + '</p>');
      }
    }
    closeList();
    return out.join('');
  }

  function addMsg(role, text, raw) {
    const div = document.createElement('div');
    div.className = 'guide-msg ' + role;
    if (raw) div.textContent = text;
    else div.innerHTML = mdToHtml(text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  panel.querySelector('.guide-chat-close').addEventListener('click', () => {
    panel.classList.remove('open');
    chatBtn.classList.remove('open');
    chatBtn.setAttribute('aria-expanded', 'false');
    chatBtn.focus();
  });

  suggestions.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    input.value = b.textContent;
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  chatBtn.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    chatBtn.classList.toggle('open', open);
    chatBtn.setAttribute('aria-expanded', String(open));
    bubble.classList.remove('visible');
    if (open) {
      if (!log.childElementCount) {
        addMsg('model', "Hi. Ask me anything about **Daniel's work**, his research, or this site.");
      }
      input.focus();
    }
  });

  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    panel.classList.remove('open');
    chatBtn.classList.remove('open');
    chatBtn.setAttribute('aria-expanded', 'false');
    chatBtn.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addMsg('user', q, true);
    window.track && window.track('chat-message', '', { q: q.slice(0, 160) });
    api.react?.('happy');
    const pending = addMsg('model', 'Thinking...', true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history: history.slice(-4) }),
      });
      if (!r.ok) throw new Error('bad status ' + r.status);
      const data = await r.json();
      pending.innerHTML = mdToHtml(data.reply);
      suggestions.style.display = 'none';
      history.push({ role: 'user', text: q }, { role: 'model', text: data.reply });
    } catch (err) {
      pending.innerHTML = mdToHtml("I can't reach my brain from here - but Daniel answers email quickly: **damorasoler@gmail.com**");
    }
  });
  // ---- hide / restore the droid ----
  const hideBtn = document.createElement('button');
  hideBtn.className = 'guide-hide-btn';
  hideBtn.type = 'button';
  hideBtn.title = 'Hide the guide';
  hideBtn.setAttribute('aria-label', 'Hide the guide');
  hideBtn.innerHTML = '&times;';
  document.body.appendChild(hideBtn);

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'guide-restore-btn';
  restoreBtn.type = 'button';
  restoreBtn.setAttribute('aria-label', 'Show the guide');
  restoreBtn.innerHTML = '<i class="fas fa-robot"></i>';
  document.body.appendChild(restoreBtn);

  function setHidden(hidden) {
    document.body.classList.toggle('guide-hidden', hidden);
    entry?.setAttribute('aria-expanded', String(!hidden));
    if (hidden) {
      panel.classList.remove('open');
      chatBtn.classList.remove('open');
      chatBtn.setAttribute('aria-expanded', 'false');
      bubble.classList.remove('visible');
    }
    try { sessionStorage.setItem('guideHidden', hidden ? '1' : '0'); } catch (e) { /* fine */ }
  }

  hideBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setHidden(true); });
  restoreBtn.addEventListener('click', () => { setHidden(false); api.resize && api.resize(); });

  try {
    if (sessionStorage.getItem('guideHidden') === '1') setHidden(true);
  } catch (e) { /* fine */ }
}

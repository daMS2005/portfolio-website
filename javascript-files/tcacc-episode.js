// The October 2026 TC_ACC episode, shot by shot (tc-acc.html): a halftone frame above the cut's V1/A1 timeline.
// Frames come from one atlas; shots that show an identifiable person are stored there only as a
// 16 x 9 average and are drawn as 16 x 9 dots.
(() => {
  const root = document.getElementById('tcCut');
  if (!root) return;

  const INK = '#ff6a3d', TXT = '#f5f3ef', MUTED = '#9b968f', MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  const TYPE = {
    case_image: ['case photo', INK], archival_broll: ['archival footage', '#d7a25e'], stock_broll: ['stock b-roll', '#7d766c'],
    stock_video: ['stock video', '#7d766c'], route_map: ['route map', TXT], title: ['Title ident', '#46423d'], end: ['End card', '#46423d'],
  };
  const HERO = 26; // first view: shot 26, the clock
  const PAD = 16, GUT = 30, TRACK_H = 104; // timeline side padding, label gutter and height, CSS px
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const frame = $('tcCutFrame'), track = $('tcCutTrack'), now = $('tcCutNow'), ctx = track.getContext('2d');
  let ep = null, env = null, halftone = null, t = 0, cur = null, raf = 0;

  const tc = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const fit = (c, w, h) => { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } };

  function load() {
    const img = new Image();
    const atlas = new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = '/assets/tcacc-atlas.webp?v=1'; });
    Promise.all([fetch('/assets/tcacc-episode.json?v=1').then(r => r.json()), atlas]).then(([j]) => {
      halftone = makeGL(img);
      if (!halftone) throw new Error('WebGL unavailable');
      const [tw, th, cols] = j.tile;
      j.segs = j.segs.map(([a, b, type, n, r, m, mp], i) => ({ a, b, type, n, r, m, mp, i, color: TYPE[type][1],
        uv: [(i % cols) * tw / img.width, Math.floor(i / cols) * th / img.height, tw / img.width, th / img.height] }));
      ep = j; env = Uint8Array.from(atob(j.env), c => c.charCodeAt(0));
      $('tcCutStatus').remove();
      const s = ep.segs[HERO];
      show((s.a + s.b) / 2);
    }).catch(() => { // keep the page whole: the montage still and its caption
      frame.parentElement.innerHTML = '<img src="/images/tcacc-episode-stills.jpg" alt="A montage of documentary imagery used in a TC_ACC episode: coastline, archival surveillance, document research, and a harbor" width="1280" height="720">';
      track.parentElement.hidden = true;
      root.querySelector('figcaption').textContent = 'Representative episode imagery · research, archival material, documents, and location context assembled into one edit.';
    });
  }

  function show(time) {
    t = Math.min(ep.dur, Math.max(0, time));
    let i = 0;
    while (i < ep.segs.length - 1 && t >= ep.segs[i + 1].a) i++;
    if (ep.segs[i] !== cur) describe(cur = ep.segs[i]);
    kick();
  }

  function describe(s) {
    const name = s.n ? `Shot ${s.n} of ${ep.shots}` : TYPE[s.type][0], act = `Act ${ep.acts.filter(a => a <= s.a).length}`;
    const what = s.n ? TYPE[s.type][0] : '';
    const move = !s.r && s.mp[0] !== s.mp[1] ? s.m.replace(/_/g, ' ').replace(/(push|pull) (in|out)/, '$1-$2') : '';
    now.innerHTML = [name, `${tc(s.a)}–${tc(s.b)}`, act, what, move, s.r && '<b>withheld</b>'].filter(Boolean).map(x => `<span>${x}</span>`).join(' · ');
    track.setAttribute('aria-valuenow', s.i + 1);
    track.setAttribute('aria-valuetext', [name, `${tc(s.a)} to ${tc(s.b)}`, act, what, s.r ? 'withheld' : ''].filter(Boolean).join(', '));
  }

  function draw() {
    raf = 0;
    const k = Math.min(devicePixelRatio || 1, 2);
    drawFrame(k);
    drawTrack(k);
  }

  function drawFrame(k) {
    const w = Math.round(frame.clientWidth * k), h = Math.round(w * 9 / 16), s = cur, mp = s.mp;
    fit(frame, w, h);
    // the shot's camera move follows the playhead; withheld shots: 16 dots across, unstaggered, dimmer, no move
    const p = reduced ? 0.5 : Math.min(1, Math.max(0, (t - s.a) / (s.b - s.a))), e = p * p * (3 - 2 * p);
    const cell = s.r ? w / 16 : Math.min(6.5, Math.max(2.25, w / k / 190)) * k;
    halftone(w, h, s.uv, cell, s.r ? 0 : 1, s.r || mp[0] === mp[1] ? 1 : mp[0] + (mp[1] - mp[0]) * e, mp[2], mp[3],
      s.r ? 0 : mp[4] + (mp[5] - mp[4]) * e, s.r ? 0 : mp[6] + (mp[7] - mp[6]) * e);
  }

  function drawTrack(k) {
    fit(track, Math.round(track.clientWidth * k), Math.round(TRACK_H * k));
    const c = ctx, W = track.width, u = v => v * k, x0 = u(PAD + GUT), x1 = W - u(PAD), X = s => x0 + (x1 - x0) * s / ep.dur;
    const act = ep.acts.filter(a => a <= cur.a).length;
    c.clearRect(0, 0, W, track.height);
    c.font = `${u(10)}px ${MONO}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = MUTED;
    c.fillText('Act', u(PAD), u(13)); c.fillText('V1', u(PAD), u(33)); c.fillText('A1', u(PAD), u(67));
    ep.acts.forEach((a, i) => {
      const x = Math.round(X(a));
      c.fillStyle = i + 1 === act ? TXT : 'rgba(245,243,239,.35)';
      c.fillRect(x, u(8), k, u(11)); c.fillText(i + 1, x + u(4), u(13));
    });
    // V1: one block per shot, coloured by source; withheld shots dotted, like their frames
    for (const s of ep.segs) {
      const a = Math.round(X(s.a)), b = Math.round(X(s.b)) - k, on = s === cur ? 1 : 0.6;
      if (b <= a) continue;
      c.fillStyle = s.color; c.globalAlpha = on * (s.r ? 0.3 : 1);
      c.fillRect(a, u(22), b - a, u(22));
      c.globalAlpha = on;
      if (s.r) for (let x = a + u(2); x + u(2) <= b; x += u(4)) for (const y of [26, 32, 38]) c.fillRect(x, u(y), u(2), u(2));
    }
    c.globalAlpha = 1;
    // A1: the soundtrack's loudness, the current shot's stretch brighter
    const n = env.length, mid = u(67), half = u(16), step = u(3), ca = X(cur.a), cb = X(cur.b);
    for (let x = x0; x < x1; x += step) {
      const i0 = Math.floor((x - x0) / (x1 - x0) * n), i1 = Math.max(i0 + 1, Math.floor((x + step - x0) / (x1 - x0) * n));
      let v = 0;
      for (let i = i0; i < i1 && i < n; i++) v = Math.max(v, env[i]);
      const hh = Math.max(k, v / 255 * half);
      c.fillStyle = x >= ca && x < cb ? 'rgba(245,243,239,.85)' : 'rgba(245,243,239,.28)';
      c.fillRect(x, mid - hh, u(2), 2 * hh);
    }
    c.fillStyle = MUTED;
    for (let s = 0, every = (x1 - x0) / k < 400 ? 120 : 60; s < ep.dur; s += every) {
      const x = Math.round(X(s));
      c.fillRect(x, u(87), k, u(4));
      if (x + u(4) + c.measureText(tc(s)).width <= x1) c.fillText(tc(s), x + u(4), u(96));
    }
    const ph = Math.round(X(t));
    c.fillStyle = INK; c.fillRect(ph, u(4), k, u(83));
    c.beginPath(); c.moveTo(ph - u(4), u(2)); c.lineTo(ph + u(5), u(2)); c.lineTo(ph + k / 2, u(7)); c.fill();
  }

  // ---------- WebGL halftone: one dot per cell, radius from luminance, orange ink ----------
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D tex; uniform vec2 res, texel, shift; uniform vec4 tile, mo; uniform float cell, stagger, amt;
float lum(vec2 c) {
  vec2 uv = mo.yz + (c / res - mo.yz) / mo.x - shift;
  vec2 t = clamp(tile.xy + uv * tile.zw, tile.xy + texel, tile.xy + tile.zw - texel);
  return dot(texture2D(tex, t).rgb, vec3(.3, .59, .11));
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  float row = floor(p.y / cell), cov = 0.;
  for (int j = -1; j <= 1; j++) {
    float r = row + float(j), off = stagger * mod(r, 2.) * .5 * cell, col = floor((p.x - off) / cell);
    for (int i = -1; i <= 1; i++) {
      vec2 c = vec2((col + float(i) + .5) * cell + off, (r + .5) * cell);
      float rad = smoothstep(.1, mo.w, lum(c)) * cell * .62;
      cov = max(cov, step(.4, rad) * clamp(rad - length(p - c) + .5, 0., 1.));
    }
  }
  gl_FragColor = vec4(mix(vec3(.031, .035, .039), vec3(1., .416, .239), cov * amt), 1.);
}`;

  function makeGL(img) {
    const gl = frame.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return null;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'], [gl.FRAGMENT_SHADER, FS]]) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(prog, sh);
    }
    gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    const U = Object.fromEntries(['res', 'texel', 'shift', 'tile', 'mo', 'cell', 'stagger', 'amt'].map(n => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform2f(U.texel, 1 / img.width, 1 / img.height);
    return (w, h, uv, cell, stagger, scale, fx, fy, sx, sy) => {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.res, w, h); gl.uniform4f(U.tile, uv[0], uv[1], uv[2], uv[3]);
      gl.uniform4f(U.mo, scale, fx, fy, 0.92); gl.uniform2f(U.shift, sx, sy);
      gl.uniform1f(U.cell, cell); gl.uniform1f(U.stagger, stagger); gl.uniform1f(U.amt, stagger ? 1 : 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  const seek = e => {
    if (!ep) return;
    const r = track.getBoundingClientRect();
    show((e.clientX - r.left - PAD - GUT) / (r.width - 2 * PAD - GUT) * ep.dur);
  };
  track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); seek(e); });
  track.addEventListener('pointermove', seek);
  track.addEventListener('keydown', e => {
    if (!ep) return;
    const last = ep.segs.length - 1, i = cur.i;
    const j = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: last }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    const s = ep.segs[Math.max(0, Math.min(last, j))];
    show((s.a + s.b) / 2);
  });
  addEventListener('resize', () => { if (ep) kick(); });

  // load when the figure approaches the viewport
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load(); } }, { rootMargin: '600px 0px' }).observe(root);
})();

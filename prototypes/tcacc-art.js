// TC_ACC chapter art, drawn from one real run: ep-20261007-01, which produced the Oct 2026 episode.
// Scene A: its 28 stages, each bar the stage's measured time, textured by log events per minute.
// Scene B: the cut it rendered (render plan + the episode's frames and soundtrack), scrubbed shot by shot.
// Frames that show an identifiable person ship only as a 16 x 9 average and are drawn as 16 x 9 dots.
import { loadImg, makeDissolver, seg, clamp01 } from './film.js';

const BG = '#08090a', INK = '#ff6a3d', TXT = '#f5f3ef', MUTED = '#9b968f';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const TYPE = {
  case_image: ['case photo', INK], archival_broll: ['archival footage', '#d7a25e'], stock_broll: ['stock b-roll', '#7d766c'],
  stock_video: ['stock video', '#7d766c'], route_map: ['route map', TXT], title: ['title ident', '#46423d'], end: ['end card', '#46423d'],
};
const LEGEND = [['case photo', INK], ['archival', '#d7a25e'], ['stock', '#7d766c'], ['map', TXT], ['titles', '#46423d']];
const DEPT = { research: 'Research', story: 'Story', assets: 'Assets', animation: 'Animation', publishing: 'Publishing', gate: 'Review gate' };
// scroll phases: run, dither dissolve, cut
const A = [0.03, 0.28], XF = [0.30, 0.38], B = [0.40, 0.985];
const HERO = 10; // drawStill's monitor: shot 10, the mast at dusk

export async function load(base = new URL('./data/tcacc/', import.meta.url)) {
  const [data, atlas] = await Promise.all([fetch(new URL('tcacc.json', base)).then(r => r.json()), loadImg(new URL('atlas.webp', base).href)]);
  try { await document.fonts.load(`400 12px ${MONO}`); } catch (e) { /* falls back to monospace */ }
  const stages = data.run.stages, total = stages.reduce((s, x) => s + x.s, 0);
  let t0 = 0, w0 = 0, gate = 0;
  const peak = Math.max(...stages.flatMap(s => s.e));
  for (const [i, s] of stages.entries()) {
    s.t0 = t0; t0 += s.s;
    s.w0 = w0; s.w = 0.5 / stages.length + 0.5 * s.s / total; w0 += s.w; // every stage gets scroll, long stages get more
    s.label = `${String(i + 1).padStart(2, "0")} ${s.n}`;
    s.long = `${s.label}  ${dur(s.s)}`;
    s.cap = `Run, ${data.run.dates} · ${s.d === 'gate' ? `review gate ${++gate} of 2, stage ${i + 1} of 28` : `${DEPT[s.d]}, stage ${i + 1} of 28`} · ${s.n} · ${dur(s.s)}${s.o ? ' · ' + s.o : ''}`;
  }
  const ep = data.ep, [tw, th, cols] = ep.tile;
  ep.segs = ep.segs.map(([a, b, type, n, r, m, mp], i) => ({
    a, b, type, n, r, mp, i, color: TYPE[type][1],
    uv: [(i % cols) * tw / atlas.width, Math.floor(i / cols) * th / atlas.height, tw / atlas.width, th / atlas.height],
    cap: n ? `shot ${n} of ${ep.shots}` : TYPE[type][0],
    what: n ? `${TYPE[type][0]}${r ? ', withheld at 16 × 9 dots' : ''}${mp[0] !== mp[1] && !r ? ' · ' + m.replace(/_/g, ' ').replace(/(push|pull) (in|out)/, '$1-$2') : ''}` : '',
  }));
  const env = Uint8Array.from(atob(ep.env), c => c.charCodeAt(0));
  return { run: { ...data.run, total, peak }, ep, env, atlas, gl: makeGL(atlas), dissolve: makeDissolver(8), lay: {} };
}

export function drawChapter(ctx, st, t, opts = {}) {
  const dpr = opts.dpr || 1;
  if (t < XF[0]) return drawRun(ctx, st, seg(t, ...A), dpr);
  if (t > XF[1]) return drawCut(ctx, st, seg(t, ...B) * st.ep.dur, dpr, false);
  const u = seg(t, ...XF), blank = c => { c.fillStyle = BG; c.fillRect(0, 0, c.canvas.width, c.canvas.height); };
  if (u < 0.5) st.dissolve(ctx, c => drawRun(c, st, 1, dpr), blank, u * 2); // run out, then cut in: text never meets image
  else st.dissolve(ctx, blank, c => drawCut(c, st, 0, dpr, false), u * 2 - 1);
}

export function drawStill(ctx, st, opts = {}) {
  const s = st.ep.segs[HERO];
  drawCut(ctx, st, (s.a + s.b) / 2, opts.dpr || 1, true);
}

export function caption(st, t) {
  if (t < (XF[0] + XF[1]) / 2) return stageAt(st, seg(t, ...A)).s.cap;
  const time = t > XF[1] ? seg(t, ...B) * st.ep.dur : 0, s = segAt(st, time);
  return [st.ep.label, s.cap, tc(time), s.what].filter(Boolean).join(' · ');
}

// ---------- scene A: the run ----------
function stageAt(st, q) {
  const ss = st.run.stages;
  let i = 0;
  while (i < ss.length - 1 && q >= ss[i + 1].w0) i++;
  const s = ss[i], u = clamp01((q - s.w0) / s.w);
  return { i, s, u, time: s.t0 + u * s.s };
}

function drawRun(ctx, st, q, dpr) {
  const W = ctx.canvas.width, H = ctx.canvas.height, ss = st.run.stages, k = dpr;
  const narrow = W / k < 640, pad = Math.max(16, Math.min(W, H) / k * 0.06) * k;
  const rows = ss.length + (narrow ? 0 : 5);
  const rh = Math.min(30 * k, (H - 2 * pad) / rows), top = (H - rh * rows) / 2;
  const x0 = pad, x1 = W - pad, X = tm => x0 + (x1 - x0) * tm / st.run.total;
  const fs = Math.round(Math.max(8.5 * k, Math.min(12 * k, rh * 0.6)));
  const now = stageAt(st, q), px = X(now.time);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = 'middle';
  let row = 0, dept = '';
  for (const [i, s] of ss.entries()) {
    if (!narrow && s.d !== dept && s.d !== 'gate') { // department heading row
      const y = top + (row++ + 0.5) * rh;
      const name = DEPT[s.d].toUpperCase(), lx = x0 + ctx.measureText(name).width + 14 * k;
      ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText(name, x0, y);
      ctx.fillStyle = 'rgba(245,243,239,.07)'; ctx.fillRect(lx, Math.round(y), x1 - lx, k);
    }
    if (s.d !== 'gate') dept = s.d;
    const y = top + (row++ + 0.5) * rh, a = X(s.t0), b = Math.max(a + 2 * k, X(s.t0 + s.s)), bh = rh * 0.5;
    const done = i < now.i || q >= 1, cur = i === now.i && q < 1;
    if (s.d === 'gate') { // a gate spans the whole run: dashed rule plus a diamond where the run passed it
      ctx.strokeStyle = 'rgba(255,106,61,.35)'; ctx.lineWidth = k; ctx.setLineDash([3 * k, 4 * k]);
      ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(x1, Math.round(y) + 0.5); ctx.stroke(); ctx.setLineDash([]);
      const d = bh * 0.7;
      ctx.fillStyle = done || cur ? INK : BG; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(a, y - d); ctx.lineTo(a + d, y); ctx.lineTo(a, y + d); ctx.lineTo(a - d, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(245,243,239,.2)'; ctx.lineWidth = k;
      if (!done) ctx.strokeRect(a + k / 2, y - bh / 2 + k / 2, b - a - k, bh - k);
      const end = done ? b : cur ? Math.max(a, Math.min(b, px)) : a;
      if (end > a) { // filled part: a faint bar plus one column per minute, its height the log activity
        const col = cur ? INK : '#bdb6ac', n = s.e.length, cw = (b - a) / n;
        ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fillRect(a, y - bh / 2, end - a, bh); ctx.globalAlpha = 1;
        for (let j = 0; j < n && a + j * cw < end; j++) {
          const h = bh * (0.2 + 0.8 * Math.sqrt(s.e[j] / st.run.peak));
          ctx.fillRect(a + j * cw, y + bh / 2 - h, Math.min(Math.max(cw - (cw > 3 * k ? k : 0), k), end - a - j * cw), h);
        }
      }
    }
    const label = narrow ? s.label : s.long, lw = ctx.measureText(label).width, g = 10 * k;
    const left = a - g - lw >= x0 || b + g + lw > x1;
    ctx.textAlign = left ? 'right' : 'left';
    const lx = left ? (s.d === 'gate' ? a - 2 * g : a - g) : b + g;
    if (s.d === 'gate') { ctx.fillStyle = BG; ctx.fillRect(left ? lx - lw - g / 2 : lx - g / 2, y - rh / 2, lw + g, rh); } // keep the dashed rule off the text
    ctx.fillStyle = cur ? TXT : done ? MUTED : 'rgba(245,243,239,.3)';
    ctx.fillText(label, lx, y);
  }
  ctx.fillStyle = INK; ctx.fillRect(Math.round(px), top - rh * 0.4, k, rh * (rows + 0.8));
}

// ---------- scene B: the cut ----------
function segAt(st, time) {
  const ss = st.ep.segs;
  let i = 0;
  while (i < ss.length - 1 && time >= ss[i + 1].a) i++;
  return ss[i];
}

function layoutCut(st, W, H, k) {
  const key = `${W}x${H}x${k}`;
  if (st.lay.key === key) return st.lay;
  const narrow = W / k < 640, pad = Math.max(16, Math.min(W, H) / k * 0.05) * k;
  const actsH = 14 * k, v1 = Math.round(Math.min(30 * k, Math.max(16 * k, H * 0.035))), a1 = Math.round(Math.min(56 * k, Math.max(24 * k, H * 0.07)));
  const legend = narrow ? 0 : 22 * k, gap = Math.round(14 * k), th = actsH + v1 + 6 * k + a1 + legend;
  const mw = Math.floor(Math.min(W - 2 * pad, (H - 2 * pad - th - gap) * 16 / 9)), mh = Math.round(mw * 9 / 16);
  const my = Math.round((H - mh - gap - th) / 2), mx = Math.round((W - mw) / 2), ty = my + mh + gap;
  return (st.lay = { key, narrow, mx, my, mw, mh, actsY: ty, v1Y: ty + actsH, v1, a1Y: ty + actsH + v1 + 6 * k, a1, legY: ty + th - legend + 8 * k, labels: mx >= 40 * k });
}

function drawCut(ctx, st, time, dpr, all) {
  const W = ctx.canvas.width, H = ctx.canvas.height, k = dpr, ep = st.ep, L = layoutCut(st, W, H, k);
  const X = tm => L.mx + L.mw * tm / ep.dur, ph = Math.round(X(time)), cur = segAt(st, time);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // monitor
  const p = clamp01((time - cur.a) / (cur.b - cur.a)), e = p * p * (3 - 2 * p), mp = cur.mp, still = cur.r || mp[0] === mp[1];
  const cell = cur.r ? L.mw / 16 : Math.min(6.5, Math.max(2.25, L.mw / k / 190)) * k;
  if (st.gl) {
    ctx.drawImage(st.gl.draw(L.mw, L.mh, cur.uv, cell, cur.r ? 0 : 1, still ? 1 : mp[0] + (mp[1] - mp[0]) * e, mp[2], mp[3],
      cur.r ? 0 : mp[4] + (mp[5] - mp[4]) * e, cur.r ? 0 : mp[6] + (mp[7] - mp[6]) * e), L.mx, L.my);
  } else { // no WebGL: the frame itself, tinted
    const [u, v, uw, vh] = cur.uv, A = st.atlas;
    ctx.imageSmoothingEnabled = !cur.r;
    ctx.drawImage(A, u * A.width, v * A.height, uw * A.width, vh * A.height, L.mx, L.my, L.mw, L.mh);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = INK; ctx.fillRect(L.mx, L.my, L.mw, L.mh); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.strokeStyle = 'rgba(245,243,239,.08)'; ctx.lineWidth = k; ctx.strokeRect(L.mx - k / 2, L.my - k / 2, L.mw + k, L.mh + k);
  // acts: eight parts
  ctx.font = `${Math.round(10 * k)}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const [i, a] of ep.acts.entries()) {
    const x = Math.round(X(a)), on = time >= a && (i === ep.acts.length - 1 || time < ep.acts[i + 1]);
    ctx.fillStyle = on ? TXT : 'rgba(245,243,239,.35)';
    ctx.fillRect(x, L.actsY + 2 * k, k, 10 * k); ctx.fillText(String(i + 1), x + 4 * k, L.actsY + 7 * k);
  }
  // V1: one block per shot, laid down as the playhead passes
  for (const s of ep.segs) {
    const a = Math.round(X(s.a)), b = Math.round(X(s.b)) - k;
    if (b <= a) continue;
    if (all || s.b <= time || s === cur) {
      ctx.fillStyle = s.color; ctx.globalAlpha = s === cur ? 1 : 0.78;
      ctx.fillRect(a, L.v1Y, b - a, L.v1); ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(245,243,239,.14)'; ctx.lineWidth = k;
      ctx.strokeRect(a + k / 2, L.v1Y + k / 2, b - a - k, L.v1 - k);
    }
  }
  // A1: the episode's soundtrack, loudness per column
  const env = st.env, n = env.length, step = 3 * k, mid = L.a1Y + L.a1 / 2;
  for (let x = 0; x < L.mw; x += step) {
    const i0 = Math.floor(x / L.mw * n), i1 = Math.max(i0 + 1, Math.floor((x + step) / L.mw * n));
    let v = 0;
    for (let i = i0; i < i1 && i < n; i++) v = Math.max(v, env[i]);
    const h = Math.max(k, v / 255 * L.a1 / 2);
    ctx.fillStyle = all || L.mx + x < ph ? 'rgba(245,243,239,.72)' : 'rgba(245,243,239,.16)';
    ctx.fillRect(L.mx + x, mid - h, 2 * k, 2 * h);
  }
  if (L.labels) {
    ctx.fillStyle = MUTED; ctx.textAlign = 'right';
    ctx.fillText('V1', L.mx - 10 * k, L.v1Y + L.v1 / 2); ctx.fillText('A1', L.mx - 10 * k, mid);
  }
  if (!L.narrow) { // legend under the tracks
    ctx.textAlign = 'left';
    let x = L.mx;
    for (const [name, col] of LEGEND) {
      ctx.fillStyle = col; ctx.fillRect(x, L.legY - 4 * k, 8 * k, 8 * k);
      ctx.fillStyle = MUTED; ctx.fillText(name, x + 13 * k, L.legY);
      x += 13 * k + ctx.measureText(name).width + 18 * k;
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(ph, L.actsY, k, L.a1Y + L.a1 - L.actsY);
  ctx.beginPath(); ctx.moveTo(ph - 4 * k, L.actsY); ctx.lineTo(ph + 5 * k, L.actsY); ctx.lineTo(ph + k / 2, L.actsY + 5 * k); ctx.fill();
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
      float rad = smoothstep(.1, mo.w, lum(c)) * cell * .62; // S-curve: midtones pulled apart so frames read
      cov = max(cov, step(.4, rad) * clamp(rad - length(p - c) + .5, 0., 1.));
    }
  }
  gl_FragColor = vec4(mix(vec3(.031, .035, .039), vec3(1., .416, .239), cov * amt), 1.);
}`;

function makeGL(img) {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
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
  return {
    draw(w, h, uv, cell, stagger, scale, fx, fy, sx, sy) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(U.res, w, h); gl.uniform4f(U.tile, uv[0], uv[1], uv[2], uv[3]);
      gl.uniform4f(U.mo, scale, fx, fy, .92); gl.uniform2f(U.shift, sx, sy);
      gl.uniform1f(U.cell, cell); gl.uniform1f(U.stagger, stagger); gl.uniform1f(U.amt, stagger ? 1 : 0.5); // withheld frames: dimmer ink
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return c;
    },
  };
}

const tc = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function dur(s) {
  if (s < 1) return "under 1 s";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  const m = Math.round(s / 60);
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

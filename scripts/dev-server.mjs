// Local dev server that mimics Vercel: serves the static site AND runs the
// real api/*.js functions, with an in-memory mock of Upstash Redis so the
// analytics -> stats loop can be tested end to end without any accounts.
// Run:  STATS_PASSWORD=... node scripts/dev-server.mjs   (port 8124)
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.argv[2] || 8124);

// ---- in-memory "Upstash Redis" (pipeline subset) ----
const hashes = new Map();
const lists = new Map();
const sets = new Map();
const strings = new Map();
const at = (l, i) => (Number(i) < 0 ? l.length + Number(i) : Number(i)); // Redis-style negative indexes
function redisCmd([cmd, ...a]) {
  switch (cmd.toUpperCase()) {
    case 'HSET': {
      const h = hashes.get(a[0]) || new Map();
      h.set(a[1], a[2]);
      hashes.set(a[0], h);
      return 1;
    }
    case 'HGET':
      return hashes.get(a[0])?.get(a[1]) ?? null;
    case 'RPUSH': {
      const l = lists.get(a[0]) || [];
      l.push(...a.slice(1));
      lists.set(a[0], l);
      return l.length;
    }
    case 'EXPIRE':
      return 1;
    case 'SET':
      if (a.includes('NX') && strings.has(a[0])) return null;
      strings.set(a[0], a[1]);
      return 'OK';
    case 'GET':
      return strings.get(a[0]) ?? null;
    case 'HINCRBY': {
      const h = hashes.get(a[0]) || new Map();
      h.set(a[1], (h.get(a[1]) || 0) + Number(a[2]));
      hashes.set(a[0], h);
      return h.get(a[1]);
    }
    case 'HGETALL': {
      const h = hashes.get(a[0]);
      return h ? [...h.entries()].flat().map(String) : [];
    }
    case 'LPUSH': {
      const l = lists.get(a[0]) || [];
      l.unshift(...a.slice(1));
      lists.set(a[0], l);
      return l.length;
    }
    case 'LTRIM': {
      const l = lists.get(a[0]) || [];
      lists.set(a[0], l.slice(Math.max(0, at(l, a[1])), at(l, a[2]) + 1));
      return 'OK';
    }
    case 'LRANGE': {
      const l = lists.get(a[0]) || [];
      return l.slice(Math.max(0, at(l, a[1])), at(l, a[2]) + 1);
    }
    case 'SADD': {
      const s = sets.get(a[0]) || new Set();
      s.add(a[1]);
      sets.set(a[0], s);
      return 1;
    }
    default:
      return null;
  }
}

// load .env from this worktree or from the main repo checkout (never committed)
for (const p of ['.env', '../../../.env', '../../../../.env']) {
  try {
    const txt = await readFile(join(process.cwd(), p), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    console.log('loaded env from', p);
    break;
  } catch { /* try next path */ }
}

// use real Redis if credentials exist, otherwise fall back to the in-memory mock
const hasRealRedis = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
if (!hasRealRedis) {
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${PORT}/mock-redis`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'local';
}
console.log(hasRealRedis ? 'using REAL Upstash Redis' : 'using in-memory mock Redis');
console.log(process.env.GEMINI_API_KEY ? 'Gemini key loaded - chat is live' : 'no Gemini key - chat will show fallback');

// local-only default; the real password lives in Vercel's STATS_PASSWORD env var
process.env.STATS_PASSWORD = process.env.STATS_PASSWORD || 'localdev';

const chat = (await import('../api/chat.js')).default;
const track = (await import('../api/track.js')).default;
const stats = (await import('../api/stats.js')).default;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/png',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.ply': 'application/octet-stream', '.splinecode': 'application/octet-stream',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.MOV': 'video/quicktime',
};

function shim(res) {
  return {
    _headers: {},
    setHeader(k, v) { res.setHeader(k, v); },
    status(code) { this._code = code; return this; },
    json(obj) {
      res.writeHead(this._code || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    },
    end(body) {
      res.writeHead(this._code || 200);
      res.end(body);
    },
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let body = '';
  for await (const chunk of req) body += chunk;
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = {}; }

  if (url.pathname.startsWith('/mock-redis')) {
    const results = (Array.isArray(parsed) ? parsed : []).map((c) => ({ result: redisCmd(c) }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }

  const vercelReq = Object.assign(req, { body: parsed });
  if (url.pathname === '/api/chat') return chat(vercelReq, shim(res));
  if (url.pathname === '/api/track') return track(vercelReq, shim(res));
  if (url.pathname === '/api/stats') return stats(vercelReq, shim(res));

  // static files
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/stats') p = '/stats.html';
  try {
    const filePath = join(process.cwd(), normalize(p).replace(/^\/+/, ''));
    const info = await stat(filePath);
    const contentType = MIME[extname(p)] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return res.end();
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return res.end();
      }

      res.writeHead(206, {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      return createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': info.size,
      'Content-Type': contentType,
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`dev server on http://127.0.0.1:${PORT}`));

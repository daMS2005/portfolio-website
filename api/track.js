// Cookieless event tracker. Enriches each event server-side with coarse geo
// (Vercel edge headers) and a parsed user-agent, then aggregates into Redis.
// Nothing is stored on the visitor's device; no persistent identifiers.
import { createHash, randomBytes } from 'node:crypto';

// Vercel's marketplace integrations inject Redis credentials under several
// different names depending on the integration version - accept them all.
function redisCreds() {
  const e = process.env;
  return {
    url: e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL || e.REDIS_REST_URL || '',
    token: e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN || e.REDIS_REST_TOKEN || '',
  };
}

const seen = globalThis.__mora_track_rl || (globalThis.__mora_track_rl = new Map());

// Daniel's own networks: api/stats.js stores a hash of the IP that opens the dashboard; it counts for 30 days.
const ipHash = (ip) => createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);

function parseUA(ua) {
  const s = String(ua || '');
  let browser = 'Other';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\//.test(s)) browser = 'Opera';
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = 'Chrome';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';

  let os = 'Other';
  if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Mac OS X/.test(s)) os = 'macOS';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/Linux/.test(s)) os = 'Linux';

  const bot = /bot|crawler|spider|crawling|preview|facebookexternalhit|slackbot|discordbot|whatsapp|headless|lighthouse/i.test(s);
  return { browser, os, bot };
}

function refSource(ref, utm) {
  if (utm) return String(utm).slice(0, 40);
  if (!ref) return 'direct';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/localhost|127\.0\.0\.1/.test(h)) return 'local';
    if (/google\./.test(h)) return 'google';
    if (/linkedin\./.test(h) || /lnkd\.in/.test(h)) return 'linkedin';
    if (/github\./.test(h)) return 'github';
    if (/instagram\./.test(h)) return 'instagram';
    if (/t\.co|twitter\.|x\.com/.test(h)) return 'twitter/x';
    return h.slice(0, 40);
  } catch { return 'direct'; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 80) return res.status(204).end(); // silent drop on floods
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.clear();

  const b = req.body || {};
  const { e, m, sid } = b;
  if (typeof e !== 'string' || !e) return res.status(400).end();

  const ua = parseUA(req.headers['user-agent']);
  if (ua.bot) return res.status(204).end(); // keep crawlers out of the stats

  const ev = e.slice(0, 48);
  const country = req.headers['x-vercel-ip-country'] || 'unknown';
  let city = null;
  try { city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null; } catch { /* malformed header */ }
  const day = new Date().toISOString().slice(0, 10);
  const bg = typeof b.bg === 'string' && /^[a-z]{2,12}$/.test(b.bg) ? b.bg : ''; // homepage background A/B variant
  const device = b.touch ? (Number(b.vw) < 768 ? 'mobile' : 'tablet') : 'desktop';

  console.log('[track]', JSON.stringify({ e: ev, m, sid, country, city, ...ua }));

  const { url: rurl, token: rtok } = redisCreds();
  if (!rurl || !rtok) return res.status(204).end();
  const redis = async (c) => {
    const r = await fetch(`${rurl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rtok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    return (await r.json()).map((x) => x.result);
  };
  // one round trip: is this Daniel's network, and today's salt for the visitor code
  const [ownerAt, , salt] = await redis([
    ['HGET', 'owner:ips', ipHash(ip)],
    ['SET', `salt:${day}`, randomBytes(16).toString('hex'), 'NX', 'EX', '172800'],
    ['GET', `salt:${day}`],
  ]).catch(() => []);
  if (ownerAt && Date.now() - Number(ownerAt) < 30 * 86400_000) return res.status(204).end();
  // visitor code: groups one person's pages for a day. A hash of the IP and browser with a salt
  // that is deleted after two days, so it can't be reversed or linked across days.
  const vid = salt ? createHash('sha256').update(`${salt}|${ip}|${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 8) : undefined;

  const cmds = [
    ['HINCRBY', `ev:${day}`, ev, '1'],
    ['HINCRBY', 'ev:total', ev, '1'],
  ];

  if (ev === 'pageview') {
    const source = refSource(b.ref, b.utm);
    let refPage = '';
    try { const u = new URL(b.ref); refPage = (u.host.replace(/^www\./, '') + u.pathname).slice(0, 120); } catch { /* direct */ }
    const internal = refPage && refPage.startsWith(String(req.headers.host || '').replace(/^www\./, ''));
    if (refPage && !internal) cmds.push(['HINCRBY', 'ref:total', refPage, '1']);
    cmds.push(
      ['HINCRBY', 'geo:total', country, '1'],
      ['HINCRBY', `geo:${day}`, country, '1'],
      ['HINCRBY', 'src:total', source, '1'],
      ['HINCRBY', 'browser:total', ua.browser, '1'],
      ['HINCRBY', 'os:total', ua.os, '1'],
      ['HINCRBY', 'device:total', device, '1'],
      ['HINCRBY', 'lang:total', String(b.lang || 'unknown').slice(0, 8), '1'],
      ['HINCRBY', 'visits:day', day, '1'],
    );
    if (city) cmds.push(['HINCRBY', 'city:total', `${city}, ${country}`, '1']);
    if (b.campaign) cmds.push(['HINCRBY', 'campaign:total', String(b.campaign).slice(0, 40), '1']);
    cmds.push(
      ['LPUSH', 'visits:recent', JSON.stringify({
        t: now, sid, vid, bg: bg || undefined, country, city, source,
        browser: ua.browser, os: ua.os, device,
        page: String(m || '').slice(0, 60), vw: b.vw, vh: b.vh, lang: b.lang, tz: b.tz,
        ref: refPage, scr: b.sw && b.sh ? `${b.sw}x${b.sh}` : undefined, dpr: b.dpr, dark: b.dark, reduced: b.reduced,
      })],
      ['LTRIM', 'visits:recent', '0', '999'],
    );
  }

  if (typeof sid === 'string' && /^[a-z0-9]{6,24}$/.test(sid)) {
    const step = { t: now, e: ev };
    if (m != null && m !== '') step.m = String(m).slice(0, 60);
    if (typeof b.label === 'string' && b.label) step.l = b.label.slice(0, 50);
    if (typeof b.q === 'string' && b.q) step.q = b.q.slice(0, 160); // a question asked to MORA-01
    if (ev === 'visit-end' && Number.isFinite(Number(b.depth))) step.d = Math.max(0, Math.min(100, Math.round(Number(b.depth))));
    cmds.push(['RPUSH', `s:${sid}`, JSON.stringify(step)], ['LTRIM', `s:${sid}`, '-200', '-1'], ['EXPIRE', `s:${sid}`, '2592000']);
  }

  if (ev === 'pageview' && m) cmds.push(['HINCRBY', 'pages:total', String(m).slice(0, 60), '1']);
  if (typeof b.label === 'string' && b.label) {
    const target = `${String(b.page || '').slice(0, 40)} · ${b.label.slice(0, 50)}`;
    cmds.push(['HINCRBY', 'clicks:total', target, '1']);
  }
  if (ev === 'scroll' && m) cmds.push(['HINCRBY', 'scroll:total', String(m), '1']);
  if (ev === 'section' && m) cmds.push(['HINCRBY', 'section:views', String(m).slice(0, 40), '1']);

  if (ev === 'visit-end') {
    const secs = Math.max(0, Math.min(3600, Number(m) || 0));
    cmds.push(
      ['HINCRBY', 'time:total', 'seconds', String(secs)],
      ['HINCRBY', 'time:total', 'visits', '1'],
    );
    if (secs >= 30) cmds.push(['HINCRBY', 'time:total', 'engaged', '1']);
    if (b.dwell && typeof b.dwell === 'object') {
      for (const [sec, val] of Object.entries(b.dwell).slice(0, 12)) {
        const v = Math.max(0, Math.min(1800, Number(val) || 0));
        if (v > 0) cmds.push(['HINCRBY', 'section:seconds', String(sec).slice(0, 40), String(v)]);
      }
    }
  }

  // A/B test: views, clicks and finished visits per background variant
  if (bg) {
    const ab = (field, n = 1) => cmds.push(['HINCRBY', 'ab:bg', `${bg}:${field}`, String(n)]);
    if (ev === 'pageview') ab('views');
    if (typeof b.label === 'string' && b.label) ab('clicks');
    if (ev === 'visit-end') {
      const secs = Math.max(0, Math.min(3600, Number(m) || 0));
      ab('ended'); ab('seconds', secs);
      if (secs >= 30) ab('engaged');
      if (Number.isFinite(Number(b.depth))) ab('depth', Math.max(0, Math.min(100, Math.round(Number(b.depth)))));
    }
  }

  // every all-time counter also gets a per-day copy, kept 400 days, so the dashboard can filter by date
  for (const [, key, field, n] of cmds.filter((c) => c[0] === 'HINCRBY' && /:(total|views|seconds)$/.test(c[1]) && c[1] !== 'ev:total')) {
    cmds.push(['HINCRBY', `${key}@${day}`, field, n], ['EXPIRE', `${key}@${day}`, '34560000']);
  }

  try { await redis(cmds); } catch (err) { /* analytics never blocks */ }

  return res.status(204).end();
}

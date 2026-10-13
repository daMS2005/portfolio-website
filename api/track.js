// Cookieless event tracker. Enriches each event server-side with coarse geo
// (Vercel edge headers) and a parsed user-agent, then aggregates into Redis.
// Nothing is stored on the visitor's device; no persistent identifiers.

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
  const device = b.touch ? (Number(b.vw) < 768 ? 'mobile' : 'tablet') : 'desktop';

  console.log('[track]', JSON.stringify({ e: ev, m, sid, country, city, ...ua }));

  const { url: rurl, token: rtok } = redisCreds();
  if (!rurl || !rtok) return res.status(204).end();

  const cmds = [
    ['HINCRBY', `ev:${day}`, ev, '1'],
    ['HINCRBY', 'ev:total', ev, '1'],
  ];

  if (ev === 'pageview') {
    const source = refSource(b.ref, b.utm);
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
        t: now, sid, country, city, source,
        browser: ua.browser, os: ua.os, device,
        page: String(m || '').slice(0, 60), vw: b.vw, vh: b.vh, lang: b.lang, tz: b.tz,
      })],
      ['LTRIM', 'visits:recent', '0', '99'],
    );
  }

  if (ev === 'pageview' && m) cmds.push(['HINCRBY', 'pages:total', String(m).slice(0, 60), '1']);
  if (typeof b.label === 'string' && b.label) {
    const target = `${String(b.page || '').slice(0, 40)} · ${b.label.slice(0, 50)}`;
    cmds.push(['HINCRBY', 'clicks:total', target, '1']);
  }
  if (ev === 'scroll' && m) cmds.push(['HINCRBY', 'scroll:total', String(m), '1']);
  if (ev === 'section' && m) cmds.push(['HINCRBY', 'section:views', String(m).slice(0, 24), '1']);

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
        if (v > 0) cmds.push(['HINCRBY', 'section:seconds', String(sec).slice(0, 24), String(v)]);
      }
    }
  }

  try {
    await fetch(`${rurl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rtok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
  } catch (err) { /* analytics never blocks */ }

  return res.status(204).end();
}

// Gated analytics readout. Opens with Daniel's private link (its key's SHA-256 is
// below; the key itself is never in this public repo) or the Vercel env var STATS_PASSWORD.
import { createHash } from 'node:crypto';

const ipHash = (ip) => createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
const KEY_SHA256 = '0e130498da689896131ff87d6f8d50f604eef3d59f3db2df3a7db37053b86b40';

// Vercel's marketplace integrations inject Redis credentials under several
// different names depending on the integration version - accept them all.
function redisCreds() {
  const e = process.env;
  return {
    url: e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL || e.REDIS_REST_URL || '',
    token: e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN || e.REDIS_REST_TOKEN || '',
  };
}

const failures = globalThis.__mora_stats_fails || (globalThis.__mora_stats_fails = new Map());

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = String((req.body && req.body.key) || '');
  const keyOk = key.length > 20 && createHash('sha256').update(key).digest('hex') === KEY_SHA256;
  const expected = (process.env.STATS_PASSWORD || '').trim();
  if (!keyOk && !expected) {
    return res.status(503).json({ error: 'Stats are not available' });
  }

  // at most 8 wrong guesses per IP per 15 minutes (per warm instance)
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const fails = (failures.get(ip) || []).filter((t) => now - t < 15 * 60_000);
  if (!keyOk && fails.length >= 8) return res.status(429).json({ error: 'Too many attempts - try again later' });

  const given = String((req.body && req.body.password) || '').trim();
  // constant-ish time compare
  let ok = given.length === expected.length;
  for (let i = 0; i < expected.length; i++) {
    ok = (given.charCodeAt(i) === expected.charCodeAt(i)) && ok;
  }
  if (!ok && !keyOk) {
    failures.set(ip, [...fails, now]);
    return res.status(401).json({ error: 'wrong password' });
  }

  const { url: rurl, token: rtok } = redisCreds();
  // access granted - if storage isn't wired yet, show an empty dashboard
  // with a notice rather than an error that looks like a failed login
  if (!rurl || !rtok) {
    return res.status(200).json({
      totals: {}, countries: {}, recentQuestions: [], daily: {},
      notice: 'Logged in - but no Redis credentials found in this deployment. Connect an Upstash database or set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, then redeploy.',
    });
  }

  async function redis(cmds) {
    const r = await fetch(`${rurl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rtok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error('redis ' + r.status);
    return (await r.json()).map((x) => x.result);
  }

  function toObj(flat) {
    const o = {};
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]);
    }
    return o;
  }

  try {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    }
    const KEYS = [
      'ev:total', 'geo:total', 'city:total', 'src:total', 'browser:total',
      'os:total', 'device:total', 'lang:total', 'scroll:total',
      'section:views', 'section:seconds', 'time:total', 'visits:day',
      'campaign:total', 'pages:total', 'clicks:total', 'ref:total',
    ];
    const cmds = [
      ...KEYS.map((k) => ['HGETALL', k]),
      ['LRANGE', 'chat:recent', '0', '49'],
      ['LRANGE', 'visits:recent', '0', '49'],
      ...days.map((d) => ['HGETALL', `ev:${d}`]),
      // whoever opens the dashboard is Daniel: api/track.js skips this network for 30 days
      ['HSET', 'owner:ips', ipHash(ip), String(now)],
    ];
    const out = await redis(cmds);

    const data = {};
    KEYS.forEach((k, i) => { data[k.replace(/[:.]/g, '_')] = toObj(out[i]); });

    const parseList = (arr) => (arr || [])
      .map((x) => { try { return JSON.parse(x); } catch { return null; } })
      .filter(Boolean);

    // each recent visit's timeline: pages, sections, clicks and time on page
    const recentVisits = parseList(out[KEYS.length + 1]);
    const steps = recentVisits.length ? await redis(recentVisits.map((v) => ['LRANGE', `s:${v.sid}`, '0', '-1'])) : [];
    recentVisits.forEach((v, i) => { v.steps = parseList(steps[i]); });

    const daily = {};
    days.forEach((d, i) => { daily[d] = toObj(out[KEYS.length + 2 + i]); });

    const t = data.time_total || {};
    const visits = Number(t.visits || 0);
    const summary = {
      pageviews: Number((data.ev_total || {}).pageview || 0),
      visitsEnded: visits,
      avgSeconds: visits ? Math.round(Number(t.seconds || 0) / visits) : 0,
      engagedRate: visits ? Math.round((Number(t.engaged || 0) / visits) * 100) : 0,
      chatMessages: Number((data.ev_total || {})['chat-message'] || 0),
    };

    return res.status(200).json({
      summary,
      totals: data.ev_total,
      countries: data.geo_total,
      cities: data.city_total,
      sources: data.src_total,
      browsers: data.browser_total,
      os: data.os_total,
      devices: data.device_total,
      languages: data.lang_total,
      campaigns: data.campaign_total,
      pages: data.pages_total,
      clicks: data.clicks_total,
      referrers: data.ref_total,
      scroll: data.scroll_total,
      sectionViews: data.section_views,
      sectionSeconds: data.section_seconds,
      visitsPerDay: data.visits_day,
      daily,
      recentQuestions: parseList(out[KEYS.length]),
      recentVisits,
    });
  } catch (e) {
    console.error('stats error', e);
    return res.status(502).json({ error: `stats storage unreachable (${e.message})` });
  }
}

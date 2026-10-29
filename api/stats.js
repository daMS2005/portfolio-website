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
    // optional date range: from/to (YYYY-MM-DD) pick the per-day counters, fromTs/toTs (the
    // visitor's local day bounds) pick the visits and questions; no range means all time
    const body = req.body || {}, isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const ranged = isDay(body.from) && isDay(body.to) && body.from <= body.to;
    const days = [];
    if (ranged) {
      for (let d = Date.parse(`${body.from}T00:00:00Z`); d <= Date.parse(`${body.to}T00:00:00Z`) && days.length < 62; d += 86400000) {
        days.push(new Date(d).toISOString().slice(0, 10));
      }
    } else {
      for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    }
    const fromTs = ranged ? Number(body.fromTs) || Date.parse(`${body.from}T00:00:00Z`) : 0;
    const toTs = ranged ? Number(body.toTs) || Date.parse(`${body.to}T00:00:00Z`) + 86400000 : Infinity;

    const KEYS = [
      'geo:total', 'city:total', 'src:total', 'browser:total', 'os:total', 'device:total', 'lang:total',
      'scroll:total', 'section:views', 'section:seconds', 'time:total', 'campaign:total', 'pages:total',
      'clicks:total', 'ref:total',
    ];
    const groups = [
      ...KEYS.map((k) => (ranged ? days.map((d) => ['HGETALL', `${k}@${d}`]) : [['HGETALL', k]])),
      ranged ? [] : [['HGETALL', 'ev:total']],
      days.map((d) => ['HGETALL', `ev:${d}`]),
      [['LRANGE', 'chat:recent', '0', '199']],
      [['LRANGE', 'visits:recent', '0', '999']],
      // whoever opens the dashboard is Daniel: api/track.js skips this network for 30 days
      [['HSET', 'owner:ips', ipHash(ip), String(now)]],
      [['HGETALL', 'ab:bg']],
    ];
    const flat = await redis(groups.flat());
    let at = 0;
    const out = groups.map((g) => flat.slice(at, (at += g.length)));
    const sum = (objs) => objs.reduce((acc, o) => { for (const [k, v] of Object.entries(o)) acc[k] = (acc[k] || 0) + v; return acc; }, {});

    const data = {};
    KEYS.forEach((k, i) => { data[k] = sum(out[i].map(toObj)); });
    const evDays = out[KEYS.length + 1].map(toObj);
    const ev = ranged ? sum(evDays) : toObj(out[KEYS.length][0]);
    const daily = Object.fromEntries(days.map((d, i) => [d, evDays[i]]));

    const parseList = (arr) => (arr || [])
      .map((x) => { try { return JSON.parse(x); } catch { return null; } })
      .filter(Boolean);
    const inRange = (x) => x.t >= fromTs && x.t < toTs;
    const recentQuestions = parseList(out[KEYS.length + 2][0]).filter(inRange);

    // each visit's timeline: pages, sections, clicks and time on page (newest 200 in the range)
    const recentVisits = parseList(out[KEYS.length + 3][0]).filter(inRange).slice(0, 200);
    const steps = recentVisits.length ? await redis(recentVisits.map((v) => ['LRANGE', `s:${v.sid}`, '0', '-1'])) : [];
    recentVisits.forEach((v, i) => { v.steps = parseList(steps[i]); });

    const t = data['time:total'];
    const visits = Number(t.visits || 0);
    const summary = {
      pageviews: Number(ev.pageview || 0),
      visitsEnded: visits,
      avgSeconds: visits ? Math.round(Number(t.seconds || 0) / visits) : 0,
      engagedRate: visits ? Math.round((Number(t.engaged || 0) / visits) * 100) : 0,
      chatMessages: Number(ev['chat-message'] || 0),
    };

    return res.status(200).json({
      range: ranged ? { from: days[0], to: days[days.length - 1] } : null,
      summary,
      totals: ev,
      countries: data['geo:total'],
      cities: data['city:total'],
      sources: data['src:total'],
      browsers: data['browser:total'],
      os: data['os:total'],
      devices: data['device:total'],
      languages: data['lang:total'],
      campaigns: data['campaign:total'],
      pages: data['pages:total'],
      clicks: data['clicks:total'],
      referrers: data['ref:total'],
      scroll: data['scroll:total'],
      sectionViews: data['section:views'],
      sectionSeconds: data['section:seconds'],
      daily,
      ab: toObj(out[KEYS.length + 5][0]),
      recentQuestions,
      recentVisits,
    });
  } catch (e) {
    console.error('stats error', e);
    return res.status(502).json({ error: `stats storage unreachable (${e.message})` });
  }
}

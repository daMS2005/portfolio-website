const WINDOW_MS = 30 * 60 * 1000;
const MAX_REQUESTS = 4;
const buckets = globalThis.__video_request_rl || (globalThis.__video_request_rl = new Map());

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (hits.length >= MAX_REQUESTS) {
    buckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  buckets.set(ip, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === String(host).split(',')[0].trim();
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin rejected.' });

  const body = req.body || {};
  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ ok: true });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (topic.length < 8 || topic.length > 2500) {
    return res.status(400).json({ error: 'The case reference must be between 8 and 2,500 characters.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in about 30 minutes.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Email delivery is not configured yet.' });
  }

  const to = process.env.VIDEO_REQUEST_TO || 'damorasoler@gmail.com';
  const from = process.env.VIDEO_REQUEST_FROM || 'Portfolio <onboarding@resend.dev>';
  const safeEmail = escapeHtml(email);
  const safeTopic = escapeHtml(topic).replaceAll('\n', '<br>');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `tcacc-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: 'New TC_ACC documentary request',
        text: `Reply-to email: ${email}\n\nCase or reference:\n${topic}`,
        html: `<h2>New TC_ACC documentary request</h2><p><strong>Reply-to:</strong> ${safeEmail}</p><p><strong>Case or reference:</strong><br>${safeTopic}</p>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('video request email error', response.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'Email delivery failed. Please try again.' });
    }

    const result = await response.json();
    console.log('[video-request]', JSON.stringify({ id: result.id || null }));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('video request error', error);
    return res.status(502).json({ error: 'Email delivery failed. Please try again.' });
  }
}

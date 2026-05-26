'use strict';

const kv = require('./kv.js');

const NOTIFY_EMAIL = process.env.MAMA_NOTIFY_EMAIL || 'stas.mono123@gmail.com';
const SEND_FROM = process.env.MAMA_SEND_FROM || 'mama <onboarding@resend.dev>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function checkRateLimit(ip) {
  const key = `mama:rate:${ip}`;
  try {
    const count = await kv.get(key);
    const n = typeof count === 'number' ? count : Number(count || 0);
    if (n >= 8) return false;
    await kv.set(key, n + 1, { ex: 3600 });
    return true;
  } catch (e) {
    console.warn('[mama-send] rate limit skip:', e.message);
    return true;
  }
}

async function sendViaResend({ to, subject, text }) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_resend_key' };

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SEND_FROM,
      to: [to],
      subject,
      text,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Resend ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  return { sent: true, id: json.id };
}

async function storeSubmission(payload) {
  const id = String(Date.now());
  const key = `mama:submission:${id}`;
  try {
    await kv.set(key, payload, { ex: 60 * 60 * 24 * 365 });
    await kv.set('mama:submission:latest', { id, ...payload }, { ex: 60 * 60 * 24 * 365 });
    return { stored: true, id };
  } catch (e) {
    console.error('[mama-send] KV store failed:', e.message);
    return { stored: false, id };
  }
}

async function submitMamaAnswers(req, body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const answered = Number(body.answered) || 0;
  const total = Number(body.total) || 0;

  if (!text || answered <= 0) {
    const err = new Error('brak odpowiedzi do wysłania');
    err.status = 400;
    throw err;
  }

  if (text.length > 120000) {
    const err = new Error('za duży payload');
    err.status = 413;
    throw err;
  }

  const ip = clientIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    const err = new Error('za dużo prób — spróbuj za chwilę');
    err.status = 429;
    throw err;
  }

  const submittedAt = new Date().toISOString();
  const payload = {
    text,
    answered,
    total,
    submittedAt,
    ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 240),
  };

  const store = await storeSubmission(payload);

  let email = { sent: false, reason: 'not_attempted' };
  try {
    email = await sendViaResend({
      to: NOTIFY_EMAIL,
      subject: `mama — ${answered} odpowiedzi`,
      text: text + '\n\n—\n' + submittedAt,
    });
  } catch (e) {
    console.error('[mama-send] email failed:', e.message);
    email = { sent: false, reason: e.message };
  }

  if (!email.sent && !store.stored) {
    const err = new Error('nie udało się zapisać ani wysłać');
    err.status = 503;
    throw err;
  }

  return {
    ok: true,
    emailed: email.sent,
    stored: store.stored,
    id: store.id,
    emailId: email.id || null,
  };
}

module.exports = {
  submitMamaAnswers,
  NOTIFY_EMAIL,
};

'use strict';

const kv = require('../_lib/kv.js');
const { sign } = require('../_lib/jwt.js');

const JWT_30_DAYS = 30 * 24 * 60 * 60;
const TRANSFER_5_MIN = 5 * 60;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

function setCookie(res, value, maxAge) {
  res.setHeader(
    'Set-Cookie',
    `szpineta_access=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

async function logScan(req, code, fingerprint, state) {
  try {
    const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
      || req.headers['x-real-ip'] || '?';
    const gps = req.body.gps || null;
    const event = {
      at: new Date().toISOString(),
      code,
      state,
      ip,
      country: req.headers['x-vercel-ip-country'] || '?',
      city: req.headers['x-vercel-ip-city'] || '?',
      lat: gps?.lat ?? req.headers['x-vercel-ip-latitude'] ?? null,
      lng: gps?.lng ?? req.headers['x-vercel-ip-longitude'] ?? null,
      acc: gps?.acc ?? null,
      ua: (req.headers['user-agent'] || '?').slice(0, 150),
      fp: fingerprint ? fingerprint.slice(0, 16) : '?',
    };
    await kv.kvCommand(['RPUSH', 'scans:log', JSON.stringify(event)]);
    await kv.kvCommand(['LTRIM', 'scans:log', '-500', '-1']);
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  const { code, fingerprint } = req.body || {};
  if (!code || !fingerprint || typeof code !== 'string' || typeof fingerprint !== 'string') {
    return res.status(400).json({ error: 'missing code or fingerprint' });
  }
  if (!CODE_RE.test(code.toUpperCase())) {
    return res.status(400).json({ error: 'invalid code format' });
  }

  const upperCode = code.toUpperCase();
  const codeData = await kv.get(`codes:${upperCode}`);
  if (!codeData || codeData.status !== 'active') {
    return res.status(404).json({ error: 'code not found' });
  }

  const pairing = await kv.get(`code_pairings:${upperCode}`);
  const now = new Date().toISOString();

  if (!pairing) {
    await kv.set(`code_pairings:${upperCode}`, {
      code: upperCode,
      fingerprint,
      firstActivatedAt: now,
      lastSeenAt: now,
    });
    const token = sign({ code: upperCode, fingerprint }, JWT_SECRET, JWT_30_DAYS);
    setCookie(res, token, JWT_30_DAYS);
    await logScan(req, upperCode, fingerprint, 'first');
    return res.json({ state: 'first' });
  }

  if (pairing.fingerprint === fingerprint) {
    await kv.set(`code_pairings:${upperCode}`, { ...pairing, lastSeenAt: now });
    const token = sign({ code: upperCode, fingerprint }, JWT_SECRET, JWT_30_DAYS);
    setCookie(res, token, JWT_30_DAYS);
    await logScan(req, upperCode, fingerprint, 'known');
    return res.json({ state: 'known' });
  }

  // Different device — short-lived transfer token
  const transferToken = sign({ code: upperCode, action: 'transfer' }, JWT_SECRET, TRANSFER_5_MIN);
  await logScan(req, upperCode, fingerprint, 'transfer');
  return res.json({ state: 'transfer', transferToken });
};

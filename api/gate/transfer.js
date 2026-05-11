'use strict';

const kv = require('../_lib/kv.js');
const { sign, verify } = require('../_lib/jwt.js');

const JWT_30_DAYS = 30 * 24 * 60 * 60;

function setCookie(res, value, maxAge) {
  res.setHeader(
    'Set-Cookie',
    `szpineta_access=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

module.exports = async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  const { transferToken, fingerprint } = req.body || {};
  if (!transferToken || !fingerprint) {
    return res.status(400).json({ error: 'missing params' });
  }

  let payload;
  try {
    payload = verify(transferToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'invalid or expired transfer token' });
  }

  if (payload.action !== 'transfer') {
    return res.status(400).json({ error: 'invalid token type' });
  }

  const { code } = payload;
  const pairing = await kv.get(`code_pairings:${code}`);
  if (!pairing) return res.status(404).json({ error: 'pairing not found' });

  const now = new Date().toISOString();
  await kv.set(`code_pairings:${code}`, {
    ...pairing,
    fingerprint,
    lastSeenAt: now,
    transferredAt: now,
  });

  const token = sign({ code, fingerprint }, JWT_SECRET, JWT_30_DAYS);
  setCookie(res, token, JWT_30_DAYS);
  return res.json({ state: 'success' });
};

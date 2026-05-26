'use strict';

// Admin "master key" bypass — pozwala wejść na /poems.html bez znajdki.
// Klucz w env: ADMIN_MASTER_KEY. Bez ustawionego env endpoint jest wyłączony.

const { sign } = require('../_lib/jwt.js');

const JWT_SECRET = process.env.JWT_SECRET;
const MASTER_KEY = process.env.ADMIN_MASTER_KEY;
const JWT_365_DAYS = 365 * 24 * 60 * 60;

function setCookie(res, value, maxAge) {
  res.setHeader(
    'Set-Cookie',
    `szpineta_access=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

// constant-time string compare
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });
  if (!MASTER_KEY) return res.status(503).json({ error: 'admin master key not configured' });

  const { key } = req.body || {};
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'missing key' });
  }
  if (!safeEqual(key, MASTER_KEY)) {
    return res.status(401).json({ error: 'invalid' });
  }

  const token = sign(
    { code: 'ADMIN', fingerprint: 'master', admin: true },
    JWT_SECRET,
    JWT_365_DAYS,
  );
  setCookie(res, token, JWT_365_DAYS);
  return res.json({ ok: true });
};

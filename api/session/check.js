'use strict';

const { verify, sign } = require('../_lib/jwt.js');

const JWT_SECRET = process.env.JWT_SECRET;
const MASTER_KEY = process.env.ADMIN_MASTER_KEY;
const JWT_365_DAYS = 365 * 24 * 60 * 60;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  }
  return out;
}

function setCookie(res, value, maxAge) {
  res.setHeader(
    'Set-Cookie',
    `szpineta_access=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function adminMaster(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });
  if (!MASTER_KEY) return res.status(503).json({ error: 'admin master key not configured' });

  const body = typeof req.body === 'string'
    ? JSON.parse(req.body || '{}')
    : (req.body || {});
  const { key } = body;
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
}

module.exports = async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path === '/api/admin/master' || path.endsWith('/api/admin/master')) {
    return adminMaster(req, res);
  }

  if (req.method !== 'GET') return res.status(405).end();
  if (!JWT_SECRET) return res.json({ valid: false });

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['szpineta_access'];
  if (!token) return res.json({ valid: false });

  try {
    const payload = verify(token, JWT_SECRET);
    return res.json({ valid: true, code: payload.code });
  } catch {
    return res.json({ valid: false });
  }
};

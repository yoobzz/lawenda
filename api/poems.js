'use strict';

const kv = require('./_lib/kv.js');
const { verify } = require('./_lib/jwt.js');

const JWT_SECRET = process.env.JWT_SECRET;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['szpineta_access'];
  if (!token) return res.status(401).json({ error: 'no session' });

  try {
    verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'invalid session' });
  }

  const poems = await kv.get('poems:all');
  if (!poems) return res.status(500).json({ error: 'poems not in KV' });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ poems });
};

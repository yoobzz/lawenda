'use strict';

const { verify } = require('../_lib/jwt.js');

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

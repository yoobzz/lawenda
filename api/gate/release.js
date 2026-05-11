'use strict';

const kv = require('../_lib/kv.js');
const { verify } = require('../_lib/jwt.js');
const { parseCookies } = require('../_lib/cookies.js');

function clearCookie(res) {
  res.setHeader(
    'Set-Cookie',
    'szpineta_access=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
  );
}

module.exports = async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['szpineta_access'];
  if (!token) return res.status(401).json({ error: 'no session' });

  let payload;
  try {
    payload = verify(token, JWT_SECRET);
  } catch {
    clearCookie(res);
    return res.status(401).json({ error: 'invalid session' });
  }

  if (payload.code) {
    await kv.del(`code_pairings:${payload.code}`);
  }

  clearCookie(res);
  return res.json({ state: 'released' });
};

'use strict';

const { verify } = require('../_lib/jwt.js');
const { parseCookies } = require('../_lib/cookies.js');

module.exports = async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET;
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

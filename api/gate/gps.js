'use strict';

const kv = require('../_lib/kv.js');
const { verify } = require('../_lib/jwt.js');
const { parseCookies } = require('../_lib/cookies.js');

module.exports = async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).end();

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['szpineta_access'];
  if (!token) return res.status(401).end();

  let payload;
  try {
    payload = verify(token, JWT_SECRET);
  } catch {
    return res.status(401).end();
  }

  const { gps } = req.body || {};
  if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
    return res.status(400).end();
  }

  const event = {
    at: new Date().toISOString(),
    code: payload.code,
    state: 'gps',
    lat: gps.lat,
    lng: gps.lng,
    acc: gps.acc ?? null,
  };

  try {
    await kv.kvCommand(['RPUSH', 'scans:log', JSON.stringify(event)]);
    await kv.kvCommand(['LTRIM', 'scans:log', '-500', '-1']);
  } catch (_) {}

  return res.json({ ok: true });
};

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

// Pelny dostep tylko dla waznej sesji: admin (master) ALBO posiadacz znajdki,
// ktorej kod istnieje, nie jest wycofany i ma aktualna pare z tym fingerprintem.
// Dzieki temu "wycofaj"/"oddaj"/przejecie blokuja dostep natychmiast. Brak zajawki.
async function isFullAccess(req) {
  if (!JWT_SECRET) return false;
  const token = parseCookies(req.headers.cookie)['szpineta_access'];
  if (!token) return false;

  let payload;
  try {
    payload = verify(token, JWT_SECRET);
  } catch {
    return false;
  }

  if (payload.admin === true) return true;

  const code = payload.code;
  if (!code) return false;

  const codeData = await kv.get(`codes:${code}`);
  if (!codeData || codeData.status !== 'active' || codeData.state === 'revoked') return false;

  const pairing = await kv.get(`code_pairings:${code}`);
  if (!pairing) return false;
  if (payload.fingerprint && pairing.fingerprint && pairing.fingerprint !== payload.fingerprint) return false;

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  // Bez waznej sesji: brak dostepu (poems.html przekieruje na /gate.html).
  if (!(await isFullAccess(req))) {
    return res.status(401).json({ error: 'no session' });
  }

  const poems = await kv.get('poems:all');
  if (!poems) return res.status(500).json({ error: 'poems not in KV' });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ poems });
};

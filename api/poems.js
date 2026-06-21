'use strict';

const kv = require('./_lib/kv.js');
const { verify } = require('./_lib/jwt.js');

const JWT_SECRET = process.env.JWT_SECRET;

// Hybryda dostępu: wiersze publiczne (widoczne bez kodu) vs pełny zbiór (po kodzie z kartki).
// Indeksy odnoszą się do pola `index` z poems:all (extract-poems.js / data-index).
const PUBLIC_INDICES = [0, 10, 95, 102, 113, 144, 160];

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  }
  return out;
}

function hasValidSession(req) {
  if (!JWT_SECRET) return false;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['szpineta_access'];
  if (!token) return false;
  try {
    verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const all = await kv.get('poems:all');
  if (!Array.isArray(all) || !all.length) {
    return res.status(500).json({ error: 'poems not in KV' });
  }

  // Pełny zbiór tylko dla ważnej sesji (kod QR / admin).
  if (hasValidSession(req)) {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ poems: all, full: true, total: all.length });
  }

  // Bez sesji: tylko zajawka publiczna. Kolejność = rosnące indeksy (jak w KV).
  const publicSet = new Set(PUBLIC_INDICES);
  const poems = all.filter((p) => publicSet.has(p.index));
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.json({ poems, full: false, total: all.length });
};

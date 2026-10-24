'use strict';

const kv = require('../_lib/kv.js');
const { sign } = require('../_lib/jwt.js');
const { normalizeCode, devicesOf, MAX_DEVICES } = require('../_lib/codes.js');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_30_DAYS = 30 * 24 * 60 * 60;
const TRANSFER_5_MIN = 5 * 60;
const MAX_TRACE = 60;

// Opcjonalny "ślad" zostawiany przez znalazcę (imię/@insta). Bez znaków kontrolnych.
function cleanTrace(value) {
  if (typeof value !== 'string') return '';
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    out += (c < 32 || c === 127) ? ' ' : value[i];
  }
  return out.trim().slice(0, MAX_TRACE);
}

function setCookie(res, value, maxAge) {
  res.setHeader(
    'Set-Cookie',
    `szpineta_access=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

async function logScan(req, code, fingerprint, state) {
  try {
    const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
      || req.headers['x-real-ip'] || '?';
    const event = {
      at: new Date().toISOString(),
      code,
      state,
      ip,
      country: req.headers['x-vercel-ip-country'] || '?',
      city: req.headers['x-vercel-ip-city'] || '?',
      lat: req.headers['x-vercel-ip-latitude'] || null,
      lng: req.headers['x-vercel-ip-longitude'] || null,
      ua: (req.headers['user-agent'] || '?').slice(0, 150),
      fp: fingerprint ? fingerprint.slice(0, 16) : '?',
    };
    await kv.kvCommand(['RPUSH', 'scans:log', JSON.stringify(event)]);
    await kv.kvCommand(['LTRIM', 'scans:log', '-500', '-1']);
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured' });

  const { code, fingerprint, trace } = req.body || {};
  if (!code || !fingerprint || typeof code !== 'string' || typeof fingerprint !== 'string') {
    return res.status(400).json({ error: 'missing code or fingerprint' });
  }
  // kod literowy (stare znajdki) albo ze znaczków; jeden klucz codes:{kod} dla obu
  const codeKey = normalizeCode(code);
  if (!codeKey) {
    return res.status(400).json({ error: 'invalid code format' });
  }

  const traceName = cleanTrace(trace);
  const codeData = await kv.get(`codes:${codeKey}`);
  if (!codeData || codeData.status !== 'active' || codeData.state === 'revoked') {
    return res.status(404).json({ error: 'code not found' });
  }

  // kod uniwersalny: sesja dla kazdego, bez parowania i bez przejmowania
  if (codeData.mode === 'universal') {
    const token = sign({ code: codeKey, fingerprint, universal: true }, JWT_SECRET, JWT_30_DAYS);
    setCookie(res, token, JWT_30_DAYS);
    await logScan(req, codeKey, fingerprint, 'universal');
    return res.json({ state: 'universal' });
  }

  const pairing = await kv.get(`code_pairings:${codeKey}`);
  const now = new Date().toISOString();

  if (!pairing) {
    await kv.set(`code_pairings:${codeKey}`, {
      code: codeKey,
      fingerprint,
      devices: [fingerprint],
      firstActivatedAt: now,
      lastSeenAt: now,
      ...(traceName ? { holderName: traceName } : {}),
    });
    const token = sign({ code: codeKey, fingerprint }, JWT_SECRET, JWT_30_DAYS);
    setCookie(res, token, JWT_30_DAYS);
    await logScan(req, codeKey, fingerprint, 'first');
    return res.json({ state: 'first' });
  }

  const devices = devicesOf(pairing);

  if (devices.includes(fingerprint)) {
    // dopisz ślad jeśli posiadacz go teraz zostawił, a wcześniej go nie było
    const holderName = pairing.holderName || traceName;
    await kv.set(`code_pairings:${codeKey}`, {
      ...pairing,
      devices,
      lastSeenAt: now,
      ...(holderName ? { holderName } : {}),
    });
    const token = sign({ code: codeKey, fingerprint }, JWT_SECRET, JWT_30_DAYS);
    setCookie(res, token, JWT_30_DAYS);
    await logScan(req, codeKey, fingerprint, 'known');
    return res.json({ state: 'known' });
  }

  // Kod osobisty: kolejne urządzenie tej samej osoby, do MAX_DEVICES. Potem nie wpuszcza.
  if (codeData.mode === 'personal') {
    if (devices.length < MAX_DEVICES) {
      const next = devices.concat(fingerprint);
      await kv.set(`code_pairings:${codeKey}`, { ...pairing, devices: next, lastSeenAt: now });
      const token = sign({ code: codeKey, fingerprint }, JWT_SECRET, JWT_30_DAYS);
      setCookie(res, token, JWT_30_DAYS);
      await logScan(req, codeKey, fingerprint, 'device');
      return res.json({ state: 'device', devices: next.length, maxDevices: MAX_DEVICES });
    }
    await logScan(req, codeKey, fingerprint, 'transfer');
    return res.json({ state: 'transfer', personal: true, full: true, maxDevices: MAX_DEVICES });
  }

  // Tryb "wild" — jedno urządzenie; krótkotrwały token transferu (zachowanie dotychczasowe).
  const transferToken = sign({ code: codeKey, action: 'transfer' }, JWT_SECRET, TRANSFER_5_MIN);
  await logScan(req, codeKey, fingerprint, 'transfer');
  return res.json({ state: 'transfer', transferToken });
};

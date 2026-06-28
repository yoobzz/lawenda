'use strict';

const crypto = require('crypto');
const kv = require('../_lib/kv.js');
const { requireAdmin } = require('../_lib/admin-auth.js');

const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;
const FINGERPRINT_RE = /^[a-zA-Z0-9_-]{8,128}$/;
// Alfabet jak w scripts/mint-codes.js — bez mylących znaków (0/O/1/I/L/U).
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const MODES = ['wild', 'personal'];
const STATES = ['minted', 'assigned', 'revoked'];
const MAX_LABEL = 80;
const MAX_RECIPIENT = 80;
const MAX_NOTE = 280;
const MAX_MINT = 50;

function normalizeCode(code) {
  return String(code || '').toUpperCase().trim();
}

// Zwraca undefined gdy pola nie podano (nie nadpisujemy); '' pozwala wyczyścić.
// Usuwa znaki kontrolne (kod < 32 lub 127) bez regexa, żeby źródło było czyste ASCII.
function cleanText(value, max) {
  if (value === undefined || value === null) return undefined;
  const s = String(value);
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    out += (c < 32 || c === 127) ? ' ' : s[i];
  }
  return out.trim().slice(0, max);
}

function randomCode() {
  const buf = crypto.randomBytes(4);
  let s = '';
  for (let i = 0; i < 4; i += 1) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

async function loadIndex() {
  const idx = await kv.get('codes:index');
  return Array.isArray(idx) ? idx.slice() : [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (requireAdmin(req, res) !== true) return;

  const body = req.body || {};
  const action = String(body.action || '').trim();

  try {
    // ── mint: wygeneruj N nowych kodów (bez pojedynczego `code`) ──
    if (action === 'mint') {
      const count = Math.max(1, Math.min(MAX_MINT, parseInt(body.count, 10) || 1));
      const label = cleanText(body.label, MAX_LABEL) || '';
      const recipient = cleanText(body.recipient, MAX_RECIPIENT) || '';
      const note = cleanText(body.note, MAX_NOTE) || '';
      const mode = MODES.includes(body.mode) ? body.mode : 'wild';

      const index = await loadIndex();
      const known = new Set(index);
      const created = [];
      const now = new Date().toISOString();

      let attempts = 0;
      const maxAttempts = count * 200;
      while (created.length < count && attempts < maxAttempts) {
        attempts += 1;
        const code = randomCode();
        if (known.has(code)) continue;
        if (await kv.exists(`codes:${code}`)) { known.add(code); continue; }
        const record = {
          code,
          serial: index.length + created.length + 1,
          status: 'active',
          state: recipient ? 'assigned' : 'minted',
          mode,
          label,
          recipient,
          note,
          issuedAt: now,
          assignedAt: recipient ? now : null,
          updatedAt: now,
        };
        await kv.set(`codes:${code}`, record);
        known.add(code);
        created.push(code);
      }

      if (!created.length) {
        return res.status(500).json({ error: 'nie udało się wygenerować unikalnych kodów' });
      }
      await kv.set('codes:index', index.concat(created));
      return res.json({ ok: true, action: 'mint', created, count: created.length });
    }

    // ── pozostałe akcje wymagają poprawnego kodu ──
    const code = normalizeCode(body.code);
    if (!CODE_RE.test(code)) return res.status(400).json({ error: 'invalid code' });

    if (action === 'setLabel') {
      const current = (await kv.get(`codes:${code}`)) || { code, status: 'active' };
      const next = { ...current, code };

      const label = cleanText(body.label, MAX_LABEL);
      const recipient = cleanText(body.recipient, MAX_RECIPIENT);
      const note = cleanText(body.note, MAX_NOTE);
      if (label !== undefined) next.label = label;
      if (recipient !== undefined) next.recipient = recipient;
      if (note !== undefined) next.note = note;

      if (body.mode !== undefined) {
        if (!MODES.includes(body.mode)) return res.status(400).json({ error: 'invalid mode' });
        next.mode = body.mode;
      }
      if (body.state !== undefined) {
        if (!STATES.includes(body.state)) return res.status(400).json({ error: 'invalid state' });
        next.state = body.state;
      } else if (next.recipient && (!next.state || next.state === 'minted')) {
        // wpisanie odbiorcy bez jawnego stanu = oznacz jako wydany
        next.state = 'assigned';
      }
      if (next.state === 'assigned' && !next.assignedAt) next.assignedAt = new Date().toISOString();
      next.updatedAt = new Date().toISOString();

      await kv.set(`codes:${code}`, next);
      return res.json({ ok: true, action: 'setLabel', code });
    }

    if (action === 'revoke') {
      const current = (await kv.get(`codes:${code}`)) || { code, status: 'active' };
      const next = { ...current, code, state: 'revoked', updatedAt: new Date().toISOString() };
      await kv.set(`codes:${code}`, next);
      // odpinamy obecnego posiadacza; nowy skan zostanie odrzucony (gate/scan sprawdza state)
      await kv.del(`code_pairings:${code}`);
      return res.json({ ok: true, action: 'revoke', code });
    }

    if (action === 'release') {
      await kv.del(`code_pairings:${code}`);
      return res.json({ ok: true, code, action: 'release' });
    }

    if (action === 'setFingerprint') {
      const fingerprint = String((body && body.fingerprint) || '').trim();
      if (!FINGERPRINT_RE.test(fingerprint)) {
        return res.status(400).json({ error: 'invalid fingerprint format' });
      }
      const now = new Date().toISOString();
      const pairing = await kv.get(`code_pairings:${code}`);
      const next = pairing && typeof pairing === 'object'
        ? { ...pairing, fingerprint, lastSeenAt: now }
        : { code, fingerprint, firstActivatedAt: now, lastSeenAt: now };
      await kv.set(`code_pairings:${code}`, next);
      return res.json({ ok: true, code, action: 'setFingerprint' });
    }

    return res.status(400).json({ error: 'invalid action' });
  } catch (_) {
    return res.status(500).json({ error: 'failed to update owner data' });
  }
};

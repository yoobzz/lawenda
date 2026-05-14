'use strict';

const kv = require('../_lib/kv.js');
const { requireAdminBasicAuth } = require('../_lib/admin-auth.js');

const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;
const FINGERPRINT_RE = /^[a-zA-Z0-9_-]{8,128}$/;

function normalizeCode(code) {
  return String(code || '').toUpperCase().trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (requireAdminBasicAuth(req, res) !== true) return;

  const action = String((req.body && req.body.action) || '').trim();
  const code = normalizeCode(req.body && req.body.code);
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'invalid code' });

  try {
    if (action === 'release') {
      await kv.del(`code_pairings:${code}`);
      return res.json({ ok: true, code, action: 'release' });
    }

    if (action === 'setFingerprint') {
      const fingerprint = String((req.body && req.body.fingerprint) || '').trim();
      if (!FINGERPRINT_RE.test(fingerprint)) {
        return res.status(400).json({ error: 'invalid fingerprint format' });
      }

      const now = new Date().toISOString();
      const pairing = await kv.get(`code_pairings:${code}`);
      const next = pairing && typeof pairing === 'object'
        ? { ...pairing, fingerprint, lastSeenAt: now }
        : {
          code,
          fingerprint,
          firstActivatedAt: now,
          lastSeenAt: now,
        };

      await kv.set(`code_pairings:${code}`, next);
      return res.json({ ok: true, code, action: 'setFingerprint' });
    }

    return res.status(400).json({ error: 'invalid action' });
  } catch (_) {
    return res.status(500).json({ error: 'failed to update owner data' });
  }
};

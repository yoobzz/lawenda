'use strict';

const kv = require('../_lib/kv.js');
const { requireAdminBasicAuth } = require('../_lib/admin-auth.js');

const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

function normalizeCodeList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return Array.from(
    new Set(
      rawList
        .map(code => String(code || '').toUpperCase().trim())
        .filter(code => CODE_RE.test(code)),
    ),
  ).sort();
}

function shortFingerprint(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'string') return null;
  const clean = fingerprint.trim();
  if (!clean) return null;
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
}

async function loadCodes() {
  const fromIndex = await kv.get('codes:index');
  const normalized = normalizeCodeList(fromIndex);
  if (normalized.length > 0) return normalized;

  const keys = await kv.kvCommand(['KEYS', 'codes:*']);
  return normalizeCodeList(
    (keys || [])
      .map(key => String(key || ''))
      .filter(key => key.startsWith('codes:'))
      .map(key => key.slice('codes:'.length))
      .filter(code => code !== 'index'),
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (requireAdminBasicAuth(req, res) !== true) return;

  const ownerFilter = String(req.query.owner || 'all');
  const search = String(req.query.search || '').toUpperCase().trim();
  const onlyWithOwner = ownerFilter === 'with';
  const onlyWithoutOwner = ownerFilter === 'without';

  try {
    const codes = await loadCodes();
    const rows = await Promise.all(
      codes.map(async code => {
        const [codeData, pairing] = await Promise.all([
          kv.get(`codes:${code}`),
          kv.get(`code_pairings:${code}`),
        ]);

        const ownerFingerprint = pairing && typeof pairing.fingerprint === 'string'
          ? pairing.fingerprint
          : null;

        return {
          code,
          status: codeData && typeof codeData.status === 'string' ? codeData.status : 'unknown',
          hasOwner: Boolean(ownerFingerprint),
          ownerFingerprintShort: shortFingerprint(ownerFingerprint),
          firstActivatedAt: pairing && pairing.firstActivatedAt ? pairing.firstActivatedAt : null,
          lastSeenAt: pairing && pairing.lastSeenAt ? pairing.lastSeenAt : null,
          transferredAt: pairing && pairing.transferredAt ? pairing.transferredAt : null,
        };
      }),
    );

    const filtered = rows.filter(row => {
      if (search && !row.code.includes(search)) return false;
      if (onlyWithOwner && !row.hasOwner) return false;
      if (onlyWithoutOwner && row.hasOwner) return false;
      return true;
    });

    return res.json({
      items: filtered.sort((a, b) => a.code.localeCompare(b.code)),
      total: filtered.length,
      totalAllCodes: rows.length,
    });
  } catch (_) {
    return res.status(500).json({ error: 'failed to load findings' });
  }
};

'use strict';

const kv = require('../_lib/kv.js');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { codes } = req.body || {};
  if (!Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'brak kodów' });
  }

  const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;
  const valid = codes.map(c => String(c).toUpperCase().trim()).filter(c => CODE_RE.test(c));
  if (valid.length === 0) return res.status(400).json({ error: 'żaden kod nie jest prawidłowy' });

  const results = await Promise.all(valid.map(async code => {
    try {
      await kv.del(`code_pairings:${code}`);
      return { code, ok: true };
    } catch (e) {
      return { code, ok: false, error: e.message };
    }
  }));

  return res.json({ results });
};

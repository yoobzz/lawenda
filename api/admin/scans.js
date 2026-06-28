'use strict';

const kv = require('../_lib/kv.js');
const { requireAdmin } = require('../_lib/admin-auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (requireAdmin(req, res) !== true) return;

  try {
    const items = await kv.kvCommand(['LRANGE', 'scans:log', '0', '-1']);
    const scans = (items || [])
      .map(s => { try { return JSON.parse(s); } catch (_) { return null; } })
      .filter(Boolean)
      .reverse();
    return res.json({ scans });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

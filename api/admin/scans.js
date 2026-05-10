'use strict';

const kv = require('../_lib/kv.js');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

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

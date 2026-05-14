'use strict';

const fs = require('fs');
const path = require('path');
const { requireAdminBasicAuth } = require('../_lib/admin-auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (requireAdminBasicAuth(req, res) !== true) return;

  try {
    const panelPath = path.join(process.cwd(), 'admin-findings.html');
    const html = await fs.promises.readFile(panelPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('admin panel unavailable');
  }
};

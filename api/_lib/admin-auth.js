'use strict';

const crypto = require('crypto');

function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function unauthorized(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="szpineta-admin", charset="UTF-8"');
  return res.status(401).json({ error: 'unauthorized' });
}

function requireAdminBasicAuth(req, res) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;

  if (!expectedUser || !expectedPass) {
    return res.status(500).json({ error: 'admin auth misconfigured' });
  }

  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Basic ')) return unauthorized(res);

  let decoded = '';
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  } catch (_) {
    return unauthorized(res);
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return unauthorized(res);

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);
  if (!safeEqualString(user, expectedUser) || !safeEqualString(pass, expectedPass)) {
    return unauthorized(res);
  }

  return true;
}

module.exports = { requireAdminBasicAuth };

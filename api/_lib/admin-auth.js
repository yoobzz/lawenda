'use strict';

const crypto = require('crypto');
const { verify } = require('./jwt.js');

function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

// Jedyne logowanie panelu: master key -> JWT cookie z admin:true (patrz api/session/check.js).
function isAdminJwt(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  const token = readCookie(req, 'szpineta_access');
  if (!token) return false;
  try {
    const payload = verify(token, secret);
    return Boolean(payload && payload.admin === true);
  } catch (_) {
    return false;
  }
}

// Niemy fallback dla skryptów/CLI (curl): Authorization: Bearer ADMIN_TOKEN.
function isAdminBearer(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 && safeEqualString(token, expected);
}

// Ujednolicony strażnik admina: JWT cookie (panel) LUB Bearer (skrypty).
// Zwraca true, albo wysyła zwykłe 401 (BEZ Basic challenge, żeby panel nie pokazywał popupu).
function requireAdmin(req, res) {
  if (isAdminJwt(req) || isAdminBearer(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
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

module.exports = { requireAdminBasicAuth, requireAdmin, isAdminJwt, isAdminBearer };

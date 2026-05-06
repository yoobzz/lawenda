'use strict';

const crypto = require('crypto');

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function sign(payload, secret, expiresInSeconds) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedPayload = b64url(Buffer.from(JSON.stringify(fullPayload)));
  const data = `${header}.${encodedPayload}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid token');
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('invalid signature');
  }
  const decoded = JSON.parse(b64urlDecode(payload).toString());
  if (decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('token expired');
  return decoded;
}

module.exports = { sign, verify };

'use strict';

const { sign, verify } = require('../jwt.js');

const SECRET = 'test-secret';

describe('sign', () => {
  test('returns a 3-part dot-separated token', () => {
    const token = sign({ sub: '1' }, SECRET, 60);
    expect(token.split('.')).toHaveLength(3);
  });

  test('decoded payload contains original fields plus iat and exp', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = sign({ code: 'ABCD', fingerprint: 'fp1' }, SECRET, 300);
    const [, payloadB64] = token.split('.');
    const decoded = JSON.parse(
      Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        payloadB64.length + (4 - (payloadB64.length % 4)) % 4, '='
      ), 'base64').toString()
    );
    expect(decoded.code).toBe('ABCD');
    expect(decoded.fingerprint).toBe('fp1');
    expect(decoded.iat).toBeGreaterThanOrEqual(before);
    expect(decoded.exp).toBe(decoded.iat + 300);
  });

  test('header encodes alg HS256 and typ JWT', () => {
    const token = sign({}, SECRET, 60);
    const [headerB64] = token.split('.');
    const header = JSON.parse(
      Buffer.from(headerB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        headerB64.length + (4 - (headerB64.length % 4)) % 4, '='
      ), 'base64').toString()
    );
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });
});

describe('verify', () => {
  test('accepts a freshly signed token and returns payload', () => {
    const token = sign({ code: 'WXYZ', action: 'transfer' }, SECRET, 60);
    const payload = verify(token, SECRET);
    expect(payload.code).toBe('WXYZ');
    expect(payload.action).toBe('transfer');
  });

  test('throws "token expired" for a token with past exp', () => {
    const token = sign({ sub: '1' }, SECRET, -1);
    expect(() => verify(token, SECRET)).toThrow('token expired');
  });

  test('throws "invalid signature" when payload is tampered', () => {
    const token = sign({ code: 'AAAA' }, SECRET, 60);
    const parts = token.split('.');
    const tampered = JSON.stringify({ code: 'ZZZZ', iat: 9999, exp: 9999999999 });
    parts[1] = Buffer.from(tampered).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(() => verify(parts.join('.'), SECRET)).toThrow('invalid signature');
  });

  test('throws "invalid token" for a 2-part token', () => {
    expect(() => verify('header.payload', SECRET)).toThrow('invalid token');
  });

  test('throws "invalid token" for a 1-part string', () => {
    expect(() => verify('onlyone', SECRET)).toThrow('invalid token');
  });

  test('throws "invalid signature" when signed with a different secret', () => {
    const token = sign({ sub: '1' }, 'other-secret', 60);
    expect(() => verify(token, SECRET)).toThrow('invalid signature');
  });

  test('throws "invalid signature" for a token with a truncated signature', () => {
    const token = sign({ sub: '1' }, SECRET, 60);
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, 4);
    expect(() => verify(parts.join('.'), SECRET)).toThrow('invalid signature');
  });
});

describe('parseCookies (via cookies.js)', () => {
  const { parseCookies } = require('../cookies.js');

  test('returns empty object for undefined header', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  test('returns empty object for empty string', () => {
    expect(parseCookies('')).toEqual({});
  });

  test('parses a single cookie', () => {
    expect(parseCookies('foo=bar')).toEqual({ foo: 'bar' });
  });

  test('parses multiple cookies', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  test('handles values containing = signs', () => {
    const result = parseCookies('token=abc=def=ghi');
    expect(result.token).toBe('abc=def=ghi');
  });

  test('ignores entries with no key', () => {
    const result = parseCookies('; foo=bar');
    expect(result.foo).toBe('bar');
  });
});

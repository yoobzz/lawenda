'use strict';

jest.mock('../../_lib/jwt.js');

const jwt = require('../../_lib/jwt.js');
const handler = require('../check.js');

const SECRET = 'secret';

function makeReq(cookieHeader, overrides = {}) {
  return {
    method: 'GET',
    headers: { cookie: cookieHeader },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _headers: {},
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    end() {},
  };
  return res;
}

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

test('returns 405 for non-GET method', async () => {
  const res = makeRes();
  await handler(makeReq(undefined, { method: 'POST' }), res);
  expect(res._status).toBe(405);
});

test('returns valid: false when JWT_SECRET is not set', async () => {
  delete process.env.JWT_SECRET;
  const res = makeRes();
  await handler(makeReq('szpineta_access=tok'), res);
  expect(res._body).toEqual({ valid: false });
});

test('returns valid: false when no cookie is present', async () => {
  const res = makeRes();
  await handler(makeReq(undefined), res);
  expect(res._body).toEqual({ valid: false });
});

test('returns valid: false when cookie header is empty string', async () => {
  const res = makeRes();
  await handler(makeReq(''), res);
  expect(res._body).toEqual({ valid: false });
});

test('returns valid: false for an invalid JWT', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });
  const res = makeRes();
  await handler(makeReq('szpineta_access=bad-token'), res);
  expect(res._body).toEqual({ valid: false });
});

test('returns valid: false for an expired JWT', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('token expired'); });
  const res = makeRes();
  await handler(makeReq('szpineta_access=old-token'), res);
  expect(res._body).toEqual({ valid: false });
});

test('returns valid: true with code for a valid JWT', async () => {
  jwt.verify.mockReturnValue({ code: 'ABCD', fingerprint: 'fp' });
  const res = makeRes();
  await handler(makeReq('szpineta_access=good-token'), res);
  expect(res._body).toEqual({ valid: true, code: 'ABCD' });
});

test('parses szpineta_access from a multi-cookie header', async () => {
  jwt.verify.mockReturnValue({ code: 'WXYZ', fingerprint: 'fp' });
  const res = makeRes();
  await handler(makeReq('other=x; szpineta_access=good-token; another=y'), res);
  expect(res._body).toEqual({ valid: true, code: 'WXYZ' });
  expect(jwt.verify).toHaveBeenCalledWith('good-token', SECRET);
});

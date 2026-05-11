'use strict';

jest.mock('../../_lib/kv.js');
jest.mock('../../_lib/jwt.js');

const kv = require('../../_lib/kv.js');
const jwt = require('../../_lib/jwt.js');
const handler = require('../release.js');

const SECRET = 'secret';

function makeReq(cookieHeader, overrides = {}) {
  return {
    method: 'POST',
    headers: { cookie: cookieHeader },
    body: {},
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

test('returns 405 for non-POST method', async () => {
  const res = makeRes();
  await handler(makeReq(undefined, { method: 'GET' }), res);
  expect(res._status).toBe(405);
});

test('returns 500 when JWT_SECRET is missing', async () => {
  delete process.env.JWT_SECRET;
  const res = makeRes();
  await handler(makeReq('szpineta_access=tok'), res);
  expect(res._status).toBe(500);
});

test('returns 401 when no cookie is present', async () => {
  const res = makeRes();
  await handler(makeReq(undefined), res);
  expect(res._status).toBe(401);
  expect(res._body.error).toMatch(/no session/);
});

test('returns 401 and clears cookie on invalid JWT', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });
  const res = makeRes();
  await handler(makeReq('szpineta_access=bad-token'), res);
  expect(res._status).toBe(401);
  expect(res._headers['Set-Cookie']).toMatch(/Max-Age=0/);
});

test('returns 401 and clears cookie on expired JWT', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('token expired'); });
  const res = makeRes();
  await handler(makeReq('szpineta_access=expired-token'), res);
  expect(res._status).toBe(401);
  expect(res._headers['Set-Cookie']).toMatch(/Max-Age=0/);
});

describe('successful release', () => {
  beforeEach(() => {
    jwt.verify.mockReturnValue({ code: 'ABCD', fingerprint: 'fp' });
    kv.del.mockResolvedValue(1);
  });

  test('deletes the code pairing from KV', async () => {
    await handler(makeReq('szpineta_access=valid-token'), makeRes());
    expect(kv.del).toHaveBeenCalledWith('code_pairings:ABCD');
  });

  test('clears the session cookie', async () => {
    const res = makeRes();
    await handler(makeReq('szpineta_access=valid-token'), res);
    expect(res._headers['Set-Cookie']).toMatch(/Max-Age=0/);
  });

  test('responds with state: released', async () => {
    const res = makeRes();
    await handler(makeReq('szpineta_access=valid-token'), res);
    expect(res._body).toEqual({ state: 'released' });
  });
});

test('does not call kv.del when JWT has no code field', async () => {
  jwt.verify.mockReturnValue({ fingerprint: 'fp' });
  const res = makeRes();
  await handler(makeReq('szpineta_access=token-no-code'), res);
  expect(kv.del).not.toHaveBeenCalled();
  expect(res._body).toEqual({ state: 'released' });
});

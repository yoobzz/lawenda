'use strict';

jest.mock('../../_lib/kv.js');
jest.mock('../../_lib/jwt.js');

const kv = require('../../_lib/kv.js');
const jwt = require('../../_lib/jwt.js');
const handler = require('../transfer.js');

const SECRET = 'secret';

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    body: { transferToken: 'valid-transfer-token', fingerprint: 'fp-new' },
    headers: {},
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
  await handler(makeReq({ method: 'GET' }), res);
  expect(res._status).toBe(405);
});

test('returns 500 when JWT_SECRET is missing', async () => {
  delete process.env.JWT_SECRET;
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(500);
});

test('returns 400 when transferToken is missing', async () => {
  const res = makeRes();
  await handler(makeReq({ body: { fingerprint: 'fp' } }), res);
  expect(res._status).toBe(400);
});

test('returns 400 when fingerprint is missing', async () => {
  const res = makeRes();
  await handler(makeReq({ body: { transferToken: 'tok' } }), res);
  expect(res._status).toBe(400);
});

test('returns 401 when transfer token is invalid', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(401);
  expect(res._body.error).toMatch(/invalid or expired/);
});

test('returns 401 when transfer token is expired', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('token expired'); });
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(401);
});

test('returns 400 when token action is not "transfer"', async () => {
  jwt.verify.mockReturnValue({ code: 'ABCD', action: 'session' });
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(400);
  expect(res._body.error).toMatch(/invalid token type/);
});

test('returns 404 when pairing is not in KV', async () => {
  jwt.verify.mockReturnValue({ code: 'ABCD', action: 'transfer' });
  kv.get.mockResolvedValue(null);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(404);
});

describe('successful transfer', () => {
  const existingPairing = {
    code: 'ABCD',
    fingerprint: 'fp-old',
    firstActivatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jwt.verify.mockReturnValue({ code: 'ABCD', action: 'transfer' });
    kv.get.mockResolvedValue(existingPairing);
    kv.set.mockResolvedValue('OK');
    jwt.sign.mockReturnValue('new-session-token');
  });

  test('updates fingerprint in KV', async () => {
    await handler(makeReq(), makeRes());
    expect(kv.set).toHaveBeenCalledWith(
      'code_pairings:ABCD',
      expect.objectContaining({ fingerprint: 'fp-new', transferredAt: expect.any(String) })
    );
  });

  test('preserves original fields when updating pairing', async () => {
    await handler(makeReq(), makeRes());
    expect(kv.set).toHaveBeenCalledWith(
      'code_pairings:ABCD',
      expect.objectContaining({ firstActivatedAt: '2024-01-01T00:00:00.000Z' })
    );
  });

  test('sets session cookie with new token', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._headers['Set-Cookie']).toMatch(/szpineta_access=new-session-token/);
  });

  test('responds with state: success', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._body).toEqual({ state: 'success' });
  });
});

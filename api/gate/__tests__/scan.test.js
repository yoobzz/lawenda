'use strict';

jest.mock('../../_lib/kv.js');
jest.mock('../../_lib/jwt.js');

const kv = require('../../_lib/kv.js');
const jwt = require('../../_lib/jwt.js');
const handler = require('../scan.js');

const SECRET = 'secret';

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    body: { code: 'ABCD', fingerprint: 'fp-new' },
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
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: null }),
  });
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
  expect(res._body.error).toMatch(/misconfigured/);
});

test('returns 400 when code is missing', async () => {
  const res = makeRes();
  await handler(makeReq({ body: { fingerprint: 'fp' } }), res);
  expect(res._status).toBe(400);
});

test('returns 400 when fingerprint is missing', async () => {
  const res = makeRes();
  await handler(makeReq({ body: { code: 'ABCD' } }), res);
  expect(res._status).toBe(400);
});

describe('code format validation', () => {
  const invalidFormatCodes = [
    'abc',    // lowercase
    'ABC',    // 3 chars
    'ABCDE',  // 5 chars
    'AB1D',   // digit 1 excluded
    'ABIO',   // I and O excluded
    'AB!D',   // special char
  ];

  test.each(invalidFormatCodes)('rejects invalid code format %j', async (code) => {
    const res = makeRes();
    await handler(makeReq({ body: { code, fingerprint: 'fp' } }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/invalid code format/);
  });

  test('rejects empty string as missing code', async () => {
    const res = makeRes();
    await handler(makeReq({ body: { code: '', fingerprint: 'fp' } }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/missing/);
  });

  const validCodes = ['ABCD', 'WXYZ', '2345', 'abcd'];
  test.each(validCodes)('accepts valid code %j (case-insensitive)', async (code) => {
    kv.get.mockResolvedValue(null);
    const res = makeRes();
    await handler(makeReq({ body: { code, fingerprint: 'fp' } }), res);
    // 404 is fine — it means the format was accepted and KV was queried
    expect(res._status).toBe(404);
  });
});

test('returns 404 when code is not in KV', async () => {
  kv.get.mockResolvedValue(null);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(404);
});

test('returns 404 when code status is not active', async () => {
  kv.get.mockResolvedValue({ status: 'revoked' });
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res._status).toBe(404);
});

describe('first scan — no existing pairing', () => {
  beforeEach(() => {
    kv.get
      .mockResolvedValueOnce({ status: 'active' })  // codes:ABCD
      .mockResolvedValueOnce(null);                  // code_pairings:ABCD
    kv.set.mockResolvedValue('OK');
    kv.kvCommand.mockResolvedValue(null);
    jwt.sign.mockReturnValue('session-token');
  });

  test('creates pairing in KV', async () => {
    await handler(makeReq(), makeRes());
    expect(kv.set).toHaveBeenCalledWith(
      'code_pairings:ABCD',
      expect.objectContaining({ code: 'ABCD', fingerprint: 'fp-new' })
    );
  });

  test('sets session cookie', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._headers['Set-Cookie']).toMatch(/szpineta_access=session-token/);
  });

  test('responds with state: first', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._body).toEqual({ state: 'first' });
  });
});

describe('known scan — same fingerprint', () => {
  const existingPairing = { code: 'ABCD', fingerprint: 'fp-new', firstActivatedAt: 'x' };

  beforeEach(() => {
    kv.get
      .mockResolvedValueOnce({ status: 'active' })
      .mockResolvedValueOnce(existingPairing);
    kv.set.mockResolvedValue('OK');
    kv.kvCommand.mockResolvedValue(null);
    jwt.sign.mockReturnValue('renewed-token');
  });

  test('updates lastSeenAt in KV', async () => {
    await handler(makeReq(), makeRes());
    expect(kv.set).toHaveBeenCalledWith(
      'code_pairings:ABCD',
      expect.objectContaining({ fingerprint: 'fp-new' })
    );
  });

  test('sets session cookie', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._headers['Set-Cookie']).toMatch(/szpineta_access=renewed-token/);
  });

  test('responds with state: known', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._body).toEqual({ state: 'known' });
  });
});

describe('transfer scan — different fingerprint', () => {
  const existingPairing = { code: 'ABCD', fingerprint: 'fp-original', firstActivatedAt: 'x' };

  beforeEach(() => {
    kv.get
      .mockResolvedValueOnce({ status: 'active' })
      .mockResolvedValueOnce(existingPairing);
    kv.kvCommand.mockResolvedValue(null);
    jwt.sign.mockReturnValue('transfer-token');
  });

  test('does not set a session cookie', async () => {
    const res = makeRes();
    await handler(makeReq({ body: { code: 'ABCD', fingerprint: 'fp-other' } }), res);
    expect(res._headers['Set-Cookie']).toBeUndefined();
  });

  test('responds with state: transfer and transferToken', async () => {
    const res = makeRes();
    await handler(makeReq({ body: { code: 'ABCD', fingerprint: 'fp-other' } }), res);
    expect(res._body).toEqual({ state: 'transfer', transferToken: 'transfer-token' });
  });

  test('signs transfer token with action: transfer', async () => {
    await handler(makeReq({ body: { code: 'ABCD', fingerprint: 'fp-other' } }), makeRes());
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'transfer' }),
      SECRET,
      expect.any(Number)
    );
  });
});

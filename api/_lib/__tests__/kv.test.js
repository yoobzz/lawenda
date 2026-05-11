'use strict';

const kv = require('../kv.js');

const MOCK_URL = 'https://kv.example.com';
const MOCK_TOKEN = 'tok';

beforeEach(() => {
  process.env.KV_REST_API_URL = MOCK_URL;
  process.env.KV_REST_API_TOKEN = MOCK_TOKEN;
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  jest.restoreAllMocks();
});

function mockFetch(result) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ result }),
  });
}

function mockFetchError(status, text) {
  global.fetch.mockResolvedValue({
    ok: false,
    status,
    text: async () => text,
  });
}

describe('kvCommand', () => {
  test('sends POST to KV_REST_API_URL with correct auth header', async () => {
    mockFetch('OK');
    await kv.kvCommand(['SET', 'key', 'val']);
    expect(global.fetch).toHaveBeenCalledWith(
      MOCK_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${MOCK_TOKEN}`,
        }),
        body: JSON.stringify(['SET', 'key', 'val']),
      })
    );
  });

  test('returns result from JSON response', async () => {
    mockFetch(42);
    const result = await kv.kvCommand(['EXISTS', 'k']);
    expect(result).toBe(42);
  });

  test('throws with descriptive message on non-OK response', async () => {
    mockFetchError(503, 'Service Unavailable');
    await expect(kv.kvCommand(['GET', 'k'])).rejects.toThrow('503');
  });

  test('throws when KV_REST_API_URL is missing', async () => {
    delete process.env.KV_REST_API_URL;
    await expect(kv.kvCommand(['GET', 'k'])).rejects.toThrow('KV_REST_API_URL');
  });

  test('throws when KV_REST_API_TOKEN is missing', async () => {
    delete process.env.KV_REST_API_TOKEN;
    await expect(kv.kvCommand(['GET', 'k'])).rejects.toThrow('KV_REST_API_TOKEN');
  });

  test('strips trailing slash from URL', async () => {
    process.env.KV_REST_API_URL = MOCK_URL + '/';
    mockFetch('OK');
    await kv.kvCommand(['PING']);
    expect(global.fetch).toHaveBeenCalledWith(MOCK_URL, expect.anything());
  });
});

describe('get', () => {
  test('returns parsed JSON when result is a JSON string', async () => {
    mockFetch(JSON.stringify({ foo: 'bar' }));
    const result = await kv.get('mykey');
    expect(result).toEqual({ foo: 'bar' });
  });

  test('returns raw string when result is not valid JSON', async () => {
    mockFetch('plain-string');
    const result = await kv.get('mykey');
    expect(result).toBe('plain-string');
  });

  test('returns null when result is null', async () => {
    mockFetch(null);
    const result = await kv.get('missing');
    expect(result).toBeNull();
  });

  test('returns null when result is undefined', async () => {
    mockFetch(undefined);
    const result = await kv.get('missing');
    expect(result).toBeNull();
  });
});

describe('set', () => {
  test('serialises object values to JSON', async () => {
    mockFetch('OK');
    await kv.set('k', { a: 1 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual(['SET', 'k', JSON.stringify({ a: 1 })]);
  });

  test('passes string values without extra serialisation', async () => {
    mockFetch('OK');
    await kv.set('k', 'hello');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual(['SET', 'k', 'hello']);
  });

  test('appends EX option when provided', async () => {
    mockFetch('OK');
    await kv.set('k', 'v', { ex: 300 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual(['SET', 'k', 'v', 'EX', '300']);
  });
});

describe('exists', () => {
  test('returns true when KV reports 1', async () => {
    mockFetch(1);
    expect(await kv.exists('k')).toBe(true);
  });

  test('returns false when KV reports 0', async () => {
    mockFetch(0);
    expect(await kv.exists('k')).toBe(false);
  });
});

describe('del', () => {
  test('sends DEL command for given key', async () => {
    mockFetch(1);
    await kv.del('mykey');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual(['DEL', 'mykey']);
  });
});

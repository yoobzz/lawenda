'use strict';

// Mały klient REST do Vercel KV / Upstash Redis (bez deps).
// Wymaga env: KV_REST_API_URL, KV_REST_API_TOKEN
// (Vercel Storage → KV → .env.local exportuje te zmienne)

function ensureEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error('brak env: KV_REST_API_URL i/lub KV_REST_API_TOKEN');
    console.error('wskazówka: po provisioningu Vercel KV pobierz .env.local i załaduj go,');
    console.error('np.: set -a && source .env.local && set +a && npm run seed:poems');
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function kvCommand(args) {
  const { url, token } = ensureEnv();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`KV ${args[0]} ${args[1] || ''} → ${resp.status}: ${txt}`);
  }
  const json = await resp.json();
  return json.result;
}

async function set(key, value, options = {}) {
  const args = ['SET', key, typeof value === 'string' ? value : JSON.stringify(value)];
  if (options.ex) args.push('EX', String(options.ex));
  return kvCommand(args);
}

async function get(key) {
  const result = await kvCommand(['GET', key]);
  if (result === null || result === undefined) return null;
  try { return JSON.parse(result); } catch (_) { return result; }
}

async function exists(key) {
  return Boolean(await kvCommand(['EXISTS', key]));
}

module.exports = { set, get, exists, kvCommand };

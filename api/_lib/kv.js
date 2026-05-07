'use strict';

function ensureEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('brak KV env: KV_REST_API_URL / KV_REST_API_TOKEN');
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

async function del(key) {
  return kvCommand(['DEL', key]);
}

module.exports = { set, get, del, exists, kvCommand };

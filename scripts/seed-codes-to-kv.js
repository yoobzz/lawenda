#!/usr/bin/env node
// Krok B.5 — wgrywa scripts/output/codes.json do Vercel KV
// Tworzy: codes:{code} → {status, issuedAt, serial}
// Uruchomienie:
//   set -a && source .env.local && set +a
//   npm run seed:codes

'use strict';

const fs = require('fs');
const path = require('path');
const kv = require('./_kv-client.js');

const CODES_JSON = path.join(__dirname, 'output', 'codes.json');

async function main() {
  if (!fs.existsSync(CODES_JSON)) {
    console.error('brak ' + CODES_JSON + ' — uruchom: npm run mint:codes');
    process.exit(1);
  }
  const codes = JSON.parse(fs.readFileSync(CODES_JSON, 'utf8'));
  if (!Array.isArray(codes) || !codes.length) {
    console.error('codes.json pusty');
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const c of codes) {
    const key = `codes:${c.code}`;
    const exists = await kv.exists(key);
    if (exists && !process.env.SEED_FORCE) {
      skipped++;
      continue;
    }
    await kv.set(key, {
      code: c.code,
      serial: c.serial,
      status: 'active',
      issuedAt: c.issuedAt,
    });
    inserted++;
  }

  // Index wszystkich kodów (do listingu w admin)
  await kv.set('codes:index', codes.map(c => c.code));

  console.log(`wgrano: ${inserted}, pominięto (już istniały): ${skipped}`);
  if (skipped > 0) console.log('aby nadpisać istniejące: SEED_FORCE=1 npm run seed:codes');
}

main().catch(err => { console.error(err); process.exit(1); });

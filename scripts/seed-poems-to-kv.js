#!/usr/bin/env node
// Krok B.3 — wgrywa scripts/output/poems.json do Vercel KV pod kluczem "poems:all"
// Uruchomienie:
//   set -a && source .env.local && set +a    # exportuje KV_REST_API_*
//   npm run seed:poems
// Wymagania: scripts/output/poems.json istnieje (uruchom najpierw extract:poems)

'use strict';

const fs = require('fs');
const path = require('path');
const kv = require('./_kv-client.js');

const POEMS_JSON = path.join(__dirname, 'output', 'poems.json');

async function main() {
  if (!fs.existsSync(POEMS_JSON)) {
    console.error('brak ' + POEMS_JSON + ' — uruchom: npm run extract:poems');
    process.exit(1);
  }
  const poems = JSON.parse(fs.readFileSync(POEMS_JSON, 'utf8'));
  if (!Array.isArray(poems) || !poems.length) {
    console.error('poems.json jest pusty lub niepoprawny');
    process.exit(1);
  }

  // Sprawdź czy już istnieje
  const existed = await kv.exists('poems:all');
  if (existed && !process.env.SEED_FORCE) {
    console.error('poems:all już istnieje w KV. Aby nadpisać: SEED_FORCE=1 npm run seed:poems');
    process.exit(2);
  }

  await kv.set('poems:all', poems);
  await kv.set('poems:meta', {
    count: poems.length,
    seededAt: new Date().toISOString(),
    minIndex: poems[0].index,
    maxIndex: poems[poems.length - 1].index,
  });

  console.log(`wgrano ${poems.length} wierszy do KV pod "poems:all"`);
  console.log(`metadata zapisana pod "poems:meta"`);
}

main().catch(err => { console.error(err); process.exit(1); });

#!/usr/bin/env node
// Krok B.4 — generuje N unikalnych kodów + SVG QR-y do druku + mapping markdown
// Uruchomienie: node scripts/mint-codes.js [N]   (default N=20)
// Wymaga: npm install (potrzebuje qrcode)
// Output (gitignored):
//   scripts/output/codes.json           — lista wygenerowanych kodów (sekret)
//   scripts/output/codes-mapping.md     — tabela kod ↔ url, do druku/notesu
//   scripts/output/qr/{KOD}.svg         — 20 plików SVG do importu w model 3D

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Bez 0/O/1/I/L/U — czytelność druku
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LEN = 4;

// Zmień jeśli przeniosisz domenę
const BASE_URL = 'https://szpineta.com/g/';

const N = parseInt(process.argv[2] || '20', 10);

const OUT_DIR = path.join(__dirname, 'output');
const QR_DIR = path.join(OUT_DIR, 'qr');
const CODES_JSON = path.join(OUT_DIR, 'codes.json');
const MAPPING_MD = path.join(OUT_DIR, 'codes-mapping.md');

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.error('brak modułu qrcode. uruchom: npm install');
  process.exit(1);
}

function randomCode() {
  const buf = crypto.randomBytes(CODE_LEN);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += ALPHABET[buf[i] % ALPHABET.length];
  }
  return s;
}

function uniqueCodes(n) {
  const set = new Set();
  let safety = n * 1000;
  while (set.size < n && safety--) set.add(randomCode());
  if (set.size < n) throw new Error('nie udało się wygenerować ' + n + ' unikalnych kodów');
  return Array.from(set);
}

async function main() {
  if (!Number.isFinite(N) || N <= 0 || N > 1000) {
    console.error('podaj sensowne N (1-1000)');
    process.exit(1);
  }

  fs.mkdirSync(QR_DIR, { recursive: true });

  // Jeśli codes.json istnieje — domyślnie nie nadpisuj (chroni przed przypadkową regeneracją po druku)
  if (fs.existsSync(CODES_JSON) && !process.env.MINT_FORCE) {
    console.error('codes.json już istnieje. Aby wymusić regenerację: MINT_FORCE=1 npm run mint:codes');
    console.error('UWAGA: regeneracja unieważni wszystkie obecnie wydrukowane kody.');
    process.exit(2);
  }

  const codes = uniqueCodes(N);
  const issuedAt = new Date().toISOString();

  const records = codes.map((code, i) => ({
    code,
    serial: i + 1,
    url: BASE_URL + code,
    issuedAt,
    physicalObject: null, // wypełnij ręcznie w codes-mapping.md gdy przypiszesz do znajdki
  }));

  fs.writeFileSync(CODES_JSON, JSON.stringify(records, null, 2), 'utf8');

  // Mapping markdown
  const md = [
    '# kody — mapowanie do znajdek fizycznych',
    '',
    `wygenerowane: ${issuedAt}`,
    `łącznie: ${N}`,
    '',
    '**ten plik jest prywatny — nie commituj.**',
    '',
    '| serial | kod | url | znajdka fizyczna | data sparowania |',
    '|---|---|---|---|---|',
    ...records.map(r => `| ${r.serial} | \`${r.code}\` | ${r.url} | _(uzupełnij)_ | _(po pierwszym skanie)_ |`),
    '',
  ].join('\n');
  fs.writeFileSync(MAPPING_MD, md, 'utf8');

  // SVG QR-y
  for (const r of records) {
    const svg = await QRCode.toString(r.url, {
      type: 'svg',
      errorCorrectionLevel: 'M', // średni — kompromis między rozmiarem a tolerancją uszkodzenia
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    fs.writeFileSync(path.join(QR_DIR, `${r.code}.svg`), svg, 'utf8');
  }

  console.log(`wygenerowano ${N} kodów:`);
  for (const r of records) console.log(`  ${r.serial.toString().padStart(2)}.  ${r.code}  →  ${r.url}`);
  console.log(`\noutput:`);
  console.log(`  ${path.relative(process.cwd(), CODES_JSON)}`);
  console.log(`  ${path.relative(process.cwd(), MAPPING_MD)}`);
  console.log(`  ${path.relative(process.cwd(), QR_DIR)}/*.svg  (${N} plików)`);
}

main().catch(err => { console.error(err); process.exit(1); });

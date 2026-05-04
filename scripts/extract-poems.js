#!/usr/bin/env node
// Krok B.2 — wyciąga 157 wierszy z poems.html do scripts/output/poems.json
// Uruchomienie: node scripts/extract-poems.js
// Output: scripts/output/poems.json (gitignored — to są wszystkie wiersze)

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POEMS_HTML = path.join(ROOT, 'poems.html');
const OUT_DIR = path.join(__dirname, 'output');
const OUT_FILE = path.join(OUT_DIR, 'poems.json');

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parsePoemBody(body) {
  // Zachowuje znaki specjalne (~|*+_^itd).
  // Każdy <br> wraz z otaczającym whitespace → pojedynczy \n
  // (w HTML często jest "<br>\n        next" — bez tego dałoby fałszywą pustą linię).
  // Sekwencja <br><br> daje \n\n czyli paragraph break — zamierzony.
  const text = body
    .replace(/\s*<br\s*\/?>\s*/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const lines = text.split('\n').map(l => decodeEntities(l).trim());
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function main() {
  if (!fs.existsSync(POEMS_HTML)) {
    console.error('nie znaleziono', POEMS_HTML);
    process.exit(1);
  }
  const html = fs.readFileSync(POEMS_HTML, 'utf8');

  // class może być "poem" lub "poem active"; dopasowanie tolerancyjne
  const re = /<div\s+class="poem[^"]*"\s+data-index="(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const index = parseInt(m[1], 10);
    const lines = parsePoemBody(m[2]);
    out.push({ index, lines });
  }

  if (!out.length) {
    console.error('nie wyciągnąłem ani jednego wiersza — sprawdź regex / strukturę poems.html');
    process.exit(2);
  }

  out.sort((a, b) => a.index - b.index);

  // sanity: unikalność, ciągłość, niepuste
  const seen = new Set();
  const dups = [];
  const empty = [];
  for (const p of out) {
    if (seen.has(p.index)) dups.push(p.index);
    seen.add(p.index);
    if (!p.lines.length || p.lines.every(l => l === '')) empty.push(p.index);
  }
  const max = out[out.length - 1].index;
  const minIdx = out[0].index;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  console.log(`wyciągnięto ${out.length} wierszy → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`indeksy: ${minIdx}..${max}`);
  if (dups.length) console.warn(`UWAGA: zduplikowane indeksy: ${dups.join(', ')}`);
  if (empty.length) console.warn(`UWAGA: puste wiersze: ${empty.join(', ')}`);
  if (max + 1 !== out.length) console.warn(`UWAGA: indeksy nieciągłe (max+1=${max + 1}, count=${out.length})`);

  // mała próbka do oka
  console.log('\nprobka pierwszego wiersza (index=' + out[0].index + '):');
  console.log('  ' + out[0].lines.slice(0, 4).map(l => l || '(pusta)').join('\n  '));
}

main();

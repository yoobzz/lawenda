/**
 * build-pointcloud.js  –  node build-pointcloud.js
 * Wczytuje lavmodel.stl, tworzy pole lawendy, zapisuje pointcloud.bin.
 *
 * Format binarny (interleaved, little-endian):
 *   [0..3]  uint32  – liczba punktów
 *   per punkt (14 bajtów):
 *     float32 x, float32 y, float32 z
 *     uint8   color   (0=lawenda/fiolet, 1=łodyga/zielony)
 *     uint8   revealT (0-255 → 0.0-1.0, animacja wzrostu)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── 1. Wczytaj i parsuj ASCII STL ─────────────────────────────────────────
console.log('Wczytuję lavmodel.stl…');
const stlText = fs.readFileSync(path.join(__dirname, 'lavmodel.stl'), 'utf-8');

console.log('Parsuję wierzchołki…');
const rawVerts = [];
const re = /vertex\s+([\d.\+\-eE]+)\s+([\d.\+\-eE]+)\s+([\d.\+\-eE]+)/g;
let m;
while ((m = re.exec(stlText)) !== null) {
    rawVerts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
}
console.log(`  Wierzchołków w STL: ${rawVerts.length.toLocaleString()}`);

// ── 2. Normalizacja (tak samo jak w index.html) ────────────────────────────
let [minX, minY, minZ] = [Infinity, Infinity, Infinity];
let [maxX, maxY, maxZ] = [-Infinity, -Infinity, -Infinity];
for (const [x, y, z] of rawVerts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
const scl = 7.8 / Math.max(maxX - minX, maxY - minY, maxZ - minZ);

// ── 3. Próbkuj do bazy punktów ────────────────────────────────────────────
const TARGET_PER_PLANT = 28000;
const vstep = Math.max(1, Math.floor(rawVerts.length / TARGET_PER_PLANT));
const base  = [];
for (let i = 0; i < rawVerts.length; i += vstep) {
    const [x, y, z] = rawVerts[i];
    base.push([(x - cx) * scl, (y - cy) * scl, (z - cz) * scl]);
}
console.log(`  Próbka bazowa: ${base.length} punktów / roślinę`);

// ── 4. Kolory po osi Z (STL Z → świat Y = góra/dół po rotation.x=-π/2) ───
//  Dolne 40% osi Z = łodyga (zielona), reszta = kwiat (lawenda)
const STALK_FRACTION = 0.40;
let bzMin = Infinity, bzMax = -Infinity;
for (const [,, z] of base) { if (z < bzMin) bzMin = z; if (z > bzMax) bzMax = z; }
const bzRange = bzMax - bzMin;
const baseColors = base.map(([,, z]) => ((z - bzMin) / bzRange < STALK_FRACTION ? 1 : 0));

// ── 5. revealT: animacja wzrostu od dołu ku górze (oś Z) ─────────────────
const baseReveals = base.map(([,, z]) => (z - bzMin) / bzRange); // 0=dół, 1=góra

// ── 6. Jedna roślina w centrum ────────────────────────────────────────────
const FIELD = [
    { wx: 0.0, wz: 0.0, s: 1.0, ry: 0.0 },
];

// ── 7. Złóż wszystkie punkty ──────────────────────────────────────────────
const COUNT = FIELD.length * base.length;
const buf   = Buffer.allocUnsafe(4 + COUNT * 14);
buf.writeUInt32LE(COUNT, 0);

let ptr = 4;
for (const { wx, wz, s, ry: angle } of FIELD) {
    const dx   = wx;
    const dy   = -wz;          // STL Y offset = –świat Z
    const cosA = Math.cos(angle), sinA = Math.sin(angle);

    for (let i = 0; i < base.length; i++) {
        const [bx, by, bz] = base[i];

        // Obrót wokół STL Z (oś pionowa, Z niezmienione)
        const rx = (bx * cosA - by * sinA) * s + dx;
        const ry = (bx * sinA + by * cosA) * s + dy;
        const rz =  bz * s;

        buf.writeFloatLE(rx,  ptr); ptr += 4;
        buf.writeFloatLE(ry,  ptr); ptr += 4;
        buf.writeFloatLE(rz,  ptr); ptr += 4;
        buf[ptr++] = baseColors[i];
        buf[ptr++] = Math.round(baseReveals[i] * 255);
    }
}

const outPath = path.join(__dirname, 'pointcloud.bin');
fs.writeFileSync(outPath, buf);
const kb = (buf.length / 1024).toFixed(0);
console.log(`\n✓ Zapisano pointcloud.bin`);
console.log(`  Łącznie punktów : ${COUNT.toLocaleString()} (${FIELD.length} roślin × ${base.length})`);
console.log(`  Rozmiar pliku   : ${kb} KB\n`);

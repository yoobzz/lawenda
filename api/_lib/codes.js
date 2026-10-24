'use strict';

// Wspólne reguły kodów (bramka, panel admina, dostęp do wierszy).
//
// Dwa rodzaje kodów:
// - kod ze znaczków (od 24.10.2026 domyślny): GLYPH_LEN znaczków z GLYPHS, np. |~*^!=
// - kod literowy (stare znajdki z QR /g/ABCD): 4 znaki z ALPHABET (bez 0/O/1/I/L/U)

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const ALNUM_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

// znaczki z klawiatury bramki (16 = każdy bajt losowy daje równy rozkład)
const GLYPHS = '"\';.,/\\|~*^!=+-_';
const GLYPH_LEN = 6;
// odczyt przyjmuje też znaczki starszych kodów uniwersalnych (: ` < >) i długość 3–16
const GLYPH_LOOKUP_RE = /^["';.,/\\|~*^!=+\-_:`<>]{3,16}$/;

// kod osobisty: tyle urządzeń jednej osoby (telefon, laptop, …), potem nie wpuszcza nowych
const MAX_DEVICES = 3;

// '' gdy kod nie pasuje do żadnego formatu; litery są normalizowane do wielkich
function normalizeCode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const upper = s.toUpperCase();
  if (ALNUM_RE.test(upper)) return upper;
  if (GLYPH_LOOKUP_RE.test(s)) return s;
  return '';
}

function isGlyphCode(code) {
  return GLYPH_LOOKUP_RE.test(String(code || ''));
}

// urządzenia przypięte do kodu; starsze pary mają tylko pole fingerprint
function devicesOf(pairing) {
  if (!pairing || typeof pairing !== 'object') return [];
  const list = Array.isArray(pairing.devices) ? pairing.devices.filter(d => typeof d === 'string' && d) : [];
  if (typeof pairing.fingerprint === 'string' && pairing.fingerprint && !list.includes(pairing.fingerprint)) {
    list.unshift(pairing.fingerprint);
  }
  return list;
}

module.exports = {
  ALPHABET,
  ALNUM_RE,
  GLYPHS,
  GLYPH_LEN,
  GLYPH_LOOKUP_RE,
  MAX_DEVICES,
  normalizeCode,
  isGlyphCode,
  devicesOf,
};

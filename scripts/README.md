# scripts — przygotowanie bramki QR (Krok B)

cztery skrypty do jednorazowych operacji. wszystkie outputy lądują w `scripts/output/` (gitignored).

## kolejność uruchomienia

### 1. instalacja zależności
```bash
npm install
```
(`qrcode` jako devDep dla mint-codes)

### 2. wyciągnij wiersze z poems.html → JSON  (Krok B.2)
```bash
npm run extract:poems
```
output: `scripts/output/poems.json` (157 wierszy)

### 3. provisioning Vercel KV  (Krok B.1) — TY w panelu vercela
- vercel.com → projekt szpineta → Storage → Create → KV
- po utworzeniu: pobierz `.env.local` (przycisk w panelu KV) i wrzuć do roota repo
  - zawiera: `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`
- `.env.local` jest w `.gitignore` — nie zostanie zacommitowane

### 4. wygeneruj 20 kodów + svg do druku  (Krok B.4)
```bash
npm run mint:codes        # 20 kodów (default)
npm run mint:codes -- 30  # albo inna liczba
```
output:
- `scripts/output/codes.json` — lista kodów (sekret)
- `scripts/output/codes-mapping.md` — tabela do druku/notesu
- `scripts/output/qr/{KOD}.svg` × N — pliki do importu w model 3D

uwaga: skrypt **nie nadpisze** istniejącego `codes.json`. żeby zregenerować (i unieważnić wszystkie wydrukowane kody):
```bash
MINT_FORCE=1 npm run mint:codes
```

### 5. wgraj wiersze do KV  (Krok B.3)
```bash
set -a && source .env.local && set +a
npm run seed:poems
```
zapisuje pod kluczami `poems:all` i `poems:meta`.

ochrona: nie nadpisze istniejącego `poems:all` bez `SEED_FORCE=1`.

### 6. wgraj kody do KV  (Krok B.5)
```bash
set -a && source .env.local && set +a
npm run seed:codes
```
zapisuje pod kluczami `codes:{KOD}` (z `status: 'active'`) i `codes:index`.

ochrona: kody które już istnieją są pomijane (chroni przed nadpisaniem stanu sparowania). żeby wymusić: `SEED_FORCE=1`.

## struktura kluczy w KV (po Kroku B)

```
poems:all               → JSON [157 wierszy]  (czytany przez /api/poems)
poems:meta              → JSON {count, seededAt, minIndex, maxIndex}

codes:index             → JSON [tablica wszystkich kodów]
codes:{KOD}             → JSON {code, serial, status, issuedAt}

# (pojawia się dynamicznie w Kroku C, po pierwszym skanie)
code_pairings:{KOD}     → JSON {code, fingerprint, firstActivatedAt, lastSeenAt}
```

## notatka bezpieczeństwa

`scripts/output/` zawiera całą poezję + sekretne kody. **nigdy nie commituj tego folderu.** `.gitignore` już to chroni, ale zweryfikuj `git status` przed `git add -A`.

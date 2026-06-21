# Analiza wizualna i UX — szpineta.com

Metoda: zrzuty live (`docs/screens/before/`, headless Chrome, desktop 1440×900 + mobile 390×844)
+ analiza kodu (`index.html`, `poems.html`, `gate.html`, `bio.html`, API). Data: 2026-06-21.

---

## 1. Tożsamość wizualna — co działa (i ma zostać)

Strona ma mocny, świadomy język: **biel, ogrom powietrza, jeden gest na ekran, motyw glifów**
`~||-_^+*.` jako logo-szyfr. To nie jest „niedokończony minimalizm" — to celowa surowość,
która stawia słowo w centrum. Ten kierunek jest dobry i go nie ruszamy.

- **index**: ultraminimal, wyśrodkowane „lawenda", tytuł-glif morfuje u góry, tło pointcloud
  (three.js, model lawendy z symboli, lawendowo-zielone) dochodzi po załadowaniu.
- **bio**: surowe, lo-fi wideo autora + wielkie „cześć! / jestem staś." — intymne, spójne z duchem.
- **gate**: kryptyczny kadr ze znacznikami `+` w rogach i tekstem-wierszem po bokach
  („tak oddaje / swoje znajdki / przeznaczenie / znaczy znaczek") + konstelacja glifów. Piękne.

---

## 2. Ocena per strona

### index.html — wzorzec
Mocne: tożsamość, rytm, typografia (ABC Diatype Rounded), interaktywne tło.
Słabe:
- **Intro jest długie i bez „skip"** — zrzut po 8 s wciąż łapie animację (tytuł dopiero buduje
  „lawenda", pointcloud niewidoczny). Powracający użytkownik czeka za każdym razem.
- **Odkrywalność wejścia do wierszy** — z poziomu landingu nie widać jasnego „czytaj".
- Martwa, ukryta `.poems-section` z licznikiem „1 / 142" (stara kopia czytnika) = dwa źródła prawdy.

### bio.html
Mocne: charakter, spójność. Słabe: autoodtwarzane wideo (waga ~1,2 MB w kadrze), brak
widocznej kontroli dźwięku/pauzy na zrzucie; do sprawdzenia wydajność na mobile/3G.

### gate.html — najpoważniejszy problem UX
Ekran jest **ślepą ścianą dla każdego bez fizycznego kodu**: brak pola, instrukcji, jakiejkolwiek
afordancji „co dalej". Dla mechaniki QR (wszedłeś z `/g/:code`) to działa, ale **ciekawy gość,
który trafia na `/poems.html` bez kodu, jest twardo przerzucany tutaj i odbija się od niczego.**
To największy wyciek uwagi w całym serwisie.

### poems.html — czytnik
Mocne: immersyjny model „jeden wiersz naraz", deep-link-friendly dane, sporo funkcji.
Słabe:
- **Rozjazd z index** (patrz §4): brak pointcloud, własny dark-mode, inne intro (decrypt-reveal),
  brak Google Fonts (ryzyko innego renderu fontu), zdublowane meta tagi.
- **Przeładowanie kontrolkami** — 9 ikon-symboli (`* - + ¿ ~ www. ! bio _`) bez podpisów;
  dla nowego użytkownika nieczytelne (co robi `~` reshuffle? `_` release? `¿` szukaj?).
- **Brak spisu treści** — 157 wierszy w nawigacji liniowej = do wiersza 120 trzeba „przeklikać"
  albo znać numer (goto). Przy tym zbiorze to realna bariera.
- **Twardy redirect** bez sesji — zero zajawki treści (zob. gate).

---

## 3. Surowość vs polish — gdzie co

| Obszar | Surowość pomaga | Surowość szkodzi → minimalny polish |
|---|---|---|
| Tożsamość, logo-glif, biel | TAK — to jest marka | — |
| Czytanie wiersza (powietrze, brak chromu) | TAK — skupienie na słowie | — |
| Wejście do treści (gate/landing) | NIE | dać 1 jasny gest + zajawkę; reszta dalej tajemnicą |
| Kontrolki w poems | NIE | zredukować do potrzebnych, dać czytelne afordancje/tytuły |
| Nawigacja po 157 | NIE | spis treści (overlay), żeby surowość nie znaczyła „zgubisz się" |
| Intro/animacje | częściowo | zostawić klimat, ale dać „skip"/skrócić dla powracających |

Wniosek: **surowość zostaje jako estetyka treści; polish wchodzi tylko w punktach wejścia
i orientacji** (gdzie dziś użytkownik się gubi lub odbija).

---

## 4. Spójność index ↔ poems (rozjazdy do usunięcia)

- Fonty: index ma Geist / IBM Plex Mono / Inter + ABC; poems tylko ABC (brak fallbacku Google).
- Tło: index = pointcloud three.js; poems = cząsteczki CSS (lub brak na iOS/reduced-motion).
- Motyw: poems ma własny dark-mode toggle; index jest tylko jasny.
- Intro: index = typewriter + „oddech" 3D; poems = decrypt-reveal.
- Licznik: index (martwa sekcja) „/ 142", poems „/ 157" — niespójne liczby.
- Meta: w poems zdublowane bloki og:/twitter: (linie 11–17 i 34–39).

---

## 5. Priorytety (mapują się na fazy wdrożenia)

**P0 — wejście i orientacja (największy zwrot)**
- Hybryda dostępu: 5–7 wierszy publicznych + czytelny komunikat „reszta po kodzie z kartki”,
  zamiast twardego redirectu na gate. *(Faza 3)*
- Spis treści (overlay) w poems — skok po 157. *(Faza 2)*

**P1 — spójność i czytelność**
- Ujednolicić poems z index: fonty, tło, motyw (rekom. jeden jasny), intro. *(Faza 2/4)*
- Zredukować/opisać kontrolki w poems. *(Faza 2)*
- Usunąć martwą `.poems-section` z index; ujednolicić licznik. *(Faza 4)*
- Odkrywalność „czytaj" na index. *(Faza 4)*

**P2 — higiena i wydajność**
- Usunąć zdublowane meta w poems; rozstrzygnąć watermark PNG (rekom. glif zamiast domeny). *(Faza 2)*
- „Skip/skróć” intro dla powracających. *(Faza 4)*
- Sprawdzić wagę/wydajność wideo bio i pointcloud na mobile. *(Faza 4)*
- Usunąć sekcję mama (martwy kod). *(Faza 5)*

Stan „po” (zrzuty desktop+mobile) dołączę do `docs/screens/after/` przed deployem prod.

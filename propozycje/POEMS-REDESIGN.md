# propozycja: nowy wygląd poems.html + nowe drzwi do strony

> prototyp do kliknięcia: [`propozycje/poems-redesign.html`](poems-redesign.html)
> (samowystarczalny, 4 wiersze demo — te które już są publicznie w poems.html, nic z KV nie wycieka)

---

## część 1 — nowy wygląd: „łąka"

### skąd ten pomysł

Obecny poems.html jest jasny, techniczny (licznik `1 / 157`, popover „idź do nr",
przyciski w kółkach) — a wszystko dookoła niego poszło już w inną stronę:
znajdka.html to czarna noc z ziarnem i rozsypanymi znaczkami, index.html ma
pointcloud lawendy, bio mówi wprost *„nie lubię formalności"* i *„znaki traktuję
jako coś, czego nie da się zapisać słowami"*. Numerowanie wierszy cyframi jest
z tym sprzeczne. Redesign domyka tę pętlę: **czytelnik wchodzi przez znajdkę
w nocy — i zostaje w tej nocy**.

### główne zmiany

1. **noc domyślnie** — tło `#080808`, ziarno i scatter znaczków przejęte 1:1
   z znajdka.html. Przejście znajdka → wiersze przestaje być zgrzytem
   (czarny chat → nagle biała strona). Tryb „dzień" zostaje pod `*`.

2. **sygnatury zamiast numerów** — każdy wiersz dostaje deterministyczną
   sygnaturę ze znaków staśka (np. `~*^-_.`), wyświetlaną nad tekstem
   i w nawigacji zamiast licznika `1 / 157`. Kod do tego **już istnieje**
   w poems.html (`getOrAssignPoemText`) — tylko nigdy nie jest pokazywany.
   W prototypie sygnatura jest seedowana z indeksu (ta sama dla wszystkich,
   stabilne linki), nie z localStorage.

3. **łąka** — kliknięcie sygnatury (albo `~`) otwiera widok wszystkich 157
   wierszy jako znaczków rozsianych po ekranie. Nieprzeczytane są ledwo
   widoczne, przeczytane **kwitną na lawendowo**, aktualny pulsuje.
   Hover pokazuje sygnaturę + pierwszą linijkę. To zastępuje jednocześnie
   popover „idź do nr" i daje czytelnikowi powód, żeby wracać: łąka
   zakwita w miarę czytania. Nawiązuje do pointclouda i do samej mechaniki
   znajdek — wiersze też się *znajduje*, nie wybiera z listy.

4. **łodyga zamiast licznika postępu** — cienka linia u dołu ekranu rośnie
   z procentem przeczytanych (gradient zieleń → lawenda, jak w
   lawenda-painter: łodyga → kwiat). Na 25/50/75/100% rozkwita mały `*`.

5. **zostaje to, co już jest dobre**: decrypt-reveal (najlepsza animacja na
   stronie — w prototypie odtworzona), seedowane „messy" położenie bloku,
   trail znaczków za kursorem (z znajdki), `porzuć znajdkę`, `wesprzyj
   wydanie`, swipe na mobile, prefers-reduced-motion.

### co przy okazji uprościć (z TODO.md)

- zdeduplikować podwójne meta tagi w `<head>`,
- search/goto/font-size schować do jednego miejsca (łąka + jeden przycisk),
  zamiast 9 przycisków w pasku kontrolek.

---

## część 2 — kreatywny pomysł na dostęp (dziś: tylko QR ze znajdki)

20 fizycznych znajdek to świetny rdzeń — rzadkość i rytuał. Problem:
to **jedyne** drzwi, więc ktoś z Krakowa czy Gdańska nie wejdzie nigdy.
Propozycja: zostawić znajdki jako drzwi główne i dodać drzwi, które są
równie „w duchu", ale nie wymagają trzymania przedmiotu.

### rekomendacja: „wschód słońca" 🌅

Bio kończy się słowami *„kocham naturę, wschody słońca, ciszę"*. Więc:

> **strona otwiera się dla każdego — ale tylko o wschodzie słońca.**

- W okno ±20 minut wokół lokalnego wschodu słońca bramka wpuszcza każdego,
  kto przyjdzie, i daje dostęp do **zachodu słońca tego dnia** (sesja-dzień,
  krótszy JWT niż 30-dniowy znajdkowy).
- Poza oknem bramka-czat mówi np. *„śpię. przyjdź o 4:37"* — i podaje
  godzinę jutrzejszego wschodu dla lokalizacji pytającego.
- **Zero nowej infrastruktury**: Vercel już daje `x-vercel-ip-latitude/longitude`
  (api/gate/scan.js już je czyta do logów), wschód słońca liczy się wzorem
  NOAA w ~30 liniach bez zależności, sesje to ten sam JWT + cookie co teraz.
- Rzadkość zostaje zachowana — kluczem nie jest przedmiot, tylko **fatyga**:
  trzeba wstać o świcie. To jest dokładnie ten sam gest co schylenie się po
  znajdkę — wysiłek zamiast loginu. I daje się tym dzielić wirusowo
  („ta strona z wierszami otwiera się tylko o wschodzie słońca").

### drzwi nr 3 (tani dodatek): „szept" — podaj dalej

Posiadacz znajdki może raz na jakiś czas (np. raz na tydzień) wygenerować
**jednorazowy link-szept** ważny 24h i wysłać go jednej osobie. Obdarowany
dostaje 7 dni dostępu i widzi rodowód: *„jesteś trzecią parą rąk tej znajdki"*.

- Infrastruktura **już istnieje**: api/gate/transfer.js robi dokładnie to
  z tokenami transferu — wystarczy wariant, który nie przepina parowania,
  tylko wydaje krótszą sesję-gościa i inkrementuje licznik w KV.
- Znajdka przestaje być kluczem do drzwi, a staje się **nasionem** — każda
  z 20 sztuk rozsiewa dostęp dalej, po jednej osobie naraz, i zostawia ślad.

### pomysły zapasowe (gdyby kiedyś)

- **„zostaw wiersz, weź wiersz"** — bramka-czat przyjmuje własny krótki
  wiersz odwiedzającego i daje dzień dostępu; teksty lądują w admin findings
  (api/add-poem.js już jest). Płaci się wierszem, nie pieniędzmi.
- **fragmenty w mieście** — wlepki/plakaty z pojedynczą linijką zamiast QR;
  wpisanie linijki w bramce = klucz (linijka jest kodem w KV). Tańsze
  w produkcji niż znajdki, skalowalne na inne miasta.

### dlaczego ta kombinacja

| drzwi | klucz | rzadkość | koszt budowy |
|---|---|---|---|
| znajdka (jest) | przedmiot | 20 sztuk | 0 — działa |
| wschód słońca | wstanie o świcie | ~40 min/dobę | 1 endpoint, bez zależności |
| szept | zaufanie posiadacza | 20 × 1/tydzień | wariant istniejącego transferu |

Trzy drzwi, trzy różne gesty — znaleźć, obudzić się, dostać od kogoś.
Żadne nie jest „zarejestruj się i kliknij". Wszystkie zostawiają ślad w KV,
który widać w admin panelu.

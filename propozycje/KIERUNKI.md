# poems.html — trzy kierunki do wyboru

Podgląd: `propozycje/kierunki.html` (przełącznik a/b/c u góry).
Zero efektów, zero ozdobników — sama typografia. Wybierz kierunek,
dopracuję wybrany na pełnym poems.html.

**a — kartka.** Jeden wiersz na ekranie i nic poza nim. Klik przy lewej/prawej
krawędzi przewija. Pod spodem jedno słowo „spis" — lista pierwszych linijek
zamiast numerów i wyszukiwarki.

**b — zwój.** Wszystkie wiersze jednym pionowym ciągiem, jak długi rękopis.
Między wierszami separatory ze znaków staśka. Po prawej cienka nić pokazuje,
gdzie jesteś. Naturalne na telefonie — czyta się kciukiem.

**c — maszynopis.** Archiwum na zimno: monospace, lista `0001 · pierwsza
linijka`, klik otwiera wiersz. Pasuje do estetyki admin.html i do słowa
„archiwum", którym strona sama się opisuje.

---

# dostęp — nowe pomysły (zamiast samego QR)

1. **strona, która się otwiera powoli.** Bez kodów: pierwszego dnia każdy
   widzi jeden wiersz. Każdy dzień powrotu odsłania kilka kolejnych — pełne
   archiwum po ~30 dniach wracania. Kluczem jest cierpliwość, nie przedmiot.
   Znajdka z QR pozostaje skrótem: od razu wszystko. (Cookie + licznik dni,
   jeden endpoint.)

2. **wiersz dnia.** Publiczna strona z jednym wierszem na dobę, bez logowania.
   Archiwum całości — tylko za znajdką. Daje się linkować i wracać codziennie,
   a rzadkość zbioru zostaje nietknięta.

3. **dostęp za wiersz.** Bramka przyjmuje jeden własny wiersz odwiedzającego
   i otwiera archiwum na tydzień. Teksty wpadają do admin findings
   (api/add-poem.js już istnieje). Płaci się tym samym, czym jest strona.

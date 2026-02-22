# Google Analytics – konfiguracja

Strona używa **Google Tag Manager** (GTM-TKJ2KBZ8). Zdarzenia są wysyłane przez `dataLayer.push()`.

## Konfiguracja GTM

W [tagmanager.google.com](https://tagmanager.google.com) → kontener GTM-TKJ2KBZ8:

1. **Tag GA4 Configuration**
   - Typ: Google Analytics: GA4 Configuration
   - Measurement ID: `G-XVMT9MTCGE`
   - Wyzwalacz: All Pages

2. **Tag GA4 Event** (dla zdarzeń niestandardowych)
   - Typ: Google Analytics: GA4 Event
   - Configuration Tag: wybierz tag z pkt 1
   - Event Name: `{{Event}}` (zmienna Data Layer)
   - Event Parameters: poem_index → `{{dlv - poem_index}}`, poem_title → `{{dlv - poem_title}}`, direction → `{{dlv - direction}}`, link_url → `{{dlv - link_url}}`, menu_name → `{{dlv - menu_name}}`
   - Wyzwalacz: Custom Event – utwórz osobny trigger dla każdego zdarzenia (poem_view, copy_link, font_adjust, support_click, read_poems_click, start_click, menu_open, back_to_start, download_image) albo jeden trigger z regex w nazwie zdarzenia

3. **Zmienne Data Layer** (jeśli potrzebne)
   - Zmienne → Nowa → Typ: Data Layer Variable
   - Nazwa zmiennej w Data Layer: `poem_index`, `poem_title`, `direction`, `link_url`, `menu_name`

---

## Co jest już śledzone

Na stronie wysyłane są następujące zdarzenia:

| Zdarzenie | Kiedy | Parametry |
|-----------|-------|-----------|
| `start_click` | Klik w tytuł (start) lub Enter/Space | — |
| `read_poems_click` | Klik „czytaj tutaj” | — |
| `support_click` | Klik „wesprzyj wydanie” | `link_url` |
| `poem_view` | Wyświetlenie wiersza (nawigacja) | `poem_index`, `poem_title` |
| `menu_open` | Otwarcie menu prezentacji | `menu_name` |
| `back_to_start` | Powrót do strony startowej | — |
| `copy_link` | Skopiowanie linku do wiersza | `poem_index` |
| `font_adjust` | Zmiana rozmiaru czcionki | `direction` (smaller/bigger) |
| `download_image` | Pobranie obrazu wiersza (poems.html) | `poem_index` |

Śledzenie działa na **index.html** i **poems.html**.

---

## Jak skonfigurować w GA4

### 1. Zaloguj się do Google Analytics
- Wejdź na [analytics.google.com](https://analytics.google.com)
- Wybierz właściwość z ID `G-XVMT9MTCGE`

### 2. Sprawdź, czy dane wpływają
- **Raportowanie** → **Zdarzenia** – po kilku godzinach zobaczysz zdarzenia
- **Raportowanie** → **Czas rzeczywisty** – podgląd na żywo (opóźnienie ok. 30 s)

### 3. Utwórz raport niestandardowy (opcjonalnie)
- **Eksploracja** → **Utwórz eksplorację** → **Eksploracja swobodna**
- Dodaj wymiar: **Nazwa zdarzenia**
- Dodaj wymiar: **poem_index** lub **poem_title** (dla `poem_view`)
- Dodaj metrykę: **Liczba zdarzeń**
- Ustaw filtry według potrzeb

### 4. Konwersje (opcjonalnie)
Jeśli chcesz śledzić np. „czytaj tutaj” jako konwersję:
- **Admin** → **Zdarzenia** → znajdź `read_poems_click` → włącz **Oznacz jako konwersję**
- To samo możesz zrobić dla `support_click` (wesprzyj wydanie)

### 5. Audiencje (opcjonalnie)
- **Admin** → **Audiencje** → **Nowa audiencja**
- Np. „Osoby, które kliknęły wesprzyj”: warunek = zdarzenie `support_click`
- Np. „Czytelnicy wierszy”: warunek = zdarzenie `poem_view`

---

## Gdzie szukać danych

- **Najpopularniejsze wiersze**: Zdarzenia → `poem_view` → wymiar `poem_title` lub `poem_index`
- **Konwersja do czytania**: Zdarzenia → `read_poems_click`
- **Wsparcie**: Zdarzenia → `support_click`
- **Użycie menu**: Zdarzenia → `menu_open`

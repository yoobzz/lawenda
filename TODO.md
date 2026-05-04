# TODO — odłożone decyzje i drobnostki

## odłożone decyzje (z Kroku A, do podjęcia później)

- [ ] **watermark domeny w pobieraniu PNG wiersza** (`poems.html:3471-3473`) — obecnie kanwa wkomponowuje `szpineta.com` w dolną ramkę pobranego obrazu. Po wprowadzeniu modelu dostępu przez fizyczny kod QR domena na obrazku staje się sprzeczna z duchem mechaniki ("znalazłeś, masz, możesz puścić"). Decyzja po **Kroku F**: usunąć domenę całkiem? Zastąpić kodem (np. `~||-_^+*.`)? Zostawić jako pomost między światami?

- [ ] **zduplikowane meta tagi w `poems.html`** (linie 11–17 i 34–39) — w `<head>` znajdują się dwa zestawy tych samych tagów `og:*` i `twitter:*`. Stan z HEAD-a, bug z poprzedniej iteracji. Nie deduplikujemy w Kroku A żeby nie mieszać scope. Po Kroku D (gdy `poems.html` przejdzie głęboki refaktor i tak) — zostawić tylko jeden zestaw.

## informacje (nic do zrobienia, tylko ślad)

- `znajdki-backend/` i `znajdki-preview/` zostały usunięte (`rm -rf`, nie były w gicie — untracked). W `znajdki-backend/.env` były lokalne sekrety: `DATABASE_URL`, `ADMIN_TOKEN`, `PORT`, `HOST`, `CORS_ORIGIN`. **Sekrety NIE trafiły do gita** (folder nie był commitowany), więc nie ma potrzeby ich rotacji. Jeśli `DATABASE_URL` wskazywał na działającą bazę PostgreSQL którą jeszcze masz uruchomioną gdzieś — możesz ją wyłączyć, bo nikt już z niej nie korzysta.

## planowane (Krok B+, do referencji)

- migracja 157 wierszy z `poems.html` do Vercel KV (krok B)
- backend `/api/gate/*` (krok C)
- bramka UI z trybem czatu w stylu szpinety (krok E)
- generowanie 20 unikalnych kodów QR + plik mapowania do druku (krok B.4)

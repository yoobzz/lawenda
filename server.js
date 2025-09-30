/* Minimalny serwer z panelem admin (Basic Auth) i edycją poems.html */
const path = require('path');
const fs = require('fs');
const express = require('express');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Uwierzytelnienie Basic Auth dla /admin
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'changeme';
app.use('/admin', basicAuth({
  users: { [adminUser]: adminPass },
  challenge: true,
  realm: 'szpineta-admin',
}));

// Parsowanie formularzy
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serwowanie plików statycznych (publicznych)
app.use(express.static(__dirname, { extensions: ['html'] }));

// Prosty panel admin (serwowany wyłącznie po uwierzytelnieniu)
app.get('/admin', (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.send(`<!DOCTYPE html>
<html lang="pl"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>panel — dodaj wiersz</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; margin: 24px; }
    label { display:block; margin: 12px 0 6px; font-weight: 600; }
    input[type=text], textarea { width: 100%; max-width: 820px; padding: 10px; font: inherit; }
    textarea { height: 320px; }
    button { margin-top: 16px; padding: 10px 14px; font: inherit; cursor: pointer; }
    .hint { color: #666; font-size: 12px; margin-top: 4px; }
    .ok { color: #0a7d2e; }
    .err { color: #b00020; }
  </style>
</head><body>
  <h1>Dodaj wiersz</h1>
  <form method="post" action="/admin/add-poem">
    <label for="poemTitle">Tytuł (opcjonalnie, nie wpływa na wygląd)</label>
    <input type="text" id="poemTitle" name="poemTitle" placeholder="np. po pełni">
    <div class="hint">Tytuł zapisywany jest jako komentarz w kodzie źródłowym.</div>

    <label for="poemText">Treść wiersza</label>
    <textarea id="poemText" name="poemText" placeholder="Wpisz wiersz. Nowe linie będą zapisane jako &lt;br&gt;."></textarea>
    <div class="hint">Zachowaj puste linie tam, gdzie chcesz przerwę akapitową.</div>

    <button type="submit">Dodaj jako nowy wiersz</button>
  </form>
  <p class="hint">Po dodaniu odśwież <a href="/poems.html" target="_blank" rel="noopener">poems.html</a>.</p>
</body></html>`);
});

// Pomocnicze: bezpieczne escapowanie HTML
function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Pomocnicze: znajdź pozycję domykającego </div> dla <div id="...">
function findContainerCloseIndex(html, containerId) {
  const openRe = new RegExp(`<div\\b[^>]*\\bid=["']${containerId}["'][^>]*>`, 'i');
  const match = openRe.exec(html);
  if (!match) return -1;
  const afterOpen = match.index + match[0].length;
  const tokenRe = /<div\b[^>]*>|<\/div>/gi;
  tokenRe.lastIndex = afterOpen;
  let depth = 1;
  let token;
  while ((token = tokenRe.exec(html)) !== null) {
    const t = token[0].toLowerCase();
    if (t.startsWith('<div')) depth += 1;
    else depth -= 1;
    if (depth === 0) return token.index; // wstawiamy PRZED tym </div>
  }
  return -1;
}

// Znajdź miejsce wstawienia w #poemsMount
function findInsertPositionForPoem(html) {
  return findContainerCloseIndex(html, 'poemsMount');
}

// Znajdź miejsce wstawienia w dowolnym kontenerze o id
function findInsertPositionByContainerId(html, containerId) {
  return findContainerCloseIndex(html, containerId);
}

// Ustal kolejny data-index
function getNextPoemIndex(html) {
  const re = /data-index=\"(\d+)\"/g;
  let max = -1;
  let m;
  while ((m = re.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

app.post('/admin/add-poem', (req, res) => {
  try {
    const poemsPath = path.join(__dirname, 'poems.html');
    const indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(poemsPath)) {
      return res.status(500).send('<p class="err">Nie znaleziono poems.html</p>');
    }
    const rawPoems = fs.readFileSync(poemsPath, 'utf8');
    let insertPoems = findInsertPositionForPoem(rawPoems);
    if (insertPoems < 0) {
      insertPoems = findInsertPositionByContainerId(rawPoems, 'poemsSection');
      if (insertPoems < 0) {
        return res.status(500).send('<p class="err">Nie znaleziono kontenera #poemsMount ani #poemsSection</p>');
      }
    }

    const nextIndexPoems = getNextPoemIndex(rawPoems);
    const title = (req.body.poemTitle || '').trim();
    const text = (req.body.poemText || '').replace(/\r\n/g, '\n');
    if (!text) {
      return res.status(400).send('<p class="err">Treść wiersza jest pusta</p>');
    }

    const escaped = escapeHtml(text)
      .split('\n')
      .map(line => line.length ? line : '')
      .join('<br>\n                ');

    // poems.html wcięcia
    const indentPoemsDiv = '            ';
    const indentPoemsText = '                ';
    const titleComment = title ? `\n${indentPoemsDiv}<!-- ${escapeHtml(title)} -->` : '';
    const blockPoems = `\n${indentPoemsDiv}<div class=\"poem\" data-index=\"${nextIndexPoems}\">\n${indentPoemsText}${escaped}\n${indentPoemsDiv}</div>\n`;

    const updatedPoems = rawPoems.slice(0, insertPoems) + titleComment + blockPoems + rawPoems.slice(insertPoems);
    fs.writeFileSync(poemsPath, updatedPoems, 'utf8');

    // index.html — sekcja poemsSection (wcięcie 8/12 spacji jak w pliku)
    let updatedIndex = false;
    if (fs.existsSync(indexPath)) {
      const rawIndex = fs.readFileSync(indexPath, 'utf8');
      const insertIndex = findInsertPositionByContainerId(rawIndex, 'poemsSection');
      if (insertIndex >= 0) {
        const nextIndexIndex = getNextPoemIndex(rawIndex);
        const indentIndexDiv = '        ';
        const indentIndexText = '            ';
        const blockIndex = `\n${indentIndexDiv}<div class=\"poem\" data-index=\"${nextIndexIndex}\">\n${indentIndexText}${escaped}\n${indentIndexDiv}</div>\n`;
        const updatedIndexHtml = rawIndex.slice(0, insertIndex) + blockIndex + rawIndex.slice(insertIndex);
        fs.writeFileSync(indexPath, updatedIndexHtml, 'utf8');
        updatedIndex = true;
      }
    }

    res.set('X-Robots-Tag', 'noindex, nofollow');
    const msg = updatedIndex ? 'Dodano wiersz do poems.html i index.html.' : 'Dodano wiersz do poems.html.';
    return res.send(`<p class="ok">${msg}</p><p><a href="/poems.html" target="_blank" rel="noopener">Otwórz poems.html</a></p><p><a href="/index.html" target="_blank" rel="noopener">Otwórz index.html</a></p>`);
  } catch (e) {
    console.error(e);
    return res.status(500).send('<p class="err">Błąd serwera podczas zapisu</p>');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  if (adminPass === 'changeme') {
    console.log('UWAGA: Ustaw ADMIN_USER i ADMIN_PASS, np.: ADMIN_USER=stas ADMIN_PASS=twojehaslo node server.js');
  }
});




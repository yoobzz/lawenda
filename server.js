/* Minimalny serwer z panelem admin (Basic Auth) i edycją poems.html */
const path = require('path');
const fs = require('fs');
const express = require('express');
const basicAuth = require('express-basic-auth');

// Canvas do generowania obrazów (opcjonalne - jeśli nie zainstalowane, endpoint zwróci błąd)
let createCanvas, loadFont;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadFont = canvas.loadFont;
} catch (e) {
  console.warn('canvas nie jest zainstalowany - endpoint obrazów nie będzie działał. Zainstaluj: npm install canvas');
}

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

// Funkcja do parsowania wiersza z poems.html
function getPoemFromHtml(html, poemIndex) {
  // Szukaj div z data-index="poemIndex"
  const re = new RegExp(`<div\\s+class=["']poem["'][^>]*data-index=["']${poemIndex}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i');
  const match = re.exec(html);
  if (!match) return null;
  
  const poemHtml = match[1];
  // Usuń HTML i wyciągnij tekst - zachowaj wszystkie znaki specjalne
  let text = poemHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
  
  // Dekoduj wszystkie HTML entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Podziel na linie - ZACHOWAJ puste linie (nie filtruj ich!)
  const lines = text.split('\n').map(l => l.trim());
  // Filtruj tylko dla preview (nie dla głównego tekstu)
  const nonEmptyLines = lines.filter(l => l.length > 0);
  
  return {
    text: text,
    lines: lines, // ZACHOWAJ wszystkie linie, w tym puste
    firstLine: nonEmptyLines[0] || 'wiersz',
    preview: nonEmptyLines.slice(0, 3).join(' ').substring(0, 150) || 'staś szpineta archiwum'
  };
}

// Endpoint do renderowania poems.html z właściwymi meta tagami dla crawlerów
app.get('/poems.html', (req, res) => {
  const poemsPath = path.join(__dirname, 'poems.html');
  if (!fs.existsSync(poemsPath)) {
    return res.status(404).send('Not found');
  }
  
  let html = fs.readFileSync(poemsPath, 'utf8');
  
  // Sprawdź czy jest query parameter ?poem=X (dla crawlerów Facebook/Twitter)
  const poemParam = req.query.poem;
  if (poemParam) {
    const poemIndex = parseInt(poemParam, 10) - 1; // data-index jest 0-based
    if (!isNaN(poemIndex) && poemIndex >= 0) {
      const poem = getPoemFromHtml(html, poemIndex);
      
      if (poem) {
        const poemNumber = poemIndex + 1;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const currentUrl = `${baseUrl}/poems.html#wiersz-${poemNumber}`;
        
        // Aktualizuj meta tagi - znajdź i zamień każdy
        html = html.replace(
          /<meta\s+property=["']og:title["'][^>]*>/i,
          `<meta property="og:title" content="wiersz ${poemNumber} — ${escapeHtml(poem.firstLine.substring(0, 50))}">`
        );
        html = html.replace(
          /<meta\s+property=["']og:description["'][^>]*>/i,
          `<meta property="og:description" content="${escapeHtml(poem.preview)}">`
        );
        html = html.replace(
          /<meta\s+property=["']og:url["'][^>]*>/i,
          `<meta property="og:url" content="${escapeHtml(currentUrl)}">`
        );
        html = html.replace(
          /<meta\s+name=["']twitter:title["'][^>]*>/i,
          `<meta name="twitter:title" content="wiersz ${poemNumber} — ${escapeHtml(poem.firstLine.substring(0, 50))}">`
        );
        html = html.replace(
          /<meta\s+name=["']twitter:description["'][^>]*>/i,
          `<meta name="twitter:description" content="${escapeHtml(poem.preview)}">`
        );
        // Aktualizuj obraz - użyj endpoint do generowania obrazu
        const imageUrl = `${baseUrl}/poem-image.png?poem=${poemNumber}`;
        html = html.replace(
          /<meta\s+property=["']og:image["'][^>]*>/i,
          `<meta property="og:image" content="${escapeHtml(imageUrl)}">`
        );
        html = html.replace(
          /<meta\s+name=["']twitter:image["'][^>]*>/i,
          `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`
        );
        html = html.replace(
          /<title>[^<]*<\/title>/i,
          `<title>wiersz ${poemNumber} — ~||-_^+*.</title>`
        );
      }
    }
  }
  
  res.send(html);
});

// Endpoint do generowania obrazu z treścią wiersza (dla Instagram Stories)
app.get('/poem-image.png', async (req, res) => {
  if (!createCanvas) {
    return res.status(503).send('Canvas library not installed');
  }
  
  const poemParam = req.query.poem;
  if (!poemParam) {
    return res.status(400).send('Missing ?poem parameter');
  }
  
  const poemsPath = path.join(__dirname, 'poems.html');
  if (!fs.existsSync(poemsPath)) {
    return res.status(404).send('poems.html not found');
  }
  
  const html = fs.readFileSync(poemsPath, 'utf8');
  const poemIndex = parseInt(poemParam, 10) - 1;
  if (isNaN(poemIndex) || poemIndex < 0) {
    return res.status(400).send('Invalid poem index');
  }
  
  const poem = getPoemFromHtml(html, poemIndex);
  if (!poem) {
    return res.status(404).send('Poem not found');
  }
  
  try {
    // Załaduj czcionkę ABC Diatype Rounded jeśli dostępna
    const fontPath = path.join(__dirname, 'fonts', 'ABCDiatypeRoundedVariable-Trial.woff2');
    if (loadFont && fs.existsSync(fontPath)) {
      try {
        await loadFont(fontPath);
      } catch (e) {
        console.warn('Nie można załadować czcionki ABC Diatype Rounded:', e.message);
      }
    }
    // Spróbuj też załadować ABC Helveesti Plus Variable (fallback)
    const helveestiPath = path.join(__dirname, 'fonts', 'ABCHelveestiPlusVariable-Trial.woff2');
    if (loadFont && fs.existsSync(helveestiPath)) {
      try {
        await loadFont(helveestiPath);
      } catch (e) {
        // Ignoruj błąd - to tylko fallback
      }
    }
    
    // Wymiary Instagram Stories
    const W = 1080;
    const H = 1920;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    
    // Tło (lekko kremowe gradient)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fffdfa');
    bg.addColorStop(1, '#f9f6ef');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    
    // Marginesy
    const padX = 120;
    const padY = 200;
    const contentW = W - padX * 2;
    const contentH = H - padY * 2;
    
    // Ustawienia tekstu
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    
    // Tekst wiersza - podziel na linie
    const originalLines = poem.lines;
    let fontSize = 44;
    let allLines = [];
    
    // Funkcja do zawijania długich linii
    const wrapLine = (text, maxWidth, currentFontSize) => {
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      ctx.font = `300 ${currentFontSize}px 'ABC Diatype Rounded', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        const metrics = ctx.measureText(test);
        if (metrics.width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          // Jeśli słowo jest za długie, dziel po znakach
          if (ctx.measureText(word).width > maxWidth) {
            let chunk = '';
            for (const ch of word) {
              const test2 = chunk + ch;
              if (ctx.measureText(test2).width <= maxWidth) {
                chunk = test2;
              } else {
                if (chunk) lines.push(chunk);
                chunk = ch;
              }
            }
            line = chunk;
          } else {
            line = word;
          }
        }
      }
      if (line) lines.push(line);
      return lines;
    };
    
    // Znajdź odpowiedni rozmiar czcionki
    do {
      allLines = [];
      ctx.font = `300 ${fontSize}px 'ABC Diatype Rounded', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      for (const rawLine of originalLines) {
        if ((rawLine || '').trim().length === 0) {
          allLines.push(''); // zachowaj pustą linię jako odstęp
        } else {
          const wrapped = wrapLine(rawLine, contentW, fontSize);
          allLines.push(...wrapped);
        }
      }
      const lineHeight = fontSize * 1.4;
      const totalHeight = allLines.reduce((acc, ln) => acc + (ln === '' ? fontSize * 0.9 : lineHeight), 0);
      if (totalHeight > contentH) {
        fontSize -= 2;
      } else {
        break;
      }
    } while (fontSize >= 28);
    
    // Rysuj tekst - wyśrodkuj w pionie
    ctx.font = `300 ${fontSize}px 'ABC Diatype Rounded', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    const lineHeight = fontSize * 1.4;
    const totalHeight = allLines.reduce((acc, ln) => acc + (ln === '' ? fontSize * 0.9 : lineHeight), 0);
    let y = padY + Math.max(0, (contentH - totalHeight) / 2);
    
    for (const ln of allLines) {
      if (ln === '') {
        y += fontSize * 0.9;
        continue;
      }
      // Upewnij się, że wszystkie znaki są renderowane (w tym znaki specjalne)
      try {
        ctx.fillText(ln, W / 2, y);
      } catch (err) {
        // Jeśli błąd renderowania, spróbuj bez problematycznych znaków
        console.warn('Błąd renderowania linii:', ln, err);
        const safeLine = ln.replace(/[^\x20-\x7E\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/g, '?');
        ctx.fillText(safeLine, W / 2, y);
      }
      y += lineHeight;
      if (y > H - padY) break;
    }
    
    // Stopka z autorem
    ctx.font = '700 22px \'ABC Diatype Rounded\', \'Inter\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('~||-_^+*.', W / 2, H - 100);
    
    // Konwertuj do PNG
    const buffer = canvas.toBuffer('image/png');
    
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache na 24h
    res.send(buffer);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).send('Error generating image');
  }
});

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
    body { font-family: 'ABC Diatype Rounded', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 24px; }
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




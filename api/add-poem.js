// Serverless API for Vercel: add a poem by committing changes to GitHub repo
// Requires env vars on Vercel:
// - ADMIN_TOKEN: bearer token required in Authorization header
// - GITHUB_TOKEN: personal access token with repo contents write access
// - GITHUB_REPO: "owner/repo"
// - GITHUB_BRANCH: branch name (default: main)

/**
 * Convert raw text into HTML lines with <br> and escaped entities.
 */
function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toHtmlLines(text, indentForText) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const escaped = escapeHtml(normalized)
    .split('\n')
    .map(line => (line.length ? `${line}<br>` : ''))
    .join(`\n${indentForText}`);
  return escaped;
}

/** Find index of the closing </div> for a container with the given id. */
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
    if (depth === 0) return token.index; // insert before this </div>
  }
  return -1;
}

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

async function githubGetFile(owner, repo, path, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub GET ${path} failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

async function githubPutFile(owner, repo, path, branch, token, message, contentBase64, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: contentBase64,
    branch,
    sha,
  };
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub PUT ${path} failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Auth
    const adminToken = process.env.ADMIN_TOKEN;
    const auth = req.headers.authorization || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    if (!adminToken || !provided || provided !== adminToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
~
    // Env
    const githubToken = process.env.GITHUB_TOKEN;
    const repoFull = process.env.GITHUB_REPO || '';
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!githubToken || !repoFull.includes('/')) {
      return res.status(500).json({ error: 'GitHub env not configured' });
    }
    const [owner, repo] = repoFull.split('/');

    // Body
    const ct = (req.headers['content-type'] || '').toLowerCase();
    let poemTitle = '';
    let poemText = '';
    if (ct.includes('application/json') && req.body) {
      poemTitle = String(req.body.poemTitle || '');
      poemText = String(req.body.poemText || '');
    } else if (ct.includes('application/x-www-form-urlencoded') && req.body) {
      poemTitle = String(req.body.poemTitle || '');
      poemText = String(req.body.poemText || '');
    } else {
      // Try to parse raw text JSON
      try {
        const raw = typeof req.body === 'string' ? req.body : '';
        const parsed = raw ? JSON.parse(raw) : {};
        poemTitle = String(parsed.poemTitle || '');
        poemText = String(parsed.poemText || '');
      } catch (_) {
        // ignore
      }
    }
    if (!poemText || !poemText.trim()) {
      return res.status(400).json({ error: 'Treść wiersza jest pusta' });
    }

    // Get current files
    const poemsMeta = await githubGetFile(owner, repo, 'poems.html', branch, githubToken);
    const indexMeta = await githubGetFile(owner, repo, 'index.html', branch, githubToken);
    const poemsHtml = Buffer.from(poemsMeta.content || '', 'base64').toString('utf8');
    const indexHtml = Buffer.from(indexMeta.content || '', 'base64').toString('utf8');

    // Compute insert positions
    let insertPoems = findContainerCloseIndex(poemsHtml, 'poemsMount');
    if (insertPoems < 0) insertPoems = findContainerCloseIndex(poemsHtml, 'poemsSection');
    if (insertPoems < 0) return res.status(500).json({ error: 'Nie znaleziono kontenera #poemsMount ani #poemsSection w poems.html' });

    const insertIndex = findContainerCloseIndex(indexHtml, 'poemsSection');
    if (insertIndex < 0) return res.status(500).json({ error: 'Nie znaleziono kontenera #poemsSection w index.html' });

    const nextIndexPoems = getNextPoemIndex(poemsHtml);
    const nextIndexIndex = Math.max(getNextPoemIndex(indexHtml), nextIndexPoems);

    // Build blocks with indentation matching local server.js logic
    const indentPoemsDiv = '            ';
    const indentPoemsText = '                ';
    const indentIndexDiv = '        ';
    const indentIndexText = '            ';

    const titleComment = poemTitle.trim() ? `\n${indentPoemsDiv}<!-- ${escapeHtml(poemTitle.trim())} -->` : '';
    const textHtmlPoems = toHtmlLines(poemText, indentPoemsText);
    const textHtmlIndex = toHtmlLines(poemText, indentIndexText);

    const blockPoems = `\n${indentPoemsDiv}<div class=\"poem\" data-index=\"${nextIndexPoems}\">\n${indentPoemsText}${textHtmlPoems}\n${indentPoemsDiv}</div>\n`;
    const blockIndex = `\n${indentIndexDiv}<div class=\"poem\" data-index=\"${nextIndexIndex}\">\n${indentIndexText}${textHtmlIndex}\n${indentIndexDiv}</div>\n`;

    const updatedPoems = poemsHtml.slice(0, insertPoems) + titleComment + blockPoems + poemsHtml.slice(insertPoems);
    const updatedIndex = indexHtml.slice(0, insertIndex) + blockIndex + indexHtml.slice(insertIndex);

    // Commit both files
    const timestamp = new Date().toISOString();
    const commitMsg = poemTitle.trim() ? `Add poem: ${poemTitle.trim()} (${timestamp})` : `Add poem (${timestamp})`;

    await githubPutFile(owner, repo, 'poems.html', branch, githubToken, commitMsg, Buffer.from(updatedPoems, 'utf8').toString('base64'), poemsMeta.sha);
    await githubPutFile(owner, repo, 'index.html', branch, githubToken, commitMsg, Buffer.from(updatedIndex, 'utf8').toString('base64'), indexMeta.sha);

    return res.status(200).json({ ok: true, message: 'Dodano wiersz do poems.html i index.html (commit w GitHub).', dataIndexPoems: nextIndexPoems, dataIndexIndex: nextIndexIndex });
  } catch (e) {
    return res.status(500).json({ error: 'Błąd serwera', details: String(e && e.message ? e.message : e) });
  }
}



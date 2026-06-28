// Serverless API (Vercel): dodaje wiersz BEZPOSREDNIO do Vercel KV (poems:all),
// dzieki czemu pojawia sie na stronie natychmiast (poems.html czyta z /api/poems -> KV).
// Best-effort: jesli skonfigurowany GitHub, synchronizuje tez zrodlo scripts/output/poems.json.
//
// Env:
// - JWT_SECRET / ADMIN_MASTER_KEY (logowanie panelu) lub ADMIN_TOKEN (Bearer dla skryptow)
// - KV_REST_API_URL / KV_REST_API_TOKEN
// - (opcjonalnie) GITHUB_TOKEN, GITHUB_REPO "owner/repo", GITHUB_BRANCH (domyslnie main)

const kv = require('./_lib/kv.js');
const { requireAdmin } = require('./_lib/admin-auth.js');

// Zamien surowy tekst na tablice wersow (jak scripts/extract-poems.js):
// trim kazdej linii, usun puste z poczatku i konca, zachowaj puste w srodku (przerwy zwrotek).
function toLines(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
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
  if (!resp.ok) throw new Error(`GitHub GET ${path}: ${resp.status}`);
  return resp.json();
}

async function githubPutFile(owner, repo, path, branch, token, message, contentBase64, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ message, content: contentBase64, branch, sha }),
  });
  if (!resp.ok) throw new Error(`GitHub PUT ${path}: ${resp.status}`);
  return resp.json();
}

// Best-effort: dopisz wiersz do scripts/output/poems.json w repo (zeby zrodlo bylo zsynchronizowane z KV).
async function syncPoemToGithub(poem) {
  const githubToken = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO || '';
  if (!githubToken || !repoFull.includes('/')) return false;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const [owner, repo] = repoFull.split('/');
  const path = 'scripts/output/poems.json';
  const meta = await githubGetFile(owner, repo, path, branch, githubToken);
  let arr = [];
  try { arr = JSON.parse(Buffer.from(meta.content || '', 'base64').toString('utf8')); } catch (_) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  arr.push(poem);
  const content = Buffer.from(`${JSON.stringify(arr, null, 2)}\n`, 'utf8').toString('base64');
  await githubPutFile(owner, repo, path, branch, githubToken, `Add poem (index ${poem.index})`, content, meta.sha);
  return true;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Auth: JWT cookie (panel) lub Bearer ADMIN_TOKEN (skrypty)
    if (requireAdmin(req, res) !== true) return;

    // Body (JSON lub form)
    let poemTitle = '';
    let poemText = '';
    const body = req.body;
    if (body && typeof body === 'object') {
      poemTitle = String(body.poemTitle || '');
      poemText = String(body.poemText || '');
    } else if (typeof body === 'string' && body) {
      try { const p = JSON.parse(body); poemTitle = String(p.poemTitle || ''); poemText = String(p.poemText || ''); } catch (_) {}
    }

    const lines = toLines(poemText);
    if (!lines.length) return res.status(400).json({ error: 'Treść wiersza jest pusta' });

    // ── zapis do KV (zrodlo, ktore czyta strona) ──
    const poems = (await kv.get('poems:all')) || [];
    if (!Array.isArray(poems)) return res.status(500).json({ error: 'poems:all w KV ma zly format' });
    const maxIndex = poems.reduce((m, p) => (p && typeof p.index === 'number' && p.index > m ? p.index : m), -1);
    const index = maxIndex + 1;

    const poem = { index, lines };
    poems.push(poem);
    await kv.set('poems:all', poems);

    const indices = poems.map(p => p.index).filter(n => typeof n === 'number');
    await kv.set('poems:meta', {
      count: poems.length,
      minIndex: indices.length ? Math.min(...indices) : 0,
      maxIndex: indices.length ? Math.max(...indices) : 0,
      updatedAt: new Date().toISOString(),
    });

    // ── best-effort: zsynchronizuj zrodlo w repo (nie blokuje sukcesu) ──
    let synced = false;
    try { synced = await syncPoemToGithub(poem); } catch (_) { synced = false; }

    return res.status(200).json({
      ok: true,
      index,
      message: synced
        ? `Dodano wiersz (index ${index}) do KV i zsynchronizowano poems.json.`
        : `Dodano wiersz (index ${index}) do KV — widoczny na stronie od razu.`,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Błąd serwera', details: String(e && e.message ? e.message : e) });
  }
};

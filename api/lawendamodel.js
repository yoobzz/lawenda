// Vercel serverless: proxy lawendamodel.stl z GitHub Releases (omija CORS + LFS)
// Model musi być w Release: https://github.com/yoobzz/lawenda/releases
const GITHUB_STL_URL = 'https://github.com/yoobzz/lawenda/releases/download/v1.0/lawendamodel.stl';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  try {
    const response = await fetch(GITHUB_STL_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': 'szpineta-pl/1.0' },
    });
    if (!response.ok) {
      return res.status(response.status).send(`GitHub release: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const { Readable } = require('stream');
    const stream = Readable.fromWeb(response.body);
    stream.pipe(res);
  } catch (e) {
    console.error('lawendamodel proxy error:', e);
    res.status(500).send('Proxy error');
  }
};

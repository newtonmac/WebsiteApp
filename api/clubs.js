const fs = require('fs');
const path = require('path');

// Simple API token — embedded in frontend JS (stops casual scraping)
const API_TOKEN = 'pp-clubs-7742-v1';

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://paddlepoint.org',
  'https://www.paddlepoint.org',
  'https://jmlsd.org',
  'https://www.jmlsd.org',
  'http://localhost',
  'http://127.0.0.1',
];

let cachedData = null;

function loadData() {
  if (cachedData) return cachedData;
  const filePath = path.join(__dirname, '_clubs-data.json');
  cachedData = fs.readFileSync(filePath, 'utf8');
  return cachedData;
}

module.exports = (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o) || referer.startsWith(o));

  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API token (from header or query param)
  const token = req.headers['x-api-token'] || req.query.token;
  if (token !== API_TOKEN) {
    // Also allow if referer is from our site (for browser navigation)
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied. This data is proprietary.' });
    }
  }

  // Serve data with cache headers (browser caches for 1 hour, CDN for 6 hours)
  try {
    const data = loadData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=21600, max-age=3600, stale-while-revalidate=86400');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load data' });
  }
};

// Vercel Serverless: Serve events from Cloud SQL
const { query } = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = [
  'https://paddlepoint.org','https://www.paddlepoint.org',
  'https://jmlsd.org','https://www.jmlsd.org',
  'http://localhost','http://127.0.0.1',
];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  if (origin && isAllowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const rows = await query('SELECT * FROM events ORDER BY start_date ASC');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

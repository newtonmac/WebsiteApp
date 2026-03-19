const express = require('express');
const mysql = require('mysql2/promise');

const app = express();

const ALLOWED_ORIGINS = [
  'https://jmlsd.org',
  'https://www.jmlsd.org',
  'https://paddlepoint.org',
  'https://www.paddlepoint.org',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Create connection pool (Cloud SQL uses Unix socket in Cloud Run)
let pool;
function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    user: process.env.DB_USER || 'paddle',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'paddlepoint',
    // Cloud Run connects via Unix socket
    socketPath: process.env.DB_SOCKET || `/cloudsql/${process.env.CLOUD_SQL_CONNECTION}`,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return pool;
}

// GET /clubs - return all clubs (with optional craft filter)
app.get('/clubs', async (req, res) => {
  try {
    const db = getPool();
    let query = 'SELECT * FROM paddle_recommendations WHERE latitude IS NOT NULL AND longitude IS NOT NULL';
    const params = [];

    if (req.query.craft) {
      query += ' AND craft_display_name = ?';
      params.push(req.query.craft);
    }

    query += ' ORDER BY sort_score DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET /clubs/search?country=US&state=California&city=San+Diego
app.get('/clubs/search', async (req, res) => {
  try {
    const db = getPool();
    let query = 'SELECT * FROM paddle_recommendations WHERE latitude IS NOT NULL AND longitude IS NOT NULL';
    const params = [];

    if (req.query.country) {
      query += ' AND country_code = ?';
      params.push(req.query.country);
    }
    if (req.query.state) {
      query += ' AND region_name = ?';
      params.push(req.query.state);
    }
    if (req.query.city) {
      query += ' AND (city = ? OR area_name LIKE ?)';
      params.push(req.query.city, `%${req.query.city}%`);
    }
    if (req.query.craft) {
      query += ' AND craft_display_name = ?';
      params.push(req.query.craft);
    }

    query += ' ORDER BY sort_score DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Paddle Clubs API running on port ${PORT}`);
});

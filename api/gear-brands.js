const { query } = require('./_db');
const ALLOWED_ORIGINS = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rows = await query(
      `SELECT * FROM gear_brands ORDER BY name`
    );
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

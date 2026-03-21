const pool = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';
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
    const [rows] = await pool.query(
      `SELECT id, ioc_code, name, country, continent, federation_type,
       website, email, phone, address, city, state, description, sports,
       facebook_url, instagram_url, logo_url, icf_url, founded_year,
       member_count, president FROM federations ORDER BY country, name`
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

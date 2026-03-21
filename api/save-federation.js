const pool = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-api-token'];
  if (token !== API_TOKEN) return res.status(403).json({ error: 'Access denied' });

  const data = req.body || {};

  if (req.method === 'DELETE') {
    if (!data.id) return res.status(400).json({ error: 'id required' });
    await pool.query('DELETE FROM federations WHERE id=?', [data.id]);
    return res.status(200).json({ success: true });
  }

  const fields = ['ioc_code','name','country','continent','federation_type',
    'website','email','phone','address','city','state','description','sports',
    'facebook_url','instagram_url','logo_url','icf_url','founded_year','member_count','president'];

  if (data.id) {
    // UPDATE
    const sets = [];
    const vals = [];
    for (const f of fields) {
      if (data[f] !== undefined) { sets.push(`${f}=?`); vals.push(data[f]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(data.id);
    await pool.query(`UPDATE federations SET ${sets.join(',')} WHERE id=?`, vals);
    return res.status(200).json({ success: true, id: data.id });
  } else {
    // INSERT
    if (!data.name) return res.status(400).json({ error: 'name required' });
    const cols = fields.filter(f => data[f] !== undefined);
    const vals = cols.map(f => data[f]);
    const placeholders = cols.map(() => '?').join(',');
    const [result] = await pool.query(
      `INSERT INTO federations (${cols.join(',')}) VALUES (${placeholders})`, vals
    );
    return res.status(200).json({ success: true, id: result.insertId });
  }
};

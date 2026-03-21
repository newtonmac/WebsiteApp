const { query } = require('./_db');
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
    await query('DELETE FROM gear_brands WHERE id=?', [data.id]);
    return res.status(200).json({ success: true });
  }

  const fields = ['name','categories','brand_type','product_types','country','city',
    'website','email','phone','address','description','popular_products',
    'year_founded','logo_url','facebook_url','instagram_url','youtube_url','distributors','featured'];

  if (data.id) {
    const sets = [], vals = [];
    for (const f of fields) {
      if (data[f] !== undefined) { sets.push(`${f}=?`); vals.push(data[f]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields' });
    vals.push(data.id);
    await query(`UPDATE gear_brands SET ${sets.join(',')} WHERE id=?`, vals);
    return res.status(200).json({ success: true, id: data.id });
  } else {
    if (!data.name) return res.status(400).json({ error: 'name required' });
    const cols = fields.filter(f => data[f] !== undefined);
    const vals = cols.map(f => data[f]);
    const result = await query(
      `INSERT INTO gear_brands (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, vals
    );
    return res.status(200).json({ success: true, id: result.insertId });
  }
};

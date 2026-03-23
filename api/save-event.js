// Vercel Serverless: Save/update/delete events in Cloud SQL
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = [
  'https://paddlepoint.org','https://www.paddlepoint.org',
  'https://jmlsd.org','https://www.jmlsd.org',
  'http://localhost','http://127.0.0.1',
];
const COLUMNS = [
  'name','event_type','sports','level','start_date','end_date','venue','city',
  'state','country','country_code','lat','lng','organizer','organizer_url',
  'registration_deadline','registration_status','description','website',
  'featured','source','source_url'
];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o)))
    res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const token = req.headers['x-api-token'];
  const session = requireAdmin(req);
  if (token !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });

  try {
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      await query('DELETE FROM events WHERE id = ?', [id]);
      return res.status(200).json({ success: true, deleted: id });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST or DELETE' });

    const data = req.body;
    if (!data || !data.name) return res.status(400).json({ error: 'name required' });

    // Build row from allowed columns
    const row = {};
    for (const [k, v] of Object.entries(data)) {
      if (!COLUMNS.includes(k)) continue;
      if (v === null || v === undefined || v === '' || v === 'None') { row[k] = null; continue; }
      if (k === 'featured') { row[k] = v ? 1 : 0; continue; }
      if (k === 'lat' || k === 'lng') { row[k] = parseFloat(v) || null; continue; }
      row[k] = String(v).trim();
    }

    if (data.id) {
      const sets = [], vals = [];
      for (const [col, val] of Object.entries(row)) { sets.push(`${col} = ?`); vals.push(val); }
      vals.push(data.id);
      await query(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, vals);
      return res.status(200).json({ success: true, updated: data.id });
    }

    const cols = Object.keys(row);
    const vals = Object.values(row);
    const result = await query(`INSERT INTO events (${cols.join(', ')}) VALUES (${cols.map(()=>'?').join(', ')})`, vals);
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

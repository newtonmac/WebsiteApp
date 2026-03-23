// Vercel Serverless: Save club to Cloud SQL
// POST /api/save-club { club data } — inserts or updates a club
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');

const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = [
  'https://paddlepoint.org','https://www.paddlepoint.org',
  'https://jmlsd.org','https://www.jmlsd.org',
  'http://localhost','http://127.0.0.1',
];

const COLUMNS = [
  'name','address','city','state','country','lat','lng','phone','website',
  'email','description','classification','craft_types','disciplines',
  'activity_level','has_youth_program','has_masters_program',
  'has_adaptive_program','offers_lessons','membership_type',
  'practice_schedule','season','year_founded','facebook_url','instagram_url',
  'club_size','facility_type','federation_affiliation',
  'photo_url','google_rating','google_review_count','google_maps_url'
];

// Map frontend short names → DB column names
const FIELD_MAP = {
  n:'name', a:'address', ci:'city', sa:'state', st:'state',
  co:'country', la:'lat', lo:'lng', p:'phone', w:'website',
  e:'email', d:'description', cl:'classification', ct:'craft_types',
  di:'disciplines', al:'activity_level', yp:'has_youth_program',
  mp:'has_masters_program', ol:'offers_lessons',
  se:'season', fb:'facebook_url', ig:'instagram_url',
  fe:'federation_affiliation', ph:'photo_url',
  gr:'google_rating', gc:'google_review_count', gm:'google_maps_url',
};

// Canonical craft type names (lowercase key → stored value)
const CRAFT_NORM = {
  'c1':'C1','k1':'K1','canoe':'canoe','kayak':'kayak','sup':'sup',
  'surfski':'surfski','surski':'surfski','outrigger':'outrigger',
  'rowing':'rowing','marathon':'marathon','whitewater':'whitewater',
  'dragon boat':'dragon boat','dragon_boat':'dragon boat','dragonboat':'dragon boat',
  'sprint kayak':'sprint kayak','sprint_kayak':'sprint kayak',
  'sea kayak':'sea kayak','sea_kayak':'sea kayak',
  'canoe polo':'canoe polo','canoe_polo':'canoe polo',
  'prone paddle':'prone paddle','prone_paddle':'prone paddle',
  'whitewater kayak':'whitewater','whitewater_kayak':'whitewater',
  'ocean racing':'ocean racing',
};

function normalizeCraftTypes(raw) {
  if (!raw) return null;
  const types = raw.split(',').map(t => {
    t = t.trim().toLowerCase();
    return CRAFT_NORM[t] || t.replace(/_/g, ' ');
  });
  // Deduplicate (case-insensitive)
  const seen = new Set();
  const unique = [];
  types.forEach(t => {
    const key = t.toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); unique.push(t); }
  });
  return unique.join(', ') || null;
}

function mapToDb(data) {
  const row = {};
  for (const [k, v] of Object.entries(data)) {
    const col = FIELD_MAP[k] || k;
    if (!COLUMNS.includes(col)) continue;
    if (v === null || v === undefined || v === '' || v === 'None') { row[col] = null; continue; }
    if (col === 'has_youth_program' || col === 'has_masters_program' || col === 'has_adaptive_program' || col === 'offers_lessons') {
      row[col] = (v === true || v === 'True' || v === '1' || v === 'yes') ? 1 : 0;
    } else if (col === 'lat' || col === 'lng' || col === 'google_rating') {
      row[col] = parseFloat(v) || null;
    } else if (col === 'google_review_count') {
      row[col] = parseInt(v) || null;
    } else {
      row[col] = String(v).trim();
    }
    // Normalize craft_types after setting
    if (col === 'craft_types' && row[col]) {
      row[col] = normalizeCraftTypes(row[col]);
    }
  }
  return row;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers['x-api-token'];
  const session = requireAdmin(req);
  if (token !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });

  try {
    // DELETE a club
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Club id required' });
      await query('DELETE FROM clubs WHERE id = ?', [id]);
      return res.status(200).json({ success: true, deleted: id });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST or DELETE only' });

    const data = req.body;
    if (!data || !data.n) return res.status(400).json({ error: 'Club name (n) required' });
    const row = mapToDb(data);
    if (!row.name) return res.status(400).json({ error: 'Club name required' });

    // UPDATE existing club (if id provided)
    if (data.id) {
      const sets = [];
      const vals = [];
      for (const [col, val] of Object.entries(row)) {
        sets.push(`${col} = ?`);
        vals.push(val);
      }
      vals.push(data.id);
      await query(`UPDATE clubs SET ${sets.join(', ')} WHERE id = ?`, vals);
      return res.status(200).json({ success: true, updated: data.id });
    }

    // INSERT new club
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(', ');
    const vals = Object.values(row);
    const result = await query(
      `INSERT INTO clubs (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    );
    const insertId = result.insertId;
    return res.status(201).json({ success: true, id: insertId });

  } catch (err) {
    console.error('Save club error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

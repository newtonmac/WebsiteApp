// Vercel Serverless: Serve clubs from Cloud SQL
// GET /api/clubs — returns all clubs as JSON
const { query } = require('./_db');

const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = [
  'https://paddlepoint.org','https://www.paddlepoint.org',
  'https://jmlsd.org','https://www.jmlsd.org',
  'http://localhost','http://127.0.0.1',
];

// In-memory cache (lives for the life of the serverless instance)
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — short enough for admin edits to appear fast

// State abbreviation → full name
const STATE_MAP = {
  'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','DC':'District of Columbia',
  'FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois',
  'IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana',
  'ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota',
  'MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada',
  'NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York',
  'NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon',
  'PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota',
  'TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia',
  'WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming',
};
const COUNTRY_CODES = {
  'United States':'US','United Kingdom':'GB','Canada':'CA','Australia':'AU',
  'Germany':'DE','France':'FR','Italy':'IT','Spain':'ES','Brazil':'BR',
  'Netherlands':'NL','Sweden':'SE','Denmark':'DK','Poland':'PL','Ireland':'IE',
  'South Africa':'ZA','Japan':'JP','New Zealand':'NZ','Austria':'AT',
  'Switzerland':'CH','Hungary':'HU','Belgium':'BE','Argentina':'AR','Portugal':'PT',
  'Mexico':'MX','India':'IN','China':'CN','South Korea':'KR','Israel':'IL',
};

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o) || referer.startsWith(o));
  if (origin && isAllowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const token = req.headers['x-api-token'] || req.query.token;
  if (token !== API_TOKEN && !isAllowed) {
    return res.status(403).json({ error: 'Access denied. This data is proprietary.' });
  }

  // Cache bust: ?refresh=1 forces a fresh DB read
  const forceRefresh = req.query.refresh === '1';

  try {
    // Check cache
    const mode = req.query.mode || 'full';
    const cacheKey = mode === 'map' ? 'map' : 'full';
    
    if (!forceRefresh && cachedData && cachedData[cacheKey] && (Date.now() - cacheTime) < CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', mode === 'map' ? 'public, max-age=300' : 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(200).send(cachedData[cacheKey]);
    }

    // Fetch from Cloud SQL
    const sql = mode === 'map'
      ? `SELECT id,name,city,state,country,lat,lng,craft_types,classification,
         google_rating,website,phone,email,facebook_url,instagram_url
         FROM clubs ORDER BY id`
      : 'SELECT * FROM clubs ORDER BY id';
    const rows = await query(sql);
    const clubs = rows.map(r => {
      const c = {};
      if (r.id) c.id = r.id;
      if (r.name) c.n = r.name;
      if (r.address) c.a = r.address;
      if (r.city) c.ci = r.city;
      if (r.state) {
        c.sa = r.state;
        c.st = STATE_MAP[r.state] || r.state;
      }
      if (r.country) {
        c.co = r.country;
        c.cc = COUNTRY_CODES[r.country] || '';
      }
      if (r.lat) c.la = parseFloat(r.lat);
      if (r.lng) c.lo = parseFloat(r.lng);
      if (r.phone) c.p = r.phone;
      if (r.website) c.w = r.website;
      if (r.email) c.e = r.email;
      if (r.description) c.d = r.description;
      if (r.craft_types) c.ct = r.craft_types;
      if (r.disciplines) c.di = r.disciplines;
      if (r.classification) c.cl = r.classification;
      if (r.google_rating) c.gr = r.google_rating;
      if (r.google_review_count) c.gc = r.google_review_count;
      if (r.facebook_url) c.fb = r.facebook_url;
      if (r.instagram_url) c.ig = r.instagram_url;
      if (r.photo_url) c.ph = r.photo_url;
      if (r.google_maps_url) c.gm = r.google_maps_url;
      if (r.federation_affiliation) c.fe = r.federation_affiliation;
      if (r.has_youth_program) c.yp = 'True';
      if (r.has_masters_program) c.mp = 'True';
      if (r.offers_lessons) c.ol = 'True';
      if (r.season) c.se = r.season;
      return c;
    });

    const json = JSON.stringify(clubs);
    if (!cachedData) cachedData = {};
    cachedData[cacheKey] = json;
    cacheTime = Date.now();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', mode === 'map' ? 'public, max-age=300' : 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(json);
  } catch (err) {
    console.error('Clubs API error:', err.message);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
};

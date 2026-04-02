// Vercel Serverless: PaddleGuru direct HTML scraper
// Fetches paddleguru.com/races, parses embedded EDN data for all upcoming races
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function parseLocation(loc) {
  if (!loc) return { venue: null, city: null, state: null, country: 'USA' };
  const parts = loc.split(',').map(s => s.trim());
  if (parts.length >= 3) {
    // "Steamer Lane, Santa Cruz, Ca" or "123 Main St, City, ST, Country"
    const last = parts[parts.length - 1];
    const hasCountry = last.length > 2 && !last.match(/^[A-Z]{2}$/);
    if (hasCountry) {
      return { venue: parts.slice(0, -3).join(', ') || null, city: parts[parts.length - 3] || null, state: parts[parts.length - 2] || null, country: last };
    }
    return { venue: parts.slice(0, -2).join(', ') || null, city: parts[parts.length - 2] || null, state: parts[parts.length - 1] || null, country: 'USA' };
  } else if (parts.length === 2) {
    return { venue: null, city: parts[0], state: parts[1], country: 'USA' };
  }
  return { venue: null, city: loc, state: null, country: 'USA' };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const session = requireAdmin(req);
  if (req.headers['x-api-token'] !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // Step 1: Polite delay then fetch
    await delay(2000);
    const pageRes = await fetch('https://paddleguru.com/races?search=&sport=all', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!pageRes.ok) return res.status(200).json({ success: false, error: `HTTP ${pageRes.status}` });
    const html = await pageRes.text();

    // Step 2: Find the large script tag with EDN race data
    const scriptMatch = html.match(/<script[^>]*>(\{:route[\s\S]*?)<\/script>/);
    if (!scriptMatch) return res.status(200).json({ success: false, error: 'Could not find race data in page' });
    const data = scriptMatch[1];

    // Step 3: Parse race blocks from EDN data
    // Each race has :_id, :title, :dates {:start N :end N}, :location {:display-str}, :description
    const blocks = data.split(':_id "');
    const nowTs = Date.now();
    const races = [];

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const titleM = block.match(/:title\s+"([^"]+)"/);
      const startM = block.match(/:start\s+(\d{10,})/);
      const endM = block.match(/:end\s+(\d{10,})/);
      const locM = block.match(/:display-str\s+"([^"]+)"/);
      const descM = block.match(/:description\s+"([^"]{10,300})/);

      if (!titleM || !startM) continue;
      const startTs = parseInt(startM[1]);
      if (startTs < nowTs) continue; // skip past events

      const title = titleM[1];
      const startDate = new Date(startTs).toISOString().split('T')[0];
      const endDate = endM ? new Date(parseInt(endM[1])).toISOString().split('T')[0] : startDate;
      const location = locM ? locM[1] : '';
      const desc = descM ? descM[1].replace(/<br>/g, ' ').replace(/\\n/g, ' ').trim() : '';
      const slug = title.replace(/[^A-Za-z0-9]/g, '');
      const loc = parseLocation(location);

      races.push({
        name: title,
        start_date: startDate,
        end_date: endDate,
        venue: loc.venue,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        description: desc.substring(0, 300) || null,
        website: `https://paddleguru.com/races/${slug}`,
      });
    }

    races.sort((a, b) => a.start_date.localeCompare(b.start_date));

    // Step 4: Insert new events (dedup by name + start_date)
    let inserted = 0, skipped = 0;
    for (const race of races) {
      const existing = await query(
        'SELECT id FROM events WHERE name = ? AND start_date = ?',
        [race.name, race.start_date]
      );
      if (existing.length > 0) { skipped++; continue; }

      const row = {
        name: race.name, event_type: 'regatta',
        sports: 'kayak,canoe,sup,outrigger,surfski',
        level: 'regional',
        start_date: race.start_date, end_date: race.end_date,
        venue: race.venue, city: race.city,
        state: race.state, country: race.country,
        organizer: 'PaddleGuru',
        description: race.description,
        website: race.website,
        registration_status: 'open',
        source: 'PaddleGuru', source_url: 'paddleguru.com',
      };
      const cols = Object.keys(row);
      await query(
        `INSERT INTO events (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        Object.values(row)
      );
      inserted++;
    }

    return res.status(200).json({
      success: true, source: 'PaddleGuru',
      found: races.length, inserted, skipped,
      sample: races.slice(0, 5).map(r => ({ name: r.name, date: r.start_date, city: r.city })),
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
};

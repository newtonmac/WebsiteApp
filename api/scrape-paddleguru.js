// Vercel Serverless: PaddleGuru direct HTML scraper
// Fetches paddleguru.com/races page slowly (server-rendered HTML) and parses events
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function parseDate(dateStr) {
  // "April 05, 2026" or "April 05 - April 06, 2026" or "May 30 - June 01, 2026"
  if (!dateStr) return { start: null, end: null };
  const parts = dateStr.split(' - ');
  const months = { January:'01',February:'02',March:'03',April:'04',May:'05',June:'06',
    July:'07',August:'08',September:'09',October:'10',November:'11',December:'12' };

  function parse(s) {
    // "April 05, 2026" or "April 05"
    const m = s.trim().match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (!m) return null;
    const month = months[m[1]];
    if (!month) return null;
    const day = m[2].padStart(2, '0');
    const year = m[3] || null;
    return { month, day, year };
  }

  if (parts.length === 1) {
    const d = parse(parts[0]);
    if (!d || !d.year) return { start: null, end: null };
    const iso = `${d.year}-${d.month}-${d.day}`;
    return { start: iso, end: iso };
  }

  const startP = parse(parts[0]);
  const endP = parse(parts[1]);
  if (!startP || !endP) return { start: null, end: null };
  const year = endP.year || startP.year || '2026';
  return {
    start: `${startP.year || year}-${startP.month}-${startP.day}`,
    end: `${year}-${endP.month}-${endP.day}`
  };
}

function parseLocation(loc) {
  // "1750 Fiesta Island Road, San Diego, CA, USA" or "Steamer Lane, Santa Cruz, Ca"
  if (!loc) return { venue: null, city: null, state: null, country: null };
  const parts = loc.split(',').map(s => s.trim());
  if (parts.length >= 4) {
    return { venue: parts[0], city: parts[1], state: parts[2], country: parts[3] };
  } else if (parts.length === 3) {
    return { venue: parts[0], city: parts[1], state: parts[2], country: 'USA' };
  } else if (parts.length === 2) {
    return { venue: null, city: parts[0], state: parts[1], country: 'USA' };
  }
  return { venue: null, city: loc, state: null, country: null };
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
    // Step 1: Fetch the races page slowly
    console.log('[paddleguru] Fetching races page...');
    await delay(2000); // polite initial delay
    const pageRes = await fetch('https://paddleguru.com/races?search=&sport=all', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) return res.status(200).json({ success: false, error: `HTTP ${pageRes.status}` });
    const html = await pageRes.text();
    console.log('[paddleguru] Page fetched, length:', html.length);

    // Step 2: Parse race blocks from HTML
    // Each race is in a structure with an <a> to /races/RaceName, location text, date text, description
    const racePattern = /<a[^>]*href="\/races\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const raceNames = new Map();
    let match;
    while ((match = racePattern.exec(html)) !== null) {
      const slug = match[1];
      const text = match[2].trim();
      if (text === 'More Info' || text.length < 3) continue;
      if (!raceNames.has(slug)) raceNames.set(slug, text);
    }

    // Step 3: For each race, extract location, date, description from surrounding HTML
    // The page structure has race blocks with the name link, then location, date, description as text nodes
    const races = [];
    for (const [slug, name] of raceNames) {
      // Find the block around this race link
      const idx = html.indexOf(`/races/${slug}"`);
      if (idx === -1) continue;
      // Get a chunk of HTML around this race (the card is ~500-1000 chars)
      const start = Math.max(0, idx - 200);
      const end = Math.min(html.length, idx + 1500);
      const block = html.substring(start, end);

      // Strip HTML tags to get text lines
      const text = block.replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

      // Find the name line, then location and date follow
      const nameIdx = lines.findIndex(l => l === name || l.includes(name));
      let location = '', dateStr = '', description = '';
      if (nameIdx >= 0) {
        // Next non-empty lines after name: location, date, description
        const after = lines.slice(nameIdx + 1).filter(l => l !== 'More Info' && l.length > 2);
        if (after.length >= 1) location = after[0];
        if (after.length >= 2) dateStr = after[1];
        if (after.length >= 3) description = after.slice(2).join(' ').substring(0, 300);
      }

      const dates = parseDate(dateStr);
      const loc = parseLocation(location);

      if (dates.start) {
        races.push({
          name,
          slug,
          url: `https://paddleguru.com/races/${slug}`,
          start_date: dates.start,
          end_date: dates.end || dates.start,
          venue: loc.venue,
          city: loc.city,
          state: loc.state,
          country: loc.country || 'USA',
          description: description || null,
        });
      }
    }

    console.log('[paddleguru] Parsed races:', races.length);

    // Step 4: Insert new events (skip duplicates by name + start_date)
    let inserted = 0, skipped = 0;
    for (const race of races) {
      const existing = await query(
        'SELECT id FROM events WHERE name = ? AND start_date = ?',
        [race.name, race.start_date]
      );
      if (existing.length > 0) { skipped++; continue; }

      const row = {
        name: race.name,
        event_type: 'regatta',
        sports: 'kayak,canoe,sup,outrigger,surfski',
        level: 'regional',
        start_date: race.start_date,
        end_date: race.end_date,
        venue: race.venue,
        city: race.city,
        state: race.state,
        country: race.country,
        organizer: 'PaddleGuru',
        description: race.description,
        website: race.url,
        registration_status: 'open',
        source: 'PaddleGuru',
        source_url: 'paddleguru.com',
      };
      const cols = Object.keys(row);
      await query(
        `INSERT INTO events (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        Object.values(row)
      );
      inserted++;
    }

    console.log(`[paddleguru] Done: ${inserted} inserted, ${skipped} skipped (already exist)`);
    return res.status(200).json({
      success: true,
      source: 'PaddleGuru',
      found: races.length,
      inserted,
      skipped,
      sample: races.slice(0, 5).map(r => ({ name: r.name, date: r.start_date, city: r.city })),
    });

  } catch (err) {
    console.error('[paddleguru] Error:', err.message);
    return res.status(200).json({ success: false, error: err.message });
  }
};

// Vercel Serverless: AI-powered event scraper using Anthropic API + web_search
const { query } = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';

const SOURCES = [
  // NORTH AMERICA
  { name: 'American Canoe Association', url: 'americancanoe.org', country: 'US', query: 'ACA American Canoe Association 2026 events races sprint slalom' },
  { name: 'USA SUP', url: 'usasup.org', country: 'US', query: 'USA SUP 2026 national championships regional race series events' },
  { name: 'Canoe Kayak Canada', url: 'canoekayak.ca', country: 'CA', query: 'Canoe Kayak Canada 2026 events competitions sprint slalom' },
  { name: 'US Dragon Boat Federation', url: 'usdbf.org', country: 'US', query: 'US Dragon Boat Federation 2026 events races festivals' },
  { name: 'Dragon Boat Canada', url: 'dragonboat.ca', country: 'CA', query: 'Dragon Boat Canada 2026 festivals races events' },
  { name: 'USA Surfing (SUP)', url: 'usasurfing.org', country: 'US', query: 'USA Surfing SUP 2026 events championships paddleboard' },
  // INTERNATIONAL
  { name: 'ICF', url: 'canoeicf.com', country: 'INT', query: 'ICF International Canoe Federation 2026 world championships world cup calendar' },
  { name: 'European Canoe Association', url: 'canoe-europe.org', country: 'EU', query: 'European Canoe Association ECA 2026 European championships events' },
  // EUROPE
  { name: 'British Canoeing', url: 'britishcanoeing.org.uk', country: 'GB', query: 'British Canoeing 2026 events races national championships calendar' },
  { name: 'French Canoe Federation (FFCK)', url: 'ffck.org', country: 'FR', query: 'FFCK Federation Francaise Canoe Kayak 2026 events competitions' },
  { name: 'Deutscher Kanu-Verband', url: 'kanu.de', country: 'DE', query: 'Deutscher Kanu-Verband DKV Germany 2026 canoe kayak events' },
  { name: 'Spanish Canoe Federation', url: 'rfep.es', country: 'ES', query: 'Real Federacion Espanola Piragüismo 2026 events races Spain' },
  { name: 'Italian Canoe Federation', url: 'federcanoa.it', country: 'IT', query: 'Federazione Italiana Canoa Kayak 2026 events competitions Italy' },
  // OCEANIA
  { name: 'Paddle Australia', url: 'paddle.org.au', country: 'AU', query: 'Paddle Australia 2026 events competitions nationals calendar' },
  { name: 'Paddle New Zealand', url: 'canoenz.org.nz', country: 'NZ', query: 'Canoe Racing New Zealand Paddle NZ 2026 events competitions' },
  // SUP CIRCUITS
  { name: 'European SUP League', url: 'standupmagazin.com', country: 'EU', query: 'European SUP League ESL 2026 calendar race series events' },
  { name: 'TotalSUP Events', url: 'totalsup.com', country: 'INT', query: 'TotalSUP 2026 SUP race events calendar worldwide' },
  { name: 'PaddleGuru Races', url: 'paddleguru.com', country: 'US', query: 'PaddleGuru 2026 paddle races SUP kayak outrigger events calendar' },
  // OUTRIGGER
  { name: 'IVF (Va\'a)', url: 'ivf.org.fj', country: 'INT', query: 'International Va\'a Federation IVF 2026 outrigger world sprints championships' },
  { name: 'USAORCA', url: 'usaorca.org', country: 'US', query: 'USAORCA USA Outrigger 2026 national championships events races' },
  // DRAGON BOAT INTERNATIONAL
  { name: 'IDBF', url: 'idbf.org', country: 'INT', query: 'International Dragon Boat Federation IDBF 2026 world championships events races' },
];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.headers['x-api-token'] !== API_TOKEN) return res.status(403).json({ error: 'Access denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { sourceIndex } = req.body || {};
  const source = typeof sourceIndex === 'number' ? SOURCES[sourceIndex] : null;
  const toScrape = source ? [source] : SOURCES;

  const results = [];
  for (const src of toScrape) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: `Search for upcoming paddling events from ${src.name} (${src.url}) for 2026. Find races, regattas, championships, festivals.

For each event found, return ONLY a JSON array (no markdown, no backticks) with objects containing:
- name (string)
- event_type: one of "regatta","trial","international","festival","clinic","fun_paddle"
- sports: comma-separated from kayak,canoe,sup,outrigger,dragon_boat,surfski,rowing,canoe_polo,prone_paddle
- level: one of "local","regional","national","international","olympic"
- start_date: YYYY-MM-DD format
- end_date: YYYY-MM-DD format (same as start if single day)
- venue (string)
- city (string)
- state (string or null)
- country (string)
- organizer: "${src.name}"
- description: 1-2 sentence description
- website: URL if found
- registration_status: "open","closed","upcoming"

Search query: ${src.query}
Return ONLY the JSON array, nothing else.` }]
        })
      });

      const data = await aiRes.json();
      // Collect ALL text blocks (web_search responses have tool_use + tool_result + text)
      const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
      const fullText = textBlocks.join('\n');
      if (!fullText.trim()) { results.push({ source: src.name, status: 'no_text', events: [] }); continue; }

      // Parse JSON from response
      let events = [];
      try {
        const clean = fullText.replace(/```json|```/g, '').trim();
        events = JSON.parse(clean);
      } catch (e) {
        // Try to extract JSON array from text
        const match = fullText.match(/\[[\s\S]*\]/);
        if (match) { try { events = JSON.parse(match[0]); } catch (e2) {} }
      }

      // Insert new events (skip duplicates by name + start_date)
      let inserted = 0;
      for (const ev of events) {
        if (!ev.name || !ev.start_date) continue;
        const existing = await query('SELECT id FROM events WHERE name = ? AND start_date = ?', [ev.name, ev.start_date]);
        if (existing.length > 0) continue;
        const row = {
          name: ev.name, event_type: ev.event_type || 'regatta', sports: ev.sports || '',
          level: ev.level || 'regional', start_date: ev.start_date, end_date: ev.end_date || ev.start_date,
          venue: ev.venue || null, city: ev.city || null, state: ev.state || null,
          country: ev.country || null, organizer: ev.organizer || src.name,
          description: ev.description || null, website: ev.website || null,
          registration_status: ev.registration_status || 'upcoming',
          source: src.name, source_url: src.url
        };
        const cols = Object.keys(row);
        await query(`INSERT INTO events (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, Object.values(row));
        inserted++;
      }
      results.push({ source: src.name, status: 'ok', found: events.length, inserted });
    } catch (err) {
      results.push({ source: src.name, status: 'error', error: err.message });
    }
  }

  return res.status(200).json({ success: true, results, sources: SOURCES.map(s => s.name) });
};

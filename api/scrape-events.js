// Vercel Serverless: AI-powered event scraper using Anthropic API + web_search
const { query } = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';

const SOURCES = [
  { name: 'American Canoe Association', url: 'americancanoe.org', country: 'US', query: 'ACA American Canoe Association 2026 events races' },
  { name: 'Canoe Kayak Canada', url: 'canoekayak.ca', country: 'CA', query: 'Canoe Kayak Canada 2026 events competitions' },
  { name: 'ICF', url: 'canoeicf.com', country: 'INT', query: 'ICF International Canoe Federation 2026 world championships calendar' },
  { name: 'British Canoeing', url: 'britishcanoeing.org.uk', country: 'GB', query: 'British Canoeing 2026 events races calendar' },
  { name: 'Paddle Australia', url: 'paddle.org.au', country: 'AU', query: 'Paddle Australia 2026 events competitions calendar' },
  { name: 'USA Surfing (SUP)', url: 'usasurfing.org', country: 'US', query: 'USA Surfing SUP 2026 events championships' },
  { name: 'Dragon Boat Canada', url: 'dragonboat.ca', country: 'CA', query: 'Dragon Boat Canada 2026 festivals races' },
  { name: 'US Dragon Boat Federation', url: 'usdbf.org', country: 'US', query: 'US Dragon Boat Federation 2026 events races festivals' },
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
          max_tokens: 4000,
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
      const textBlock = data.content?.find(b => b.type === 'text');
      if (!textBlock) { results.push({ source: src.name, status: 'no_text', events: [] }); continue; }

      // Parse JSON from response
      let events = [];
      try {
        const clean = textBlock.text.replace(/```json|```/g, '').trim();
        events = JSON.parse(clean);
      } catch (e) {
        // Try to extract JSON array from text
        const match = textBlock.text.match(/\[[\s\S]*\]/);
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

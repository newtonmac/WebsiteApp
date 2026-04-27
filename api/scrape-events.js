// Vercel Serverless: AI-powered event scraper using Anthropic API + web_search
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';

// Dynamic year window — covers current year and next, so queries stay evergreen
const NOW = new Date();
const YEAR = NOW.getFullYear();
const YEAR_NEXT = YEAR + 1;
const YEARS = `${YEAR} ${YEAR_NEXT}`;

const SOURCES = [
  // NORTH AMERICA
  { name: 'American Canoe Association', url: 'americancanoe.org', country: 'US', query: `ACA American Canoe Association ${YEARS} events races sprint slalom` },
  { name: 'USA SUP', url: 'usasup.org', country: 'US', query: `usasup.org ${YEAR} regional race series schedule national championships SUP race calendar` },
  { name: 'Canoe Kayak Canada', url: 'canoekayak.ca', country: 'CA', query: `Canoe Kayak Canada ${YEARS} events competitions sprint slalom` },
  { name: 'US Dragon Boat Federation', url: 'usdbf.org', country: 'US', query: `usdbf.org ${YEAR} dragon boat events club crew nationals festivals calendar United States` },
  { name: 'Dragon Boat Canada', url: 'dragonboat.ca', country: 'CA', query: `Dragon Boat Canada ${YEARS} festivals races events` },
  { name: 'USA Surfing (SUP)', url: 'usasurfing.org', country: 'US', query: `USA Surfing SUP ${YEARS} events championships paddleboard` },
  // INTERNATIONAL
  { name: 'ICF', url: 'canoeicf.com', country: 'INT', query: `ICF International Canoe Federation ${YEARS} world championships world cup calendar` },
  { name: 'European Canoe Association', url: 'canoe-europe.org', country: 'EU', query: `European Canoe Association ECA ${YEARS} European championships events` },
  // EUROPE
  { name: 'British Canoeing', url: 'britishcanoeing.org.uk', country: 'GB', query: `British Canoeing ${YEAR} national championships marathon sprint slalom freestyle wildwater calendar UK` },
  { name: 'French Canoe Federation (FFCK)', url: 'ffck.org', country: 'FR', query: `FFCK Federation Francaise Canoe Kayak ${YEARS} events competitions` },
  { name: 'Deutscher Kanu-Verband', url: 'kanu.de', country: 'DE', query: `Deutscher Kanu-Verband DKV Germany ${YEARS} canoe kayak events` },
  { name: 'Spanish Canoe Federation', url: 'rfep.es', country: 'ES', query: `Real Federacion Espanola Piragüismo ${YEARS} events races Spain` },
  { name: 'Italian Canoe Federation', url: 'federcanoa.it', country: 'IT', query: `Federazione Italiana Canoa Kayak ${YEARS} events competitions Italy` },
  // OCEANIA
  { name: 'Paddle Australia', url: 'paddle.org.au', country: 'AU', query: `paddle.org.au ${YEAR} national championships sprint marathon slalom ocean racing SUP canoe polo Australian schedule` },
  { name: 'Paddle New Zealand', url: 'canoenz.org.nz', country: 'NZ', query: `Canoe Racing New Zealand canoeracing.org.nz ${YEAR} sprint slalom marathon SUP nationals events schedule` },
  // SUP CIRCUITS
  { name: 'European SUP League', url: 'standupmagazin.com', country: 'EU', query: `European SUP League ESL ${YEARS} calendar race series events` },
  { name: 'TotalSUP Events', url: 'totalsup.com', country: 'INT', query: `TotalSUP ${YEARS} SUP race events calendar worldwide` },
  { name: 'PaddleGuru Races', url: 'paddleguru.com', country: 'US', query: `PaddleGuru ${YEARS} paddle races SUP kayak outrigger events calendar` },
  { name: 'PaddleGuru SUP/OC', url: 'paddleguru.com', country: 'US', query: `paddleguru ${YEARS} SUP stand up paddle outrigger ocean race` },
  { name: 'PaddleGuru Kayak', url: 'paddleguru.com', country: 'US', query: `paddleguru ${YEARS} kayak surfski canoe sprint race regatta results` },
  // OUTRIGGER
  { name: 'IVF (Va\'a)', url: 'ivfiv.org', country: 'INT', query: `International Va'a Federation ivfiv.org ${YEAR} World Sprint Championships Singapore world distance outrigger calendar` },
  { name: 'USAORCA', url: 'usaorca.org', country: 'US', query: `usaorca.org ${YEAR} US Nationals OC1 OC2 V1 V6 sprint distance championship World Sprints Singapore qualifier outrigger` },
  // DRAGON BOAT INTERNATIONAL
  { name: 'IDBF', url: 'idbf.org', country: 'INT', query: `IDBF International Dragon Boat Federation ${YEAR} Club Crew World Championships CCWC Hualien Taiwan world racing championships nations calendar` },
];

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

  const { sourceIndex } = req.body || {};
  const source = typeof sourceIndex === 'number' ? SOURCES[sourceIndex] : null;
  const toScrape = source ? [source] : SOURCES;

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const results = [];
  for (let i = 0; i < toScrape.length; i++) {
    const src = toScrape[i];
    if (i > 0) await delay(3000); // 3 second pause between sources
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) { results.push({ source: src.name, status: 'error', error: 'ANTHROPIC_API_KEY not set' }); continue; }
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: `Search for upcoming paddling events from ${src.name} (${src.url}) for ${YEAR} and ${YEAR_NEXT}. Find races, regattas, championships, festivals.

For each event found, return ONLY a JSON array (no markdown, no backticks) with objects containing:
- name (string)
- event_type: one of "regatta","race","championship","competition","trial","international","festival","clinic","fun_paddle","workshop","conference","exhibition","training_camp","qualifier"
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

      const apiStatus = aiRes.status;
      const data = await aiRes.json();
      // Debug: log response structure
      const blockTypes = (data.content || []).map(b => b.type);
      const apiError = data.error ? JSON.stringify(data.error) : null;
      const stopReason = data.stop_reason || null;
      console.log(`[${src.name}] HTTP=${apiStatus}, stop=${stopReason}, blocks=${JSON.stringify(blockTypes)}`);
      if (apiError) { console.log(`[${src.name}] API error: ${apiError}`); }
      
      // If API returned an error, report it
      if (data.error) {
        results.push({ source: src.name, status: 'api_error', error: apiError, httpStatus: apiStatus });
        continue;
      }
      // Collect ALL text blocks (web_search responses have tool_use + tool_result + text)
      const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
      const fullText = textBlocks.join('\n');
      if (!fullText.trim()) {
        // Try tool_result blocks as fallback
        const toolResults = (data.content || []).filter(b => b.type === 'tool_result').map(b => typeof b.content === 'string' ? b.content : JSON.stringify(b.content));
        const fallbackText = toolResults.join('\n');
        if (fallbackText.trim()) {
          console.log(`[${src.name}] Using tool_result fallback, length=${fallbackText.length}`);
        }
        results.push({ source: src.name, status: fullText.trim() ? 'ok' : 'no_text', events: [], debug: blockTypes });
        continue;
      }

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
      const VALID_TYPES = ['regatta','trial','international','festival','clinic','fun_paddle','race','championship','competition','workshop','conference','exhibition','training_camp','qualifier'];
      const TYPE_MAP = { 'sprint':'race', 'slalom':'race', 'marathon':'race', 'relay':'race', 'time_trial':'trial', 'time trial':'trial', 'world_cup':'international', 'world cup':'international', 'worlds':'international', 'nationals':'championship', 'national':'championship', 'camp':'training_camp', 'symposium':'conference', 'seminar':'workshop', 'demo':'exhibition', 'expo':'exhibition', 'fun':'fun_paddle', 'paddle':'fun_paddle', 'paddlefest':'festival', 'tour':'race' };
      const VALID_LEVELS = ['local','regional','national','international','olympic'];
      const VALID_REG = ['open','closed','upcoming','sold_out'];
      let inserted = 0;
      for (const ev of events) {
        if (!ev.name || !ev.start_date) continue;
        const existing = await query('SELECT id FROM events WHERE name = ? AND start_date = ?', [ev.name, ev.start_date]);
        if (existing.length > 0) continue;
        const rawType = (ev.event_type || 'regatta').toLowerCase().trim();
        const eventType = VALID_TYPES.includes(rawType) ? rawType : (TYPE_MAP[rawType] || 'regatta');
        const rawLevel = (ev.level || 'regional').toLowerCase().trim();
        const level = VALID_LEVELS.includes(rawLevel) ? rawLevel : 'regional';
        const rawReg = (ev.registration_status || 'upcoming').toLowerCase().trim();
        const regStatus = VALID_REG.includes(rawReg) ? rawReg : 'upcoming';
        const row = {
          name: ev.name, event_type: eventType, sports: ev.sports || '',
          level: level, start_date: ev.start_date, end_date: ev.end_date || ev.start_date,
          venue: ev.venue || null, city: ev.city || null, state: ev.state || null,
          country: ev.country || null, organizer: ev.organizer || src.name,
          description: ev.description || null, website: ev.website || null,
          registration_status: regStatus,
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

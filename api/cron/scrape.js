// Vercel Cron: runs both scrapers on a schedule.
// Triggered by Vercel cron (configured in vercel.json) — Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET env var is set.
//
// Strategy: PaddleGuru direct first (fast, ~10s, ~100 events), then AI federation
// scrape for all sources. AI scrape may not complete all 23 sources within the
// function's max duration; dedup by (name, start_date) means the next cron run
// picks up what was missed. Idempotent.

const { query } = require('../_db');

// ---------- PaddleGuru direct scraper (mirrors api/scrape-paddleguru.js) ----------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function parseLocation(loc) {
  if (!loc) return { venue: null, city: null, state: null, country: 'USA' };
  const parts = loc.split(',').map(s => s.trim());
  if (parts.length >= 3) {
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

async function runPaddleGuruScrape() {
  try {
    await delay(1500);
    const pageRes = await fetch('https://paddleguru.com/races?search=&sport=all', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!pageRes.ok) return { ok: false, error: `HTTP ${pageRes.status}` };
    const html = await pageRes.text();
    const scriptMatch = html.match(/<script[^>]*>(\{:route[\s\S]*?)<\/script>/);
    if (!scriptMatch) return { ok: false, error: 'No race data found in page' };
    const data = scriptMatch[1];
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
      if (startTs < nowTs) continue;
      const title = titleM[1];
      const startDate = new Date(startTs).toISOString().split('T')[0];
      const endDate = endM ? new Date(parseInt(endM[1])).toISOString().split('T')[0] : startDate;
      const location = locM ? locM[1] : '';
      const desc = descM ? descM[1].replace(/<br>/g, ' ').replace(/\\n/g, ' ').trim() : '';
      const slug = title.replace(/[^A-Za-z0-9]/g, '');
      const loc = parseLocation(location);
      races.push({
        name: title, start_date: startDate, end_date: endDate,
        venue: loc.venue, city: loc.city, state: loc.state, country: loc.country,
        description: desc.substring(0, 300) || null,
        website: `https://paddleguru.com/races/${slug}`,
      });
    }
    let inserted = 0, skipped = 0;
    for (const race of races) {
      const existing = await query('SELECT id FROM events WHERE name = ? AND start_date = ?', [race.name, race.start_date]);
      if (existing.length > 0) { skipped++; continue; }
      const row = {
        name: race.name, event_type: 'regatta',
        sports: 'kayak,canoe,sup,outrigger,surfski',
        level: 'regional',
        start_date: race.start_date, end_date: race.end_date,
        venue: race.venue, city: race.city, state: race.state, country: race.country,
        organizer: 'PaddleGuru',
        description: race.description, website: race.website,
        registration_status: 'open',
        source: 'PaddleGuru', source_url: 'paddleguru.com',
      };
      const cols = Object.keys(row);
      await query(`INSERT INTO events (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(row));
      inserted++;
    }
    return { ok: true, found: races.length, inserted, skipped };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------- AI federation scraper (mirrors api/scrape-events.js) ----------

const NOW = new Date();
const YEAR = NOW.getFullYear();
const YEAR_NEXT = YEAR + 1;
const YEARS = `${YEAR} ${YEAR_NEXT}`;

const SOURCES = [
  { name: 'American Canoe Association', url: 'americancanoe.org', country: 'US', query: `ACA American Canoe Association ${YEARS} events races sprint slalom` },
  { name: 'USA SUP', url: 'usasup.org', country: 'US', query: `usasup.org ${YEAR} regional race series schedule national championships SUP race calendar` },
  { name: 'Canoe Kayak Canada', url: 'canoekayak.ca', country: 'CA', query: `Canoe Kayak Canada ${YEARS} events competitions sprint slalom` },
  { name: 'US Dragon Boat Federation', url: 'usdbf.org', country: 'US', query: `usdbf.org ${YEAR} dragon boat events club crew nationals festivals calendar United States` },
  { name: 'Dragon Boat Canada', url: 'dragonboat.ca', country: 'CA', query: `Dragon Boat Canada ${YEARS} festivals races events` },
  { name: 'USA Surfing (SUP)', url: 'usasurfing.org', country: 'US', query: `USA Surfing SUP ${YEARS} events championships paddleboard` },
  { name: 'ICF', url: 'canoeicf.com', country: 'INT', query: `ICF International Canoe Federation ${YEARS} world championships world cup calendar` },
  { name: 'European Canoe Association', url: 'canoe-europe.org', country: 'EU', query: `European Canoe Association ECA ${YEARS} European championships events` },
  { name: 'British Canoeing', url: 'britishcanoeing.org.uk', country: 'GB', query: `British Canoeing ${YEAR} national championships marathon sprint slalom freestyle wildwater calendar UK` },
  { name: 'French Canoe Federation (FFCK)', url: 'ffck.org', country: 'FR', query: `FFCK Federation Francaise Canoe Kayak ${YEARS} events competitions` },
  { name: 'Deutscher Kanu-Verband', url: 'kanu.de', country: 'DE', query: `Deutscher Kanu-Verband DKV Germany ${YEARS} canoe kayak events` },
  { name: 'Spanish Canoe Federation', url: 'rfep.es', country: 'ES', query: `Real Federacion Espanola Piragüismo ${YEARS} events races Spain` },
  { name: 'Italian Canoe Federation', url: 'federcanoa.it', country: 'IT', query: `Federazione Italiana Canoa Kayak ${YEARS} events competitions Italy` },
  { name: 'Paddle Australia', url: 'paddle.org.au', country: 'AU', query: `paddle.org.au ${YEAR} national championships sprint marathon slalom ocean racing SUP canoe polo Australian schedule` },
  { name: 'Paddle New Zealand', url: 'canoenz.org.nz', country: 'NZ', query: `Canoe Racing New Zealand canoeracing.org.nz ${YEAR} sprint slalom marathon SUP nationals events schedule` },
  { name: 'European SUP League', url: 'standupmagazin.com', country: 'EU', query: `European SUP League ESL ${YEARS} calendar race series events` },
  { name: 'TotalSUP Events', url: 'totalsup.com', country: 'INT', query: `TotalSUP ${YEARS} SUP race events calendar worldwide` },
  { name: 'PaddleGuru Races', url: 'paddleguru.com', country: 'US', query: `PaddleGuru ${YEARS} paddle races SUP kayak outrigger events calendar` },
  { name: 'PaddleGuru SUP/OC', url: 'paddleguru.com', country: 'US', query: `paddleguru ${YEARS} SUP stand up paddle outrigger ocean race` },
  { name: 'PaddleGuru Kayak', url: 'paddleguru.com', country: 'US', query: `paddleguru ${YEARS} kayak surfski canoe sprint race regatta results` },
  { name: 'IVF (Va\'a)', url: 'ivfiv.org', country: 'INT', query: `International Va'a Federation ivfiv.org ${YEAR} World Sprint Championships Singapore world distance outrigger calendar` },
  { name: 'USAORCA', url: 'usaorca.org', country: 'US', query: `usaorca.org ${YEAR} US Nationals OC1 OC2 V1 V6 sprint distance championship World Sprints Singapore qualifier outrigger` },
  { name: 'IDBF', url: 'idbf.org', country: 'INT', query: `IDBF International Dragon Boat Federation ${YEAR} Club Crew World Championships CCWC Hualien Taiwan world racing championships nations calendar` },
];

const VALID_TYPES = ['regatta','trial','international','festival','clinic','fun_paddle','race','championship','competition','workshop','conference','exhibition','training_camp','qualifier'];
const TYPE_MAP = { 'sprint':'race', 'slalom':'race', 'marathon':'race', 'relay':'race', 'time_trial':'trial', 'time trial':'trial', 'world_cup':'international', 'world cup':'international', 'worlds':'international', 'nationals':'championship', 'national':'championship', 'camp':'training_camp', 'symposium':'conference', 'seminar':'workshop', 'demo':'exhibition', 'expo':'exhibition', 'fun':'fun_paddle', 'paddle':'fun_paddle', 'paddlefest':'festival', 'tour':'race' };
const VALID_LEVELS = ['local','regional','national','international','olympic'];
const VALID_REG = ['open','closed','upcoming','sold_out'];

async function scrapeOneSource(src, apiKey) {
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

  const data = await aiRes.json();
  if (data.error) {
    return { source: src.name, status: 'api_error', error: JSON.stringify(data.error) };
  }
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
  const fullText = textBlocks.join('\n');
  if (!fullText.trim()) {
    return { source: src.name, status: 'no_text', found: 0, inserted: 0 };
  }
  let events = [];
  try {
    const clean = fullText.replace(/```json|```/g, '').trim();
    events = JSON.parse(clean);
  } catch (e) {
    const match = fullText.match(/\[[\s\S]*\]/);
    if (match) { try { events = JSON.parse(match[0]); } catch (e2) {} }
  }
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
      level, start_date: ev.start_date, end_date: ev.end_date || ev.start_date,
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
  return { source: src.name, status: 'ok', found: events.length, inserted };
}

// ---------- Cron handler ----------

module.exports = async (req, res) => {
  // Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically.
  // Also accept the existing API token for manual debugging via curl.
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const apiToken = req.headers['x-api-token'];
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManual = apiToken === 'pp-clubs-7742-v1';
  if (!isCron && !isManual) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const startedAt = Date.now();
  // Stop scraping new sources once we hit this elapsed time, to leave headroom
  // for in-flight DB writes before Vercel's maxDuration kills the function.
  const TIME_BUDGET_MS = 270000; // 4m30s of a 5m budget

  const summary = {
    triggered: isCron ? 'cron' : 'manual',
    started_at: new Date(startedAt).toISOString(),
    paddleguru: null,
    federations: [],
    skipped: [],
  };

  // Step 1: PaddleGuru direct scrape (fast, runs first)
  summary.paddleguru = await runPaddleGuruScrape();

  // Step 2: AI federation scrape, with elapsed-time guard
  for (let i = 0; i < SOURCES.length; i++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > TIME_BUDGET_MS) {
      summary.skipped.push(...SOURCES.slice(i).map(s => s.name));
      break;
    }
    const src = SOURCES[i];
    if (i > 0) await delay(1500); // shorter delay than admin UI; cron has tighter budget
    try {
      const result = await scrapeOneSource(src, apiKey);
      summary.federations.push(result);
    } catch (err) {
      summary.federations.push({ source: src.name, status: 'error', error: err.message });
    }
  }

  summary.duration_ms = Date.now() - startedAt;
  summary.totals = {
    paddleguru_inserted: summary.paddleguru?.inserted || 0,
    federation_inserted: summary.federations.reduce((s, r) => s + (r.inserted || 0), 0),
    sources_run: summary.federations.length,
    sources_skipped: summary.skipped.length,
  };

  return res.status(200).json(summary);
};

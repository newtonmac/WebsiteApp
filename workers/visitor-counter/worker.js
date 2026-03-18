// Cloudflare Worker: Visitor Counter
// Tracks page visits with city-level geolocation using Cloudflare's cf object.
// Uses KV for storage. No PII is stored — IPs are hashed for uniqueness only.
// Deploy: npx wrangler deploy

const ALLOWED_ORIGINS = [
  'https://jmlsd.org',
  'https://www.jmlsd.org',
  'https://paddlepoint.org',
  'https://www.paddlepoint.org',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/visit') {
        return handleCors(request, await recordVisit(request, env));
      }

      if (request.method === 'GET' && url.pathname === '/stats') {
        return handleCors(request, await getStats(env));
      }

      return handleCors(request, new Response('Not found', { status: 404 }));
    } catch (err) {
      const resp = new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return handleCors(request, resp);
    }
  },
};

// Hash IP for privacy — we only need uniqueness, not the actual IP
async function hashIP(ip) {
  const data = new TextEncoder().encode(ip + '_jmlsd_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  const arr = new Uint8Array(hash);
  return Array.from(arr.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function recordVisit(request, env) {
  const cf = request.cf || {};
  const city = cf.city || 'Unknown';
  const country = cf.country || 'Unknown';
  const region = cf.region || '';
  const lat = parseFloat(cf.latitude) || null;
  const lng = parseFloat(cf.longitude) || null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const visitorHash = await hashIP(ip);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD in Pacific time

  // --- Update daily data ---
  const dayKey = `day:${today}`;
  const dayData = JSON.parse(await env.VISITORS.get(dayKey) || '{}');

  if (!dayData.visitors) dayData.visitors = [];
  if (!dayData.cities) dayData.cities = {};
  if (!dayData.coords) dayData.coords = {};

  // Only count unique visitors
  const isNew = !dayData.visitors.includes(visitorHash);
  if (isNew) {
    dayData.visitors.push(visitorHash);

    // Track city only for unique visitors
    const cityLabel = city !== 'Unknown' ? `${city}, ${region ? region + ', ' : ''}${country}` : 'Unknown';
    dayData.cities[cityLabel] = (dayData.cities[cityLabel] || 0) + 1;

    // Store coordinates for map visualization
    if (lat && lng) {
      dayData.coords[cityLabel] = { lat, lng };
    }

    // Increment total only for unique visitors
    const totalStr = await env.VISITORS.get('total');
    const total = (parseInt(totalStr) || 0) + 1;
    await env.VISITORS.put('total', total.toString());
  }

  await env.VISITORS.put(dayKey, JSON.stringify(dayData));

  // --- Maintain date index (last 30 days) ---
  const indexData = JSON.parse(await env.VISITORS.get('date_index') || '[]');
  if (!indexData.includes(today)) {
    indexData.push(today);
    // Keep only last 30 days in index
    while (indexData.length > 30) indexData.shift();
    await env.VISITORS.put('date_index', JSON.stringify(indexData));
  }

  const total = parseInt(await env.VISITORS.get('total') || '0');

  return new Response(JSON.stringify({
    total,
    todayUnique: dayData.visitors.length,
    isNew,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getStats(env) {
  const total = parseInt(await env.VISITORS.get('total') || '0');
  const dateIndex = JSON.parse(await env.VISITORS.get('date_index') || '[]');

  // Fetch last 7 days of data
  const recentDates = dateIndex.slice(-7);
  const days = [];

  for (const date of recentDates) {
    const dayData = JSON.parse(await env.VISITORS.get(`day:${date}`) || '{}');
    days.push({
      date,
      uniqueVisitors: (dayData.visitors || []).length,
      totalHits: dayData.totalHits || 0,
      cities: dayData.cities || {},
      coords: dayData.coords || {},
    });
  }

  return new Response(JSON.stringify({ total, days }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

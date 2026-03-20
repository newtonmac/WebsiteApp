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

    const page = url.searchParams.get('page') || '';

    try {
      if (request.method === 'POST' && url.pathname === '/visit') {
        return handleCors(request, await recordVisit(request, env, page));
      }

      if (request.method === 'GET' && url.pathname === '/stats') {
        return handleCors(request, await getStats(env, page));
      }

      if (request.method === 'GET' && url.pathname === '/stats/referrers') {
        return handleCors(request, await getReferrerStats(env, page));
      }

      if (request.method === 'POST' && url.pathname === '/duration') {
        return handleCors(request, await recordDuration(request, env, page));
      }

      if (request.method === 'GET' && url.pathname === '/stats/engagement') {
        return handleCors(request, await getEngagementStats(env, page));
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

async function recordVisit(request, env, page) {
  const cf = request.cf || {};
  const city = cf.city || 'Unknown';
  const country = cf.country || 'Unknown';
  const region = cf.region || '';
  const lat = parseFloat(cf.latitude) || null;
  const lng = parseFloat(cf.longitude) || null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const visitorHash = await hashIP(ip);

  // Parse referrer from request body
  let referrer = '';
  try {
    const body = await request.json();
    referrer = body.referrer || '';
  } catch { /* no body or invalid JSON */ }

  // Normalize referrer to just the domain
  let referrerLabel = 'Direct';
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      referrerLabel = refUrl.hostname.replace(/^www\./, '');
    } catch {
      referrerLabel = referrer;
    }
  }

  const prefix = page ? `${page}:` : '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD in Pacific time

  // --- Update daily data ---
  const dayKey = `${prefix}day:${today}`;
  const dayData = JSON.parse(await env.VISITORS.get(dayKey) || '{}');

  if (!dayData.visitors) dayData.visitors = [];
  if (!dayData.cities) dayData.cities = {};
  if (!dayData.coords) dayData.coords = {};
  if (!dayData.referrers) dayData.referrers = {};
  if (!dayData.hours) dayData.hours = {};
  if (!dayData.durations) dayData.durations = [];

  // Only count unique visitors
  const isNew = !dayData.visitors.includes(visitorHash);
  if (isNew) {
    dayData.visitors.push(visitorHash);

    // Track city only for unique visitors
    const cityLabel = city !== 'Unknown' ? `${city}, ${region ? region + ', ' : ''}${country}` : 'Unknown';
    dayData.cities[cityLabel] = (dayData.cities[cityLabel] || 0) + 1;

    // Track referrer for unique visitors
    dayData.referrers[referrerLabel] = (dayData.referrers[referrerLabel] || 0) + 1;

    // Store coordinates for map visualization
    if (lat && lng) {
      dayData.coords[cityLabel] = { lat, lng };
    }

    // Track hour of visit (Pacific time)
    const hour = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false });
    const h = parseInt(hour);
    dayData.hours[h] = (dayData.hours[h] || 0) + 1;

    // Increment total only for unique visitors
    const totalKey = `${prefix}total`;
    const totalStr = await env.VISITORS.get(totalKey);
    const total = (parseInt(totalStr) || 0) + 1;
    await env.VISITORS.put(totalKey, total.toString());
  }

  await env.VISITORS.put(dayKey, JSON.stringify(dayData));

  // --- Maintain date index (last 30 days) ---
  const indexKey = `${prefix}date_index`;
  const indexData = JSON.parse(await env.VISITORS.get(indexKey) || '[]');
  if (!indexData.includes(today)) {
    indexData.push(today);
    // Keep only last 30 days in index
    while (indexData.length > 30) indexData.shift();
    await env.VISITORS.put(indexKey, JSON.stringify(indexData));
  }

  const total = parseInt(await env.VISITORS.get(`${prefix}total`) || '0');

  return new Response(JSON.stringify({
    total,
    todayUnique: dayData.visitors.length,
    isNew,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getStats(env, page) {
  const prefix = page ? `${page}:` : '';
  const total = parseInt(await env.VISITORS.get(`${prefix}total`) || '0');
  const dateIndex = JSON.parse(await env.VISITORS.get(`${prefix}date_index`) || '[]');

  // Fetch last 7 days of data
  const recentDates = dateIndex.slice(-7);
  const days = [];

  for (const date of recentDates) {
    const dayData = JSON.parse(await env.VISITORS.get(`${prefix}day:${date}`) || '{}');
    days.push({
      date,
      uniqueVisitors: (dayData.visitors || []).length,
      totalHits: dayData.totalHits || 0,
      cities: dayData.cities || {},
      coords: dayData.coords || {},
      hours: dayData.hours || {},
    });
  }

  return new Response(JSON.stringify({ total, days }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getReferrerStats(env, page) {
  const prefix = page ? `${page}:` : '';
  const dateIndex = JSON.parse(await env.VISITORS.get(`${prefix}date_index`) || '[]');
  const recentDates = dateIndex.slice(-7);

  const days = [];
  const totals = {};

  for (const date of recentDates) {
    const dayData = JSON.parse(await env.VISITORS.get(`${prefix}day:${date}`) || '{}');
    const referrers = dayData.referrers || {};
    days.push({ date, referrers });
    for (const [ref, count] of Object.entries(referrers)) {
      totals[ref] = (totals[ref] || 0) + count;
    }
  }

  return new Response(JSON.stringify({ totals, days }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function recordDuration(request, env, page) {
  let seconds = 0;
  try {
    const body = await request.json();
    seconds = Math.min(Math.max(Math.round(body.seconds || 0), 0), 3600); // clamp 0-3600
  } catch { return new Response('Bad request', { status: 400 }); }

  if (seconds < 3) {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const prefix = page ? `${page}:` : '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const dayKey = `${prefix}day:${today}`;
  const dayData = JSON.parse(await env.VISITORS.get(dayKey) || '{}');

  if (!dayData.durations) dayData.durations = [];
  dayData.durations.push(seconds);

  await env.VISITORS.put(dayKey, JSON.stringify(dayData));

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function getEngagementStats(env, page) {
  const prefix = page ? `${page}:` : '';
  const dateIndex = JSON.parse(await env.VISITORS.get(`${prefix}date_index`) || '[]');
  const recentDates = dateIndex.slice(-7);

  const hourTotals = {}; // hour -> total visits
  const dayOfWeekHours = {}; // "dow:hour" -> count
  let totalDuration = 0;
  let durationCount = 0;
  const dailyAvgDurations = [];

  for (const date of recentDates) {
    const dayData = JSON.parse(await env.VISITORS.get(`${prefix}day:${date}`) || '{}');
    const hours = dayData.hours || {};
    const durations = dayData.durations || [];

    // Aggregate hours
    for (const [h, count] of Object.entries(hours)) {
      hourTotals[h] = (hourTotals[h] || 0) + count;
    }

    // Day-of-week + hour for heatmap
    const dow = new Date(date + 'T12:00:00').getDay(); // 0=Sun
    for (const [h, count] of Object.entries(hours)) {
      const key = `${dow}:${h}`;
      dayOfWeekHours[key] = (dayOfWeekHours[key] || 0) + count;
    }

    // Durations
    const dayTotal = durations.reduce((s, d) => s + d, 0);
    totalDuration += dayTotal;
    durationCount += durations.length;
    dailyAvgDurations.push({
      date,
      avg: durations.length > 0 ? Math.round(dayTotal / durations.length) : 0,
      count: durations.length,
    });
  }

  return new Response(JSON.stringify({
    avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    durationCount,
    hourTotals,
    dayOfWeekHours,
    dailyAvgDurations,
  }), { headers: { 'Content-Type': 'application/json' } });
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

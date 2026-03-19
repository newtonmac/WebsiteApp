// Cloudflare Worker: Paddle Clubs API
// Serves paddle club/recommendation data from Cloud SQL via proxy
// Deploy: npx wrangler deploy
//
// Required env vars (set via wrangler secret):
//   DB_HOST - Cloud SQL public IP
//   DB_USER - database username
//   DB_PASS - database password
//   DB_NAME - database name (paddlepoint)

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
      // GET /clubs - return all recommendations (with optional search)
      if (request.method === 'GET' && url.pathname === '/clubs') {
        return handleCors(request, await getClubs(url, env));
      }

      // GET /clubs/search?q=city_name - search by location
      if (request.method === 'GET' && url.pathname === '/clubs/search') {
        return handleCors(request, await searchClubs(url, env));
      }

      return handleCors(request, new Response('Not found', { status: 404 }));
    } catch (err) {
      return handleCors(request, new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
  },
};

async function getClubs(url, env) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radius = parseFloat(url.searchParams.get('radius')) || 50; // km

  let data = JSON.parse(await env.CLUBS.get('all_clubs') || '[]');

  // Filter by location if lat/lng provided
  if (!isNaN(lat) && !isNaN(lng)) {
    data = data.filter(club => {
      if (!club.latitude || !club.longitude) return false;
      const dist = haversine(lat, lng, club.latitude, club.longitude);
      club._distance_km = Math.round(dist * 10) / 10;
      return dist <= radius;
    }).sort((a, b) => a._distance_km - b._distance_km);
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function searchClubs(url, env) {
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();
  if (!query) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = JSON.parse(await env.CLUBS.get('all_clubs') || '[]');

  const results = data.filter(club => {
    return (club.city && club.city.toLowerCase().includes(query)) ||
           (club.area_name && club.area_name.toLowerCase().includes(query)) ||
           (club.region_name && club.region_name.toLowerCase().includes(query)) ||
           (club.country_code && club.country_code.toLowerCase() === query) ||
           (club.top_organization_names && club.top_organization_names.toLowerCase().includes(query));
  });

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  const headers = new Headers(response.headers);
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers });
}

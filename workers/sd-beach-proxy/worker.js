// Cloudflare Worker: SD Beach Water Quality Proxy
// Proxies sdbeachinfo.com API (SD County DEH) to add CORS headers
// The DEH is the primary/authoritative source for beach water quality
// in San Diego County — they physically collect samples at 81 stations.
// Their API blocks CORS, so this proxy enables browser access.
// Deploy: npx wrangler deploy

const SD_BEACH_API = 'https://sdbeachinfo.com/Home/GetTargetCityByID';
const ALLOWED_ORIGINS = ['https://jmlsd.org', 'http://localhost:8080', 'http://127.0.0.1:8080'];

// SD County DEH regions: 1=South Bay/IB, 2=City of SD, 3=North County
const REGION_IDS = [1, 2, 3];

// Cache beach data for 10 minutes (stations update ~daily)
const CACHE_TTL = 600;

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const regionParam = url.searchParams.get('region');

    try {
      let allStations = [];

      if (regionParam) {
        // Fetch specific region
        const data = await fetchRegion(parseInt(regionParam));
        allStations = data;
      } else {
        // Fetch all 3 regions in parallel
        const results = await Promise.all(
          REGION_IDS.map(id => fetchRegion(id))
        );
        allStations = results.flat();
      }

      // Normalize station data for consistent client-side consumption
      // Raw API field names: Advisory (HTML), Closure (HTML), Description (HTML), Active (bool)
      const stations = allStations.map(s => ({
        Name: s.Name || '',
        DehID: s.DehID || '',
        SiteID: s.SiteID || null,
        Latitude: s.Latitude || null,
        Longitude: s.Longitude || null,
        RBGColor: s.RBGColor || '',
        IndicatorID: s.IndicatorID || null,
        Advisory: s.Advisory || '',
        Closure: s.Closure || '',
        Description: s.Description || '',
        GeneralAdvisoryMessage: s.GeneralAdvisoryMessage || '',
        Active: s.Active ?? true,
        TypeID: s.TypeID || null,
        RegionID: s.RegionID || null,
        CityID: s.CityID || null,
        CityName: s.CityName || '',
      }));

      const response = new Response(JSON.stringify(stations), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL}`,
        },
      });

      return handleCors(request, response);
    } catch (err) {
      const errorResp = new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
      return handleCors(request, errorResp);
    }
  },
};

async function fetchRegion(regionId) {
  const resp = await fetch(`${SD_BEACH_API}?id=${regionId}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

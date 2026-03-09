// Cloudflare Worker: SD Fire Dispatch Proxy
// Proxies the San Diego Fire Dispatch API to add CORS headers
// Deploy: npx wrangler deploy

const SD_DISPATCH_API = 'https://webapps.sandiego.gov/SDFireDispatch/api/v1/Incidents';
const ALLOWED_ORIGINS = ['https://jmlsd.org', 'http://localhost:8080', 'http://127.0.0.1:8080'];

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    try {
      const resp = await fetch(SD_DISPATCH_API, {
        headers: { 'Accept': 'application/json' },
      });

      const data = await resp.json();

      // Filter to fire/vegetation/brush incidents only (not medical/EMS)
      const fireTypes = ['fire', 'brush', 'veg', 'wildland', 'grass', 'struct', 'dumpster', 'rubbish', 'vehicle fire'];
      const fireIncidents = data.filter(d => {
        const type = (d.IncidentTypeName || '').toLowerCase();
        const callType = (d.CallType || '').toLowerCase();
        return fireTypes.some(ft => type.includes(ft) || callType.includes(ft)) ||
               callType === 'fire' || callType === 'fire system service';
      });

      const response = new Response(JSON.stringify(fireIncidents), {
        headers: { 'Content-Type': 'application/json' },
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

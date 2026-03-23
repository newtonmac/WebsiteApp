// Vercel Serverless: Enrich a club by name + website
// Fetches website content, extracts info, queries Google Places API
// POST /api/enrich-club { name, website }

const API_TOKEN = 'pp-clubs-7742-v1';
const { requireAdmin } = require('./_auth');
const GOOGLE_API_KEY = 'AIzaSyAR81pUTUz5ON7ZBuoouTh2RTHyECr6yvg';

const ALLOWED_ORIGINS = [
  'https://paddlepoint.org','https://www.paddlepoint.org',
  'https://jmlsd.org','https://www.jmlsd.org',
  'http://localhost','http://127.0.0.1',
];

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Auth — accept API token OR session cookie
  const token = req.headers['x-api-token'];
  const session = requireAdmin(req);
  if (token !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });

  try {
    const { name, website, facebook, instagram } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Club name required' });

    const result = { n: name, w: website || '' };

    // Pre-set user-provided social URLs
    if (facebook) result.fb = facebook;
    if (instagram) result.ig = instagram;

    // 1. SCRAPE WEBSITE — extract email, phone, social links, description
    if (website) {
      try {
        const siteRes = await fetch(website, {
          headers: { 'User-Agent': 'Mozilla/5.0 PaddlePoint ClubBot/1.0' },
          redirect: 'follow',
        });
        if (siteRes.ok) {
          const html = await siteRes.text();
          // Extract emails
          const emails = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
          if (emails) {
            const good = emails.filter(e => !e.includes('example') && !e.includes('wixpress') && !e.includes('sentry'));
            if (good.length) result.e = good[0];
          }
          // Extract phone numbers
          const phones = html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
          if (phones) result.p = phones[0];
          // Facebook (skip tracking pixels and short paths) — only if user didn't provide
          const fbMatches = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._\-]{3,}\/?/g);
          if (fbMatches && !result.fb) {
            const fbGood = fbMatches.filter(u => !u.includes('/tr') && !u.includes('/sharer') && !u.includes('/plugins') && !u.includes('/dialog'));
            if (fbGood.length) result.fb = fbGood[0];
          }
          // Instagram — only if user didn't provide
          const ig = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/);
          if (ig && !result.ig) result.ig = ig[0];
          // Extract description from meta tags
          const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
          if (metaDesc) result.d = metaDesc[1].substring(0, 400);
          // OG description fallback
          if (!result.d) {
            const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
            if (ogDesc) result.d = ogDesc[1].substring(0, 400);
          }
          // Try to detect craft types from page content
          const lower = html.toLowerCase();
          const crafts = [];
          if (/\bkayak/i.test(lower)) crafts.push('kayak');
          if (/\bcanoe\b/i.test(lower)) crafts.push('canoe');
          if (/\browing\b|sculling/i.test(lower)) crafts.push('rowing');
          if (/\bdragon\s*boat/i.test(lower)) crafts.push('dragon_boat');
          if (/\bstand.up.paddle|\bsup\b|\bpaddleboard/i.test(lower)) crafts.push('sup');
          if (/\boutrigger/i.test(lower)) crafts.push('outrigger');
          if (/\bsurfski/i.test(lower)) crafts.push('surfski');
          if (/\bwhitewater/i.test(lower)) crafts.push('whitewater_kayak');
          if (/\bsea.kayak/i.test(lower)) crafts.push('sea_kayak');
          if (/\bcanoe.polo/i.test(lower)) crafts.push('canoe_polo');
          if (crafts.length) result.ct = crafts.join(',');
        }
      } catch (e) {
        result._webError = e.message;
      }
    }

    // 2. GOOGLE PLACES — find the club, get rating, reviews, address, coords, photo
    try {
      const searchQuery = encodeURIComponent(name);
      const placesUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,types&key=${GOOGLE_API_KEY}`;
      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();
      console.log('Places search status:', placesData.status, 'candidates:', placesData.candidates?.length || 0);
      if (placesData.error_message) console.log('Places error:', placesData.error_message);
      result._placesStatus = placesData.status;
      if (placesData.error_message) result._placesMsg = placesData.error_message;

      if (placesData.candidates && placesData.candidates.length > 0) {
        const place = placesData.candidates[0];

        // Get more details via Place Details API
        if (place.place_id) {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,rating,user_ratings_total,photos,website,formatted_phone_number,address_components,url&key=${GOOGLE_API_KEY}`;
          const detailsRes = await fetch(detailsUrl);
          const details = await detailsRes.json();

          if (details.result) {
            const r = details.result;
            if (r.formatted_address) result.a = r.formatted_address;
            if (r.geometry && r.geometry.location) {
              result.la = r.geometry.location.lat;
              result.lo = r.geometry.location.lng;
            }
            if (r.rating) result.gr = r.rating;
            if (r.user_ratings_total) result.gc = r.user_ratings_total;
            if (r.formatted_phone_number) result.p = r.formatted_phone_number;
            if (r.url) result.gm = r.url;
            if (!result.w && r.website) result.w = r.website;

            // Photo
            if (r.photos && r.photos.length > 0) {
              result.ph = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${r.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
            }

            // Parse address components for city, state, country
            if (r.address_components) {
              for (const comp of r.address_components) {
                if (comp.types.includes('locality')) result.ci = comp.long_name;
                if (comp.types.includes('administrative_area_level_1')) {
                  result.st = comp.long_name;
                  result.sa = comp.short_name;
                }
                if (comp.types.includes('country')) {
                  result.co = comp.long_name;
                  result.cc = comp.short_name;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      result._placesError = e.message;
    }

    result.cl = 'club';
    result.se = 'year-round';
    // Clean up internal debug fields
    delete result._webError;
    delete result._placesError;
    delete result._placesStatus;
    delete result._placesMsg;
    delete result._debug;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

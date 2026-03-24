const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchPage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = req.headers['x-api-token'];
  const session = requireAdmin(req);
  if (token !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });

  const { name, website, id, facebook_url, instagram_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Brand name required' });

  const result = { name, website: website || '', facebook_url: facebook_url || '', instagram_url: instagram_url || '' };
  let siteHtml = '';

  // Step 1: Scrape homepage
  if (website) {
    siteHtml = await fetchPage(website);
    if (siteHtml) {
      // Basic info extraction
      const descMatch = siteHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
        || siteHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
      if (descMatch) result.description = descMatch[1].trim().slice(0, 500);
      try { result.logo_url = `https://icons.duckduckgo.com/ip3/${new URL(website).hostname}.ico`; } catch {}
      const emails = siteHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emails) { const good = emails.filter(e => !e.includes('example') && !e.includes('sentry')); if (good.length) result.email = good[0]; }
      const phones = siteHtml.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
      if (phones) result.phone = phones[0];
      if (!result.facebook_url) { const fb = siteHtml.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._\-]{3,}\/?/g); if (fb) { const g = fb.filter(u => !u.includes('/tr') && !u.includes('/sharer')); if (g.length) result.facebook_url = g[0]; } }
      if (!result.instagram_url) { const ig = siteHtml.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/); if (ig) result.instagram_url = ig[0]; }
      const yt = siteHtml.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)\/[a-zA-Z0-9._-]+\/?/);
      if (yt) result.youtube_url = yt[0];
    }
  }

  // Step 2: SLOWLY scrape sub-pages for product data
  if (website && siteHtml) {
    try {
      const base = new URL(website);
      // Find internal links
      const allHrefs = [...siteHtml.matchAll(/href=["']([^"'#]*?)["']/gi)].map(m => m[1]).filter(Boolean);
      const skipPattern = /css|js|images?|fonts?|favicon|mailto|tel:|privacy|terms|contact|about|news|blog|faq|login|cart|account|search|sitemap|\.(jpg|png|gif|svg|pdf|css|js)$/i;
      const urls = new Set();
      for (const href of allHrefs) {
        if (skipPattern.test(href)) continue;
        try { const u = new URL(href, base); if (u.hostname === base.hostname && u.pathname !== '/' && u.pathname.length > 2) urls.add(u.toString()); } catch {}
      }
      for (const p of ['/products','/shop','/models','/kayaks','/surfski','/surf-skis','/boats','/boards','/collections','/touring-kayaks','/racing-kayaks','/our-boats']) {
        urls.add(new URL(p, base).toString());
      }

      // Scrape up to 4 sub-pages with 3 SECOND delays
      const pages = [siteHtml];
      for (const url of [...urls].slice(0, 4)) {
        await delay(3000);
        const page = await fetchPage(url);
        if (page.length > 200) pages.push(page);
      }

      // Strip HTML, combine text
      const text = pages.join('\n')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);

      // Extract nav link text (often contains model names)
      const linkTexts = [...siteHtml.matchAll(/<a[^>]*>([^<]{3,60})<\/a>/gi)]
        .map(m => m[1].trim()).filter(t => t && !t.match(/home|about|contact|login|cart|search|menu|privacy|terms/i));
      const linkTextStr = linkTexts.length > 0 ? '\n\nNavigation/link text: ' + linkTexts.join(', ') : '';

      // Call Claude to extract products
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      if (ANTHROPIC_KEY && text.length > 50) {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 500,
            messages: [{ role: 'user', content:
              `You are extracting product information for "${name}", a paddle sports / water sports brand.\n\nFrom the website text below, identify their 4-8 most popular or flagship products. For each product, provide:\n- Product name (model name only, no brand prefix)\n- A short 5-10 word description of what it is\n\nRespond ONLY with products in this exact format, one per line, separated by |:\nProduct Name — short description | Product Name — short description\n\nIf the text mentions model names in links/navigation, include those.\nIf you can't identify specific products, respond with just: NONE\n\nWebsite text:\n${text}${linkTextStr}` }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        const aiData = await aiRes.json();
        const aiText = aiData?.content?.[0]?.text?.trim() || '';
        if (aiText && aiText !== 'NONE' && aiText.includes('—')) {
          result.popular_products = aiText;
        }
      }

      // Also improve description with AI
      if (ANTHROPIC_KEY && result.description && result.description.length > 5) {
        try {
          const descRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514', max_tokens: 200,
              messages: [{ role: 'user', content:
                `Rewrite this brand description for "${name}" to be a concise 1-2 sentence summary focused on paddle sports / water sports. Keep it factual and under 200 characters. If it's just a rating or unrelated text, write a brief description based on the brand name and any context you know.\n\nOriginal: ${result.description}` }],
            }),
            signal: AbortSignal.timeout(10000),
          });
          const descData = await descRes.json();
          const improved = descData?.content?.[0]?.text?.trim() || '';
          if (improved && improved.length > 20 && improved.length < 500) result.description = improved;
        } catch {}
      }
    } catch(e) { console.log('[enrich] Error:', e.message); }
  }

  return res.status(200).json(result);
};

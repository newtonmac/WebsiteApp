const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = req.headers['x-api-token'];
  const session = requireAdmin(req);
  if (token !== API_TOKEN && !session.valid) return res.status(403).json({ error: 'Access denied' });

  const { name, website, facebook_url, instagram_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Brand name required' });

  const result = { name, website: website || '', facebook_url: facebook_url || '', instagram_url: instagram_url || '' };
  let siteHtml = '';

  // Scrape website for description, logo, email, phone, social links
  if (website) {
    try {
      const siteRes = await fetch(website, {
        headers: { 'User-Agent': 'Mozilla/5.0 PaddlePoint/1.0' },
        redirect: 'follow', signal: AbortSignal.timeout(10000)
      });
      siteHtml = await siteRes.text();

      // Description from meta tags
      const descMatch = siteHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
        || siteHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
      if (descMatch) result.description = descMatch[1].trim().slice(0, 500);

      // Logo: DuckDuckGo favicon
      try {
        const urlObj = new URL(website);
        result.logo_url = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
      } catch(e) {}

      // Email
      const emails = siteHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emails) {
        const good = emails.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('webpack'));
        if (good.length) result.email = good[0];
      }

      // Phone
      const phones = siteHtml.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
      if (phones) result.phone = phones[0];

      // Facebook
      if (!result.facebook_url) {
        const fbMatch = siteHtml.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._\-]{3,}\/?/g);
        if (fbMatch) {
          const good = fbMatch.filter(u => !u.includes('/tr') && !u.includes('/sharer') && !u.includes('/plugins'));
          if (good.length) result.facebook_url = good[0];
        }
      }
      // Instagram
      if (!result.instagram_url) {
        const igMatch = siteHtml.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/);
        if (igMatch) result.instagram_url = igMatch[0];
      }
      // YouTube
      const ytMatch = siteHtml.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)\/[a-zA-Z0-9._-]+\/?/);
      if (ytMatch) result.youtube_url = ytMatch[0];

    } catch(e) { /* scrape failed, continue with what we have */ }
  }

  // AI-powered product extraction: scrape products page + use Claude to extract
  if (website && siteHtml) {
    try {
      // Try to find and scrape a products/shop page for richer data
      let productsHtml = siteHtml;
      const productLinks = siteHtml.match(/href=["'](\/(?:products|shop|models|boats|boards|kayaks|surfski|paddles|gear|collections|catalog)[^"']*?)["']/gi);
      console.log('[enrich] Product links found:', productLinks?.length || 0, productLinks?.slice(0,3));
      if (productLinks && productLinks.length > 0) {
        const href = productLinks[0].match(/href=["']([^"']+)["']/i)?.[1];
        if (href) {
          try {
            const base = new URL(website);
            const prodUrl = new URL(href, base).toString();
            const prodRes = await fetch(prodUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 PaddlePoint/1.0' },
              redirect: 'follow', signal: AbortSignal.timeout(10000)
            });
            const prodPage = await prodRes.text();
            if (prodPage.length > 500) productsHtml = prodPage;
          } catch(e) {}
        }
      }

      // Strip HTML to text for AI analysis (keep structure hints)
      const textContent = productsHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);

      // Call Claude to extract products
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      console.log('[enrich] AI key exists:', !!ANTHROPIC_KEY, 'textLen:', textContent.length);
      if (ANTHROPIC_KEY && textContent.length > 100) {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            messages: [{ role: 'user', content:
              `You are extracting product information for "${name}", a paddle sports / water sports brand.

From the website text below, identify their 4-8 most popular or flagship products. For each product, provide:
- Product name (model name only, no brand prefix)
- A short 5-10 word description of what it is

Respond ONLY with products in this exact format, one per line, separated by |:
Product Name — short description | Product Name — short description

If this doesn't appear to be a paddle/water sports brand, or you can't identify specific products, respond with just: NONE

Website text:
${textContent}`
            }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        const aiData = await aiRes.json();
        const aiText = aiData?.content?.[0]?.text?.trim() || '';
        console.log('[enrich] AI response:', aiText.substring(0, 200), 'error:', aiData?.error);
        if (aiText && aiText !== 'NONE' && aiText.includes('—')) {
          result.popular_products = aiText;
        }
      }
    } catch(e) { console.log('[enrich] AI extraction error:', e.message); result._debug_ai_error = e.message; }
  }

  // Debug info (temporary)
  result._debug = {
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    siteHtmlLen: siteHtml.length,
    productLinksFound: siteHtml.match(/href=["'](\/(?:products|shop|models|boats|boards|kayaks|surfski|paddles|gear|collections|catalog)[^"']*?)["']/gi)?.length || 0,
    productLinksExamples: (siteHtml.match(/href=["'](\/(?:products|shop|models|boats|boards|kayaks|surfski|paddles|gear|collections|catalog)[^"']*?)["']/gi) || []).slice(0,3),
  };

  // Also improve description with AI if we got a generic meta description
  if (website && siteHtml && result.description && process.env.ANTHROPIC_API_KEY) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{ role: 'user', content:
            `Rewrite this brand description for "${name}" to be a concise 1-2 sentence summary focused on paddle sports / water sports. Keep it factual and under 200 characters. If the brand isn't related to water sports, keep the original description but make it concise.

Original: ${result.description}`
          }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const aiData = await aiRes.json();
      const improved = aiData?.content?.[0]?.text?.trim() || '';
      if (improved && improved.length > 20 && improved.length < 500) {
        result.description = improved;
      }
    } catch(e) { /* AI description improvement failed */ }
  }

  return res.status(200).json(result);
};

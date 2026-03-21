const { query } = require('./_db');
const API_TOKEN = 'pp-clubs-7742-v1';
const ALLOWED_ORIGINS = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = req.headers['x-api-token'];
  if (token !== API_TOKEN) return res.status(403).json({ error: 'Access denied' });

  const { name, website, facebook_url, instagram_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Brand name required' });

  const result = { name, website: website || '', facebook_url: facebook_url || '', instagram_url: instagram_url || '' };

  // Scrape website for description, logo (favicon), email, phone
  if (website) {
    try {
      const siteRes = await fetch(website, {
        headers: { 'User-Agent': 'Mozilla/5.0 PaddlePoint/1.0' },
        redirect: 'follow', signal: AbortSignal.timeout(10000)
      });
      const html = await siteRes.text();

      // Description from meta tags
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
        || html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
      if (descMatch) result.description = descMatch[1].trim().slice(0, 500);

      // Logo: use DuckDuckGo favicon (more reliable than Google)
      try {
        const urlObj = new URL(website);
        result.logo_url = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
      } catch(e) {}

      // Email
      const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emails) {
        const good = emails.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('webpack'));
        if (good.length) result.email = good[0];
      }

      // Phone
      const phones = html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
      if (phones) result.phone = phones[0];

      // Facebook (if not provided)
      if (!result.facebook_url) {
        const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._\-]{3,}\/?/g);
        if (fbMatch) {
          const good = fbMatch.filter(u => !u.includes('/tr') && !u.includes('/sharer') && !u.includes('/plugins'));
          if (good.length) result.facebook_url = good[0];
        }
      }
      // Instagram (if not provided)
      if (!result.instagram_url) {
        const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/);
        if (igMatch) result.instagram_url = igMatch[0];
      }
      // YouTube
      const ytMatch = html.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)\/[a-zA-Z0-9._-]+\/?/);
      if (ytMatch) result.youtube_url = ytMatch[0];

    } catch(e) { /* scrape failed, continue with what we have */ }
  }

  return res.status(200).json(result);
};

// Vercel Serverless: Proxy for Cloudflare Worker admin actions
// Uses CF_ADMIN_KEY env var so the client never needs to know the key
const { requireAdmin } = require('./_auth');

const UPDATES_API = 'https://updates.newtonmac.workers.dev';
const SUGGEST_API = 'https://suggestions.newtonmac.workers.dev';

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const session = requireAdmin(req);
  if (!session.valid) return res.status(403).json({ error: 'Not authenticated' });

  const adminKey = process.env.CF_ADMIN_KEY;
  if (!adminKey) return res.status(500).json({ error: 'CF_ADMIN_KEY not configured' });

  const { action, id, title, description, status, suggestedBy } = req.body || {};

  try {
    let url, method = 'POST', body = null;

    switch (action) {
      case 'approve':
        url = `${UPDATES_API}/admin/updates`;
        body = JSON.stringify({ title, description, status, suggestedBy });
        break;
      case 'dismiss':
        url = `${SUGGEST_API}/admin/suggestions/${id}`;
        method = 'DELETE';
        break;
      case 'add_update':
        url = `${UPDATES_API}/admin/updates`;
        body = JSON.stringify({ title, description, status });
        break;
      case 'change_status':
        url = `${UPDATES_API}/admin/updates/${id}`;
        method = 'PATCH';
        body = JSON.stringify({ status });
        break;
      case 'delete_update':
        url = `${UPDATES_API}/admin/updates/${id}`;
        method = 'DELETE';
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    const headers = { 'Authorization': `Bearer ${adminKey}`, 'Content-Type': 'application/json' };
    const cfRes = await fetch(url, { method, headers, ...(body ? { body } : {}) });
    const data = await cfRes.json().catch(() => ({}));
    return res.status(cfRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

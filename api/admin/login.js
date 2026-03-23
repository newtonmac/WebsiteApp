// POST /api/admin/login — validate password, set session cookie
const { login } = require('../_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { password } = req.body || {};
  const cookie = login(password);
  if (!cookie) return res.status(401).json({ error: 'Invalid password' });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ success: true });
};

// GET /api/admin/session — check if current session is valid
const { requireAdmin } = require('../_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = requireAdmin(req);
  if (!auth.valid) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true });
};

// POST /api/admin/logout — clear session cookie
const { logout } = require('../_auth');

module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', logout());
  return res.status(200).json({ success: true });
};

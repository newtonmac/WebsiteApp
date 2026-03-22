// Lightweight count API for homepage stats
const { query } = require('./_db');

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const ALLOWED = ['https://paddlepoint.org','https://jmlsd.org','http://localhost'];
  if (ALLOWED.some(o => origin.startsWith(o))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const [clubs] = await query('SELECT COUNT(*) as count FROM clubs');
    const [events] = await query('SELECT COUNT(*) as count FROM events');
    const [countries] = await query('SELECT COUNT(DISTINCT country) as count FROM clubs');
    const [brands] = await query('SELECT COUNT(*) as count FROM gear_brands');
    const [feds] = await query('SELECT COUNT(*) as count FROM federations');

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
      clubs: clubs.count,
      events: events.count,
      countries: countries.count,
      brands: brands.count,
      federations: feds.count
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

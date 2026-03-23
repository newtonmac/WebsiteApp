import { query } from '@/lib/db';

export const revalidate = 60;

async function getStats() {
  try {
    const [clubs] = await query('SELECT COUNT(*) as c FROM clubs') as any[];
    const [events] = await query('SELECT COUNT(*) as c FROM events') as any[];
    const [gear] = await query('SELECT COUNT(*) as c FROM gear_brands') as any[];
    const [feds] = await query('SELECT COUNT(*) as c FROM federations') as any[];
    const [countries] = await query('SELECT COUNT(DISTINCT country) as c FROM clubs') as any[];
    const [recentEvents] = await query('SELECT COUNT(*) as c FROM events WHERE DATE(created_at) = (SELECT DATE(created_at) FROM events ORDER BY created_at DESC LIMIT 1)') as any[];
    return {
      clubs: clubs.c, events: events.c, gear: gear.c,
      federations: feds.c, countries: countries.c, recentEvents: recentEvents.c,
    };
  } catch { return { clubs: 0, events: 0, gear: 0, federations: 0, countries: 0, recentEvents: 0 }; }
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const cards = [
    { label: 'Paddle Clubs', value: stats.clubs.toLocaleString(), sub: `${stats.countries} countries`, icon: '🛶', href: '/admin/clubs', color: 'from-blue-500 to-cyan-500' },
    { label: 'Events', value: stats.events.toLocaleString(), sub: `${stats.recentEvents} added last scrape`, icon: '🏁', href: '/admin/events', color: 'from-emerald-500 to-teal-500' },
    { label: 'Gear Brands', value: stats.gear.toLocaleString(), sub: 'manufacturers', icon: '🎯', href: '/admin/gear', color: 'from-amber-500 to-orange-500' },
    { label: 'Federations', value: stats.federations.toLocaleString(), sub: 'worldwide', icon: '🏛️', href: '/admin/federations', color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <a key={c.label} href={c.href}
            className="block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              <span className={`text-3xl font-extrabold bg-gradient-to-r ${c.color} bg-clip-text text-transparent`}>{c.value}</span>
            </div>
            <div className="text-sm font-semibold text-white">{c.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.sub}</div>
          </a>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/events" className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/20 transition-colors">Run Event Scraper</a>
          <a href="/admin/clubs" className="px-4 py-2 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 transition-colors">Add Club</a>
          <a href="/admin/gear" className="px-4 py-2 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors">Enrich Gear Brand</a>
          <a href="/" className="px-4 py-2 bg-slate-500/10 text-slate-400 text-xs font-medium rounded-lg hover:bg-slate-500/20 transition-colors">View Public Site →</a>
        </div>
      </div>
    </div>
  );
}

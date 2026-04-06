import { Metadata } from 'next';
import { query } from '@/lib/db';
import { EventsList } from './EventsList';
import { RecentlyAdded } from './RecentlyAdded';

export const metadata: Metadata = {
  title: 'Events',
  alternates: { canonical: '/events' },
  description: 'Paddling events worldwide — regattas, races, festivals, and championships for kayak, canoe, SUP, outrigger, and dragon boat.',
  openGraph: { title: 'PaddlePoint — Events', description: 'Paddling events worldwide' },
};

export const revalidate = 300; // ISR: regenerate every 5 minutes

interface Event {
  id: number; name: string; event_type: string; start_date: string; end_date: string;
  city: string; state: string; country: string; venue: string; organizer: string;
  website: string; description: string; sports: string; competition_level: string;
  registration_status: string; updated_at: string;
}

async function getEvents(): Promise<Event[]> {
  try {
    const rows = await query('SELECT * FROM events ORDER BY start_date ASC') as Event[];
    return rows;
  } catch { return []; }
}

interface RecentEvent {
  name: string; start_date: string; city: string; state: string; country: string;
}

async function getRecentlyAdded(): Promise<{ events: RecentEvent[]; date: string }> {
  try {
    // Get the most recent scrape batch: events created within 30 min of the latest created_at
    const [latest] = await query('SELECT created_at FROM events ORDER BY created_at DESC LIMIT 1') as any[];
    if (!latest) return { events: [], date: '' };
    const rows = await query(
      'SELECT name, start_date, city, state, country FROM events WHERE created_at >= DATE_SUB(?, INTERVAL 30 MINUTE) ORDER BY start_date ASC',
      [latest.created_at]
    ) as RecentEvent[];
    return { events: rows, date: String(latest.created_at) };
  } catch { return { events: [], date: '' }; }
}

export default async function EventsPage() {
  const events = await getEvents();
  const recent = await getRecentlyAdded();
  const lastUpdated = events.reduce((latest, e) => {
    const d = new Date(e.updated_at);
    return d > latest ? d : latest;
  }, new Date(0));

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-16 text-center">
        <h2 className="text-4xl font-extrabold mb-2">🏁 Paddling Events</h2>
        <p className="text-lg opacity-90 mb-1">Races, regattas, festivals &amp; championships worldwide</p>
        <p className="text-sm opacity-70 mb-4">Free community resource — open data, no account required</p>
        <span className="inline-block bg-white/20 rounded-full px-4 py-1 text-sm font-semibold">
          {events.length} events
        </span>
        {lastUpdated.getTime() > 0 && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <p className="text-xs opacity-60">
              Last updated: {lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            {recent.events.length > 0 && (
              <RecentlyAdded events={JSON.parse(JSON.stringify(recent.events))} count={recent.events.length} />
            )}
          </div>
        )}
      </section>

      {/* Client-side filtering */}
      <EventsList events={JSON.parse(JSON.stringify(events))} />
    </>
  );
}

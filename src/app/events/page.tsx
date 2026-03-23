import { Metadata } from 'next';
import { query } from '@/lib/db';
import { EventsList } from './EventsList';

export const metadata: Metadata = {
  title: 'Events',
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

export default async function EventsPage() {
  const events = await getEvents();
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
          <p className="text-xs opacity-60 mt-2">
            Last updated: {lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </section>

      {/* Client-side filtering */}
      <EventsList events={JSON.parse(JSON.stringify(events))} />
    </>
  );
}

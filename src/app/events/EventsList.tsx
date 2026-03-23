'use client';
import { useState, useMemo } from 'react';

interface Event {
  id: number; name: string; event_type: string; start_date: string; end_date: string;
  city: string; state: string; country: string; venue: string; organizer: string;
  website: string; description: string; sports: string; competition_level: string;
  registration_status: string;
}

const TYPE_COLORS: Record<string, string> = {
  regatta: 'bg-blue-100 text-blue-700', trial: 'bg-green-100 text-green-700',
  international: 'bg-purple-100 text-purple-700', festival: 'bg-amber-100 text-amber-700',
  clinic: 'bg-cyan-100 text-cyan-700', race: 'bg-red-100 text-red-700',
};

const LEVEL_COLORS: Record<string, string> = {
  national: 'text-emerald-600', international: 'text-purple-600',
  regional: 'text-blue-600', local: 'text-slate-500',
};

function daysAway(dateStr: string) {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (d < 0) return <span className="text-slate-400">{Math.abs(d)} days ago</span>;
  if (d === 0) return <span className="text-red-500 font-bold">Today!</span>;
  return <span className="text-orange-500">{d} days away</span>;
}

export function EventsList({ events }: { events: Event[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  const types = useMemo(() => [...new Set(events.map(e => e.event_type).filter(Boolean))].sort(), [events]);
  const sports = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => e.sports?.split(',').forEach(sp => s.add(sp.trim())));
    return [...s].filter(Boolean).sort();
  }, [events]);
  const countries = useMemo(() => [...new Set(events.map(e => e.country).filter(Boolean))].sort(), [events]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (search && !`${e.name} ${e.city} ${e.state} ${e.country} ${e.organizer}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && e.event_type !== typeFilter) return false;
      if (sportFilter && !e.sports?.toLowerCase().includes(sportFilter.toLowerCase())) return false;
      if (countryFilter && e.country !== countryFilter) return false;
      return true;
    });
  }, [events, search, typeFilter, sportFilter, countryFilter]);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text" placeholder="Search events, locations, organizers..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm" value={sportFilter} onChange={e => setSportFilter(e.target.value)}>
          <option value="">All Sports</option>
          {sports.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(event => (
          <div key={event.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow border-l-4"
            style={{ borderLeftColor: event.competition_level === 'international' ? '#8b5cf6' : event.competition_level === 'national' ? '#10b981' : '#3b82f6' }}>
            <div className="flex items-start justify-between mb-2">
              {event.event_type && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${TYPE_COLORS[event.event_type] || 'bg-slate-100 text-slate-600'}`}>
                  {event.event_type}
                </span>
              )}
              {event.competition_level && (
                <span className={`text-xs font-semibold uppercase ${LEVEL_COLORS[event.competition_level] || 'text-slate-500'}`}>
                  {event.competition_level}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{event.name}</h3>
            <p className="text-sm text-slate-500 mb-1">
              📅 {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {event.end_date && event.end_date !== event.start_date && ` – ${new Date(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
            {(event.venue || event.city) && (
              <p className="text-sm text-slate-500 mb-1">📍 {[event.venue, event.city, event.state, event.country].filter(Boolean).join(', ')}</p>
            )}
            {event.organizer && <p className="text-sm text-slate-500 mb-2">🏢 {event.organizer}</p>}
            {event.sports && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {event.sports.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-sm">{daysAway(event.start_date)}</div>
              <div className="flex items-center gap-3">
                {event.registration_status && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${event.registration_status === 'open' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {event.registration_status}
                  </span>
                )}
                {event.website && (
                  <a href={event.website} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 no-underline">
                    Website →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-slate-400 py-12">No events match your filters.</p>}
    </section>
  );
}

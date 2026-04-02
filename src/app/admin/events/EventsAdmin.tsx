'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

interface Event {
  id: number; name: string; event_type: string; sports: string; level: string;
  start_date: string; end_date: string; venue: string; city: string; state: string;
  country: string; organizer: string; website: string; registration_status: string;
  registration_deadline: string; lat: number; lng: number; description: string;
  featured: number; source: string; source_url: string;
}

const API_TOKEN = 'pp-clubs-7742-v1';
const PER_PAGE = 50;
const TYPES = ['regatta','trial','international','festival','clinic','fun_paddle'];
const TYPE_LABELS: Record<string,string> = {regatta:'Regatta',trial:'Trial',international:'International',festival:'Festival',clinic:'Clinic',fun_paddle:'Fun Paddle'};
const TYPE_COLORS: Record<string,string> = {regatta:'bg-blue-500',trial:'bg-emerald-500',international:'bg-violet-500',festival:'bg-amber-500',clinic:'bg-pink-500',fun_paddle:'bg-cyan-500'};
const SPORTS = ['kayak','canoe','sup','outrigger','dragon_boat','surfski','rowing'];
const LEVELS = ['local','regional','national','international','olympic'];
const STATUSES = ['upcoming','open','closed','sold_out'];
const STATUS_COLORS: Record<string,string> = {open:'text-emerald-400',closed:'text-red-400',upcoming:'text-amber-400',sold_out:'text-pink-400'};
const FIELDS = ['name','event_type','sports','level','start_date','end_date','venue','city','state','country','organizer','website','registration_status','registration_deadline','lat','lng','description','featured','source'];

const SOURCES = [
  { name: 'American Canoe Association', flag: '🇺🇸' },
  { name: 'USA SUP', flag: '🇺🇸' },
  { name: 'Canoe Kayak Canada', flag: '🇨🇦' },
  { name: 'US Dragon Boat Federation', flag: '🇺🇸' },
  { name: 'Dragon Boat Canada', flag: '🇨🇦' },
  { name: 'USA Surfing (SUP)', flag: '🇺🇸' },
  { name: 'ICF', flag: '🌍' },
  { name: 'European Canoe Association', flag: '🇪🇺' },
  { name: 'British Canoeing', flag: '🇬🇧' },
  { name: 'French Canoe Federation (FFCK)', flag: '🇫🇷' },
  { name: 'Deutscher Kanu-Verband', flag: '🇩🇪' },
  { name: 'Spanish Canoe Federation', flag: '🇪🇸' },
  { name: 'Italian Canoe Federation', flag: '🇮🇹' },
  { name: 'Paddle Australia', flag: '🇦🇺' },
  { name: 'Paddle New Zealand', flag: '🇳🇿' },
  { name: 'European SUP League', flag: '🏄' },
  { name: 'TotalSUP Events', flag: '🌊' },
  { name: 'PaddleGuru Races', flag: '🏁' },
  { name: 'PaddleGuru SUP/OC', flag: '🏁' },
  { name: 'PaddleGuru Kayak', flag: '🏁' },
  { name: "IVF (Va'a)", flag: '🛶' },
  { name: 'USAORCA', flag: '🇺🇸' },
  { name: 'IDBF', flag: '🐉' },
];

const EMPTY_EVENT: Partial<Event> = { event_type: 'regatta', level: 'national', registration_status: 'upcoming', country: 'United States' };

export default function EventsAdmin() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sortCol, setSortCol] = useState('start_date');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Event> | null>(null);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState(false);
  // Scraper state
  const [scraping, setScraping] = useState(false);
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [sourceStatus, setSourceStatus] = useState<Record<number,string>>({});
  const [checkedSources, setCheckedSources] = useState<Set<number>>(new Set(SOURCES.map((_, i) => i)));
  const [pgScraping, setPgScraping] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?refresh=1', { headers: { 'X-API-Token': API_TOKEN }, credentials: 'include' });
      setEvents(await res.json());
    } catch { setEvents([]); }
  }, []);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const showToast = (msg: string, err = false) => { setToast(msg); setToastErr(err); setTimeout(() => setToast(''), 3000); };
  const handleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
  const setField = (key: string, val: string) => setEditing(prev => prev ? { ...prev, [key]: val } : null);

  const filtered = useMemo(() => {
    let f = events.filter(ev => {
      if (typeFilter && ev.event_type !== typeFilter) return false;
      if (sportFilter && (!ev.sports || !ev.sports.includes(sportFilter))) return false;
      if (levelFilter && ev.level !== levelFilter) return false;
      if (search) {
        const h = [ev.name, ev.city, ev.state, ev.country, ev.organizer, ev.sports, ev.venue, ev.description].join(' ').toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    f.sort((a, b) => {
      const av = ((a as any)[sortCol] || '').toString(), bv = ((b as any)[sortCol] || '').toString();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return f;
  }, [events, search, typeFilter, sportFilter, levelFilter, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageData = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // CRUD
  const saveEvent = async () => {
    if (!editing?.name) { showToast('Event name required', true); return; }
    const data: any = { ...editing };
    if (data.id) data.id = Number(data.id);
    if (data.featured) data.featured = data.featured === '1' || data.featured === true;
    try {
      const res = await fetch('/api/save-event', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.error) { showToast(r.error, true); return; }
      setEditing(null); showToast(data.id ? 'Event updated' : 'Event added'); loadEvents();
    } catch (e: any) { showToast('Save failed: ' + e.message, true); }
  };

  const deleteEvent = async () => {
    if (!editing?.id || !confirm('Delete this event?')) return;
    try {
      await fetch('/api/save-event', { method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
        body: JSON.stringify({ id: Number(editing.id) }) });
      setEditing(null); showToast('Event deleted'); loadEvents();
    } catch { showToast('Delete failed', true); }
  };

  // AI Scraper
  const runScrape = async () => {
    const selected = [...checkedSources];
    if (!selected.length) { showToast('No sources selected', true); return; }
    setScraping(true); setScrapeLog([]); setSourceStatus({});
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    let totalInserted = 0;
    for (let ci = 0; ci < selected.length; ci++) {
      const idx = selected[ci];
      if (ci > 0) await delay(16000);
      setSourceStatus(prev => ({ ...prev, [idx]: '⏳' }));
      setScrapeLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Scraping ${SOURCES[idx].name}...`]);
      try {
        const res = await fetch('/api/scrape-events', { method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
          body: JSON.stringify({ sourceIndex: idx }) });
        const data = await res.json();
        const r = data.results?.[0];
        if (r?.status === 'ok') {
          setSourceStatus(prev => ({ ...prev, [idx]: `✅ ${r.found} found, ${r.inserted} new` }));
          setScrapeLog(prev => [...prev, `✅ ${SOURCES[idx].name}: ${r.found} found, ${r.inserted} new`]);
          totalInserted += r.inserted;
        } else {
          setSourceStatus(prev => ({ ...prev, [idx]: '⚠️' }));
          setScrapeLog(prev => [...prev, `⚠️ ${SOURCES[idx].name}: ${r?.error || 'unknown'}`]);
        }
      } catch (e: any) {
        setSourceStatus(prev => ({ ...prev, [idx]: '❌' }));
        setScrapeLog(prev => [...prev, `❌ ${SOURCES[idx].name}: ${e.message}`]);
      }
    }
    setScraping(false);
    showToast(`Scrape done! ${totalInserted} new events.`);
    if (totalInserted > 0) loadEvents();
  };

  // PaddleGuru direct scraper
  const runPaddleGuru = async () => {
    setPgScraping(true);
    setScrapeLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Running PaddleGuru direct scraper...`]);
    try {
      const res = await fetch('/api/scrape-paddleguru', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN } });
      const data = await res.json();
      setScrapeLog(prev => [...prev, `✅ PaddleGuru: ${data.found} found, ${data.inserted} inserted, ${data.skipped} skipped`]);
      showToast(`PaddleGuru: ${data.inserted} new events!`);
      if (data.inserted > 0) loadEvents();
    } catch (e: any) {
      setScrapeLog(prev => [...prev, `❌ PaddleGuru direct: ${e.message}`]);
    }
    setPgScraping(false);
  };

  const toggleSource = (idx: number) => {
    setCheckedSources(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  };

  // Stats
  const typeCounts = useMemo(() => {
    const c: Record<string,number> = {};
    events.forEach(e => { c[e.event_type] = (c[e.event_type] || 0) + 1; });
    return c;
  }, [events]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">🏁 Events</h2>
          <p className="text-xs text-slate-500">
            {events.length} events · {Object.entries(typeCounts).map(([t, c]) => `${TYPE_LABELS[t] || t}: ${c}`).join(' · ')}
          </p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY_EVENT }); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg">
          ➕ Add Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search name, city, sport, organizer..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500" />
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select value={sportFilter} onChange={e => { setSportFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none">
          <option value="">All Sports</option>
          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none">
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-500 mb-2">Showing {filtered.length} of {events.length}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/50">
              {[['name','Name'],['event_type','Type'],['start_date','Date'],['city','Location'],['level','Level']].map(([col, label]) => (
                <th key={col} onClick={() => handleSort(col)}
                  className="text-left px-3 py-2.5 text-slate-400 font-semibold cursor-pointer hover:text-white text-xs">
                  {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}
                </th>
              ))}
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs">Sports</th>
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs">Status</th>
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs w-12">Edit</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map(ev => (
              <tr key={ev.id} className="border-t border-slate-800/50 hover:bg-slate-900/50 cursor-pointer" onClick={() => { setEditing({ ...ev, featured: ev.featured as any }); }}>
                <td className="px-3 py-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${TYPE_COLORS[ev.event_type] || 'bg-slate-500'}`} />
                  <span className="text-white text-xs">{ev.name}{ev.featured ? ' ⭐' : ''}</span>
                </td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{TYPE_LABELS[ev.event_type] || ev.event_type}</td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{ev.start_date?.substring(0, 10) || '—'}</td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{[ev.city, ev.state].filter(Boolean).join(', ')}</td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{ev.level}</td>
                <td className="px-3 py-1.5">
                  {(ev.sports || '').split(',').filter(Boolean).slice(0, 3).map(s => (
                    <span key={s} className="inline-block bg-cyan-500/10 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded mr-0.5">{s.trim()}</span>
                  ))}
                </td>
                <td className={`px-3 py-1.5 text-xs ${STATUS_COLORS[ev.registration_status] || 'text-slate-400'}`}>
                  {(ev.registration_status || '').replace('_', ' ')}
                </td>
                <td className="px-3 py-1.5">
                  <button onClick={e => { e.stopPropagation(); setEditing({ ...ev }); }}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 mt-3 text-sm text-slate-500">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">← Prev</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={(page + 1) >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">Next →</button>
      </div>

      {/* Scraper Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-6">
        <h3 className="text-sm font-bold text-violet-400 mb-2">🤖 AI Event Scraper</h3>
        <p className="text-xs text-slate-500 mb-3">Uses Claude AI + web search. 16s delay between sources. Deduplicates by name + date.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-4">
          {SOURCES.map((s, i) => (
            <label key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer hover:border-slate-600">
              <input type="checkbox" checked={checkedSources.has(i)} onChange={() => toggleSource(i)} className="accent-amber-500" />
              <span>{s.flag} {s.name}</span>
              {sourceStatus[i] && <span className="ml-auto text-[10px] text-slate-500">{sourceStatus[i]}</span>}
            </label>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runScrape} disabled={scraping}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {scraping ? '⏳ Scraping...' : '🔍 Run AI Scrape'}
          </button>
          <button onClick={runPaddleGuru} disabled={pgScraping}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {pgScraping ? '⏳ Fetching...' : '🏁 PaddleGuru Direct (98 races)'}
          </button>
        </div>
        {scrapeLog.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mt-3 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-0.5">
            {scrapeLog.map((line, i) => (
              <div key={i} className={line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('❌') || line.startsWith('⚠️') ? 'text-red-400' : 'text-blue-400'}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl">
            <h2 className="text-lg font-bold text-amber-400 mb-4">{editing.id ? `Edit Event #${editing.id}` : '➕ Add Event'}</h2>
            {/* Row 1: Name + Type */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Event Name *</label>
                <input value={editing.name || ''} onChange={e => setField('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Type</label>
                <select value={editing.event_type || 'regatta'} onChange={e => setField('event_type', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select></div>
            </div>
            {/* Row 2: Sports + Level */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Sports (comma-sep)</label>
                <input value={editing.sports || ''} onChange={e => setField('sports', e.target.value)} placeholder="kayak,canoe,sup"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Level</label>
                <select value={editing.level || 'national'} onChange={e => setField('level', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
            </div>
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Start Date</label>
                <input type="date" value={(editing.start_date || '').substring(0, 10)} onChange={e => setField('start_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">End Date</label>
                <input type="date" value={(editing.end_date || '').substring(0, 10)} onChange={e => setField('end_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
            </div>
            {/* Location */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Venue</label>
                <input value={editing.venue || ''} onChange={e => setField('venue', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">City</label>
                <input value={editing.city || ''} onChange={e => setField('city', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">State / Province</label>
                <input value={editing.state || ''} onChange={e => setField('state', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Country</label>
                <input value={editing.country || ''} onChange={e => setField('country', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
            </div>
            {/* Organizer + Website */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Organizer</label>
                <input value={editing.organizer || ''} onChange={e => setField('organizer', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Website</label>
                <input value={editing.website || ''} onChange={e => setField('website', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
            </div>
            {/* Registration + Featured */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Registration</label>
                <select value={editing.registration_status || 'upcoming'} onChange={e => setField('registration_status', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Reg. Deadline</label>
                <input type="date" value={(editing.registration_deadline || '').substring(0, 10)} onChange={e => setField('registration_deadline', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Featured</label>
                <select value={String(editing.featured || 0)} onChange={e => setField('featured', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  <option value="0">No</option><option value="1">Yes ⭐</option>
                </select></div>
            </div>
            {/* Description */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <textarea value={editing.description || ''} onChange={e => setField('description', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-amber-500 min-h-[60px]" />
            </div>
            {editing.source && <p className="text-[10px] text-slate-600 mb-3">Source: {editing.source}</p>}
            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
              {editing.id && (
                <button onClick={deleteEvent} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg">🗑 Delete</button>
              )}
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={saveEvent} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg">💾 Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 ${toastErr ? 'bg-red-500' : 'bg-emerald-500'} text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg z-50`}>
          {toast}
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

interface Club {
  id: number; n: string; cl: string; a: string; ci: string; st: string; co: string;
  la: number; lo: number; p: string; e: string; w: string; d: string;
  ct: string; di: string; fe: string; se: string; fb: string; ig: string;
  gr: number; gc: number; yp: string; mp: string; ol: string; al: string;
  featured: number; source: string;
}

const API_TOKEN = 'pp-clubs-7742-v1';
const PER_PAGE = 50;
const CLASSIFICATIONS = ['club','federation','association','organization','school','unverified'];
const YES_NO = [['','Unknown'],['True','Yes'],['False','No']];

function Input({ label, field, type = 'text', placeholder = '', editing, setField }: {
  label: string; field: string; type?: string; placeholder?: string;
  editing: Partial<Club> | null; setField: (key: string, val: string | number) => void;
}) {
  return (
    <div><label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input type={type} value={(editing as any)?.[field] || ''} onChange={e => setField(field, e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
  );
}

export default function ClubsAdmin() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortCol, setSortCol] = useState('n');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Club> | null>(null);
  const [toast, setToast] = useState('');

  const loadClubs = useCallback(async () => {
    try { const res = await fetch('/api/clubs', { headers: { 'X-API-Token': API_TOKEN } }); setClubs(await res.json()); } catch { setClubs([]); }
  }, []);
  useEffect(() => { loadClubs(); }, [loadClubs]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const handleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
  const setField = (key: string, val: string | number) => setEditing(prev => prev ? { ...prev, [key]: val } : null);

  const countries = useMemo(() => [...new Set(clubs.map(c => c.co).filter(Boolean))].sort(), [clubs]);

  const filtered = useMemo(() => {
    let f = clubs.filter(c => {
      if (countryFilter && c.co !== countryFilter) return false;
      if (search) {
        const h = [c.n, c.ci, c.st, c.co, c.ct].join(' ').toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    f.sort((a, b) => {
      const av = ((a as any)[sortCol] || '').toString().toLowerCase();
      const bv = ((b as any)[sortCol] || '').toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return f;
  }, [clubs, search, countryFilter, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageData = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const saveClub = async () => {
    if (!editing?.n) { alert('Club name required'); return; }
    const data: any = { ...editing };
    if (data.id) data.id = Number(data.id);
    try {
      const res = await fetch('/api/save-club', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.error) { alert(r.error); return; }
      setEditing(null); showToast(data.id ? 'Club updated' : 'Club added'); loadClubs();
    } catch (e: any) { alert('Save failed: ' + e.message); }
  };

  const deleteClub = async () => {
    if (!editing?.id || !confirm(`Delete "${editing.n}"?`)) return;
    try {
      await fetch('/api/save-club', { method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
        body: JSON.stringify({ id: Number(editing.id) }) });
      setEditing(null); showToast('Club deleted'); loadClubs();
    } catch { alert('Delete failed'); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">🛶 Clubs</h2>
          <p className="text-xs text-slate-500">{clubs.length} clubs · {countries.length} countries</p>
        </div>
        <button onClick={() => setEditing({ cl: 'club', co: 'United States' })} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg">➕ Add Club</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search name, city, craft..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500" />
        <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-500 mb-2">Showing {filtered.length} of {clubs.length}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-900/50">
            {[['n','Name'],['ci','City'],['co','Country'],['ct','Craft Types'],['gr','Rating']].map(([col, label]) => (
              <th key={col} onClick={() => handleSort(col)} className="text-left px-3 py-2.5 text-slate-400 font-semibold cursor-pointer hover:text-white text-xs">
                {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}</th>
            ))}
            <th className="text-left px-3 py-2.5 text-slate-400 font-semibold text-xs w-12">Edit</th>
          </tr></thead>
          <tbody>
            {pageData.map(c => (
              <tr key={c.id} className="border-t border-slate-800/50 hover:bg-slate-900/50 cursor-pointer" onClick={() => setEditing({ ...c })}>
                <td className="px-3 py-1.5 text-white text-xs font-medium">{c.n}</td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{c.ci || '—'}</td>
                <td className="px-3 py-1.5 text-slate-400 text-xs">{c.co || '—'}</td>
                <td className="px-3 py-1.5">{(c.ct||'').split(',').filter(Boolean).slice(0,3).map(t =>
                  <span key={t} className="inline-block bg-cyan-500/10 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded mr-0.5">{t.trim()}</span>
                )}</td>
                <td className="px-3 py-1.5 text-amber-400 text-xs">{c.gr ? `${c.gr}⭐` : '—'}</td>
                <td className="px-3 py-1.5">
                  <button onClick={e => { e.stopPropagation(); setEditing({ ...c }); }}
                    className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] rounded">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3 text-sm text-slate-500">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">← Prev</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={(page + 1) >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">Next →</button>
      </div>

      {/* Edit/Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl">
            <h2 className="text-lg font-bold text-cyan-400 mb-4">{editing.id ? `Edit: ${editing.n}` : '➕ Add Club'}</h2>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Club Name *" field="n" editing={editing} setField={setField} />
              <div><label className="text-xs text-slate-400 mb-1 block">Classification</label>
                <select value={editing.cl || 'club'} onChange={e => setField('cl', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Address" field="a" editing={editing} setField={setField} /><Input label="City" field="ci" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="State" field="st" editing={editing} setField={setField} /><Input label="Country" field="co" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Latitude" field="la" type="number" editing={editing} setField={setField} /><Input label="Longitude" field="lo" type="number" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Phone" field="p" editing={editing} setField={setField} /><Input label="Email" field="e" editing={editing} setField={setField} /></div>
            <Input label="Website" field="w" placeholder="https://..." editing={editing} setField={setField} />
            <div className="mt-3"><label className="text-xs text-slate-400 mb-1 block">Description</label>
              <textarea value={editing.d || ''} onChange={e => setField('d', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none min-h-[50px]" /></div>
            <div className="grid grid-cols-2 gap-3 mt-3 mb-3"><Input label="Craft Types" field="ct" placeholder="kayak,canoe,sup" editing={editing} setField={setField} /><Input label="Disciplines" field="di" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Federation" field="fe" editing={editing} setField={setField} /><Input label="Season" field="se" placeholder="year-round" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Facebook" field="fb" editing={editing} setField={setField} /><Input label="Instagram" field="ig" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3"><Input label="Google Rating" field="gr" type="number" editing={editing} setField={setField} /><Input label="Google Reviews" field="gc" type="number" editing={editing} setField={setField} /></div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[['yp','Youth Program'],['mp','Masters Program'],['ol','Offers Lessons']].map(([f, l]) => (
                <div key={f}><label className="text-xs text-slate-400 mb-1 block">{l}</label>
                  <select value={(editing as any)[f] || ''} onChange={e => setField(f, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                    {YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
              {editing.id && <button onClick={deleteClub} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg">🗑 Delete</button>}
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={saveClub} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg">💾 Save</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg z-50">{toast}</div>}
    </div>
  );
}

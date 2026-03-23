'use client';
import { useState, useMemo } from 'react';

interface Federation {
  id: number; name: string; country: string; ioc_code: string; continent: string;
  website: string; logo_url: string; federation_type: string;
}

export function FederationsList({ federations }: { federations: Federation[] }) {
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('');
  const continents = useMemo(() => [...new Set(federations.map(f => f.continent).filter(Boolean))].sort(), [federations]);

  const filtered = useMemo(() => {
    return federations.filter(f => {
      if (search && !`${f.country} ${f.name} ${f.ioc_code}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (continent && f.continent !== continent) return false;
      return true;
    });
  }, [federations, search, continent]);

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input type="text" placeholder="Search country or federation..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400" />
        <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm" value={continent} onChange={e => setContinent(e.target.value)}>
          <option value="">All Continents</option>
          {continents.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="bg-emerald-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">{filtered.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(f => (
          <a key={f.id} href={f.website || '#'} target="_blank" rel="noopener noreferrer"
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 no-underline hover:shadow-md transition-shadow">
            {f.logo_url ? (
              <img src={f.logo_url} alt={f.country} className="w-8 h-8 rounded-md object-contain" referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
            ) : null}
            {(!f.logo_url || true) && (
              <span className={`w-8 h-8 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold ${f.logo_url ? 'hidden' : ''}`}>
                {f.ioc_code || f.country?.substring(0, 3).toUpperCase()}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-slate-800 truncate">{f.country}</h4>
              <p className="text-xs text-slate-400 truncate">{f.name}</p>
            </div>
            <span className="text-slate-300">→</span>
          </a>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-slate-400 py-8">No federations match your search.</p>}
    </>
  );
}

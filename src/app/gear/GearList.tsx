'use client';
import { useState, useMemo } from 'react';

interface Brand {
  id: number; name: string; categories: string; country: string; website: string;
  email: string; phone: string; description: string; popular_products: string;
  logo_url: string; facebook_url: string; instagram_url: string; distributors: string;
}

const TABS = ['All','SUP','Surfski','Sprint Kayak','Canoe','Outrigger',"Va'a",'Kayak','Paddles','PFDs'];

export function GearList({ brands }: { brands: Brand[] }) {
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Brand | null>(null);

  const filtered = useMemo(() => {
    return brands.filter(b => {
      if (tab !== 'All' && !b.categories?.toLowerCase().includes(tab.toLowerCase())) return false;
      if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [brands, tab, search]);

  return (
    <>
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Search + Count */}
      <div className="flex items-center gap-3 mb-6">
        <input type="text" placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400" />
        <span className="bg-emerald-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">{filtered.length}</span>
      </div>

      {/* Brand Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(brand => (
          <div key={brand.id} onClick={() => setSelected(brand)}
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded-lg object-contain bg-slate-100 p-0.5" referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                {brand.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm">{brand.name}</h3>
              <p className="text-xs text-slate-400">{brand.country}</p>
              {brand.categories && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {brand.categories.split(',').map(c => c.trim()).filter(Boolean).slice(0, 3).map(c => (
                    <span key={c} className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-slate-300 text-lg">→</span>
          </div>
        ))}
      </div>

      {/* Detail Popup */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {selected.logo_url && <img src={selected.logo_url} alt="" className="w-14 h-14 rounded-xl object-contain bg-slate-100 p-1" referrerPolicy="no-referrer" />}
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selected.name}</h3>
                  <p className="text-sm text-slate-400">{selected.country}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            {selected.description && <p className="text-sm text-slate-600 leading-relaxed mb-4">{selected.description}</p>}
            {selected.popular_products && (
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-700 mb-2">Product lineup</h4>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  {selected.popular_products.split('|').map(p => p.trim()).filter(Boolean).map((p, i) => {
                    const [name, ...desc] = p.split('—');
                    return <p key={i} className="text-sm"><strong>{name.trim()}</strong>{desc.length > 0 && ` — ${desc.join('—').trim()}`}</p>;
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 italic">Featured models — visit their site for the full catalog</p>
              </div>
            )}
            {selected.categories && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selected.categories.split(',').map(c => (
                  <span key={c} className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{c.trim()}</span>
                ))}
              </div>
            )}
            <div className="space-y-2 text-sm">
              {selected.website && <a href={selected.website} target="_blank" rel="noopener noreferrer" className="block text-emerald-600 hover:underline">🌐 {selected.website.replace(/https?:\/\//, '').replace(/\/$/, '')}</a>}
              {selected.email && <p>✉️ {selected.email}</p>}
              {selected.facebook_url && <a href={selected.facebook_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">Facebook →</a>}
              {selected.instagram_url && <a href={selected.instagram_url} target="_blank" rel="noopener noreferrer" className="block text-pink-500 hover:underline">Instagram →</a>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

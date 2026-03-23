'use client';
import { useState, useMemo } from 'react';

interface Federation {
  id: number; name: string; country: string; continent: string;
  federation_type: string; website: string; email: string; phone: string;
  sports: string; description: string; ioc_code: string;
  city: string; state: string; president: string; founded_year: string;
  facebook_url: string; instagram_url: string; logo_url: string;
}

const TYPES = ['national','continental','international','association','organization'];
const CONTINENTS = ['Africa','Asia','Europe','North America','Oceania','South America'];

const EMPTY: Partial<Federation> = {
  name:'', country:'', continent:'', federation_type:'national',
  website:'', email:'', phone:'', sports:'', description:'',
  ioc_code:'', city:'', state:'', president:'', founded_year:'',
  facebook_url:'', instagram_url:'', logo_url:'',
};

export function FederationsAdmin({ initialData }: { initialData: Federation[] }) {
  const [feds, setFeds] = useState<Federation[]>(initialData);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Partial<Federation> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const filtered = useMemo(() => {
    return feds.filter(f => {
      if (typeFilter && f.federation_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.name?.toLowerCase().includes(q) || f.country?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [feds, search, typeFilter]);

  const handleSave = async () => {
    if (!editing?.name) { setMsg('Name is required'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/save-federation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (data.success) {
        if (editing.id) {
          setFeds(prev => prev.map(f => f.id === editing.id ? { ...f, ...editing } as Federation : f));
        } else {
          setFeds(prev => [...prev, { ...editing, id: data.id } as Federation].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setEditing(null); setMsg('');
      } else { setMsg(data.error || 'Save failed'); }
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await fetch('/api/save-federation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      setFeds(prev => prev.filter(f => f.id !== id));
    } catch (e: any) { alert('Delete failed: ' + e.message); }
  };

  const typeBadge = (t: string) => {
    const colors: Record<string,string> = {
      national:'text-blue-400 bg-blue-500/10', continental:'text-purple-400 bg-purple-500/10',
      international:'text-amber-400 bg-amber-500/10', association:'text-emerald-400 bg-emerald-500/10',
      organization:'text-cyan-400 bg-cyan-500/10',
    };
    return colors[t] || 'text-slate-400 bg-slate-500/10';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">🏛️ Federations & Associations ({feds.length})</h2>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg transition-colors">
          + Add New
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or country..."
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-cyan-500" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="text-xs text-slate-500 px-4 py-2 border-b border-slate-800">
          Showing {filtered.length} of {feds.length}
        </div>
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-700 text-slate-400 text-left text-xs">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 w-32">Country</th>
                <th className="px-3 py-2 w-28">Type</th>
                <th className="px-3 py-2 w-28">Sports</th>
                <th className="px-3 py-2 w-40">Website</th>
                <th className="px-3 py-2 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-600 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-white text-xs">{f.name}</td>
                  <td className="px-3 py-2 text-xs">{f.country || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadge(f.federation_type)}`}>
                      {f.federation_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{f.sports || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {f.website ? <a href={f.website} target="_blank" className="text-cyan-400 hover:underline truncate block max-w-[140px]">{f.website.replace(/https?:\/\//, '').replace(/\/$/,'')}</a> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing({ ...f })} className="text-blue-400 hover:text-blue-300 text-xs mr-2">Edit</button>
                    <button onClick={() => handleDelete(f.id, f.name)} className="text-red-400 hover:text-red-300 text-xs">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[90%] max-w-[600px] max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{editing.id ? 'Edit' : 'Add'} Federation / Association</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              <Field label="Name *" value={editing.name} onChange={v => setEditing({...editing, name: v})} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country" value={editing.country} onChange={v => setEditing({...editing, country: v})} />
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Type</label>
                  <select value={editing.federation_type || 'national'} onChange={e => setEditing({...editing, federation_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Continent</label>
                  <select value={editing.continent || ''} onChange={e => setEditing({...editing, continent: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none">
                    <option value="">—</option>
                    {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Field label="IOC Code" value={editing.ioc_code} onChange={v => setEditing({...editing, ioc_code: v})} />
              </div>
              <Field label="Website" value={editing.website} onChange={v => setEditing({...editing, website: v})} placeholder="https://" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={editing.email} onChange={v => setEditing({...editing, email: v})} />
                <Field label="Phone" value={editing.phone} onChange={v => setEditing({...editing, phone: v})} />
              </div>
              <Field label="Sports" value={editing.sports} onChange={v => setEditing({...editing, sports: v})} placeholder="kayak, canoe, sup, outrigger..." />
              <div className="grid grid-cols-2 gap-3">
                <Field label="President" value={editing.president} onChange={v => setEditing({...editing, president: v})} />
                <Field label="Founded Year" value={editing.founded_year} onChange={v => setEditing({...editing, founded_year: v})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={editing.city} onChange={v => setEditing({...editing, city: v})} />
                <Field label="State" value={editing.state} onChange={v => setEditing({...editing, state: v})} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <textarea value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})}
                  rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Facebook URL" value={editing.facebook_url} onChange={v => setEditing({...editing, facebook_url: v})} />
                <Field label="Instagram URL" value={editing.instagram_url} onChange={v => setEditing({...editing, instagram_url: v})} />
              </div>
            </div>
            {msg && <p className="text-red-400 text-sm mt-2">{msg}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition-colors">
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Federation'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-cyan-500" />
    </div>
  );
}

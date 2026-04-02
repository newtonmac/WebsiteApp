'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

interface Brand {
  id: number; name: string; categories: string; brand_type: string;
  product_types: string; country: string; city: string; website: string;
  email: string; phone: string; address: string; description: string;
  popular_products: string; year_founded: string; logo_url: string;
  facebook_url: string; instagram_url: string; youtube_url: string;
  distributors: string; featured: number;
}

interface Distributor { name: string; website: string; facebook: string; instagram: string; }

const API_TOKEN = 'pp-clubs-7742-v1';
const PER_PAGE = 50;
const CATEGORIES = ['SUP','surfski','sprint kayak','canoe','outrigger',"va'a",'kayak','paddles','PFD','ocean racing','clothing','accessories'];
const EMPTY_BRAND: Partial<Brand> = { brand_type: 'manufacturer' };

export default function GearAdmin() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [toast, setToast] = useState('');

  // Load brands
  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/gear-brands', { headers: { 'X-API-Token': API_TOKEN } });
      setBrands(await res.json());
    } catch { setBrands([]); }
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  // Toast helper
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Filtered + sorted
  const filtered = useMemo(() => {
    let f = brands.filter(b => {
      if (search && !b.name.toLowerCase().includes(search.toLowerCase()) &&
          !(b.country || '').toLowerCase().includes(search.toLowerCase()) &&
          !(b.categories || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && !(b.categories || '').toLowerCase().includes(catFilter.toLowerCase())) return false;
      return true;
    });
    f.sort((a, b) => {
      const va = ((a as any)[sortCol] || '').toString().toLowerCase();
      const vb = ((b as any)[sortCol] || '').toString().toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return f;
  }, [brands, search, catFilter, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageData = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Sort
  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  // Edit helpers
  const setField = (key: string, val: string) => setEditing(prev => prev ? { ...prev, [key]: val } : null);
  const openEdit = (b: Brand) => {
    setEditing({ ...b });
    try { setDistributors(JSON.parse(b.distributors || '[]')); } catch { setDistributors([]); }
  };
  const openAdd = () => { setEditing({ ...EMPTY_BRAND }); setDistributors([]); };
  const closeEdit = () => setEditing(null);

  // Save
  const saveBrand = async (data?: Partial<Brand>) => {
    const d = data || editing;
    if (!d || !d.name) return;
    const payload = { ...d, distributors: JSON.stringify(distributors) };
    if (payload.id) payload.id = Number(payload.id);
    try {
      const res = await fetch('/api/save-gear-brand', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
        body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (r.error) { alert(r.error); return; }
      if (!data) closeEdit();
      showToast(d.id ? 'Brand updated' : 'Brand added');
      loadBrands();
    } catch (e: any) { alert('Save failed: ' + e.message); }
  };

  // Delete
  const deleteBrand = async () => {
    if (!editing?.id || !confirm(`Delete "${editing.name}"?`)) return;
    try {
      await fetch('/api/save-gear-brand', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
        body: JSON.stringify({ id: Number(editing.id) }),
      });
      closeEdit(); showToast('Brand deleted'); loadBrands();
    } catch { alert('Delete failed'); }
  };

  // Enrich
  const enrichBrand = async () => {
    if (!editing?.website) { alert('Website URL required'); return; }
    setEnriching(true);
    try {
      const res = await fetch('/api/enrich-gear-brand', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-API-Token': API_TOKEN },
        body: JSON.stringify({
          name: editing.name, website: editing.website,
          categories: editing.categories,
          facebook_url: editing.facebook_url, instagram_url: editing.instagram_url,
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      // Always overwrite description + products, fill-if-empty for contact
      const updated = { ...editing };
      if (data.description) updated.description = data.description;
      if (data.popular_products) updated.popular_products = data.popular_products;
      if (!updated.logo_url && data.logo_url) updated.logo_url = data.logo_url;
      if (!updated.email && data.email) updated.email = data.email;
      if (!updated.phone && data.phone) updated.phone = data.phone;
      if (!updated.facebook_url && data.facebook_url) updated.facebook_url = data.facebook_url;
      if (!updated.instagram_url && data.instagram_url) updated.instagram_url = data.instagram_url;
      if (data.youtube_url && !updated.youtube_url) (updated as any).youtube_url = data.youtube_url;
      setEditing(updated);
      // Auto-save
      await saveBrand(updated);
      showToast('Enriched & saved!' + (data.popular_products ? ' Products found.' : ''));
    } catch (e: any) { alert('Enrich failed: ' + e.message); }
    finally { setEnriching(false); }
  };

  // Distributor helpers
  const addDist = () => { if (distributors.length < 4) setDistributors([...distributors, { name: '', website: '', facebook: '', instagram: '' }]); };
  const removeDist = (i: number) => setDistributors(distributors.filter((_, j) => j !== i));
  const setDist = (i: number, key: string, val: string) => {
    const d = [...distributors]; (d[i] as any)[key] = val; setDistributors(d);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">🎯 Gear Brands</h2>
          <p className="text-sm text-slate-500">{brands.length} brands in database</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors">
          ➕ Add Brand
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name, country, category..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500" />
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-2">
        Showing {page * PER_PAGE + 1}-{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold w-10">#</th>
              {[['name','Name'],['country','Country'],['categories','Categories']].map(([col, label]) => (
                <th key={col} onClick={() => handleSort(col)}
                  className="text-left px-3 py-2.5 text-slate-400 font-semibold cursor-pointer hover:text-white transition-colors">
                  {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}
                </th>
              ))}
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">Website</th>
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">Products</th>
              <th className="text-left px-3 py-2.5 text-slate-400 font-semibold w-16">Edit</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((b, i) => (
              <tr key={b.id} className="border-t border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                <td className="px-3 py-2 text-slate-600">{page * PER_PAGE + i + 1}</td>
                <td className="px-3 py-2 font-medium text-white">{b.name}</td>
                <td className="px-3 py-2 text-slate-400">{b.country || '—'}</td>
                <td className="px-3 py-2">
                  {(b.categories || '').split(',').filter(Boolean).map(c => (
                    <span key={c} className="inline-block bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded mr-1">{c.trim()}</span>
                  ))}
                </td>
                <td className="px-3 py-2">
                  {b.website ? <a href={b.website} target="_blank" rel="noopener" className="text-cyan-400 text-xs hover:underline">{b.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 25)}</a> : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{b.popular_products ? '✅' : '—'}</td>
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(b)} className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 mt-3 text-sm text-slate-500">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}
          className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">← Prev</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={(page + 1) >= totalPages} onClick={() => setPage(page + 1)}
          className="px-3 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-30">Next →</button>
      </div>

      {/* Edit/Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeEdit(); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">{editing.id ? `Edit: ${editing.name}` : '➕ Add New Brand'}</h2>

            {/* Name + Country */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Brand Name *</label>
                <input value={editing.name || ''} onChange={e => setField('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Country</label>
                <input value={editing.country || ''} onChange={e => setField('country', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>

            {/* Categories */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Categories</label>
              <input value={editing.categories || ''} onChange={e => setField('categories', e.target.value)}
                placeholder="SUP, surfski, sprint kayak, canoe, outrigger, kayak, paddles, clothing..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
            </div>

            {/* Type + Year + Products */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Brand Type</label>
                <select value={editing.brand_type || 'manufacturer'} onChange={e => setField('brand_type', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                  <option value="manufacturer">Manufacturer</option><option value="retailer">Retailer</option><option value="distributor">Distributor</option>
                </select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Founded Year</label>
                <input value={editing.year_founded || ''} onChange={e => setField('year_founded', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Product Types</label>
                <input value={editing.product_types || ''} onChange={e => setField('product_types', e.target.value)}
                  placeholder="watercraft, paddles, clothing..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>

            {/* Website + Email */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Website</label>
                <input value={editing.website || ''} onChange={e => setField('website', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input value={editing.email || ''} onChange={e => setField('email', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>

            {/* Phone + City */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Phone</label>
                <input value={editing.phone || ''} onChange={e => setField('phone', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">City</label>
                <input value={editing.city || ''} onChange={e => setField('city', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>

            {/* Social */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Facebook</label>
                <input value={editing.facebook_url || ''} onChange={e => setField('facebook_url', e.target.value)} placeholder="https://facebook.com/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Instagram</label>
                <input value={editing.instagram_url || ''} onChange={e => setField('instagram_url', e.target.value)} placeholder="https://instagram.com/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">YouTube</label>
                <input value={(editing as any).youtube_url || ''} onChange={e => setField('youtube_url', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Logo URL</label>
                <input value={editing.logo_url || ''} onChange={e => setField('logo_url', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" /></div>
            </div>

            {/* Products + Description */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Popular Products</label>
              <textarea value={editing.popular_products || ''} onChange={e => setField('popular_products', e.target.value)}
                placeholder="Product — description | Product — description"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500 min-h-[60px]" />
            </div>
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <textarea value={editing.description || ''} onChange={e => setField('description', e.target.value)}
                placeholder="Brand story, specialties..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500 min-h-[60px]" />
            </div>

            {/* Distributors */}
            <div className="border-t border-slate-700 pt-4 mt-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">📦 Distributors</h3>
              {distributors.map((d, i) => (
                <div key={i} className="bg-slate-950 border border-slate-700 rounded-lg p-3 mb-2 relative">
                  <button onClick={() => removeDist(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs">✕</button>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={d.name} onChange={e => setDist(i, 'name', e.target.value)} placeholder="Company name"
                      className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none" />
                    <input value={d.website} onChange={e => setDist(i, 'website', e.target.value)} placeholder="Website"
                      className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none" />
                  </div>
                </div>
              ))}
              {distributors.length < 4 && (
                <button onClick={addDist} className="text-xs text-cyan-400 hover:text-cyan-300 mt-1">+ Add Distributor</button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
              {editing.id && (
                <button onClick={deleteBrand} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
                  🗑️ Delete
                </button>
              )}
              <button onClick={enrichBrand} disabled={enriching}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {enriching ? '⏳ Enriching...' : '🔍 Enrich'}
              </button>
              <button onClick={closeEdit} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => saveBrand()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
                💾 Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}
    </div>
  );
}

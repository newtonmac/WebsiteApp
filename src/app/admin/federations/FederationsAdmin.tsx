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
  const [continentFilter, setContinentFilter] = useState('');
  const [editing, setEditing] = useState<Partial<Federation> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const filtered = useMemo(() => {
    return feds.filter(f => {
      if (typeFilter && f.federation_type !== typeFilter) return false;
      if (continentFilter && f.continent !== continentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.name?.toLowerCase().includes(q) || f.country?.toLowerCase().includes(q) || f.sports?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [feds, search, typeFilter, continentFilter]);

  // Stats for header
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    feds.forEach(f => { counts[f.federation_type] = (counts[f.federation_type] || 0) + 1; });
    return counts;
  }, [feds]);

  const handleSave = async () => {
    if (!editing?.name) { setMsg('Name is required'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/save-federation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (data.success) {
        if (editing.id) {
          setFeds(prev => prev.map(f => f.id === editing.id ? { ...f, ...editing } as Federation : f));
        } else {
          setFeds(prev => [...prev, { ...editing, id: data.id } as Federation].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setEditing(null);
      } else { setMsg(data.error || 'Save failed'); }
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await fetch('/api/save-federation', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id }),
      });
      setFeds(prev => prev.filter(f => f.id !== id));
    } catch (e: any) { alert('Delete failed: ' + e.message); }
  };

  const handleReset = () => { setSearch(''); setTypeFilter(''); setContinentFilter(''); };

  return (
    <div style={{ background:'#0f1117', color:'#e1e4e8', minHeight:'100vh', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' }}>
      {/* Header — matches clubs/events admin */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #2d3040' }}>
        <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>
          <span style={{ color:'#f59e0b' }}>🏛️ PaddlePoint Federations Admin</span>
        </h1>
        <div style={{ fontSize:13, color:'#8b8fa3' }}>
          Total: <strong style={{ color:'#e1e4e8' }}>{feds.length}</strong>
          {Object.entries(stats).map(([k, v]) => (
            <span key={k}> · {k}: <strong style={{ color:'#e1e4e8' }}>{v}</strong></span>
          ))}
        </div>
      </div>

      {/* Search row — matches clubs/events admin */}
      <div style={{ padding:'16px 20px', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, country, sport, organizer..."
          style={{ flex:1, minWidth:200, padding:'10px 14px', background:'#1a1d28', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:14, outline:'none' }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding:'10px 14px', background:'#1a1d28', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:13, minWidth:130 }}>
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={continentFilter} onChange={e => setContinentFilter(e.target.value)}
          style={{ padding:'10px 14px', background:'#1a1d28', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:13, minWidth:140 }}>
          <option value="">All Continents</option>
          {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => {}} style={{ padding:'10px 20px', background:'#22c55e', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>🔍 Search</button>
        <button onClick={handleReset} style={{ padding:'10px 20px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>↺ Reset</button>
        <button onClick={() => setEditing({ ...EMPTY })} style={{ padding:'10px 20px', background:'#8b5cf6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add Federation</button>
        <a href="/federations" style={{ padding:'10px 20px', background:'#374151', color:'#9ca3af', border:'none', borderRadius:8, fontSize:13, fontWeight:500, textDecoration:'none' }}>← Public Page</a>
      </div>

      {/* Count */}
      <div style={{ padding:'0 20px 8px', fontSize:13, color:'#6b7080' }}>Showing {filtered.length} of {feds.length} federations</div>

      {/* Table — matches clubs/events admin */}
      <div style={{ margin:'0 20px', border:'1px solid #2d3040', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2d3040', background:'#1a1d28' }}>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:40 }}>#</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500 }}>Name ↕</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:140 }}>Country</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:120 }}>Continent</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:120 }}>Type</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:140 }}>Sports</th>
              <th style={{ padding:'10px 12px', textAlign:'left', color:'#6b7080', fontWeight:500, width:180 }}>Website</th>
              <th style={{ padding:'10px 12px', textAlign:'right', color:'#6b7080', fontWeight:500, width:80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={f.id} style={{ borderBottom:'1px solid #1a1d28' }}
                onMouseEnter={e => (e.currentTarget.style.background='#1a1d28')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <td style={{ padding:'8px 12px', color:'#6b7080' }}>{i + 1}</td>
                <td style={{ padding:'8px 12px', color:'#e1e4e8', fontWeight:500 }}>
                  <span style={{ cursor:'pointer' }} onClick={() => setEditing({ ...f })}>{f.name}</span>
                </td>
                <td style={{ padding:'8px 12px', color:'#8b8fa3' }}>{f.country || '—'}</td>
                <td style={{ padding:'8px 12px', color:'#8b8fa3' }}>{f.continent || '—'}</td>
                <td style={{ padding:'8px 12px' }}>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background: f.federation_type==='national'?'rgba(59,130,246,0.15)':f.federation_type==='continental'?'rgba(139,92,246,0.15)':f.federation_type==='international'?'rgba(245,158,11,0.15)':f.federation_type==='association'?'rgba(34,197,94,0.15)':'rgba(6,182,212,0.15)', color: f.federation_type==='national'?'#60a5fa':f.federation_type==='continental'?'#a78bfa':f.federation_type==='international'?'#fbbf24':f.federation_type==='association'?'#4ade80':'#22d3ee' }}>
                    {f.federation_type}
                  </span>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  {f.sports ? f.sports.split(',').slice(0, 3).map(s => (
                    <span key={s} style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(6,182,212,0.1)', color:'#22d3ee', marginRight:4 }}>{s.trim()}</span>
                  )) : <span style={{ color:'#4b5563' }}>—</span>}
                </td>
                <td style={{ padding:'8px 12px' }}>
                  {f.website ? <a href={f.website} target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa', textDecoration:'none', fontSize:12 }}>{f.website.replace(/https?:\/\//,'').replace(/\/$/,'').substring(0,25)}</a> : <span style={{ color:'#4b5563' }}>—</span>}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'right' }}>
                  <button onClick={() => setEditing({ ...f })} style={{ background:'#22c55e', color:'#fff', border:'none', padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', marginRight:4 }}>Edit</button>
                  <button onClick={() => handleDelete(f.id, f.name)} style={{ background:'#ef4444', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6, fontSize:12, cursor:'pointer' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Modal */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
          <div style={{ background:'#1a1d28', border:'1px solid #2d3040', borderRadius:20, padding:28, width:'90%', maxWidth:520, maxHeight:'80vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => setEditing(null)} style={{ position:'absolute', top:14, right:14, background:'none', border:'none', color:'#6b7080', fontSize:20, cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#f59e0b', marginBottom:16 }}>{editing.id ? '✏️ Edit Federation' : '➕ Add Federation'}</h2>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <Inp label="Name *" value={editing.name} onChange={v => setEditing({...editing, name:v})} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Inp label="Country" value={editing.country} onChange={v => setEditing({...editing, country:v})} />
                <Sel label="Type" value={editing.federation_type||'national'} options={TYPES} onChange={v => setEditing({...editing, federation_type:v})} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Sel label="Continent" value={editing.continent||''} options={['', ...CONTINENTS]} onChange={v => setEditing({...editing, continent:v})} />
                <Inp label="IOC Code" value={editing.ioc_code} onChange={v => setEditing({...editing, ioc_code:v})} />
              </div>
              <Inp label="Website" value={editing.website} onChange={v => setEditing({...editing, website:v})} placeholder="https://" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Inp label="Email" value={editing.email} onChange={v => setEditing({...editing, email:v})} />
                <Inp label="Phone" value={editing.phone} onChange={v => setEditing({...editing, phone:v})} />
              </div>
              <Inp label="Sports" value={editing.sports} onChange={v => setEditing({...editing, sports:v})} placeholder="kayak, canoe, sup, outrigger..." />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Inp label="President" value={editing.president} onChange={v => setEditing({...editing, president:v})} />
                <Inp label="Founded Year" value={editing.founded_year} onChange={v => setEditing({...editing, founded_year:v})} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Inp label="City" value={editing.city} onChange={v => setEditing({...editing, city:v})} />
                <Inp label="State" value={editing.state} onChange={v => setEditing({...editing, state:v})} />
              </div>
              <div>
                <label style={{ fontSize:12, color:'#6b7080', display:'block', marginBottom:4 }}>Description</label>
                <textarea value={editing.description||''} onChange={e => setEditing({...editing, description:e.target.value})} rows={3}
                  style={{ width:'100%', padding:'8px 12px', background:'#0f1117', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:13, outline:'none', resize:'none' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Inp label="Facebook URL" value={editing.facebook_url} onChange={v => setEditing({...editing, facebook_url:v})} />
                <Inp label="Instagram URL" value={editing.instagram_url} onChange={v => setEditing({...editing, instagram_url:v})} />
              </div>
            </div>

            {msg && <p style={{ color:'#ef4444', fontSize:13, marginTop:10 }}>{msg}</p>}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex:1, padding:'10px 0', background:'#22c55e', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', opacity:saving?0.5:1 }}>
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Federation'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{ padding:'10px 24px', background:'#374151', color:'#9ca3af', border:'none', borderRadius:8, fontSize:14, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Inp({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize:12, color:'#6b7080', display:'block', marginBottom:4 }}>{label}</label>
      <input value={value||''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'8px 12px', background:'#0f1117', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:13, outline:'none' }} />
    </div>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize:12, color:'#6b7080', display:'block', marginBottom:4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'8px 12px', background:'#0f1117', border:'1px solid #2d3040', borderRadius:8, color:'#e1e4e8', fontSize:13, outline:'none' }}>
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );
}

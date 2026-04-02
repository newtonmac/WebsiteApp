'use client';
import { useState, useEffect, useCallback } from 'react';

const UPDATES_API = 'https://updates.newtonmac.workers.dev';
const SUGGEST_API = 'https://suggestions.newtonmac.workers.dev';
const PROXY = '/api/admin-feedback';

interface Suggestion { id: string; title: string; description: string; name: string; email: string; club: string; craft: string; city: string; country: string; notify: boolean; timestamp: string; }
interface Update { id: string; title: string; description: string; status: string; suggestedBy?: string; createdAt: string; updatedAt: string; }

const STATUS_LABELS: Record<string,string> = { planned: 'Planned', in_progress: 'In Progress', completed: 'Done' };
const STATUS_COLORS: Record<string,string> = { planned: 'bg-blue-500/15 text-blue-400', in_progress: 'bg-amber-500/15 text-amber-400', completed: 'bg-emerald-500/15 text-emerald-400' };

export default function FeedbackAdmin() {
  const [tab, setTab] = useState<'suggestions'|'updates'>('suggestions');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [toast, setToast] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addStatus, setAddStatus] = useState('planned');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Proxy helper — all admin actions go through /api/admin-feedback (uses CF_ADMIN_KEY server-side)
  const proxy = async (body: Record<string, any>) => {
    const res = await fetch(PROXY, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
    return res.json();
  };

  // Public reads (no auth needed)
  const loadSuggestions = useCallback(async () => {
    try { const r = await fetch(`${SUGGEST_API}/suggestions`); const d = await r.json(); setSuggestions(d.suggestions || []); } catch { setSuggestions([]); }
  }, []);
  const loadUpdates = useCallback(async () => {
    try { const r = await fetch(`${UPDATES_API}/updates`); const d = await r.json(); setUpdates(d.updates || []); } catch { setUpdates([]); }
  }, []);

  useEffect(() => { loadSuggestions(); loadUpdates(); }, [loadSuggestions, loadUpdates]);

  // Admin actions via proxy
  const approveSuggestion = async (s: Suggestion, status: string) => {
    const title = (document.getElementById(`sug-t-${s.id}`) as HTMLInputElement)?.value || s.title;
    const desc = (document.getElementById(`sug-d-${s.id}`) as HTMLTextAreaElement)?.value || s.description;
    try {
      // Append contact info to description
      const contactInfo = [s.name && 'From: ' + s.name, s.email && 'Email: ' + s.email, s.club && 'Club: ' + s.club, s.craft && 'Craft: ' + s.craft, (s.city || '') + ', ' + (s.country || '')].filter(Boolean).join(' | ');
      const fullDesc = desc + (contactInfo ? '\\n\\nSubmitted by: ' + contactInfo : '');
      await proxy({ action: 'approve', title, description: fullDesc, status, suggestedBy: s.name || s.city });
      await proxy({ action: 'dismiss', id: s.id }).catch(() => {});
      // Optimistically remove from UI (don't rely on KV re-fetch which has eventual consistency)
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      showToast('Approved & moved to Updates'); loadUpdates();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const dismissSuggestion = async (id: string) => {
    if (!confirm('Dismiss this suggestion?')) return;
    try {
      await proxy({ action: 'dismiss', id });
      setSuggestions(prev => prev.filter(x => x.id !== id));
      showToast('Dismissed');
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const addUpdate = async () => {
    if (!addTitle.trim()) return;
    try {
      await proxy({ action: 'add_update', title: addTitle, description: addDesc, status: addStatus });
      setAddTitle(''); setAddDesc(''); setAddStatus('planned');
      showToast('Update added'); loadUpdates();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const changeStatus = async (id: string, status: string) => {
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    try { await proxy({ action: 'change_status', id, status }); }
    catch (e: any) { alert('Failed: ' + e.message); loadUpdates(); }
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm('Delete this update?')) return;
    setUpdates(prev => prev.filter(u => u.id !== id));
    try { await proxy({ action: 'delete_update', id }); showToast('Deleted'); }
    catch (e: any) { alert('Failed: ' + e.message); loadUpdates(); }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-4">💬 Feedback & Updates</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-6 max-w-md border border-slate-800">
        <button onClick={() => setTab('suggestions')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'suggestions' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          Suggestions <span className="ml-1 text-xs bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">{suggestions.length}</span>
        </button>
        <button onClick={() => setTab('updates')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'updates' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          Updates <span className="ml-1 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{updates.length}</span>
        </button>
      </div>

      {/* Suggestions Panel */}
      {tab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 && <p className="text-slate-500 text-sm py-8 text-center">No suggestions yet.</p>}
          {suggestions.map(s => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-2">
                <span>From: <strong className="text-slate-300">{s.name || 'Anonymous'}</strong></span>
                {s.club && <span>Club: <strong className="text-slate-300">{s.club}</strong></span>}
                {s.craft && <span>Craft: <strong className="text-slate-300">{s.craft}</strong></span>}
                <span>{s.city}, {s.country}</span>
                <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                {s.email && <span className="text-cyan-400">✉️ {s.email}{s.notify ? ' · 🔔' : ''}</span>}
              </div>
              {s.email && (
                <a href={`mailto:${s.email}?subject=Re: Your PaddlePoint Feedback&body=${encodeURIComponent('Hi ' + (s.name || 'there') + ',\n\nThanks for your feedback!\n\nRegarding: ' + s.title + '\n\nGuillermo\nPaddlePoint')}`}
                  className="inline-block text-[11px] bg-cyan-600 text-white px-2.5 py-1 rounded mb-2 no-underline hover:bg-cyan-500">✉️ Reply</a>
              )}
              <div className="mb-2">
                <label className="text-[10px] text-slate-500 block mb-1">Title</label>
                <input id={`sug-t-${s.id}`} defaultValue={s.title}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-white outline-none" />
              </div>
              <div className="mb-3">
                <label className="text-[10px] text-slate-500 block mb-1">Description</label>
                <textarea id={`sug-d-${s.id}`} defaultValue={s.description || ''}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-white outline-none min-h-[40px]" />
              </div>
              <div className="flex gap-2 items-center">
                <select id={`sug-s-${s.id}`} defaultValue="planned"
                  className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white">
                  <option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="completed">Done</option>
                </select>
                <button onClick={() => approveSuggestion(s, (document.getElementById(`sug-s-${s.id}`) as HTMLSelectElement)?.value || 'planned')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded">Approve</button>
                <button onClick={() => dismissSuggestion(s.id)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Updates Panel */}
      {tab === 'updates' && (
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-bold text-white mb-3">Add New Update</h3>
            <input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Title *"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none mb-2" />
            <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none min-h-[50px] mb-2" />
            <div className="flex gap-2">
              <select value={addStatus} onChange={e => setAddStatus(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white outline-none">
                <option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="completed">Done</option>
              </select>
              <button onClick={addUpdate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg">Add Update</button>
            </div>
          </div>
          <div className="space-y-2">
            {updates.length === 0 && <p className="text-slate-500 text-sm py-8 text-center">No updates yet.</p>}
            {updates.map(u => (
              <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STATUS_COLORS[u.status] || 'bg-slate-700 text-slate-400'}`}>
                    {STATUS_LABELS[u.status] || u.status}
                  </span>
                  <span className="text-sm font-semibold text-white">{u.title}</span>
                </div>
                {u.description && <p className="text-xs text-slate-400 mb-2">{u.description}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</span>
                  <select value={u.status} onChange={e => changeStatus(u.id, e.target.value)}
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white outline-none">
                    <option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="completed">Done</option>
                  </select>
                  <button onClick={() => deleteUpdate(u.id)}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded hover:bg-red-500/10">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg z-50">{toast}</div>}
    </div>
  );
}

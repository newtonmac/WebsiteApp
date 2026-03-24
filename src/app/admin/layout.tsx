'use client';
import { useState, useEffect } from 'react';
import { AdminContext } from './AdminContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check existing session on load
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'include' })
      .then(r => { setAuthenticated(r.ok); })
      .catch(() => setAuthenticated(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (res.ok) { setAuthenticated(true); setPassword(''); }
      else setError('Wrong password');
    } catch { setError('Login failed'); }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
  };

  // Loading state
  if (authenticated === null) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-400">Checking session...</div>;
  }

  // Login gate
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-amber-400 text-center mb-6">🔐 PaddlePoint Admin</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Admin password" autoFocus
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm mb-4 outline-none focus:border-amber-400" />
          <button type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors">
            Log In
          </button>
          {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
        </form>
      </div>
    );
  }

  // Authenticated layout
  const NAV = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/events', label: 'Events', icon: '🏁' },
    { href: '/admin/clubs', label: 'Clubs', icon: '🛶' },
    { href: '/admin/gear', label: 'Gear', icon: '🎯' },
    { href: '/admin/federations', label: 'Federations', icon: '🏛️' },
    { href: '/admin/feedback', label: 'Feedback & Updates', icon: '💬' },
    { href: '/admin/traffic', label: 'Traffic', icon: '📊' },
  ];

  return (
    <AdminContext.Provider value={{ authenticated, logout: handleLogout }}>
      <div className="flex min-h-screen bg-slate-950">
        {/* Sidebar */}
        <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800">
            <h1 className="text-lg font-bold text-amber-400">PaddlePoint</h1>
            <p className="text-[11px] text-slate-500">Admin Panel</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {NAV.map(({ href, label, icon }) => (
              <a key={href} href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                <span>{icon}</span> {label}
              </a>
            ))}
          </nav>
          <div className="p-3 border-t border-slate-800">
            <a href="/" className="block text-xs text-slate-500 hover:text-slate-300 mb-2">← Back to site</a>
            <button onClick={handleLogout}
              className="w-full text-xs text-slate-500 hover:text-red-400 text-left transition-colors">
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/conditions', label: 'Water' },
  { href: '/weather', label: 'Weather' },
  { href: '/clubs', label: 'Clubs' },
  { href: '/events', label: 'Events' },
  { href: '/gear', label: 'Gear' },
  { href: '/federations', label: 'Federations' },
];

function callWhenReady(fnName: string) {
  const fn = (window as any)[fnName];
  if (fn) { fn(); return; }
  let tries = 0;
  const timer = setInterval(() => {
    const fn = (window as any)[fnName];
    if (fn) { clearInterval(timer); fn(); }
    else if (++tries > 20) { clearInterval(timer); }
  }, 100);
}

const SITE_UPDATES = [
  { date: 'Mar 24', text: 'Gear — AI-powered product extraction from brand websites' },
  { date: 'Mar 24', text: 'Gear enrich — AI scrapes brand sites for products, auto-saves' },
  { date: 'Mar 24', text: 'Gear — Clothing + Accessories tabs, LSKD and Plastex products fixed' },
  { date: 'Mar 24', text: 'Mobile — green changelog dot next to hamburger menu' },
  { date: 'Mar 24', text: 'Footer — Live data popup lists all real-time API sources' },
  { date: 'Mar 24', text: 'Stats page — world visitor map, city breakdown, bar chart' },
  { date: 'Mar 24', text: 'Water body zone filtering — bay vs ocean vs inland scored separately' },
  { date: 'Mar 24', text: 'Cold water safety alerts with USCG, ACA, NCCWS source links' },
  { date: 'Mar 24', text: 'Dry land detection — suggests nearest paddle spots' },
  { date: 'Mar 24', text: 'All legal pages live (About, Privacy, Terms, Safety, FAQ)' },
  { date: 'Mar 24', text: 'Score circles hidden when no monitoring data available' },
  { date: 'Mar 23', text: 'Clubs page — autocomplete search, suggestions, club list panel' },
  { date: 'Mar 23', text: 'Mobile responsive improvements across all pages' },
  { date: 'Mar 23', text: 'Feedback form — email field + notification opt-in' },
  { date: 'Mar 23', text: 'Admin panel with dashboard, federations CRUD, traffic analytics' },
  { date: 'Mar 23', text: 'Server-side authentication for all admin APIs' },
  { date: 'Mar 23', text: 'Events — recently added popup, date corrections' },
  { date: 'Mar 23', text: 'ACA event scraper expanded with new event types' },
  { date: 'Mar 22', text: 'Full Next.js migration — all 7 pages converted from static HTML' },
  { date: 'Mar 22', text: 'SEO foundation — metadata, Open Graph, security headers' },
  { date: 'Mar 22', text: 'Performance — browser caching, deferred JS loading' },
  { date: 'Mar 21', text: 'Water conditions — multi-category scoring system (paddle, WQ, weather)' },
  { date: 'Mar 21', text: 'Tide charts with NOAA data + hourly forecasts' },
  { date: 'Mar 20', text: 'Events page — 246 international paddling events from 21 sources' },
  { date: 'Mar 20', text: 'Gear page — 51 brands with AI-enriched descriptions' },
  { date: 'Mar 19', text: 'Federations page — 181 national federations + continental associations' },
  { date: 'Mar 18', text: 'Clubs map — 7,700+ paddle clubs across 86 countries' },
  { date: 'Mar 17', text: 'Weather page — triple-source forecasting (Open-Meteo + Google + NWS)' },
  { date: 'Mar 16', text: 'Water quality monitoring — SD County DEH real-time stations' },
  { date: 'Mar 15', text: 'Visitor counter + analytics with Cloudflare Workers' },
  { date: 'Mar 14', text: 'Feedback & Updates system with Cloudflare KV storage' },
  { date: 'Mar 13', text: 'PaddlePoint.org launched — water conditions for paddlers' },
];

function ChangelogDot({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative ml-1 p-1 group" title="Recent site updates">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
    </button>
  );
}

function ChangelogDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">🛠️ Recent Site Updates</h3>
        <p className="text-[10px] text-slate-400">What&apos;s new on PaddlePoint</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {SITE_UPDATES.map((u, i) => (
          <div key={i} className="px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap mt-0.5">{u.date}</span>
              <span className="text-xs text-slate-600 leading-relaxed">{u.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
        <button onClick={() => { onClose(); callWhenReady('openUpdatesModal'); }}
          className="text-[11px] text-cyan-600 hover:text-cyan-700 font-medium">
          View full roadmap →
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo → Home */}
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Image src="/paddle-pin.svg" alt="PaddlePoint" width={48} height={62} className="w-12 h-auto" priority />
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PaddlePoint</h1>
            <p className="text-xs text-slate-500">Paddle conditions, clubs &amp; events</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                pathname === href ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {label}
            </Link>
          ))}
          <button onClick={() => callWhenReady('openSuggestModal')}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Feedback
          </button>
          {/* Updates + changelog dot */}
          <div className="relative flex items-center">
            <button onClick={() => callWhenReady('openUpdatesModal')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Updates
            </button>
            <ChangelogDot isOpen={changelogOpen} onClick={() => setChangelogOpen(!changelogOpen)} />
            {changelogOpen && <ChangelogDropdown onClose={() => setChangelogOpen(false)} />}
          </div>
        </nav>

        {/* Mobile: changelog dot + hamburger */}
        <div className="md:hidden flex items-center gap-2 relative">
          <ChangelogDot isOpen={changelogOpen} onClick={() => setChangelogOpen(!changelogOpen)} />
          {changelogOpen && <ChangelogDropdown onClose={() => setChangelogOpen(false)} />}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-slate-100" aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white px-4 pb-4">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`block py-3 px-4 rounded-lg text-sm font-medium no-underline ${
                pathname === href ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {label}
            </Link>
          ))}
          <button onClick={() => { setMobileOpen(false); callWhenReady('openSuggestModal'); }}
            className="block w-full text-left py-3 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
            Feedback
          </button>
          <button onClick={() => { setMobileOpen(false); callWhenReady('openUpdatesModal'); }}
            className="block w-full text-left py-3 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
            Updates
          </button>
        </nav>
      )}
    </header>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/conditions', label: 'Water' },
  { href: '/weather', label: 'Weather' },
  { href: '/clubs', label: 'Clubs' },
  { href: '/events', label: 'Events' },
  { href: '/gear', label: 'Gear' },
  { href: '/federations', label: 'Federations' },
];

const MODAL_ITEMS = [
  { id: 'feedback', label: 'Feedback', action: 'openSuggestModal', icon: null },
  { id: 'updates', label: 'Updates', action: 'openUpdatesModal', icon: 'ripple' },
];

function callWhenReady(fnName: string) {
  const fn = (window as any)[fnName];
  if (fn) { fn(); return; }
  // pp-shared.js may not be ready yet — retry briefly
  let tries = 0;
  const timer = setInterval(() => {
    const fn = (window as any)[fnName];
    if (fn) { clearInterval(timer); fn(); }
    else if (++tries > 20) { clearInterval(timer); } // give up after 2s
  }, 100);
}

function WaterRipple() {
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5 mr-1">
      <svg viewBox="0 0 20 20" className="w-5 h-5 text-cyan-500" fill="none">
        <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.8">
          <animate attributeName="r" from="3" to="3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6">
          <animate attributeName="r" from="3" to="9" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4">
          <animate attributeName="r" from="3" to="9" dur="2s" begin="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin="0.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    </span>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
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
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                pathname === href
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
          {MODAL_ITEMS.map(({ id, label, action, icon }) => (
            <button
              key={id}
              onClick={() => callWhenReady(action)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors flex items-center"
            >
              {icon === 'ripple' && <WaterRipple />}
              {label}
            </button>
          ))}
        </nav>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white px-4 pb-4">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`block py-3 px-4 rounded-lg text-sm font-medium no-underline ${
                pathname === href ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </Link>
          ))}
          {MODAL_ITEMS.map(({ id, label, action, icon }) => (
            <button
              key={id}
              onClick={() => { setMobileOpen(false); callWhenReady(action); }}
              className="block w-full text-left py-3 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center"
            >
              {icon === 'ripple' && <WaterRipple />}
              {label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

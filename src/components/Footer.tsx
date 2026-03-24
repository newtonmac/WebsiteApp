'use client';

import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/data-sources', label: 'Data Sources' },
  { href: '/safety', label: 'Safety Disclaimer' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/faq', label: 'FAQ' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/contact', label: 'Contact' },
];

function WaterPulse() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500">
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M6 1C6 1 3 5 3 7.5C3 9.43 4.34 11 6 11C7.66 11 9 9.43 9 7.5C9 5 6 1 6 1Z"
              fill="white" fillOpacity="0.9" />
          </svg>
        </span>
      </span>
      <span className="text-xs text-cyan-600 font-medium">Live data</span>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 mt-8 py-6 px-4 text-center">
      <div className="flex items-center justify-center gap-3 mb-3">
        <WaterPulse />
        <span className="text-xs text-slate-300">|</span>
        <Link href="/stats" className="text-xs text-slate-500 hover:text-cyan-600 font-medium transition-colors no-underline">
          📊 Stats
        </Link>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-3">
        {FOOTER_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}
            className="text-xs text-slate-500 hover:text-slate-700 no-underline">
            {label}
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        &copy; {new Date().getFullYear()} PaddlePoint. All rights reserved.
      </p>
    </footer>
  );
}

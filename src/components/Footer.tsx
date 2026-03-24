'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

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

const LIVE_SOURCES = [
  { icon: '🌊', category: 'Weather & Marine', sources: [
    { name: 'Open-Meteo', url: 'https://open-meteo.com', desc: 'Wind, temperature, UV, precipitation' },
    { name: 'Google Weather API', url: 'https://developers.google.com/maps/documentation/weather', desc: 'Triple-source weather verification' },
    { name: 'Open-Meteo Marine', url: 'https://open-meteo.com/en/docs/marine-weather-api', desc: 'Wave height, swell, sea surface temp' },
  ]},
  { icon: '🌊', category: 'Tides & Water Temp', sources: [
    { name: 'NOAA CO-OPS', url: 'https://tidesandcurrents.noaa.gov', desc: 'Tide predictions and water temperature' },
    { name: 'USGS Water Services', url: 'https://waterservices.usgs.gov', desc: 'River flow and inland water temp' },
  ]},
  { icon: '💧', category: 'Water Quality', sources: [
    { name: 'SD County DEH', url: 'https://www.sdbeachinfo.com', desc: 'Real-time beach monitoring stations' },
    { name: 'CA State Water Board', url: 'https://data.ca.gov', desc: 'Beach advisories and closures' },
    { name: 'Swim Guide', url: 'https://www.theswimguide.org', desc: 'Beach water quality ratings' },
    { name: 'NOAA HABSOS', url: 'https://habsos.noaa.gov', desc: 'Harmful algal bloom monitoring' },
  ]},
  { icon: '⚠️', category: 'Alerts & Safety', sources: [
    { name: 'National Weather Service', url: 'https://www.weather.gov', desc: 'Active weather warnings' },
    { name: 'EPA AirNow', url: 'https://www.airnow.gov', desc: 'Air quality index' },
  ]},
];

function LiveDataPopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div ref={ref} className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">🌊 Live Data Sources</h3>
            <p className="text-[11px] text-slate-400">Real-time APIs powering PaddlePoint</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-3 overflow-y-auto max-h-[60vh] space-y-4">
          {LIVE_SOURCES.map((group, i) => (
            <div key={i}>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{group.icon} {group.category}</div>
              <div className="space-y-1.5">
                {group.sources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors no-underline group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-cyan-700 group-hover:text-cyan-800">{s.name}</div>
                      <div className="text-[11px] text-slate-400 leading-snug">{s.desc}</div>
                    </div>
                    <span className="text-[10px] text-slate-300 group-hover:text-cyan-500 mt-1">↗</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] text-slate-400 text-center">All data fetched in real-time within your browser. PaddlePoint is a data aggregator — <a href="/data-sources" className="text-cyan-500 hover:underline">learn more</a>.</p>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const [showSources, setShowSources] = useState(false);

  return (
    <footer className="border-t border-slate-200 mt-8 py-6 px-4 text-center">
      <div className="flex items-center justify-center gap-3 mb-3">
        {/* Live data pulse — clickable, opens sources popup */}
        <button onClick={() => setShowSources(true)} className="inline-flex items-center gap-1.5 group cursor-pointer">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500">
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path d="M6 1C6 1 3 5 3 7.5C3 9.43 4.34 11 6 11C7.66 11 9 9.43 9 7.5C9 5 6 1 6 1Z" fill="white" fillOpacity="0.9" />
              </svg>
            </span>
          </span>
          <span className="text-xs text-cyan-600 font-medium group-hover:text-cyan-700 transition-colors">Live data</span>
        </button>
        <span className="text-xs text-slate-300">|</span>
        <Link href="/stats" className="text-xs text-slate-500 hover:text-cyan-600 font-medium transition-colors no-underline">
          📊 Stats
        </Link>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-3">
        {FOOTER_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="text-xs text-slate-500 hover:text-slate-700 no-underline">
            {label}
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        &copy; {new Date().getFullYear()} PaddlePoint. All rights reserved.
      </p>
      {showSources && <LiveDataPopup onClose={() => setShowSources(false)} />}
    </footer>
  );
}

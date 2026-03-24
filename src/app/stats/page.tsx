'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { google: any; } }

import { useState, useEffect, useRef, useCallback } from 'react';

const COUNTER_API = 'https://visitor-counter.newtonmac.workers.dev';
const GOOGLE_MAPS_KEY = 'AIzaSyAR81pUTUz5ON7ZBuoouTh2RTHyECr6yvg';

interface DayData {
  date: string;
  uniqueVisitors: number;
  totalHits: number;
  cities?: Record<string, number>;
  coords?: Record<string, { lat: number; lng: number }>;
}
interface StatsData { total: number; days: DayData[]; }
interface CityInfo { name: string; count: number; lat: number; lng: number; }

function aggregateCities(days: DayData[]): CityInfo[] {
  const counts: Record<string, number> = {};
  const coords: Record<string, { lat: number; lng: number }> = {};
  days.forEach(d => {
    if (d.cities) Object.entries(d.cities).forEach(([c, n]) => { counts[c] = (counts[c] || 0) + n; });
    if (d.coords) Object.entries(d.coords).forEach(([c, co]) => { if (!coords[c]) coords[c] = co; });
  });
  return Object.entries(counts)
    .filter(([c]) => coords[c])
    .map(([name, count]) => ({ name, count, ...coords[name] }))
    .sort((a, b) => b.count - a.count);
}

function VisitorMap({ cities }: { cities: CityInfo[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const gm = window.google.maps;
    const map = new gm.Map(mapRef.current, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#f0f4f8' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
        { featureType: 'road', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
      ],
    });
    mapInstance.current = map;
    const maxCount = Math.max(...cities.map(c => c.count), 1);
    cities.forEach(city => {
      const scale = Math.max(6, Math.min(24, (city.count / maxCount) * 24));
      new gm.Marker({
        position: { lat: city.lat, lng: city.lng },
        map,
        title: `${city.name}: ${city.count} visits`,
        icon: {
          path: 0, // google.maps.SymbolPath.CIRCLE
          fillColor: '#0891b2',
          fillOpacity: 0.7,
          strokeColor: '#06b6d4',
          strokeWeight: 1,
          scale,
        },
      });
    });
    if (cities.length > 0) {
      const bounds = new gm.LatLngBounds();
      cities.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }));
      map.fitBounds(bounds, 40);
    }
  }, [cities]);

  useEffect(() => {
    if (window.google?.maps) { initMap(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps) { clearInterval(check); initMap(); }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`;
    script.async = true;
    script.onload = () => setTimeout(initMap, 100);
    document.head.appendChild(script);
  }, [initMap]);

  return <div ref={mapRef} className="w-full h-80 rounded-xl border border-slate-200" />;
}

function countryFlag(cityName: string): string {
  const c = cityName.split(', ').pop()?.trim() || '';
  const flags: Record<string, string> = {
    US: '🇺🇸', MX: '🇲🇽', CA: '🇨🇦', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹',
    AU: '🇦🇺', NZ: '🇳🇿', BR: '🇧🇷', JP: '🇯🇵', KR: '🇰🇷', IN: '🇮🇳', CN: '🇨🇳', AR: '🇦🇷',
    CL: '🇨🇱', CO: '🇨🇴', PT: '🇵🇹', NL: '🇳🇱', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮',
    PL: '🇵🇱', IE: '🇮🇪', AT: '🇦🇹', CH: '🇨🇭', BE: '🇧🇪', ZA: '🇿🇦', SG: '🇸🇬', TH: '🇹🇭',
    PH: '🇵🇭', ID: '🇮🇩', MY: '🇲🇾', TW: '🇹🇼', HK: '🇭🇰', IL: '🇮🇱', AE: '🇦🇪', RU: '🇷🇺',
    UA: '🇺🇦', CZ: '🇨🇿', HR: '🇭🇷', GR: '🇬🇷', HU: '🇭🇺', RO: '🇷🇴', TR: '🇹🇷', PE: '🇵🇪',
  };
  return flags[c] || '🌍';
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${COUNTER_API}/stats?page=conditions`)
      .then(r => r.json())
      .then((data: StatsData) => { setStats(data); setLoading(false); })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-slate-500 text-sm">Loading stats...</p>
    </div>
  );
  if (error || !stats) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-red-500">{error || 'No data available'}</p>
    </div>
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayData = stats.days.find(d => d.date === today);
  const todayCount = todayData ? todayData.uniqueVisitors : 0;
  const days = stats.days.slice().reverse();
  const weekTotal = stats.days.reduce((s, d) => s + d.uniqueVisitors, 0);
  const maxVisitors = Math.max(...days.map(d => d.uniqueVisitors), 1);
  const cities = aggregateCities(stats.days);
  const uniqueCountries = new Set(cities.map(c => c.name.split(', ').pop()?.trim())).size;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">📊 Site Statistics</h1>
      <p className="text-sm text-slate-500 mb-8">Visitor data from PaddlePoint</p>

      {/* Hero cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 text-center">
          <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">All Time</div>
          <div className="text-3xl font-extrabold text-blue-600">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-5 text-center">
          <div className="text-xs font-semibold text-cyan-500 uppercase tracking-wide mb-1">This Week</div>
          <div className="text-3xl font-extrabold text-cyan-600">{weekTotal.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 text-center">
          <div className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Today</div>
          <div className="text-3xl font-extrabold text-purple-600">{todayCount.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 text-center">
          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">Countries</div>
          <div className="text-3xl font-extrabold text-amber-600">{uniqueCountries}</div>
        </div>
      </div>

      {/* Visitor map */}
      {cities.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">🌍 Where Our Visitors Are</h2>
          <VisitorMap cities={cities} />
          <p className="text-xs text-slate-400 mt-2 text-center">
            {cities.length} cities across {uniqueCountries} countries
          </p>
        </div>
      )}

      {/* Top cities list */}
      {cities.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Top Visitor Locations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cities.slice(0, 20).map((city, i) => {
              const pct = (city.count / cities[0].count) * 100;
              return (
                <div key={city.name} className="relative flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-100 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-cyan-50 rounded-lg" style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                  <span className="relative text-sm z-10">{countryFlag(city.name)}</span>
                  <span className="relative flex-1 text-sm text-slate-700 truncate z-10">{city.name}</span>
                  <span className="relative text-sm font-bold text-cyan-700 z-10">{city.count}</span>
                </div>
              );
            })}
          </div>
          {cities.length > 20 && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              and {cities.length - 20} more cities...
            </p>
          )}
        </div>
      )}

      {/* Daily bar chart */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Daily Visitors (Last 7 Days)</h2>
        <div className="flex items-end gap-2 h-48 bg-slate-50 rounded-xl p-4">
          {days.map((d) => {
            const pct = (d.uniqueVisitors / maxVisitors) * 100;
            const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
            const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isToday = d.date === today;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-xs font-bold text-slate-600">{d.uniqueVisitors}</span>
                <div className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-cyan-500' : 'bg-blue-400'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }} />
                <span className="text-[10px] text-slate-500 font-medium">{dayLabel}</span>
                <span className="text-[9px] text-slate-400">{dateLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Daily Breakdown</h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Unique Visitors</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Cities</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dateStr = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const isToday = d.date === today;
                const cityCount = d.cities ? Object.keys(d.cities).length : 0;
                return (
                  <tr key={d.date} className={`border-b border-slate-100 ${isToday ? 'bg-cyan-50' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-700">{dateStr}{isToday && <span className="ml-2 text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded-full font-medium">today</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{d.uniqueVisitors.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{cityCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Data from PaddlePoint visitor counter · Updates in real-time
      </p>
    </div>
  );
}

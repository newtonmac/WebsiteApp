'use client';
import { useState, useEffect, useMemo } from 'react';

const API = 'https://visitor-counter.newtonmac.workers.dev/stats';
const PAGES = ['home','conditions','weather','clubs','events','gear','federations'];
const PAGE_NAMES: Record<string,string> = {home:'Home',conditions:'Water Conditions',weather:'Weather',clubs:'Paddle Clubs',events:'Events',gear:'Gear',federations:'Federations'};
const PAGE_COLORS: Record<string,string> = {home:'#f97316',conditions:'#06b6d4',weather:'#3b82f6',clubs:'#8b5cf6',events:'#f59e0b',gear:'#22c55e',federations:'#ec4899'};
const COUNTRY_FLAGS: Record<string,string> = {US:'🇺🇸',MX:'🇲🇽',CA:'🇨🇦',GB:'🇬🇧',AU:'🇦🇺',NZ:'🇳🇿',DE:'🇩🇪',FR:'🇫🇷',ES:'🇪🇸',JP:'🇯🇵',BR:'🇧🇷',IN:'🇮🇳',SG:'🇸🇬',IT:'🇮🇹',NL:'🇳🇱',SE:'🇸🇪',NO:'🇳🇴',PH:'🇵🇭',KR:'🇰🇷',TH:'🇹🇭',CL:'🇨🇱',AR:'🇦🇷',CO:'🇨🇴',ZA:'🇿🇦',HK:'🇭🇰',PL:'🇵🇱',IE:'🇮🇪',PT:'🇵🇹',CH:'🇨🇭',AT:'🇦🇹',BE:'🇧🇪'};

interface DayData { date: string; uniqueVisitors: number; cities: Record<string,number>; }
interface PageData { total: number; days: DayData[]; }

export default function TrafficPage() {
  const [data, setData] = useState<Record<string, PageData>>({});
  const [refs, setRefs] = useState<Record<string, Record<string,number>>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7); // days to show

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results = await Promise.all(PAGES.map(p =>
        fetch(`${API}?page=${p}`).then(r => r.json()).catch(() => ({ total: 0, days: [] }))
      ));
      const d: Record<string, PageData> = {};
      PAGES.forEach((p, i) => d[p] = results[i]);
      setData(d);

      // Referrers
      const refPages = ['paddlepoint','conditions','clubs','weather','events','gear','federations'];
      const refResults = await Promise.all(refPages.map(p =>
        fetch(`${API}/referrers?page=${p}`).then(r => r.json()).catch(() => ({ totals: {} }))
      ));
      const r: Record<string, Record<string,number>> = {};
      refPages.forEach((p, i) => r[p] = refResults[i].totals || {});
      setRefs(r);
      setLoading(false);
    }
    load();
  }, []);

  // Computed aggregates
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let totalAll = 0, todayAll = 0, yesterdayAll = 0;
    const allCities: Record<string, number> = {};
    const allCountries: Record<string, number> = {};
    const dailyTotals: Record<string, number> = {};
    const pageByDay: Record<string, Record<string, number>> = {};

    PAGES.forEach(p => {
      const d = data[p];
      if (!d) return;
      totalAll += d.total || 0;
      pageByDay[p] = {};
      (d.days || []).forEach(day => {
        dailyTotals[day.date] = (dailyTotals[day.date] || 0) + day.uniqueVisitors;
        pageByDay[p][day.date] = day.uniqueVisitors;
        Object.entries(day.cities || {}).forEach(([city, cnt]) => {
          allCities[city] = (allCities[city] || 0) + cnt;
          const parts = city.split(', ');
          const country = parts[parts.length - 1] || 'Unknown';
          allCountries[country] = (allCountries[country] || 0) + cnt;
        });
      });
    });

    todayAll = dailyTotals[today] || 0;
    yesterdayAll = dailyTotals[yesterday] || 0;
    const growth = yesterdayAll > 0 ? Math.round(((todayAll - yesterdayAll) / yesterdayAll) * 100) : 0;

    // Date range
    const dates: string[] = [];
    for (let i = range - 1; i >= 0; i--) {
      dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    }

    // Top pages sorted by total
    const pageStats = PAGES.map(p => ({ key: p, name: PAGE_NAMES[p], total: data[p]?.total || 0, color: PAGE_COLORS[p] })).sort((a, b) => b.total - a.total);

    // Top cities
    const topCities = Object.entries(allCities).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // Top countries
    const topCountries = Object.entries(allCountries).sort((a, b) => b[1] - a[1]).slice(0, 12);

    // Referrers aggregated
    const extTotals: Record<string, number> = {};
    Object.values(refs).forEach(r => {
      Object.entries(r).forEach(([src, cnt]) => {
        if (src === 'paddlepoint.org') return;
        extTotals[src] = (extTotals[src] || 0) + cnt;
      });
    });
    const topRefs = Object.entries(extTotals).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // Weekday distribution
    const weekdays = [0,0,0,0,0,0,0]; // Sun-Sat
    Object.entries(dailyTotals).forEach(([d, v]) => {
      const day = new Date(d + 'T12:00:00').getDay();
      weekdays[day] += v;
    });

    return { totalAll, todayAll, yesterdayAll, growth, dates, dailyTotals, pageByDay, pageStats, topCities, topCountries, topRefs, weekdays, uniqueCities: Object.keys(allCities).length, uniqueCountries: Object.keys(allCountries).length };
  }, [data, refs, range]);

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-400">Loading analytics...</div>;
  }

  const maxDay = Math.max(...stats.dates.map(d => stats.dailyTotals[d] || 0), 1);

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">📊 Traffic Analytics</h2>
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${range === d ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Today', value: stats.todayAll, color: 'text-cyan-400', sub: stats.growth > 0 ? `↑ ${stats.growth}%` : stats.growth < 0 ? `↓ ${Math.abs(stats.growth)}%` : '—' },
          { label: 'Yesterday', value: stats.yesterdayAll, color: 'text-blue-400' },
          { label: 'All Time', value: stats.totalAll, color: 'text-emerald-400' },
          { label: 'Cities', value: stats.uniqueCities, color: 'text-purple-400' },
          { label: 'Countries', value: stats.uniqueCountries, color: 'text-amber-400' },
          { label: 'Top Page', value: stats.pageStats[0]?.name || '—', color: 'text-pink-400', isText: true },
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={`text-2xl font-extrabold ${kpi.color}`}>
              {(kpi as any).isText ? kpi.value : Number(kpi.value).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
            {(kpi as any).sub && <div className={`text-[10px] mt-0.5 ${stats.growth >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{(kpi as any).sub}</div>}
          </div>
        ))}
      </div>

      {/* Daily Visitors Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Daily Visitors ({range} days)</h3>
        <div className="flex items-end gap-1 h-40">
          {stats.dates.map(d => {
            const v = stats.dailyTotals[d] || 0;
            const h = Math.max((v / maxDay) * 100, 3);
            const dayName = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isToday = d === new Date().toISOString().slice(0, 10);
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1 group" title={`${dateStr}: ${v} visitors`}>
                <span className="text-[10px] text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">{v}</span>
                <div className={`w-full rounded-t-md transition-all ${isToday ? 'bg-cyan-400' : 'bg-cyan-600/60 group-hover:bg-cyan-500'}`}
                  style={{ height: `${h}%` }} />
                <span className="text-[9px] text-slate-500">{range <= 14 ? dayName : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Page Breakdown + Referrers */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Page Breakdown</h3>
          <div className="space-y-2.5">
            {stats.pageStats.map(p => (
              <div key={p.key} className="flex items-center gap-3">
                <span className="w-[110px] text-xs text-slate-300 truncate">{p.name}</span>
                <Bar pct={(p.total / Math.max(stats.pageStats[0]?.total || 1, 1)) * 100} color={p.color} />
                <span className="text-xs font-bold text-white w-10 text-right">{p.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Traffic Sources</h3>
          {stats.topRefs.length === 0 ? (
            <div className="text-slate-500 text-sm">No external referrers yet</div>
          ) : (
            <div className="space-y-2.5">
              {stats.topRefs.map(([src, cnt]) => {
                const label = src.replace('com.google.android.googlequicksearchbox', 'Google App').replace('com.reddit.frontpage', 'Reddit App').replace('m.facebook.com', 'FB Mobile').replace('lm.facebook.com', 'FB Link');
                const color = src.includes('google') ? '#34d399' : src.includes('facebook') ? '#60a5fa' : src.includes('reddit') ? '#f97316' : src.includes('twitter') || src.includes('x.com') ? '#38bdf8' : '#a78bfa';
                return (
                  <div key={src} className="flex items-center gap-3">
                    <span className="w-[110px] text-xs text-slate-300 truncate">{label}</span>
                    <Bar pct={(cnt / Math.max(stats.topRefs[0]?.[1] || 1, 1)) * 100} color={color} />
                    <span className="text-xs font-bold text-white w-10 text-right">{cnt}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cities + Countries */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Top Cities</h3>
          <div className="space-y-2">
            {stats.topCities.map(([city, cnt], i) => (
              <div key={city} className="flex items-center gap-2">
                <span className="text-slate-600 text-[10px] w-4 text-right">{i + 1}</span>
                <span className="w-[130px] text-xs text-slate-300 truncate">{city.split(',')[0]}</span>
                <Bar pct={(cnt / Math.max(stats.topCities[0]?.[1] || 1, 1)) * 100} color="#8b5cf6" />
                <span className="text-xs font-bold text-white w-8 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Top Countries</h3>
          <div className="space-y-2">
            {stats.topCountries.map(([code, cnt], i) => (
              <div key={code} className="flex items-center gap-2">
                <span className="text-slate-600 text-[10px] w-4 text-right">{i + 1}</span>
                <span className="w-[130px] text-xs text-slate-300 truncate">{COUNTRY_FLAGS[code] || '🌍'} {code}</span>
                <Bar pct={(cnt / Math.max(stats.topCountries[0]?.[1] || 1, 1)) * 100} color="#f59e0b" />
                <span className="text-xs font-bold text-white w-8 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekday Distribution + Today's Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Weekday Distribution</h3>
          <div className="flex items-end gap-2 h-28">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name, i) => {
              const v = stats.weekdays[i];
              const maxW = Math.max(...stats.weekdays, 1);
              return (
                <div key={name} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[10px] text-amber-400 font-bold opacity-0 group-hover:opacity-100">{v}</span>
                  <div className="w-full rounded-t bg-amber-500/60 group-hover:bg-amber-400 transition-all"
                    style={{ height: `${Math.max((v / maxW) * 100, 4)}%` }} />
                  <span className="text-[10px] text-slate-500">{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Today by Page</h3>
          <div className="space-y-1.5">
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              return PAGES.map(p => {
                const v = stats.pageByDay[p]?.[today] || 0;
                return { key: p, name: PAGE_NAMES[p], v, color: PAGE_COLORS[p] };
              }).sort((a, b) => b.v - a.v);
            })().map(p => (
              <div key={p.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="w-[100px] text-xs text-slate-300 truncate">{p.name}</span>
                <span className="text-xs font-bold text-cyan-400 w-6 text-right">{p.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

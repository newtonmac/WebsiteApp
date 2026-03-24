'use client';

import { useState, useEffect } from 'react';

const COUNTER_API = 'https://visitor-counter.newtonmac.workers.dev';

interface DayData { date: string; uniqueVisitors: number; totalHits: number; }
interface StatsData { total: number; days: DayData[]; }

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">📊 Site Statistics</h1>
      <p className="text-sm text-slate-500 mb-8">Unique visitor counts from the PaddlePoint visitor counter</p>

      {/* Hero cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
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
      </div>

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
                <div
                  className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-cyan-500' : 'bg-blue-400'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
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
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Visits</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dateStr = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const isToday = d.date === today;
                return (
                  <tr key={d.date} className={`border-b border-slate-100 ${isToday ? 'bg-cyan-50' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-700">{dateStr}{isToday && <span className="ml-2 text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded-full font-medium">today</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{d.uniqueVisitors.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{(d.totalHits || 0).toLocaleString()}</td>
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

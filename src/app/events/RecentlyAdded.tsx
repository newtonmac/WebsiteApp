'use client';
import { useState } from 'react';

interface RecentEvent {
  name: string; start_date: string; city: string; state: string; country: string;
}

export function RecentlyAdded({ events, count }: { events: RecentEvent[]; count: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-0.5 font-semibold transition-colors cursor-pointer">
        +{count} added
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[90%] max-w-[500px] max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <h3 className="text-sm font-bold text-white">
                <span className="text-emerald-400">{count}</span> Recently Added Events
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {events.map((ev, i) => {
                const loc = [ev.city, ev.state, ev.country].filter(Boolean).join(', ');
                const dateRaw = String(ev.start_date).split('T')[0];
                const [y, m, d] = dateRaw.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                const mon = date.toLocaleDateString('en-US', { month: 'short' });
                const day = date.getDate();
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                    <span className="text-slate-600 text-[11px] w-5 text-right shrink-0">{i + 1}</span>
                    <div className="w-[52px] shrink-0 text-center bg-slate-800 rounded-lg py-1">
                      <div className="text-emerald-400 text-[10px] font-semibold uppercase leading-tight">{mon}</div>
                      <div className="text-white text-sm font-bold leading-tight">{day}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-white leading-snug">{ev.name}</div>
                      {loc && <div className="text-[11px] text-slate-400 mt-0.5 truncate">📍 {loc}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

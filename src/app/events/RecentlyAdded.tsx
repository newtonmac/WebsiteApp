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
                const dateRaw = String(ev.start_date).split('T')[0]; // handle both YYYY-MM-DD and ISO strings
                const [y, m, d] = dateRaw.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={i} className="flex items-start gap-3 px-5 py-2.5 border-b border-slate-800 hover:bg-slate-800/50">
                    <span className="text-slate-500 text-[10px] min-w-[20px] pt-1 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{ev.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-emerald-400">{dateStr}</span>
                        {loc && <span className="text-[10px] text-slate-400 truncate">{loc}</span>}
                      </div>
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

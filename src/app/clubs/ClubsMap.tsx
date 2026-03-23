'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Club {
  id: number; n: string; ci: string; sa: string; st: string; co: string;
  la: number; lo: number; ct: string; cl: string; gr: number; cc: string;
  w: string; p: string; e: string; fb: string; ig: string; d: string; fe: string;
}

interface Props {
  totalClubs: number;
  totalCountries: number;
  craftTypes: string[];
}

const MAPS_KEY = 'AIzaSyAR81pUTUz5ON7ZBuoouTh2RTHyECr6yvg';
const API_TOKEN = 'pp-clubs-7742-v1';

const CRAFT_LABELS: Record<string, string> = {
  'sprint kayak':'Sprint Kayak','canoe polo':'Canoe Polo','prone paddle':'Prone Paddle',
  'sea kayak':'Sea Kayak','dragon boat':'Dragon Boat', sup:'SUP', surfski:'Surfski',
  C1:'C1', K1:'K1', canoe:'Canoe', kayak:'Kayak', rowing:'Rowing',
  outrigger:'Outrigger', marathon:'Marathon', whitewater:'Whitewater',
};

export function ClubsMap({ totalClubs, totalCountries, craftTypes }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const clubInputRef = useRef<HTMLInputElement>(null);

  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [selected, setSelected] = useState<Club | null>(null);
  const [craftFilter, setCraftFilter] = useState('');
  const [searchMode, setSearchMode] = useState<'location' | 'club'>('location');
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPulse, setShowPulse] = useState(false);

  // Club suggestions
  const [suggestions, setSuggestions] = useState<Club[]>([]);
  const [sugHighlight, setSugHighlight] = useState(-1);

  // Club list panel
  const [listOpen, setListOpen] = useState(false);
  const [listClubs, setListClubs] = useState<Club[]>([]);

  // ─── Load Google Maps API ───
  useEffect(() => {
    // If already loaded, init immediately
    if ((window as any).google?.maps) {
      initMap();
      return;
    }
    // If script already in DOM (e.g. from previous navigation), wait for it
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const poll = setInterval(() => {
        if ((window as any).google?.maps) { clearInterval(poll); initMap(); }
      }, 100);
      return () => clearInterval(poll);
    }
    // Load fresh
    (window as any).__initMap = () => initMap();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=__initMap`;
    script.async = true; script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ─── Fetch clubs ───
  useEffect(() => {
    fetch('/api/clubs?mode=map', { headers: { 'X-API-Token': API_TOKEN } })
      .then(r => r.json())
      .then(data => { setAllClubs(data); setFilteredClubs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ─── Init map ───
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 33.5, lng: -117 },
      zoom: 6,
      mapTypeId: 'hybrid',
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: true,
      mapTypeControlOptions: { position: google.maps.ControlPosition.BOTTOM_LEFT },
      clickableIcons: false,
    });
    mapInstanceRef.current = map;
    map.addListener('idle', () => updateVisibleCount());
    setupAutocomplete();
  }, []);

  // ─── Setup Google Places Autocomplete ───
  const setupAutocomplete = useCallback(() => {
    if (!locationInputRef.current || autocompleteRef.current) return;
    const ac = new google.maps.places.Autocomplete(locationInputRef.current, {
      types: ['(regions)'],
      fields: ['geometry', 'name', 'formatted_address', 'address_components', 'types'],
    });
    autocompleteRef.current = ac;
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      const map = mapInstanceRef.current;
      if (!map) return;

      let searchCountry = '', searchState = '', searchCity = '';
      if (place.address_components) {
        for (const comp of place.address_components) {
          if (comp.types.includes('country')) searchCountry = comp.short_name;
          if (comp.types.includes('administrative_area_level_1')) searchState = comp.long_name;
          if (comp.types.includes('locality')) searchCity = comp.long_name;
          if (comp.types.includes('postal_code')) searchCity = comp.long_name;
        }
      }

      // Filter clubs by location
      const cf = craftFilter;
      const filtered = allClubs.filter(club => {
        if (cf && (!club.ct || !club.ct.includes(cf))) return false;
        if (searchCity) {
          const cl = searchCity.toLowerCase();
          return (club.ci?.toLowerCase() === cl) || (club.ci?.toLowerCase().includes(cl)) || (club.n?.toLowerCase().includes(cl));
        }
        if (searchState && !searchCity) {
          const sl = searchState.toLowerCase();
          return (club.st?.toLowerCase() === sl) || (club.sa?.toLowerCase() === sl) || (club.co?.toLowerCase() === sl);
        }
        if (searchCountry && !searchState && !searchCity) {
          const cu = searchCountry.toUpperCase();
          return (club.cc?.toUpperCase() === cu) || (club.co?.toUpperCase() === cu);
        }
        return true;
      });
      setFilteredClubs(filtered);

      // Zoom logic: region uses viewport, city fits to clubs
      const isRegionSearch = !searchCity && (searchState || searchCountry);
      if (place.geometry.viewport && isRegionSearch) {
        map.fitBounds(place.geometry.viewport, { top: 20, bottom: 20, left: 20, right: 20 });
      } else if (filtered.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        filtered.forEach(c => { if (c.la && c.lo) bounds.extend({ lat: c.la, lng: c.lo }); });
        map.fitBounds(bounds, 60);
        if (filtered.length === 1) map.setZoom(12);
      } else if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else {
        map.setCenter(place.geometry.location);
        map.setZoom(10);
      }
    });
  }, [allClubs, craftFilter]);

  // Re-setup autocomplete when ref becomes available or clubs change
  useEffect(() => { setupAutocomplete(); }, [setupAutocomplete]);

  // ─── Plot markers when filteredClubs change ───
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || allClubs.length === 0) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#3b82f6" stroke="#1a1d28" stroke-width="1.5" opacity="0.9"/></svg>`;
    const icon = {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(12, 12),
      anchor: new google.maps.Point(6, 6),
    };

    filteredClubs.forEach(club => {
      if (!club.la || !club.lo) return;
      const marker = new google.maps.Marker({
        position: { lat: club.la, lng: club.lo },
        map, icon, title: club.n, optimized: true,
      });
      (marker as any)._club = club;
      marker.addListener('click', () => {
        setSelected(club);
        map.panTo({ lat: club.la, lng: club.lo });
      });
      markersRef.current.push(marker);
    });
    updateVisibleCount();
  }, [filteredClubs]);

  // ─── Apply craft filter ───
  useEffect(() => {
    if (allClubs.length === 0) return;
    if (craftFilter) {
      setFilteredClubs(allClubs.filter(c => c.ct?.toLowerCase().includes(craftFilter.toLowerCase())));
    } else {
      setFilteredClubs(allClubs);
    }
  }, [craftFilter, allClubs]);

  // ─── Update visible count ───
  const updateVisibleCount = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) { setVisibleCount(markersRef.current.length); return; }
    const count = markersRef.current.filter(m => bounds.contains(m.getPosition()!)).length;
    setVisibleCount(count);
    if (count > 0 && !listOpen) setShowPulse(true);
  }, [listOpen]);

  // ─── Club name search with suggestions ───
  const handleClubInput = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    const ql = q.toLowerCase();
    const matches = allClubs.filter(c => {
      if (craftFilter && !c.ct?.toLowerCase().includes(craftFilter.toLowerCase())) return false;
      return c.n?.toLowerCase().includes(ql);
    });
    setSuggestions(matches.slice(0, 50));
    setSugHighlight(-1);
  }, [allClubs, craftFilter]);

  const selectSuggestion = useCallback((club: Club) => {
    setSuggestions([]);
    if (clubInputRef.current) clubInputRef.current.value = club.n;
    const map = mapInstanceRef.current;
    if (map && club.la && club.lo) {
      map.setCenter({ lat: club.la, lng: club.lo });
      map.setZoom(14);
    }
    setFilteredClubs([club]);
    setSelected(club);
  }, []);

  // ─── Toggle club list panel ───
  const toggleClubList = useCallback(() => {
    setListOpen(prev => {
      if (!prev) {
        // Build list of visible clubs
        const map = mapInstanceRef.current;
        const bounds = map?.getBounds();
        const visible: Club[] = [];
        markersRef.current.forEach(m => {
          if (!bounds || bounds.contains(m.getPosition()!)) {
            visible.push((m as any)._club);
          }
        });
        setListClubs(visible);
        setShowPulse(false);
      }
      return !prev;
    });
  }, []);

  const focusClub = useCallback((club: Club) => {
    const map = mapInstanceRef.current;
    if (map && club.la && club.lo) {
      map.panTo({ lat: club.la, lng: club.lo });
      map.setZoom(Math.max(map.getZoom() || 10, 12));
    }
    setSelected(club);
  }, []);

  const handleModeSwitch = useCallback((mode: 'location' | 'club') => {
    setSearchMode(mode);
    setSuggestions([]);
    if (locationInputRef.current) locationInputRef.current.value = '';
    if (clubInputRef.current) clubInputRef.current.value = '';
    // Reset to all (respecting craft filter)
    if (craftFilter) {
      setFilteredClubs(allClubs.filter(c => c.ct?.toLowerCase().includes(craftFilter.toLowerCase())));
    } else {
      setFilteredClubs(allClubs);
    }
    setTimeout(() => {
      if (mode === 'club') clubInputRef.current?.focus();
      else locationInputRef.current?.focus();
    }, 50);
  }, [allClubs, craftFilter]);

  // Handle Enter key for location text search
  const handleLocationKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = locationInputRef.current?.value.trim();
      if (!val) return;
      // Let autocomplete fire first; fallback text search after 300ms
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const q = val.toLowerCase();
        const matches = allClubs.filter(club => {
          if (craftFilter && !club.ct?.toLowerCase().includes(craftFilter.toLowerCase())) return false;
          return (club.n?.toLowerCase().includes(q)) || (club.ci?.toLowerCase().includes(q)) ||
            (club.st?.toLowerCase().includes(q)) || (club.sa?.toLowerCase() === q) ||
            (club.co?.toLowerCase().includes(q)) || (club.cc?.toLowerCase() === q);
        });
        if (matches.length > 0) {
          setFilteredClubs(matches);
          const bounds = new google.maps.LatLngBounds();
          matches.forEach(c => { if (c.la && c.lo) bounds.extend({ lat: c.la, lng: c.lo }); });
          map.fitBounds(bounds, 60);
          if (matches.length === 1) map.setZoom(12);
        }
      }, 300);
    }
  }, [allClubs, craftFilter]);

  // Arrow key navigation for club suggestions
  const handleClubKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugHighlight(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugHighlight(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugHighlight >= 0 && suggestions[sugHighlight]) {
        selectSuggestion(suggestions[sugHighlight]);
      } else {
        // Text search by club name
        const q = clubInputRef.current?.value.trim().toLowerCase();
        if (!q) return;
        const matches = allClubs.filter(c => {
          if (craftFilter && !c.ct?.toLowerCase().includes(craftFilter.toLowerCase())) return false;
          return c.n?.toLowerCase().includes(q);
        });
        setFilteredClubs(matches);
        setSuggestions([]);
        if (matches.length > 0) {
          const map = mapInstanceRef.current;
          if (map) {
            const bounds = new google.maps.LatLngBounds();
            matches.forEach(c => { if (c.la && c.lo) bounds.extend({ lat: c.la, lng: c.lo }); });
            map.fitBounds(bounds, 60);
          }
        }
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  }, [suggestions, sugHighlight, allClubs, craftFilter, selectSuggestion]);

  // ─── JSX ───
  return (
    <div className="flex-1 relative">
      {/* ── Floating Search Bar ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[900px] flex items-stretch gap-1.5">
        {/* Location / Club toggle */}
        <button onClick={() => handleModeSwitch('location')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all shadow-lg ${
            searchMode === 'location'
              ? 'bg-[#1e3a5f] text-blue-400 border-blue-500'
              : 'bg-[#0f1117] text-[#8b8fa3] border-[#2d3040] hover:bg-[#1a1d28] hover:text-white'
          }`}>📍 Location</button>
        <button onClick={() => handleModeSwitch('club')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all shadow-lg ${
            searchMode === 'club'
              ? 'bg-[#1e3a5f] text-blue-400 border-blue-500'
              : 'bg-[#0f1117] text-[#8b8fa3] border-[#2d3040] hover:bg-[#1a1d28] hover:text-white'
          }`}>🛶 Club</button>

        {/* Location search with Google Places Autocomplete */}
        <div className={`relative flex-1 ${searchMode !== 'location' ? 'hidden' : ''}`}>
          <input ref={locationInputRef} type="text"
            placeholder="Search by city, state, zip, or country..."
            onKeyDown={handleLocationKeyDown}
            className="w-full px-4 py-2.5 bg-[#1a1d28] border border-[#2d3040] rounded-xl text-white text-sm outline-none focus:border-cyan-500 shadow-lg placeholder:text-[#555]" />
        </div>

        {/* Club name search with suggestions */}
        <div className={`relative flex-1 ${searchMode !== 'club' ? 'hidden' : ''}`}>
          <input ref={clubInputRef} type="text" autoComplete="off"
            placeholder="Type club name..."
            onChange={e => handleClubInput(e.target.value)}
            onKeyDown={handleClubKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 200)}
            className="w-full px-4 py-2.5 bg-[#1a1d28] border border-[#2d3040] rounded-xl text-white text-sm outline-none focus:border-cyan-500 shadow-lg placeholder:text-[#555]" />
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-[#1a1d28] border border-[#2d3040] rounded-b-xl max-h-[400px] overflow-y-auto z-20 shadow-xl">
              {suggestions.map((c, i) => {
                const loc = [c.ci, c.sa || c.st, c.co].filter(Boolean).join(', ');
                const crafts = (c.ct || '').split(',').map(t => t.trim()).filter(Boolean)
                  .map(t => CRAFT_LABELS[t] || t).join(', ');
                return (
                  <div key={c.id} onMouseDown={() => selectSuggestion(c)}
                    className={`px-3 py-2 cursor-pointer border-b border-[#1e2130] text-sm ${
                      i === sugHighlight ? 'bg-[#1e3a5f]' : 'hover:bg-[#1e3a5f]'
                    }`}>
                    <span className="text-white">{c.n}</span>
                    <span className="text-[#8b8fa3] text-xs ml-1.5">{loc}</span>
                    {crafts && <span className="text-cyan-400 text-[10px] ml-1.5">{crafts}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Craft filter */}
        {searchMode === 'location' && (
          <select value={craftFilter} onChange={e => setCraftFilter(e.target.value)}
            className="px-3 py-2 bg-[#1a1d28] border border-[#2d3040] rounded-xl text-white text-xs outline-none cursor-pointer shadow-lg focus:border-cyan-500 whitespace-nowrap">
            <option value="">All Craft Types</option>
            {craftTypes.map(ct => (
              <option key={ct} value={ct}>{CRAFT_LABELS[ct] || ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        )}

        {/* Pulsating club count badge */}
        <button onClick={toggleClubList} title="Click to view club list"
          className={`px-3 py-2 bg-[#1a1d28] border border-[#2d3040] rounded-xl text-xs font-bold whitespace-nowrap shadow-lg transition-all cursor-pointer hover:border-cyan-500 ${
            showPulse ? 'animate-[badgePulse_1.5s_ease-in-out_infinite]' : ''
          }`}>
          <span className="text-cyan-400 mr-1">{visibleCount}</span>
          <span className="text-white">clubs</span>
        </button>
      </div>

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(34,211,238,0); }
        }
      `}</style>

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-20">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-sm font-medium">Loading {totalClubs.toLocaleString()} clubs...</div>
        </div>
      )}

      {/* ── Club List Panel ── */}
      {listOpen && (
        <div className="absolute top-14 right-3 z-20 w-[360px] max-h-[calc(100%-80px)] bg-[rgba(15,17,23,0.95)] backdrop-blur-xl border border-[#2d3040] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2d3040] shrink-0">
            <h3 className="text-sm font-bold text-[#e1e4e8]"><span className="text-cyan-400">{listClubs.length}</span> Clubs Found</h3>
            <button onClick={() => setListOpen(false)} className="text-[#6b7080] hover:text-white text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listClubs.length === 0 && (
              <div className="p-5 text-center text-[#6b7080] text-sm">No clubs in current view</div>
            )}
            {listClubs.length > 110 && (
              <div className="px-4 py-2 bg-[#1a1d28] text-amber-400 text-[11px] border-b border-[#2d3040]">
                Showing 110 of {listClubs.length} — zoom in to see all
              </div>
            )}
            {listClubs.slice(0, 110).map((c, i) => {
              const loc = [c.ci, c.st].filter(Boolean).join(', ');
              const crafts = (c.ct || '').split(',').filter(Boolean);
              return (
                <div key={c.id} onClick={() => focusClub(c)}
                  className="flex items-start gap-2.5 px-4 py-3 border-b border-[#1a1d28] cursor-pointer hover:bg-[#1a1d28] transition-colors">
                  <span className="text-[#6b7080] text-[11px] min-w-[24px] pt-0.5">{i + 1}</span>
                  <div>
                    <div className="text-[13px] font-semibold text-[#e1e4e8]">
                      {c.n || 'Unknown'}
                      {c.gr ? <span className="text-amber-400 text-[11px] ml-1.5">{c.gr} ★</span> : null}
                    </div>
                    <div className="text-[11px] text-[#6b7080] mt-0.5">{loc || c.co || ''}</div>
                    {crafts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {crafts.map(t => (
                          <span key={t} className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded-full">{CRAFT_LABELS[t.trim()] || t.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Club Detail Panel (bottom center) ── */}
      {selected && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[480px] bg-[rgba(15,17,23,0.95)] backdrop-blur-xl border border-[#2d3040] rounded-2xl shadow-2xl">
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-base text-white leading-tight">{selected.n}</h3>
              <button onClick={() => setSelected(null)} className="text-[#6b7080] hover:text-white text-xl ml-2">×</button>
            </div>
            <p className="text-xs text-[#8b8fa3] mb-2">
              {[selected.ci, selected.st || selected.sa, selected.co].filter(Boolean).join(', ')}
            </p>
            {selected.ct && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selected.ct.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full">
                    {CRAFT_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
            {selected.gr && <p className="text-xs text-amber-400 mb-2">⭐ {selected.gr} Google Rating</p>}
            {selected.d && <p className="text-[11px] text-[#c9cdd5] mb-2 line-clamp-3">{selected.d}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {selected.w && <a href={selected.w} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline truncate max-w-[200px]">🌐 {selected.w.replace(/https?:\/\//, '').replace(/\/$/, '')}</a>}
              {selected.p && <span className="text-[#c9cdd5]">📞 {selected.p}</span>}
              {selected.e && <span className="text-[#c9cdd5]">✉️ {selected.e}</span>}
              {selected.fb && <a href={selected.fb} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Facebook</a>}
              {selected.ig && <a href={selected.ig} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Instagram</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Club {
  id: number; n: string; ci: string; sa: string; st: string; co: string;
  la: number; lo: number; ct: string; cl: string; gr: number;
  w: string; p: string; e: string; fb: string; ig: string;
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
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<any>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selected, setSelected] = useState<Club | null>(null);
  const [craftFilter, setCraftFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'location' | 'club'>('location');
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Club[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [listClubs, setListClubs] = useState<Club[]>([]);

  // Load Google Maps API
  useEffect(() => {
    if (window.google?.maps) { initMap(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places,marker&callback=__initMap`;
    script.async = true; script.defer = true;
    // Load MarkerClusterer library
    const mcScript = document.createElement('script');
    mcScript.src = 'https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js';
    mcScript.async = true;
    document.head.appendChild(mcScript);
    (window as any).__initMap = () => initMap();
    document.head.appendChild(script);
    return () => { delete (window as any).__initMap; };
  }, []);

  // Fetch clubs
  useEffect(() => {
    fetch('/api/clubs?mode=map', { headers: { 'X-API-Token': API_TOKEN } })
      .then(r => r.json())
      .then(data => { setClubs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

    // Update visible count on bounds change
    map.addListener('idle', () => updateVisibleCount());

    // Setup Google Places Autocomplete on location input
    if (locationInputRef.current) {
      const ac = new google.maps.places.Autocomplete(locationInputRef.current, {
        types: ['(regions)'],
        fields: ['geometry', 'name', 'address_components'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(10);
        }
      });
    }
  }, []);

  // Create/update markers when clubs or filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || clubs.length === 0) return;

    // Clear old markers and clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach(m => (m as any).setMap(null));
    markersRef.current = [];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#3b82f6" stroke="#1a1d28" stroke-width="1.5" opacity="0.9"/></svg>`;
    const icon = {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(12, 12),
      anchor: new google.maps.Point(6, 6),
    };

    const filtered = clubs.filter(c => {
      if (!c.la || !c.lo) return false;
      if (craftFilter && !c.ct?.toLowerCase().includes(craftFilter.toLowerCase())) return false;
      if (search && searchMode === 'club' && !c.n?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const newMarkers: google.maps.Marker[] = [];
    filtered.forEach(club => {
      const marker = new google.maps.Marker({
        position: { lat: club.la, lng: club.lo },
        icon,
        title: club.n,
      });
      (marker as any)._club = club;
      marker.addListener('click', () => {
        setSelected(club);
        map.panTo({ lat: club.la, lng: club.lo });
      });
      newMarkers.push(marker);
      markersRef.current.push(marker as any);
    });

    // Use MarkerClusterer if available
    if ((window as any).markerClusterer?.MarkerClusterer) {
      clustererRef.current = new (window as any).markerClusterer.MarkerClusterer({
        map,
        markers: newMarkers,
        renderer: {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            const size = count > 500 ? 50 : count > 100 ? 42 : count > 20 ? 36 : 30;
            const color = count > 500 ? '#dc2626' : count > 100 ? '#f59e0b' : count > 20 ? '#3b82f6' : '#10b981';
            const svgC = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="${color}" opacity="0.85" stroke="white" stroke-width="2"/><text x="${size/2}" y="${size/2}" text-anchor="middle" dy="0.35em" fill="white" font-size="${size > 40 ? 13 : 11}" font-weight="bold" font-family="system-ui">${count > 999 ? Math.round(count/1000) + 'k' : count}</text></svg>`;
            return new google.maps.Marker({
              position,
              icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgC), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size/2, size/2) },
              zIndex: 1000 + count,
            });
          },
        },
      });
    } else {
      newMarkers.forEach(m => m.setMap(map));
    }

    updateVisibleCount();
  }, [clubs, craftFilter, search, searchMode]);

  const updateVisibleCount = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const count = markersRef.current.filter(m => bounds.contains((m as any).getPosition())).length;
    setVisibleCount(count);
  }, []);

  const handleLocationSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!search || searchMode !== 'location') return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: search }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        map.setCenter(results[0].geometry.location);
        map.setZoom(10);
      }
    });
  }, [search, searchMode]);

  // Club name suggestions as user types
  const handleClubInput = useCallback((val: string) => {
    setSearch(val);
    if (val.length < 2) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    const matches = clubs.filter(c => {
      if (craftFilter && !c.ct?.toLowerCase().includes(craftFilter.toLowerCase())) return false;
      return c.n?.toLowerCase().includes(q);
    });
    setSuggestions(matches.slice(0, 40));
  }, [clubs, craftFilter]);

  const selectSuggestion = useCallback((club: Club) => {
    setSuggestions([]);
    setSearch(club.n);
    setSelected(club);
    const map = mapInstanceRef.current;
    if (map && club.la && club.lo) {
      map.setCenter({ lat: club.la, lng: club.lo });
      map.setZoom(14);
    }
  }, []);

  // Toggle club list panel
  const toggleClubList = useCallback(() => {
    setListOpen(prev => {
      if (!prev) {
        const map = mapInstanceRef.current;
        const bounds = map?.getBounds();
        const visible: Club[] = [];
        markersRef.current.forEach(m => {
          if (!bounds || bounds.contains((m as any).getPosition())) {
            visible.push((m as any)._club);
          }
        });
        setListClubs(visible);
      }
      return !prev;
    });
  }, []);

  return (
    <div className="flex-1 relative">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2">
        <div className="flex bg-white rounded-lg shadow-md overflow-hidden">
          <button onClick={() => setSearchMode('location')}
            className={`px-3 py-2 text-sm font-medium ${searchMode === 'location' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}>
            📍 Location
          </button>
          <button onClick={() => setSearchMode('club')}
            className={`px-3 py-2 text-sm font-medium ${searchMode === 'club' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}>
            🛶 Club
          </button>
        </div>

        <form onSubmit={handleLocationSearch} className="flex-1 min-w-[140px] sm:min-w-[200px]">
          {searchMode === 'location' ? (
            <input ref={locationInputRef} type="text"
              placeholder="Search by city, state, zip, or country..."
              className="w-full px-4 py-2 bg-white rounded-lg shadow-md text-sm outline-none" />
          ) : (
            <div className="relative">
              <input type="text" value={search} onChange={e => handleClubInput(e.target.value)}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                placeholder="Search club name..."
                className="w-full px-4 py-2 bg-white rounded-lg shadow-md text-sm outline-none" />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-b-lg max-h-[350px] overflow-y-auto z-30 shadow-xl">
                  {suggestions.map(c => {
                    const loc = [c.ci, c.st || c.sa, c.co].filter(Boolean).join(', ');
                    return (
                      <div key={c.id} onMouseDown={() => selectSuggestion(c)}
                        className="px-3 py-2 cursor-pointer border-b border-slate-100 text-sm hover:bg-emerald-50">
                        <span className="font-medium text-slate-800">{c.n}</span>
                        <span className="text-slate-400 text-xs ml-1.5">{loc}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>

        <select value={craftFilter} onChange={e => setCraftFilter(e.target.value)}
          className="px-3 py-2 bg-white rounded-lg shadow-md text-sm outline-none">
          <option value="">All Craft Types</option>
          {craftTypes.map(ct => (
            <option key={ct} value={ct}>{CRAFT_LABELS[ct] || ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>

        <button onClick={toggleClubList} title="Click to view club list"
          className="bg-slate-800 text-white text-sm font-bold px-3 py-2 rounded-lg shadow-md animate-[badgePulse_1.5s_ease-in-out_infinite] cursor-pointer hover:bg-slate-700 transition-colors">
          <span className="text-cyan-400">{visibleCount}</span> clubs
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(34,211,238,0); }
        }
      `}} />

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-20">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-sm font-medium">Loading {totalClubs.toLocaleString()} clubs...</div>
        </div>
      )}

      {/* Club List Panel */}
      {listOpen && (
        <div className="absolute top-14 right-3 left-3 sm:left-auto z-20 sm:w-[340px] max-h-[calc(100%-80px)] bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 shrink-0">
            <h3 className="text-sm font-bold text-white"><span className="text-cyan-400">{listClubs.length}</span> Clubs Found</h3>
            <button onClick={() => setListOpen(false)} className="text-slate-400 hover:text-white text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listClubs.length === 0 && (
              <div className="p-5 text-center text-slate-400 text-sm">No clubs in current view</div>
            )}
            {listClubs.length > 100 && (
              <div className="px-4 py-2 bg-slate-800 text-amber-400 text-[11px] border-b border-slate-700">
                Showing 100 of {listClubs.length} — zoom in to see all
              </div>
            )}
            {listClubs.slice(0, 100).map((c, i) => {
              const loc = [c.ci, c.st].filter(Boolean).join(', ');
              return (
                <div key={c.id} onClick={() => { setSelected(c); const m = mapInstanceRef.current; if (m && c.la && c.lo) { m.panTo({ lat: c.la, lng: c.lo }); m.setZoom(Math.max(m.getZoom() || 10, 12)); } }}
                  className="flex items-start gap-2 px-4 py-2.5 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                  <span className="text-slate-500 text-[11px] min-w-[20px] pt-0.5">{i + 1}</span>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {c.n}{c.gr ? <span className="text-amber-400 text-[10px] ml-1">{c.gr} ★</span> : null}
                    </div>
                    <div className="text-[10px] text-slate-400">{loc || c.co || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Club Detail Panel */}
      {selected && (
        <div className="absolute top-16 right-3 left-3 sm:left-auto z-20 sm:w-80 max-h-[70vh] overflow-y-auto bg-slate-900 text-white rounded-2xl shadow-xl">
          <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg leading-tight">{selected.n}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl ml-2">×</button>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              {[selected.ci, selected.st || selected.sa, selected.co].filter(Boolean).join(', ')}
            </p>
            {selected.ct && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selected.ct.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="text-[11px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
                    {CRAFT_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
            {selected.gr && (
              <p className="text-sm text-amber-400 mb-2">⭐ {selected.gr} Google Rating</p>
            )}
            <div className="space-y-1.5 text-sm">
              {selected.w && <a href={selected.w} target="_blank" rel="noopener noreferrer" className="block text-sky-400 hover:underline truncate">🌐 {selected.w.replace(/https?:\/\//, '').replace(/\/$/, '')}</a>}
              {selected.p && <p className="text-slate-300">📞 {selected.p}</p>}
              {selected.e && <p className="text-slate-300">✉️ {selected.e}</p>}
              {selected.fb && <a href={selected.fb} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline">Facebook →</a>}
              {selected.ig && <a href={selected.ig} target="_blank" rel="noopener noreferrer" className="block text-pink-400 hover:underline">Instagram →</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

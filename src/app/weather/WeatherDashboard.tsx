'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAllWeatherData, windDirection, weatherDescription, beaufortFromMph, createUnitHelpers } from '@/lib/weather-api';
import type { WeatherData } from '@/lib/weather-api';

const MAPS_KEY = 'AIzaSyAR81pUTUz5ON7ZBuoouTh2RTHyECr6yvg';

export function WeatherDashboard() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const searchRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const u = createUnitHelpers(units === 'metric');

  useEffect(() => {
    if ((window as any).__weatherMapReady) { initMap(); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=__weatherMapInit`;
    s.async = true;
    (window as any).__weatherMapInit = () => { (window as any).__weatherMapReady = true; initMap(); };
    document.head.appendChild(s);
    return () => { delete (window as any).__weatherMapInit; };
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = new google.maps.Map(mapRef.current, {
      center: { lat: 33.5, lng: -117 }, zoom: 8, mapTypeId: 'hybrid',
      disableDefaultUI: true, zoomControl: true, mapTypeControl: true,
      mapTypeControlOptions: { position: (window as any).google.maps.ControlPosition.BOTTOM_LEFT },
    });
    (mapInstance.current as any).addListener('click', (e: any) => {
      if (e.latLng) loadData(e.latLng.lat(), e.latLng.lng(), `${e.latLng.lat().toFixed(4)}, ${e.latLng.lng().toFixed(4)}`);
    });
    if (searchRef.current) {
      const ac = new google.maps.places.Autocomplete(searchRef.current, { types: ['geocode','establishment'] });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        loadData(place.geometry.location.lat(), place.geometry.location.lng(), place.formatted_address || place.name || '');
      });
    }
  }, []);

  const loadData = useCallback(async (lat: number, lon: number, name: string) => {
    setLoading(true); setError('');
    try {
      const result = await fetchAllWeatherData(lat, lon, name);
      setData(result);
      if (mapInstance.current) {
        mapInstance.current.panTo({ lat, lng: lon });
        mapInstance.current.setZoom(10);
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new google.maps.Marker({ position: { lat, lng: lon }, map: mapInstance.current });
      }
    } catch { setError('Failed to load weather data'); }
    setLoading(false);
  }, []);

  const locateMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => loadData(pos.coords.latitude, pos.coords.longitude, 'My Location'),
      () => setError('Location access denied')
    );
  }, [loadData]);

  const c = data?.current;
  const bestTemp = c ? (c.gTemp ?? c.nwsTemp ?? c.omTemp) : null;
  const bestWind = c ? (c.gWindMph ?? c.nwsWindMph ?? c.omWindMph) : null;
  const bestWindDeg = c ? (c.gWindDeg ?? c.nwsWindDeg ?? c.omWindDeg) : null;
  const bestHumidity = c ? (c.gHumidity ?? c.nwsHumidity ?? c.omHumidity) : null;
  const bestVis = c ? (c.gVisibilityMi ?? c.nwsVisibilityMi ?? c.omVisibilityMi) : null;
  const bestPressure = c ? (c.gPressureHpa ?? c.nwsPressureHpa ?? c.omPressureHpa) : null;
  const bf = bestWind != null ? beaufortFromMph(bestWind) : null;

  return (
    <div className='max-w-6xl mx-auto px-4 py-4'>
      {/* Map Section — matches Water Conditions layout */}
      <div className='relative w-full rounded-2xl overflow-hidden mb-4' style={{ height: 'min(760px, 75vh)' }}>
        <div ref={mapRef} className='w-full h-full' />
        <div className='absolute top-3 left-3 right-3 z-10 flex flex-wrap gap-2'>
          <div className='flex-1 min-w-[200px] relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none'>&#x1F50D;</span>
            <input ref={searchRef} type='text' placeholder='Search for a beach, lake, marina, or address...'
              className='w-full pl-9 pr-4 py-2.5 bg-white rounded-lg shadow-md text-sm outline-none' />
          </div>
          <button onClick={locateMe} className='px-4 py-2.5 bg-emerald-500 text-white rounded-lg shadow-md text-sm font-semibold hover:bg-emerald-600'>
            &#x1F4CD; Locate Me
          </button>
          <select value={units} onChange={e => setUnits(e.target.value as any)}
            className='px-3 py-2.5 bg-white rounded-lg shadow-md text-sm outline-none'>
            <option value='imperial'>Imperial</option>
            <option value='metric'>Metric</option>
          </select>
        </div>
        {!data && !loading && (
          <div className='absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-xl px-5 py-2.5 shadow-lg text-sm text-slate-600'>
            &#x1F4CD; Tap the map where you will be paddling
          </div>
        )}
      </div>

      {loading && <div className='text-center py-8 text-slate-500'>Loading weather data...</div>}
      {error && <div className='text-center py-4 text-red-500'>{error}</div>}

      {data && c && (
        <>
          {/* Location Header */}
          <h2 className='text-2xl font-bold text-slate-800 mb-1'>{data.location.name}</h2>
          <p className='text-sm text-slate-500 mb-4'>
            {c.gDescription || c.nwsDescription || (c.omWeatherCode != null ? weatherDescription(c.omWeatherCode) : '')}
          </p>

          {/* Current Conditions Grid */}
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6'>
            {bestTemp != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>Temperature</div>
                <div className='text-2xl font-bold text-slate-800'>{u.toTemp(bestTemp!)}{u.tempUnit}</div>
                <div className='text-xs text-slate-400 mt-1'>Feels {u.toTemp(c.omFeelsLike ?? bestTemp)}{u.tempUnit}</div>
              </div>
            )}
            {bestWind != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>Wind</div>
                <div className='text-2xl font-bold text-slate-800'>{u.toSpeed(bestWind!)} <span className='text-sm'>{u.speedUnit}</span></div>
                <div className='text-xs text-slate-400 mt-1'>{bestWindDeg != null ? windDirection(bestWindDeg!) : ''} {c.omGustsMph ? `Gusts ${u.toSpeed(c.omGustsMph)}` : ''}</div>
              </div>
            )}
            {bestHumidity != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>Humidity</div>
                <div className='text-2xl font-bold text-slate-800'>{bestHumidity}%</div>
                <div className='text-xs text-slate-400 mt-1'>Dew {c.omDewPoint != null ? `${u.toTemp(c.omDewPoint)}${u.tempUnit}` : '--'}</div>
              </div>
            )}
            {c.omUV != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>UV Index</div>
                <div className={`text-2xl font-bold ${c.omUV >= 8 ? 'text-red-500' : c.omUV >= 3 ? 'text-amber-500' : 'text-green-500'}`}>{c.gUV ?? c.omUV.toFixed(1)}</div>
                <div className='text-xs text-slate-400 mt-1'>{c.omUV >= 11 ? 'Extreme' : c.omUV >= 8 ? 'Very High' : c.omUV >= 6 ? 'High' : c.omUV >= 3 ? 'Moderate' : 'Low'}</div>
              </div>
            )}
            {bestVis != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>Visibility</div>
                <div className='text-2xl font-bold text-slate-800'>{u.toDist(bestVis)} <span className='text-sm'>{u.distUnit}</span></div>
              </div>
            )}
            {bestPressure != null && (
              <div className='bg-white border border-slate-200 rounded-xl p-4'>
                <div className='text-xs text-slate-400 mb-1'>Pressure</div>
                <div className='text-2xl font-bold text-slate-800'>{bestPressure} <span className='text-sm'>hPa</span></div>
              </div>
            )}
          </div>

          {/* Beaufort Scale */}
          {bf && (
            <div className='bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full flex items-center justify-center text-white font-bold' style={{background: bf.color}}>{bf.scale}</div>
              <div><div className='font-semibold text-slate-800'>Beaufort {bf.scale}: {bf.label}</div>
                <div className='text-xs text-slate-500'>{u.toSpeed(bestWind!)} {u.speedUnit} {bestWindDeg != null ? windDirection(bestWindDeg!) : ''}</div>
              </div>
            </div>
          )}

          {/* Marine Conditions */}
          {data.marine && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>Marine Conditions</h3>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {data.marine.waveHeight != null && (
                  <div><div className='text-xs text-slate-400'>Wave Height</div>
                    <div className='text-lg font-bold text-slate-800'>{u.toHeight(data.marine.waveHeight * 3.281)} {u.heightUnit}</div></div>
                )}
                {data.marine.wavePeriod != null && (
                  <div><div className='text-xs text-slate-400'>Wave Period</div>
                    <div className='text-lg font-bold text-slate-800'>{data.marine.wavePeriod.toFixed(1)}s</div></div>
                )}
                {data.marine.swellHeight != null && (
                  <div><div className='text-xs text-slate-400'>Swell Height</div>
                    <div className='text-lg font-bold text-slate-800'>{u.toHeight(data.marine.swellHeight * 3.281)} {u.heightUnit}</div></div>
                )}
                {data.marine.seaSurfaceTempF != null && (
                  <div><div className='text-xs text-slate-400'>Sea Surface Temp</div>
                    <div className='text-lg font-bold text-slate-800'>{u.toTemp(data.marine.seaSurfaceTempF)}{u.tempUnit}</div></div>
                )}
              </div>
            </div>
          )}

          {/* NWS Alerts */}
          {data.nwsAlerts.length > 0 && (
            <div className='mb-6'>
              {data.nwsAlerts.map((a, i) => (
                <div key={i} className={`border rounded-xl p-4 mb-2 ${a.severity === 'Extreme' || a.severity === 'Severe' ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
                  <div className='font-bold text-sm'>{a.event}</div>
                  <div className='text-xs text-slate-600 mt-1'>{a.headline}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tides */}
          {data.tidePredictions.length > 0 && data.tideStation && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-1'>Tides</h3>
              <p className='text-xs text-slate-400 mb-3'>{data.tideStation.name} ({data.tideStation.dist} mi away)</p>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                {data.tidePredictions.slice(0, 8).map((t, i) => {
                  const d = new Date(t.time);
                  return (
                    <div key={i} className='flex items-center gap-2 py-1'>
                      <span className={`text-lg ${t.type === 'H' ? 'text-blue-500' : 'text-slate-400'}`}>{t.type === 'H' ? '\u2191' : '\u2193'}</span>
                      <div>
                        <div className='text-sm font-semibold text-slate-700'>{t.height.toFixed(1)} ft</div>
                        <div className='text-xs text-slate-400'>{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6-Day Forecast */}
          {data.daily.length > 0 && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>6-Day Forecast</h3>
              <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
                {data.daily.map((d, i) => {
                  const date = new Date(d.date + 'T12:00:00');
                  return (
                    <div key={i} className='text-center p-3 bg-slate-50 rounded-xl'>
                      <div className='text-xs font-semibold text-slate-600 mb-1'>{i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className='text-xs text-slate-400 mb-2'>{weatherDescription(d.weatherCode)}</div>
                      <div className='text-lg font-bold text-slate-800'>{u.toTemp(d.tempMaxF)}{u.tempUnit}</div>
                      <div className='text-xs text-slate-400'>{u.toTemp(d.tempMinF)}{u.tempUnit}</div>
                      <div className='text-xs text-slate-400 mt-1'>Wind {u.toSpeed(d.windMaxMph)} {u.speedUnit}</div>
                      {d.precipProbMax > 10 && <div className='text-xs text-blue-500 mt-1'>{d.precipProbMax}% rain</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NWS Text Forecast */}
          {data.nwsForecastPeriods.length > 0 && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>NWS Detailed Forecast</h3>
              <div className='space-y-3'>
                {data.nwsForecastPeriods.slice(0, 6).map((p, i) => (
                  <div key={i} className='border-b border-slate-100 pb-3 last:border-0'>
                    <div className='flex justify-between items-baseline'>
                      <span className='font-semibold text-sm text-slate-700'>{p.name}</span>
                      <span className='text-sm font-bold text-slate-800'>{p.temperature}{p.temperatureUnit}</span>
                    </div>
                    <p className='text-xs text-slate-500 mt-1'>{p.detailedForecast}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Air Quality */}
          {data.airQuality && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>Air Quality</h3>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div>
                  <div className='text-xs text-slate-400'>AQI</div>
                  <div className={`text-2xl font-bold ${data.airQuality.aqi <= 50 ? 'text-green-500' : data.airQuality.aqi <= 100 ? 'text-amber-500' : 'text-red-500'}`}>{data.airQuality.aqi}</div>
                  <div className='text-xs text-slate-400'>{data.airQuality.aqi <= 50 ? 'Good' : data.airQuality.aqi <= 100 ? 'Moderate' : 'Unhealthy'}</div>
                </div>
                <div><div className='text-xs text-slate-400'>PM2.5</div><div className='text-lg font-bold text-slate-800'>{data.airQuality.pm25}</div></div>
                <div><div className='text-xs text-slate-400'>PM10</div><div className='text-lg font-bold text-slate-800'>{data.airQuality.pm10}</div></div>
                <div><div className='text-xs text-slate-400'>Ozone</div><div className='text-lg font-bold text-slate-800'>{data.airQuality.o3}</div></div>
              </div>
            </div>
          )}

          {/* River Flow */}
          {data.riverFlow.length > 0 && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>Nearby River Flow</h3>
              <div className='space-y-3'>
                {data.riverFlow.map((r, i) => (
                  <div key={i} className='flex items-center justify-between border-b border-slate-100 pb-2 last:border-0'>
                    <div>
                      <div className='text-sm font-semibold text-slate-700'>{r.siteName}</div>
                      <div className='text-xs text-slate-400'>{r.distanceMi} mi away</div>
                    </div>
                    <div className='text-right'>
                      <div className='text-sm font-bold text-slate-800'>{r.flowCfs.toLocaleString()} cfs</div>
                      {r.waterTempF && <div className='text-xs text-slate-400'>Water: {u.toTemp(r.waterTempF)}{u.tempUnit}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hourly Forecast */}
          {data.hourly.length > 0 && (
            <div className='bg-white border border-slate-200 rounded-xl p-5 mb-6'>
              <h3 className='font-bold text-slate-700 mb-3'>Hourly Forecast</h3>
              <div className='overflow-x-auto'>
                <div className='flex gap-3 min-w-max'>
                  {data.hourly.slice(0, 24).map((h, i) => {
                    const t = new Date(h.time);
                    return (
                      <div key={i} className='text-center min-w-[60px] py-2'>
                        <div className='text-xs text-slate-400'>{t.toLocaleTimeString('en-US', { hour: 'numeric' })}</div>
                        <div className='text-sm font-bold text-slate-800 my-1'>{u.toTemp(h.tempF)}{u.tempUnit}</div>
                        <div className='text-xs text-slate-500'>{u.toSpeed(h.windMph)} {u.speedUnit}</div>
                        {h.precipProb > 10 && <div className='text-xs text-blue-500'>{h.precipProb}%</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Data Sources */}
          <div className='text-center text-xs text-slate-400 py-4'>
            Data: <a href='https://open-meteo.com' target='_blank' className='text-sky-500'>Open-Meteo</a> &bull;{' '}
            <a href='https://weather.googleapis.com' target='_blank' className='text-sky-500'>Google Weather</a> &bull;{' '}
            <a href='https://tidesandcurrents.noaa.gov' target='_blank' className='text-sky-500'>NOAA</a> &bull;{' '}
            <a href='https://www.weather.gov' target='_blank' className='text-sky-500'>NWS</a> &bull;{' '}
            <a href='https://waterservices.usgs.gov' target='_blank' className='text-sky-500'>USGS</a>
          </div>
        </>
      )}


    </div>
  );
}

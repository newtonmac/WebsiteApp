// Weather API Service — shared data fetching layer for weather & conditions pages
// This extracts all API calls from the legacy paddle-weather.html into reusable TypeScript

const GOOGLE_API_KEY = 'AIzaSyAR81pUTUz5ON7ZBuoouTh2RTHyECr6yvg';
const NWS_HEADERS = { 'User-Agent': 'PaddlePoint paddlepoint.org', 'Accept': 'application/json' };

// ============ TYPES ============

export interface WeatherLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface CurrentConditions {
  omTemp: number | null;
  omFeelsLike: number | null;
  omHumidity: number | null;
  omWindMph: number | null;
  omGustsMph: number | null;
  omWindDeg: number | null;
  omUV: number | null;
  omVisibilityMi: number | null;
  omPressureHpa: number | null;
  omWeatherCode: number | null;
  omIsDay: boolean;
  omDewPoint: number | null;
  omPrecipitation: number | null;
  gTemp: number | null;
  gFeelsLike: number | null;
  gHumidity: number | null;
  gWindMph: number | null;
  gGustMph: number | null;
  gWindDeg: number | null;
  gUV: number | null;
  gVisibilityMi: number | null;
  gPressureHpa: number | null;
  gConditionType: string | null;
  gDescription: string | null;
  nwsTemp: number | null;
  nwsFeelsLike: number | null;
  nwsHumidity: number | null;
  nwsWindMph: number | null;
  nwsGustMph: number | null;
  nwsWindDeg: number | null;
  nwsVisibilityMi: number | null;
  nwsPressureHpa: number | null;
  nwsStation: string | null;
  nwsDescription: string | null;
}

export interface HourlyForecast {
  time: string;
  tempF: number;
  windMph: number;
  gustsMph: number;
  windDeg: number;
  precipProb: number;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMaxF: number;
  tempMinF: number;
  windMaxMph: number;
  gustMaxMph: number;
  precipProbMax: number;
  sunrise: string;
  sunset: string;
}

export interface GoogleHourlyForecast {
  time: string;
  tempF: number;
  humidity: number;
  windMph: number;
  precipProb: number;
  conditionType: string;
  isDark: boolean;
}

export interface MarineData {
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  swellDirection: number | null;
  swellPeriod: number | null;
  seaSurfaceTempF: number | null;
  currentVelocity: number | null;
  currentDirection: number | null;
  hourlyWaveHeight: number[];
  hourlyWavePeriod: number[];
  hourlySwellHeight: number[];
  dailyWaveHeightMax: number[];
  dailyWavePeriodMax: number[];
  dailySwellHeightMax: number[];
}

export interface NWSAlert {
  event: string;
  headline: string;
  severity: string;
  description: string;
  expires: string;
}

export interface NWSForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
}

export interface TidePrediction {
  time: string;
  height: number;
  type: 'H' | 'L';
}

export interface TideHourly {
  time: string;
  height: number;
}

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  dist: number;
}

export interface WaterQualityReport {
  beach: string;
  status: string;
  advisory: string;
  date: string;
  lat?: number;
  lon?: number;
}

export interface HABReport {
  source: string;
  species: string;
  cellCount: number;
  date: string;
  location: string;
  lat?: number;
  lon?: number;
}

export interface AirQuality {
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
}

export interface RiverFlowData {
  siteName: string;
  flowCfs: number;
  gageHeightFt: number;
  waterTempF: number | null;
  dateTime: string;
  distanceMi: number;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentConditions;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  googleHourly: GoogleHourlyForecast[];
  marine: MarineData | null;
  nwsAlerts: NWSAlert[];
  nwsForecastPeriods: NWSForecastPeriod[];
  tideStation: TideStation | null;
  tidePredictions: TidePrediction[];
  tideHourly: TideHourly[];
  waterQuality: WaterQualityReport[];
  hab: HABReport[];
  airQuality: AirQuality | null;
  riverFlow: RiverFlowData[];
}

// ============ TIDE STATIONS ============
const TIDE_STATIONS: TideStation[] = [
  { id: '9410230', name: 'La Jolla', lat: 32.867, lon: -117.257, dist: 0 },
  { id: '9410170', name: 'San Diego', lat: 32.714, lon: -117.174, dist: 0 },
  { id: '9410580', name: 'Newport Beach', lat: 33.604, lon: -117.883, dist: 0 },
  { id: '9410660', name: 'Los Angeles', lat: 33.720, lon: -118.272, dist: 0 },
  { id: '9410840', name: 'Santa Monica', lat: 34.008, lon: -118.500, dist: 0 },
  { id: '9411340', name: 'Santa Barbara', lat: 34.408, lon: -119.685, dist: 0 },
  { id: '9412110', name: 'Port San Luis', lat: 35.169, lon: -120.760, dist: 0 },
  { id: '9413450', name: 'Monterey', lat: 36.605, lon: -121.888, dist: 0 },
  { id: '9414290', name: 'San Francisco', lat: 37.806, lon: -122.465, dist: 0 },
  { id: '9414750', name: 'Alameda', lat: 37.772, lon: -122.298, dist: 0 },
  { id: '8518750', name: 'The Battery, NY', lat: 40.700, lon: -74.014, dist: 0 },
  { id: '8443970', name: 'Boston', lat: 42.355, lon: -71.053, dist: 0 },
  { id: '8723214', name: 'Virginia Key, FL', lat: 25.732, lon: -80.162, dist: 0 },
  { id: '8726520', name: 'St. Petersburg, FL', lat: 27.761, lon: -82.627, dist: 0 },
  { id: '8729108', name: 'Panama City, FL', lat: 30.152, lon: -85.667, dist: 0 },
  { id: '8761724', name: 'Grand Isle, LA', lat: 29.263, lon: -89.957, dist: 0 },
  { id: '8770570', name: 'Sabine Pass, TX', lat: 29.728, lon: -93.870, dist: 0 },
  { id: '8771013', name: 'Eagle Point, TX', lat: 29.481, lon: -94.918, dist: 0 },
  { id: '9447130', name: 'Seattle', lat: 47.603, lon: -122.339, dist: 0 },
  { id: '9432780', name: 'Charleston, OR', lat: 43.345, lon: -124.322, dist: 0 },
  { id: '1612340', name: 'Honolulu', lat: 21.307, lon: -157.867, dist: 0 },
];

// ============ UTILITY FUNCTIONS ============

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestTideStation(lat: number, lon: number): TideStation {
  let best = TIDE_STATIONS[0];
  let bestDist = Infinity;
  for (const s of TIDE_STATIONS) {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { ...best, dist: Math.round(bestDist * 10) / 10 };
}

export function windDirection(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function weatherDescription(code: number): string {
  const map: Record<number, string> = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
    61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
    80:'Rain showers',81:'Moderate showers',82:'Heavy showers',
    95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Severe thunderstorm',
  };
  return map[code] || 'Unknown';
}

export function beaufortFromMph(mph: number): { scale: number; label: string; color: string } {
  if (mph < 1) return { scale: 0, label: 'Calm', color: '#a3e635' };
  if (mph < 4) return { scale: 1, label: 'Light Air', color: '#86efac' };
  if (mph < 8) return { scale: 2, label: 'Light Breeze', color: '#6ee7b7' };
  if (mph < 13) return { scale: 3, label: 'Gentle Breeze', color: '#5eead4' };
  if (mph < 19) return { scale: 4, label: 'Moderate Breeze', color: '#67e8f9' };
  if (mph < 25) return { scale: 5, label: 'Fresh Breeze', color: '#fbbf24' };
  if (mph < 32) return { scale: 6, label: 'Strong Breeze', color: '#fb923c' };
  if (mph < 39) return { scale: 7, label: 'Near Gale', color: '#f87171' };
  if (mph < 47) return { scale: 8, label: 'Gale', color: '#ef4444' };
  if (mph < 55) return { scale: 9, label: 'Strong Gale', color: '#dc2626' };
  if (mph < 64) return { scale: 10, label: 'Storm', color: '#b91c1c' };
  if (mph < 73) return { scale: 11, label: 'Violent Storm', color: '#991b1b' };
  return { scale: 12, label: 'Hurricane', color: '#7f1d1d' };
}

export function createUnitHelpers(isMetric: boolean) {
  return {
    tempUnit: isMetric ? '\u00b0C' : '\u00b0F',
    speedUnit: isMetric ? 'km/h' : 'mph',
    distUnit: isMetric ? 'km' : 'mi',
    heightUnit: isMetric ? 'm' : 'ft',
    toTemp: (f: number) => isMetric ? Math.round((f - 32) * 5 / 9) : Math.round(f),
    toSpeed: (mph: number) => isMetric ? Math.round(mph * 1.60934) : Math.round(mph),
    toDist: (mi: number) => isMetric ? +(mi * 1.60934).toFixed(1) : +mi.toFixed(1),
    toHeight: (ft: number) => isMetric ? +(ft * 0.3048).toFixed(1) : ft,
  };
}

// ============ API FETCHERS ============

function safeFetch(url: string, opts?: RequestInit): Promise<any> {
  return fetch(url, opts).then(r => r.ok ? r.json() : null).catch(() => null);
}

export async function fetchOpenMeteo(lat: number, lon: number) {
  return safeFetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility,weather_code,is_day,surface_pressure,dew_point_2m,precipitation` +
    `&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,weather_code,is_day,cloud_cover` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max,sunrise,sunset` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=6`
  );
}

export async function fetchMarine(lat: number, lon: number) {
  return safeFetch(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_period,wave_direction,ocean_current_velocity,ocean_current_direction,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature` +
    `&hourly=wave_height,wave_period,swell_wave_height` +
    `&daily=wave_height_max,wave_period_max,swell_wave_height_max` +
    `&timezone=auto&forecast_days=6`
  );
}

export async function fetchGoogleWeatherCurrent(lat: number, lon: number) {
  return safeFetch(`https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_API_KEY}&location.latitude=${lat}&location.longitude=${lon}`);
}

export async function fetchGoogleWeatherHourly(lat: number, lon: number) {
  return safeFetch(`https://weather.googleapis.com/v1/forecast/hours:lookup?key=${GOOGLE_API_KEY}&location.latitude=${lat}&location.longitude=${lon}&hours=12`);
}

export async function fetchNWSPoint(lat: number, lon: number) {
  return safeFetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: NWS_HEADERS });
}

export async function fetchNWSObservation(stationsUrl: string) {
  const stations = await safeFetch(stationsUrl, { headers: NWS_HEADERS });
  if (!stations?.features?.[0]) return null;
  const stationId = stations.features[0].properties.stationIdentifier;
  return safeFetch(`https://api.weather.gov/stations/${stationId}/observations/latest`, { headers: NWS_HEADERS });
}

export async function fetchNWSForecast(forecastUrl: string) {
  return safeFetch(forecastUrl, { headers: NWS_HEADERS });
}

export async function fetchNWSAlerts(lat: number, lon: number): Promise<NWSAlert[]> {
  const data = await safeFetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: NWS_HEADERS });
  if (!data?.features) return [];
  return data.features.map((f: any) => ({
    event: f.properties.event, headline: f.properties.headline,
    severity: f.properties.severity, description: f.properties.description, expires: f.properties.expires,
  }));
}

export async function fetchTidePredictions(stationId: string): Promise<TidePrediction[]> {
  const now = new Date();
  const begin = now.toISOString().split('T')[0].replace(/-/g, '');
  const end = new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const data = await safeFetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin}&end_date=${end}&station=${stationId}&product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&application=PaddlePoint&format=json`);
  if (!data?.predictions) return [];
  return data.predictions.map((p: any) => ({ time: p.t, height: parseFloat(p.v), type: p.type as 'H' | 'L' }));
}

export async function fetchTideHourly(stationId: string): Promise<TideHourly[]> {
  const now = new Date();
  const begin = now.toISOString().split('T')[0].replace(/-/g, '');
  const end = new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const data = await safeFetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin}&end_date=${end}&station=${stationId}&product=predictions&datum=MLLW&interval=h&units=english&time_zone=lst_ldt&application=PaddlePoint&format=json`);
  if (!data?.predictions) return [];
  return data.predictions.map((p: any) => ({ time: p.t, height: parseFloat(p.v) }));
}

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  const data = await safeFetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone`);
  if (!data?.current) return null;
  return { aqi: data.current.us_aqi, pm25: data.current.pm2_5, pm10: data.current.pm10, o3: data.current.ozone };
}

export async function fetchRiverFlow(lat: number, lon: number): Promise<RiverFlowData[]> {
  const data = await safeFetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${lon-0.5},${lat-0.5},${lon+0.5},${lat+0.5}&parameterCd=00060,00065,00010&siteType=ST&siteStatus=active`);
  if (!data?.value?.timeSeries) return [];
  const sites = new Map<string, RiverFlowData>();
  for (const ts of data.value.timeSeries) {
    const info = ts.sourceInfo;
    const siteId = info.siteCode[0].value;
    const siteLat = info.geoLocation.geogLocation.latitude;
    const siteLon = info.geoLocation.geogLocation.longitude;
    const paramCode = ts.variable.variableCode[0].value;
    const values = ts.values[0].value;
    const latest = values[values.length - 1];
    if (!latest) continue;
    if (!sites.has(siteId)) {
      sites.set(siteId, { siteName: info.siteName, flowCfs: 0, gageHeightFt: 0, waterTempF: null, dateTime: latest.dateTime, distanceMi: Math.round(haversine(lat, lon, siteLat, siteLon) * 10) / 10 });
    }
    const site = sites.get(siteId)!;
    const val = parseFloat(latest.value);
    if (paramCode === '00060') site.flowCfs = val;
    if (paramCode === '00065') site.gageHeightFt = val;
    if (paramCode === '00010') site.waterTempF = Math.round(val * 9 / 5 + 32);
  }
  return [...sites.values()].sort((a, b) => a.distanceMi - b.distanceMi).slice(0, 5);
}

// ============ MAIN ORCHESTRATOR ============

export async function fetchAllWeatherData(lat: number, lon: number, name: string): Promise<WeatherData> {
  const [openMeteo, marine, googleCurrent, googleHourlyRaw, nwsPoint] = await Promise.all([
    fetchOpenMeteo(lat, lon), fetchMarine(lat, lon),
    fetchGoogleWeatherCurrent(lat, lon), fetchGoogleWeatherHourly(lat, lon), fetchNWSPoint(lat, lon),
  ]);

  let nwsObs: any = null;
  let nwsForecast: any = null;
  if (nwsPoint?.properties) {
    const [obs, fc] = await Promise.all([
      fetchNWSObservation(nwsPoint.properties.observationStations),
      fetchNWSForecast(nwsPoint.properties.forecast),
    ]);
    nwsObs = obs; nwsForecast = fc;
  }

  const cToF = (c: number | null) => c != null ? Math.round(c * 9 / 5 + 32) : null;
  const msToMph = (ms: number | null) => ms != null ? Math.round(ms * 2.237) : null;
  const nwsP = nwsObs?.properties;
  const gTempF = (t: any) => t ? (t.unit === 'FAHRENHEIT' ? Math.round(t.degrees) : Math.round(t.degrees * 9 / 5 + 32)) : null;

  const cur = openMeteo?.current;
  const gc = googleCurrent;
  const current: CurrentConditions = {
    omTemp: cur?.temperature_2m != null ? Math.round(cur.temperature_2m) : null,
    omFeelsLike: cur?.apparent_temperature != null ? Math.round(cur.apparent_temperature) : null,
    omHumidity: cur?.relative_humidity_2m ?? null,
    omWindMph: cur?.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null,
    omGustsMph: cur?.wind_gusts_10m != null ? Math.round(cur.wind_gusts_10m) : null,
    omWindDeg: cur?.wind_direction_10m ?? null,
    omUV: cur?.uv_index ?? null,
    omVisibilityMi: cur?.visibility ? +(cur.visibility / 1609.34).toFixed(1) : null,
    omPressureHpa: cur?.surface_pressure ? Math.round(cur.surface_pressure) : null,
    omWeatherCode: cur?.weather_code ?? null,
    omIsDay: !!cur?.is_day,
    omDewPoint: cur?.dew_point_2m != null ? Math.round(cur.dew_point_2m) : null,
    omPrecipitation: cur?.precipitation ?? null,
    gTemp: gc ? gTempF(gc.temperature) : null,
    gFeelsLike: gc ? gTempF(gc.feelsLike) : null,
    gHumidity: gc?.relativeHumidity ?? null,
    gWindMph: gc?.wind?.speed ? Math.round(gc.wind.speed.value * 0.621371) : null,
    gGustMph: gc?.wind?.gust ? Math.round(gc.wind.gust.value * 0.621371) : null,
    gWindDeg: gc?.wind?.direction?.degrees ?? null,
    gUV: gc?.uvIndex ?? null,
    gVisibilityMi: gc?.visibility ? +(gc.visibility.value * 0.000621371).toFixed(1) : null,
    gPressureHpa: gc?.airPressure ? Math.round(gc.airPressure.meanSeaLevelMillibars) : null,
    gConditionType: gc?.condition?.type ?? null,
    gDescription: gc?.condition?.description ?? null,
    nwsTemp: nwsP ? cToF(nwsP.temperature?.value) : null,
    nwsFeelsLike: nwsP ? cToF(nwsP.windChill?.value ?? nwsP.heatIndex?.value) : null,
    nwsHumidity: nwsP?.relativeHumidity?.value != null ? Math.round(nwsP.relativeHumidity.value) : null,
    nwsWindMph: nwsP ? msToMph(nwsP.windSpeed?.value) : null,
    nwsGustMph: nwsP ? msToMph(nwsP.windGust?.value) : null,
    nwsWindDeg: nwsP?.windDirection?.value != null ? Math.round(nwsP.windDirection.value) : null,
    nwsVisibilityMi: nwsP?.visibility?.value != null ? Math.round(nwsP.visibility.value / 1609.34 * 10) / 10 : null,
    nwsPressureHpa: nwsP?.barometricPressure?.value != null ? Math.round(nwsP.barometricPressure.value / 100) : null,
    nwsStation: nwsP?.station ? nwsP.station.split('/').pop() : null,
    nwsDescription: nwsP?.textDescription ?? null,
  };

  const hourly: HourlyForecast[] = [];
  if (openMeteo?.hourly) {
    const h = openMeteo.hourly;
    for (let i = 0; i < (h.time?.length ?? 0) && i < 48; i++) {
      hourly.push({ time: h.time[i], tempF: Math.round(h.temperature_2m[i]), windMph: Math.round(h.wind_speed_10m[i]),
        gustsMph: Math.round(h.wind_gusts_10m[i]), windDeg: Math.round(h.wind_direction_10m[i]),
        precipProb: h.precipitation_probability[i], weatherCode: h.weather_code[i], isDay: !!h.is_day[i], cloudCover: h.cloud_cover[i] });
    }
  }

  const daily: DailyForecast[] = [];
  if (openMeteo?.daily) {
    const d = openMeteo.daily;
    for (let i = 0; i < (d.time?.length ?? 0); i++) {
      daily.push({ date: d.time[i], weatherCode: d.weather_code[i], tempMaxF: Math.round(d.temperature_2m_max[i]),
        tempMinF: Math.round(d.temperature_2m_min[i]), windMaxMph: Math.round(d.wind_speed_10m_max[i]),
        gustMaxMph: Math.round(d.wind_gusts_10m_max[i]), precipProbMax: d.precipitation_probability_max[i],
        sunrise: d.sunrise[i], sunset: d.sunset[i] });
    }
  }

  const googleHourly: GoogleHourlyForecast[] = [];
  if (googleHourlyRaw?.forecastHours) {
    for (const h of googleHourlyRaw.forecastHours) {
      googleHourly.push({ time: h.interval?.startTime ?? '', tempF: gTempF(h.temperature) ?? 0,
        humidity: h.relativeHumidity ?? 0, windMph: h.wind?.speed ? Math.round(h.wind.speed.value * 0.621371) : 0,
        precipProb: h.precipitation?.probability ?? 0, conditionType: h.weatherCondition?.type ?? '', isDark: !!h.isDark });
    }
  }

  let marineData: MarineData | null = null;
  if (marine?.current) {
    const mc = marine.current;
    marineData = {
      waveHeight: mc.wave_height ?? null, wavePeriod: mc.wave_period ?? null, waveDirection: mc.wave_direction ?? null,
      swellHeight: mc.swell_wave_height ?? null, swellDirection: mc.swell_wave_direction ?? null, swellPeriod: mc.swell_wave_period ?? null,
      seaSurfaceTempF: mc.sea_surface_temperature != null ? Math.round(mc.sea_surface_temperature * 9 / 5 + 32) : null,
      currentVelocity: mc.ocean_current_velocity ?? null, currentDirection: mc.ocean_current_direction ?? null,
      hourlyWaveHeight: marine.hourly?.wave_height ?? [], hourlyWavePeriod: marine.hourly?.wave_period ?? [],
      hourlySwellHeight: marine.hourly?.swell_wave_height ?? [],
      dailyWaveHeightMax: marine.daily?.wave_height_max ?? [], dailyWavePeriodMax: marine.daily?.wave_period_max ?? [],
      dailySwellHeightMax: marine.daily?.swell_wave_height_max ?? [],
    };
  }

  const nwsAlerts = await fetchNWSAlerts(lat, lon);

  const nwsForecastPeriods: NWSForecastPeriod[] = [];
  if (nwsForecast?.properties?.periods) {
    for (const p of nwsForecast.properties.periods) {
      nwsForecastPeriods.push({ name: p.name, temperature: p.temperature, temperatureUnit: p.temperatureUnit,
        windSpeed: p.windSpeed, windDirection: p.windDirection, shortForecast: p.shortForecast,
        detailedForecast: p.detailedForecast, isDaytime: p.isDaytime });
    }
  }

  const station = nearestTideStation(lat, lon);
  const [tidePredictions, tideHourly] = await Promise.all([fetchTidePredictions(station.id), fetchTideHourly(station.id)]);
  const [airQuality, riverFlow] = await Promise.all([fetchAirQuality(lat, lon), fetchRiverFlow(lat, lon)]);

  return {
    location: { lat, lon, name }, current, hourly, daily, googleHourly, marine: marineData,
    nwsAlerts, nwsForecastPeriods, tideStation: station, tidePredictions, tideHourly,
    waterQuality: [], hab: [], airQuality, riverFlow,
  };
}

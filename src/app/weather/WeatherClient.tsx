'use client';

export function WeatherClient() {
  return (
    <iframe
      src="/_legacy/paddle-weather.html"
      className="w-full border-0"
      style={{ height: 'calc(100vh - 73px)', minHeight: '600px' }}
      title="Weather & Tides"
      allow="geolocation"
    />
  );
}

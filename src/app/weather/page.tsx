import { Metadata } from 'next';
import { WeatherClient } from './WeatherClient';

export const metadata: Metadata = {
  title: 'Weather & Tides',
  alternates: { canonical: '/weather' },
  description: 'Weather, tides, marine forecast, water temperature, and safety conditions for paddlers. Triple-source data from Google, Open-Meteo, and NWS.',
  openGraph: {
    title: 'PaddlePoint — Weather & Tides',
    description: 'Weather, tides, marine forecast, water temperature, and safety conditions for paddlers.',
  },
};

export default function WeatherPage() {
  return <WeatherClient />;
}

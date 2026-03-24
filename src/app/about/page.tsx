import { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'About — PaddlePoint' };

export default function AboutPage() {
  return (
    <LegalPage title="About PaddlePoint">
      <div className="bg-gradient-to-br from-cyan-800 to-teal-800 text-white p-4 rounded-xl font-semibold mb-6 text-sm">
        🌊 PaddlePoint is a <strong>100% free community resource</strong> for paddlers worldwide. No ads, no accounts, no paywalls — just open data for the paddling community.
      </div>

      <h3>What is PaddlePoint?</h3>
      <p>PaddlePoint is a free, real-time conditions checker built for paddlers — kayakers, stand-up paddleboarders, canoers, and anyone who loves being on the water. Just tap a spot on the map and instantly get a detailed breakdown of conditions at that location.</p>

      <h3>What We Show You</h3>
      <ul>
        <li><strong>Paddle Score</strong> — An overall 0–100 rating of current conditions</li>
        <li><strong>Wind</strong> — Speed, gusts, and direction with a live compass</li>
        <li><strong>Waves &amp; Swell</strong> — Wave height, period, and direction for coastal spots</li>
        <li><strong>Tides</strong> — Current tide level and upcoming high/low times from NOAA</li>
        <li><strong>Weather</strong> — Temperature, UV index, visibility, and precipitation</li>
        <li><strong>Water Quality</strong> — Based on monitoring station data where available</li>
        <li><strong>Hourly Forecast</strong> — See how conditions change throughout the day</li>
      </ul>

      <h3>How It Works</h3>
      <p><strong>PaddlePoint does not generate, create, or verify any weather or conditions data.</strong> It is a data aggregator that collects and displays publicly available information from established third-party sources. All data is fetched directly from public APIs in real time within your browser.</p>

      <h3>Open Source &amp; Free</h3>
      <p>PaddlePoint is and always will be free. There are no ads, no premium tiers, and no data collection. We believe paddlers should have access to safety-critical conditions data without barriers.</p>

      <h3>Contact</h3>
      <p>Have feedback, a bug report, or a data source suggestion? Use the <strong>Feedback</strong> button in the navigation bar. We read every submission.</p>
    </LegalPage>
  );
}

import { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Data Sources — PaddlePoint' };

export default function DataSourcesPage() {
  return (
    <LegalPage title="Data Sources">
      <p>PaddlePoint aggregates publicly available data from the following sources. We do not independently verify, validate, or guarantee this data.</p>

      <h3>Weather &amp; Conditions</h3>
      <ul>
        <li><strong><a href="https://open-meteo.com" target="_blank">Open-Meteo</a></strong> — Wind speed, direction, gusts, temperature, UV, visibility, precipitation, cloud cover, and marine data (wave height, wave period, swell direction)</li>
        <li><strong><a href="https://developers.google.com/maps/documentation/weather" target="_blank">Google Weather API</a></strong> — Current conditions, hourly forecasts, thunderstorm probability, powered by Google DeepMind AI weather models</li>
        <li><strong><a href="https://tidesandcurrents.noaa.gov" target="_blank">NOAA Tides &amp; Currents</a></strong> — Official US government tide predictions and real-time water level observations</li>
        <li><strong><a href="https://www.weather.gov" target="_blank">National Weather Service (NWS)</a></strong> — Active weather alerts including beach hazard statements, coastal flood warnings, rip current advisories</li>
      </ul>

      <h3>Water Quality</h3>
      <ul>
        <li><strong><a href="https://data.ca.gov/dataset/beach-water-quality-postings-and-closures" target="_blank">California State Water Resources Control Board</a></strong> — Beach water quality advisories, postings, and closures based on bacteria testing via the CA Open Data Portal</li>
        <li><strong><a href="https://www.sdbeachinfo.com" target="_blank">SD County Dept. of Environmental Health</a></strong> — Real-time beach and bay water quality monitoring for San Diego County</li>
        <li><strong><a href="https://habsos.noaa.gov" target="_blank">NOAA HABSOS</a></strong> — Harmful Algal Bloom Observing System for algae/red tide conditions</li>
        <li><strong><a href="https://www.theswimguide.org" target="_blank">Swim Guide</a></strong> — Beach water quality data from monitoring programs worldwide</li>
      </ul>

      <h3>River &amp; Inland Water</h3>
      <ul>
        <li><strong><a href="https://waterservices.usgs.gov" target="_blank">USGS National Water Information System</a></strong> — Real-time river flow, water level, and water temperature data from gauging stations across the US</li>
      </ul>

      <h3>Mapping &amp; Location</h3>
      <ul>
        <li><strong><a href="https://maps.google.com" target="_blank">Google Maps &amp; Places API</a></strong> — Interactive map, location search, and place information</li>
        <li><strong><a href="https://www.coastal.ca.gov/YourCoast/" target="_blank">California Coastal Commission</a></strong> — Official coastal access points data</li>
      </ul>

      <h3>Safety Guidelines</h3>
      <ul>
        <li><strong><a href="https://www.uscgboating.org" target="_blank">U.S. Coast Guard</a></strong> — Cold water safety thresholds and boating safety</li>
        <li><strong><a href="https://americancanoe.org" target="_blank">American Canoe Association (ACA)</a></strong> — Paddling safety standards and thermal protection thresholds</li>
        <li><strong><a href="https://www.coldwatersafety.org" target="_blank">National Center for Cold Water Safety</a></strong> — Cold water immersion risk guidelines</li>
        <li><strong><a href="https://americanwhitewater.org" target="_blank">American Whitewater</a></strong> — River and whitewater safety standards</li>
      </ul>

      <p className="text-xs text-slate-400 mt-8">All data is fetched in real-time from public APIs. PaddlePoint has no control over the accuracy, availability, or reliability of third-party data.</p>
    </LegalPage>
  );
}

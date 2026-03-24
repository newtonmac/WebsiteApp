import { LegalPage } from '@/components/LegalPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Sources',
};

export default function DataSourcesPage() {
  return (
    <LegalPage title="Data Sources">
      <p>PaddlePoint aggregates publicly available data from the following trusted sources. We do not generate, create, or independently verify any data.</p>

      <h3>Weather & Marine</h3>
      <ul>
        <li><a href="https://open-meteo.com" target="_blank">Open-Meteo</a> — Wind, temperature, UV, visibility, precipitation, wave height, swell</li>
        <li><a href="https://developers.google.com/maps/documentation/weather" target="_blank">Google Weather API</a> — Current conditions, hourly forecasts, powered by DeepMind AI</li>
        <li><a href="https://www.weather.gov" target="_blank">National Weather Service (NWS)</a> — Active weather alerts, beach hazard statements</li>
      </ul>

      <h3>Tides & Water Level</h3>
      <ul>
        <li><a href="https://tidesandcurrents.noaa.gov" target="_blank">NOAA Tides & Currents</a> — Official US tide predictions and real-time water levels</li>
      </ul>

      <h3>Water Quality</h3>
      <ul>
        <li><a href="https://data.ca.gov/dataset/beach-water-quality-postings-and-closures" target="_blank">CA State Water Resources Control Board</a> — Beach advisories, postings, and closures</li>
        <li><a href="https://www.sdbeachinfo.com" target="_blank">San Diego County DEH</a> — Real-time beach and bay water quality monitoring</li>
        <li><a href="https://www.theswimguide.org" target="_blank">Swim Drink Fish / Swim Guide</a> — Beach water quality from 100+ affiliates worldwide</li>
      </ul>

      <h3>Harmful Algal Blooms</h3>
      <ul>
        <li><a href="https://habsos.noaa.gov" target="_blank">NOAA HABSOS</a> — Harmful Algal Bloom Observing System</li>
        <li><a href="https://fhab-api.sfei.org" target="_blank">CA FHAB (SFEI)</a> — Satellite cyanobacteria detection for California waterbodies</li>
      </ul>

      <h3>River & Stream Flow</h3>
      <ul>
        <li><a href="https://waterservices.usgs.gov" target="_blank">USGS Water Services</a> — Real-time streamflow, water temperature from gauging stations</li>
      </ul>

      <h3>Maps & Location</h3>
      <ul>
        <li><a href="https://maps.google.com" target="_blank">Google Maps & Places API</a> — Interactive maps, location search, place information</li>
      </ul>

      <h3>Safety Guidelines</h3>
      <ul>
        <li><a href="https://www.uscgboating.org" target="_blank">U.S. Coast Guard</a> — Cold water safety thresholds, boating regulations</li>
        <li><a href="https://americancanoe.org" target="_blank">American Canoe Association (ACA)</a> — Paddling safety standards</li>
        <li><a href="https://www.coldwatersafety.org" target="_blank">National Center for Cold Water Safety</a> — Cold water risk assessment</li>
        <li><a href="https://americanwhitewater.org" target="_blank">American Whitewater</a> — River safety, thermal protection guidelines</li>
      </ul>

      <p><strong>Disclaimer:</strong> PaddlePoint is a data aggregator — it collects and displays publicly available data from the sources listed above. It does not independently verify, validate, or guarantee this data. Always consult official sources directly for critical safety decisions.</p>
    </LegalPage>
  );
}

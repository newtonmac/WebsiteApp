import { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Safety Disclaimer — PaddlePoint' };

export default function SafetyPage() {
  return (
    <LegalPage title="Safety Disclaimer">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>⚠️ PaddlePoint is not a substitute for professional judgment, local knowledge, or official safety advisories.</strong>
      </div>

      <h3>Data Aggregator — Not a Safety Authority</h3>
      <p>PaddlePoint is merely a data aggregator. It collects and displays publicly available data from third-party sources including <a href="https://open-meteo.com" target="_blank">Open-Meteo</a>, <a href="https://tidesandcurrents.noaa.gov" target="_blank">NOAA Tides</a>, <a href="https://www.weather.gov" target="_blank">NWS</a>, and <a href="https://maps.google.com" target="_blank">Google Maps</a>. PaddlePoint does not independently verify, validate, or guarantee this data. It may be inaccurate, delayed, incomplete, or unavailable at any time.</p>
      <p>You should <strong>never</strong> rely solely on PaddlePoint to make decisions about whether to enter the water.</p>

      <h3>Before Every Paddle</h3>
      <ul>
        <li>Check official forecasts from the <a href="https://www.weather.gov" target="_blank">National Weather Service</a> or local meteorological agency</li>
        <li>Consult your local paddling federation or governing body for area-specific safety requirements</li>
        <li>Verify water quality with local environmental health agencies</li>
        <li>Assess conditions in person — conditions can change rapidly and without warning</li>
        <li>Inform someone of your planned route and expected return</li>
        <li>Always wear a PFD (Personal Flotation Device)</li>
        <li>Dress for the water temperature, not the air temperature</li>
      </ul>

      <h3>Water Temperature Safety</h3>
      <p>Cold water is the number one killer of recreational boaters according to the U.S. Coast Guard. PaddlePoint displays water temperature safety guidelines compiled from publicly available resources published by recognized organizations including the <a href="https://www.uscgboating.org" target="_blank">USCG</a>, <a href="https://americancanoe.org" target="_blank">ACA</a>, <a href="https://www.coldwatersafety.org" target="_blank">NCCWS</a>, and <a href="https://americanwhitewater.org" target="_blank">American Whitewater</a>. These are for <strong>general educational reference only</strong>. Local rules, requirements, and safety standards may differ.</p>

      <h3>Limitation of Liability</h3>
      <p>PaddlePoint is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components. In no event shall PaddlePoint be liable for any damages arising from the use or inability to use the service, including but not limited to personal injury, death, or property damage.</p>

      <h3>Assumption of Risk</h3>
      <p><strong>By using PaddlePoint and choosing to enter any body of water, you voluntarily assume all risks associated with water activities.</strong> You acknowledge that water sports are inherently dangerous and that no amount of data, forecasting, or technology can eliminate the risks involved. You are participating in water activities at your own risk and of your own free will.</p>

      <h3>Local Regulations</h3>
      <p>Water activities are regulated by local, state, and federal authorities. It is your responsibility to know and follow all applicable laws, ordinances, and regulations in your area. Failure to comply may result in fines, penalties, or criminal liability. PaddlePoint does not provide legal advice.</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-8 text-sm text-amber-800">
        <strong>By using PaddlePoint, you acknowledge that you have read and understood this safety disclaimer, that you understand the risks of water activities, that conditions can change without warning, and that you are solely responsible for your own safety.</strong>
      </div>
    </LegalPage>
  );
}

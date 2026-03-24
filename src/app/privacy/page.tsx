import { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy — PaddlePoint' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-sm text-slate-400 mb-4">Last updated: March 2026</p>

      <h3>Our Approach to Privacy</h3>
      <p>PaddlePoint is designed with privacy as a core principle. We collect the absolute minimum data needed to operate the service.</p>

      <h3>What We Collect</h3>
      <ul>
        <li><strong>Location (only when you tap the map)</strong> — The coordinates you select are used to fetch local conditions from third-party APIs. This location is not stored on our servers.</li>
        <li><strong>Anonymous page views</strong> — We count page visits to understand usage patterns. No personal information is attached to these counts.</li>
        <li><strong>Feedback submissions</strong> — If you submit feedback, we store the message and optionally your email (only if you provide one). This is stored in Cloudflare KV.</li>
      </ul>

      <h3>What We Do NOT Collect</h3>
      <ul>
        <li>No accounts, passwords, or personal profiles</li>
        <li>No cookies for tracking or advertising</li>
        <li>No GPS or device location (we only use the spot you tap on the map)</li>
        <li>No personal identification or demographic data</li>
        <li>No data is sold to third parties — ever</li>
      </ul>

      <h3>Third-Party Services</h3>
      <p>PaddlePoint fetches data from third-party APIs (Open-Meteo, NOAA, Google Maps, etc.) directly from your browser. Your browser connects to these services on your behalf, subject to their own privacy policies. PaddlePoint does not proxy or store this data.</p>

      <h3>Data Storage</h3>
      <p>Anonymous visitor counts are stored in Cloudflare KV. Feedback submissions are stored in Cloudflare KV. Club, event, and gear data is stored in Google Cloud SQL. No personal user data is stored in any database.</p>

      <h3>Your Rights</h3>
      <p>Since we collect virtually no personal data, there is little to manage. If you submitted feedback with an email address and wish to have it removed, use the Feedback form to let us know.</p>
    </LegalPage>
  );
}

import { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Cookie Policy — PaddlePoint' };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <h3>Our Cookie Usage</h3>
      <p>PaddlePoint uses <strong>zero tracking cookies</strong>. We do not use cookies for advertising, analytics, or user profiling.</p>

      <h3>What We Use Instead</h3>
      <ul>
        <li><strong>localStorage</strong> — We cache weather and conditions data locally in your browser to reduce API calls and improve load times. This data expires automatically and contains no personal information.</li>
        <li><strong>Session state</strong> — Your map position and search history are stored in browser memory only and are lost when you close the tab.</li>
      </ul>

      <h3>Third-Party Cookies</h3>
      <p>Google Maps (used for our map display) may set its own cookies according to Google&apos;s privacy policy. PaddlePoint has no control over these cookies.</p>

      <h3>No Consent Banner Needed</h3>
      <p>Since PaddlePoint does not use tracking cookies, we do not display a cookie consent banner. The only browser storage used is for caching public weather data to improve your experience.</p>
    </LegalPage>
  );
}

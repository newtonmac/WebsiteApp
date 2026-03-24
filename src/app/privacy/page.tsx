import { LegalPage } from '@/components/LegalPage';
import { privacyContent } from '@/content/privacy';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PaddlePoint',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <div dangerouslySetInnerHTML={{ __html: privacyContent }} />
    </LegalPage>
  );
}

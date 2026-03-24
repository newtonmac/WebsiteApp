import { LegalPage } from '@/components/LegalPage';
import { safetyContent } from '@/content/safety';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Safety Disclaimer — PaddlePoint',
};

export default function SafetyPage() {
  return (
    <LegalPage title="Safety Disclaimer">
      <div dangerouslySetInnerHTML={{ __html: safetyContent }} />
    </LegalPage>
  );
}

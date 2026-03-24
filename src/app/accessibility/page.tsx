import { LegalPage } from '@/components/LegalPage';
import { accessibilityContent } from '@/content/accessibility';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Statement — PaddlePoint',
};

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility Statement">
      <div dangerouslySetInnerHTML={{ __html: accessibilityContent }} />
    </LegalPage>
  );
}

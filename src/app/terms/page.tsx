import { LegalPage } from '@/components/LegalPage';
import { termsContent } from '@/content/terms';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — PaddlePoint',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <div dangerouslySetInnerHTML={{ __html: termsContent }} />
    </LegalPage>
  );
}

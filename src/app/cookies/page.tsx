import { LegalPage } from '@/components/LegalPage';
import { cookiesContent } from '@/content/cookies';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — PaddlePoint',
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <div dangerouslySetInnerHTML={{ __html: cookiesContent }} />
    </LegalPage>
  );
}

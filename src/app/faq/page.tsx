import { LegalPage } from '@/components/LegalPage';
import { faqContent } from '@/content/faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ & How to Use — PaddlePoint',
};

export default function FaqPage() {
  return (
    <LegalPage title="FAQ & How to Use">
      <div dangerouslySetInnerHTML={{ __html: faqContent }} />
    </LegalPage>
  );
}

import { LegalPage } from '@/components/LegalPage';
import { contactContent } from '@/content/contact';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — PaddlePoint',
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact Us">
      <div dangerouslySetInnerHTML={{ __html: contactContent }} />
    </LegalPage>
  );
}

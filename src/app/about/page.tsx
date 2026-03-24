import { LegalPage } from '@/components/LegalPage';
import { aboutContent } from '@/content/about';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About PaddlePoint — PaddlePoint',
};

export default function AboutPage() {
  return (
    <LegalPage title="About PaddlePoint">
      <div dangerouslySetInnerHTML={{ __html: aboutContent }} />
    </LegalPage>
  );
}

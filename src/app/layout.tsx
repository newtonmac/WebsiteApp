import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: { default: 'PaddlePoint', template: '%s — PaddlePoint' },
  description: 'Real-time paddle conditions, weather, clubs, events, and gear for SUP, kayak, outrigger, and canoe paddlers.',
  metadataBase: new URL('https://paddlepoint.org'),
  openGraph: {
    siteName: 'PaddlePoint',
    type: 'website',
    images: ['/paddlepoint.jpg'],
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: [
      { url: '/paddle-pin.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Script src="/pp-shared.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}

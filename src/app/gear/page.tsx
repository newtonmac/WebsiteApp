import { Metadata } from 'next';
import { query } from '@/lib/db';
import { GearList } from './GearList';

export const metadata: Metadata = {
  title: 'Gear',
  description: 'Paddle equipment brands and manufacturers. SUP boards, surfskis, kayaks, outrigger canoes, paddles, and PFDs from 50+ brands worldwide.',
  openGraph: { title: 'PaddlePoint — Gear', description: 'Paddle gear brands worldwide' },
};

export const revalidate = 3600;

interface Brand {
  id: number; name: string; categories: string; country: string; website: string;
  email: string; phone: string; description: string; popular_products: string;
  logo_url: string; facebook_url: string; instagram_url: string; distributors: string;
}

async function getBrands(): Promise<Brand[]> {
  try {
    const rows = await query('SELECT * FROM gear_brands ORDER BY name') as Brand[];
    return rows;
  } catch { return []; }
}

export default async function GearPage() {
  const brands = await getBrands();
  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Gear</h2>
      <p className="text-slate-500 mb-8">Paddle equipment brands and manufacturers worldwide. Click any brand for details, products, and links.</p>
      <GearList brands={JSON.parse(JSON.stringify(brands))} />
    </section>
  );
}

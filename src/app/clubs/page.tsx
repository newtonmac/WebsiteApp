import { Metadata } from 'next';
import { query } from '@/lib/db';
import { ClubsMap } from './ClubsMap';

export const metadata: Metadata = {
  title: 'Paddle Clubs',
  description: '7,700+ paddle clubs worldwide. Find kayak, SUP, outrigger, canoe, and dragon boat clubs near you with maps, reviews, and contact info.',
  openGraph: { title: 'PaddlePoint — Paddle Clubs', description: '7,700+ paddle clubs worldwide on an interactive map' },
};

export const revalidate = 300;

async function getClubStats() {
  try {
    const [total] = await query('SELECT COUNT(*) as count FROM clubs') as any[];
    const [countries] = await query('SELECT COUNT(DISTINCT country) as count FROM clubs') as any[];
    const crafts = await query(`SELECT craft_types FROM clubs WHERE craft_types IS NOT NULL AND craft_types != ''`) as any[];
    const craftSet = new Set<string>();
    crafts.forEach((r: any) => r.craft_types?.split(',').forEach((t: string) => { const c = t.trim(); if (c) craftSet.add(c); }));
    return { total: total.count, countries: countries.count, craftTypes: [...craftSet].sort() };
  } catch {
    return { total: 7795, countries: 86, craftTypes: [] };
  }
}

export default async function ClubsPage() {
  const stats = await getClubStats();

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
      <ClubsMap
        totalClubs={stats.total}
        totalCountries={stats.countries}
        craftTypes={stats.craftTypes}
      />
    </div>
  );
}

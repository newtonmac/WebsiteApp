import { Metadata } from 'next';
import { query } from '@/lib/db';
import { FederationsList } from './FederationsList';

export const metadata: Metadata = {
  title: 'Federations',
  alternates: { canonical: '/federations' },
  description: '181 paddling federations worldwide — national, continental, and international organizations governing canoe, kayak, SUP, and outrigger sports.',
  openGraph: { title: 'PaddlePoint — Federations', description: 'Paddling federations worldwide' },
};

export const revalidate = 86400; // ISR: daily

interface Federation {
  id: number; name: string; country: string; ioc_code: string; continent: string;
  website: string; logo_url: string; federation_type: string; member_countries: number;
}

async function getFederations(): Promise<Federation[]> {
  try {
    return await query('SELECT * FROM federations ORDER BY country') as Federation[];
  } catch { return []; }
}

export default async function FederationsPage() {
  const feds = await getFederations();
  const continental = feds.filter(f => f.federation_type === 'continental');
  const national = feds.filter(f => f.federation_type === 'national' || !f.federation_type);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-extrabold text-slate-800 mb-2">🏛 Paddling Federations Worldwide</h2>
      <p className="text-slate-500 mb-8">
        The official governing bodies for paddling sports — {continental.length} continental associations and {national.length} national
        federations affiliated with the <a href="https://www.canoeicf.com" target="_blank" className="text-sky-500 hover:underline">International Canoe Federation (ICF)</a>.
      </p>

      {/* Continental */}
      {continental.length > 0 && (
        <>
          <h3 className="text-xl font-bold text-slate-700 mb-4">🌍 Continental Associations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {continental.map(f => (
              <a key={f.id} href={f.website || '#'} target="_blank" rel="noopener noreferrer"
                className="bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-xl p-5 no-underline hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-lg mb-1">{f.name}</h4>
                <p className="text-sm opacity-70">{f.member_countries ? `${f.member_countries} member countries` : 'Continental association'}</p>
                {f.website && <p className="text-xs opacity-50 mt-1">{f.website.replace(/https?:\/\//, '').replace(/\/$/, '')}</p>}
              </a>
            ))}
          </div>
        </>
      )}

      {/* National */}
      <h3 className="text-xl font-bold text-slate-700 mb-4">🏳 National Federations</h3>
      <FederationsList federations={JSON.parse(JSON.stringify(national))} />
    </section>
  );
}

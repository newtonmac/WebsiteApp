import { query } from '@/lib/db';

export const revalidate = 60;

export default async function FederationsAdmin() {
  let feds: any[] = [];
  try {
    feds = await query('SELECT id, name, country, continent, website, federation_type FROM federations ORDER BY name ASC') as any[];
  } catch {}

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-4">🏛️ Federations ({feds.length})</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Continent</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Website</th>
            </tr>
          </thead>
          <tbody>
            {feds.map((f, i) => (
              <tr key={f.id} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/30">
                <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                <td className="px-4 py-2 font-medium text-white">{f.name}</td>
                <td className="px-4 py-2">{f.country}</td>
                <td className="px-4 py-2">{f.continent}</td>
                <td className="px-4 py-2 text-xs">{f.federation_type || '—'}</td>
                <td className="px-4 py-2">{f.website ? <a href={f.website} target="_blank" className="text-cyan-400 hover:underline text-xs truncate block max-w-[200px]">{f.website.replace(/https?:\/\//, '')}</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

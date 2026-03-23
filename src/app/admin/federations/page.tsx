import { query } from '@/lib/db';
import { FederationsAdmin } from './FederationsAdmin';

export const revalidate = 60;

export default async function FederationsAdminPage() {
  let feds: any[] = [];
  try {
    feds = await query('SELECT * FROM federations ORDER BY name ASC') as any[];
  } catch {}

  return <FederationsAdmin initialData={JSON.parse(JSON.stringify(feds))} />;
}

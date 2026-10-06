/** Observable import state of one user: rows in each table and objects in their Storage folder. */
import { getAdminSql } from './db.js';
import { importObjects } from './storage.js';

export interface ImportState {
  transactions: number;
  batches: number;
  attachments: number;
  objects: number;
}

export async function importState(userId: string): Promise<ImportState> {
  const [row] = await getAdminSql()<{ transactions: number; batches: number; attachments: number }[]>`
    select
      (select count(*)::int from public.transactions where user_id = ${userId}) as transactions,
      (select count(*)::int from public.import_batches where user_id = ${userId}) as batches,
      (select count(*)::int from public.attachments where user_id = ${userId}) as attachments`;
  return { ...(row as Omit<ImportState, 'objects'>), objects: (await importObjects([userId])).length };
}

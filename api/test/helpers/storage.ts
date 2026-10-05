/**
 * Storage helpers for integration tests. Objects in the `imports` bucket outlive their owner (no FK
 * from `storage.objects` to `auth.users`), so test files remove their users' folders explicitly.
 */
import { getAdminSql } from './db.js';
import { getLocalStack } from './stack.js';

/** Names of the objects in `imports` whose first folder is one of the given user ids. */
export async function importObjects(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await getAdminSql()<{ name: string }[]>`
    select name from storage.objects
    where bucket_id = 'imports' and split_part(name, '/', 1) = any(${userIds}::text[])
    order by name`;
  return rows.map((r) => r.name);
}

/** Deletes every object under the given users' folders through the Storage API (service key). */
export async function removeImportObjects(userIds: string[]): Promise<void> {
  const names = await importObjects(userIds);
  if (names.length === 0) return;
  const { apiUrl, serviceRoleKey } = getLocalStack();
  const res = await fetch(`${apiUrl}/storage/v1/object/imports`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: names }),
  });
  if (!res.ok) throw new Error(`Storage cleanup failed: HTTP ${res.status} ${await res.text()}`);
}

import { AppError } from '../../plugins/errors.js';

/** Private bucket created by migration 0004; objects live under `{userId}/...`. */
export const IMPORTS_BUCKET = 'imports';

const MAX_FILENAME_LENGTH = 100;
const FALLBACK_FILENAME = 'import.csv';
const STORAGE_TIMEOUT_MS = 30_000;

export interface StorageAccess {
  /** Supabase project URL. */
  supabaseUrl: string;
  /** Project API key sent as `apikey`; never a secret/service key (RLS must apply). */
  publishableKey: string;
  /** The user's own access token: Storage policies run as this user. */
  token: string;
}

export interface UploadImportFile extends StorageAccess {
  userId: string;
  batchId: string;
  filename: string;
  content: Uint8Array<ArrayBuffer>;
  contentType: string;
}

/**
 * Object name safe for a single path segment: directories and control characters are dropped,
 * anything outside `[A-Za-z0-9._-]` becomes `_`, leading dots are removed (no `..` or hidden names)
 * and the name is capped at 100 characters keeping its extension. Empty result → `import.csv`.
 */
export function safeFilename(filename: string): string {
  // eslint-disable-next-line no-control-regex
  const base = (filename.split(/[/\\]/).at(-1) ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  if (safe === '') return FALLBACK_FILENAME;
  if (safe.length <= MAX_FILENAME_LENGTH) return safe;
  const dot = safe.lastIndexOf('.');
  const extension = dot > 0 && safe.length - dot <= 10 ? safe.slice(dot) : '';
  return safe.slice(0, MAX_FILENAME_LENGTH - extension.length) + extension;
}

function objectUrl(supabaseUrl: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${IMPORTS_BUCKET}/${encoded}`;
}

function headers(access: StorageAccess): Record<string, string> {
  return { apikey: access.publishableKey, authorization: `Bearer ${access.token}` };
}

/** Only the operation and the HTTP status reach the message: no URL, token or key. */
function storageError(operation: string, status?: number): AppError {
  const detail = status === undefined ? 'Storage is unreachable' : `Storage answered HTTP ${status}`;
  return new AppError('storage_error', 502, `Could not ${operation} the import file: ${detail}`);
}

async function send(operation: string, url: string, init: RequestInit): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) });
  } catch {
    throw storageError(operation);
  }
  // Storage reports policy and not-found errors as HTTP 400 with the real code in the body.
  await res.arrayBuffer().catch(() => undefined);
  if (!res.ok) throw storageError(operation, res.status);
}

/**
 * Uploads the original file to `{userId}/{batchId}/{safeFilename}` as the user (no overwrite)
 * and returns that storage path. Failures throw `storage_error` (502).
 */
export async function uploadImportFile(input: UploadImportFile): Promise<string> {
  const path = `${input.userId}/${input.batchId}/${safeFilename(input.filename)}`;
  await send('store', objectUrl(input.supabaseUrl, path), {
    method: 'POST',
    headers: { ...headers(input), 'content-type': input.contentType },
    body: input.content,
  });
  return path;
}

/** Deletes one object of the user by its storage path. Failures throw `storage_error` (502). */
export async function removeImportFile(input: StorageAccess & { path: string }): Promise<void> {
  await send('remove', objectUrl(input.supabaseUrl, input.path), { method: 'DELETE', headers: headers(input) });
}

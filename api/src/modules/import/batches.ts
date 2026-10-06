import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { AppError } from '../../plugins/errors.js';
import { contentDisposition } from './contentDisposition.js';
import { UUID } from './preview.js';
import type { ImportRoutesOptions } from './routes.js';
import { downloadImportFile } from './storage.js';

const DEFAULT_LIMIT = 50;

/** `type/subtype` made of token characters; anything else is answered as a binary download. */
const MIME_TYPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;

const ImportedFileSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  filename: Type.String({ description: 'The name of the file as uploaded' }),
  mimeType: Type.String(),
  sizeBytes: Type.Integer(),
  bank: Type.String(),
  account: Type.Object({ id: Type.String({ format: 'uuid' }), nickname: Type.String() }),
  createdAt: Type.String({ format: 'date-time' }),
  rowCount: Type.Integer({ description: 'Data rows of the file' }),
  importedCount: Type.Integer(),
  skippedCount: Type.Integer(),
});

const ErrorBodySchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String(), field: Type.Optional(Type.String()) }),
});

const IdParams = Type.Object({ id: Type.String() });

const ListQuery = Type.Object({
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, description: `Most items returned; defaults to ${DEFAULT_LIMIT}` }),
  ),
});

interface ImportedFileRow {
  id: string;
  bank: string;
  row_count: number;
  imported_count: number;
  skipped_count: number;
  created_at: Date;
  filename: string;
  mime_type: string;
  size_bytes: number;
  account_id: string;
  nickname: string;
}

interface StoredFile {
  filename: string;
  mime_type: string;
  storage_path: string;
}

function notFound(): AppError {
  return new AppError('not_found', 404, 'Imported file not found');
}

/**
 * The user's imported files: `GET /imports` (newest first) and `GET /imports/:id/file`. The database is
 * reached only through `withUser` (RLS) and Storage only with the user's own token. The Storage path of
 * an attachment is read for the download only and never leaves the API.
 */
export async function importedFilesRoutes(app: FastifyInstance, options: ImportRoutesOptions): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.get(
    '/imports',
    { schema: { querystring: ListQuery, response: { 200: Type.Array(ImportedFileSchema) } } },
    async (request) => {
      const limit = request.query.limit ?? DEFAULT_LIMIT;
      const rows = await request.withUser(
        (tx) => tx<ImportedFileRow[]>`
          select b.id, b.bank, b.row_count, b.imported_count, b.skipped_count, b.created_at,
                 a.filename, a.mime_type, a.size_bytes, c.id as account_id, c.nickname
          from public.import_batches b
          join public.accounts c on c.id = b.account_id
          join lateral (
            select filename, mime_type, size_bytes from public.attachments
            where import_batch_id = b.id order by created_at, id limit 1
          ) a on true
          order by b.created_at desc, b.id desc
          limit ${limit}`,
      );
      return rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        bank: row.bank,
        account: { id: row.account_id, nickname: row.nickname },
        createdAt: row.created_at.toISOString(),
        rowCount: row.row_count,
        importedCount: row.imported_count,
        skippedCount: row.skipped_count,
      }));
    },
  );

  routes.get(
    '/imports/:id/file',
    {
      schema: {
        params: IdParams,
        response: {
          200: {
            description: 'The file exactly as uploaded; Content-Type is the stored mime type',
            content: { 'application/octet-stream': { schema: Type.String({ format: 'binary' }) } },
          },
          401: { ...ErrorBodySchema, description: 'unauthorized' },
          404: { ...ErrorBodySchema, description: 'not_found: unknown, foreign or non-UUID id, or the object is gone' },
          502: { ...ErrorBodySchema, description: 'storage_error' },
          503: { ...ErrorBodySchema, description: 'storage_not_configured' },
        },
      },
    },
    async (request, reply) => {
      const { publishableKey } = options;
      if (!publishableKey) {
        throw new AppError('storage_not_configured', 503, 'File storage is not configured on the server');
      }
      const { id } = request.params;
      if (!UUID.test(id)) throw notFound();
      // RLS hides the batches of other users, so a foreign id is as missing as an unknown one.
      const [stored] = await request.withUser(
        (tx) => tx<StoredFile[]>`
          select a.filename, a.mime_type, a.storage_path
          from public.import_batches b
          join lateral (
            select filename, mime_type, storage_path from public.attachments
            where import_batch_id = b.id order by created_at, id limit 1
          ) a on true
          where b.id = ${id}`,
      );
      if (!stored) throw notFound();
      const token = (request.headers.authorization ?? '').replace(/^Bearer /i, '');
      const content = await downloadImportFile({
        supabaseUrl: options.supabaseUrl,
        publishableKey,
        token,
        path: stored.storage_path,
      });
      if (!content) throw notFound();
      return reply
        .header('content-type', MIME_TYPE.test(stored.mime_type) ? stored.mime_type : 'application/octet-stream')
        .header('content-disposition', contentDisposition(stored.filename))
        .header('content-length', content.length)
        .header('cache-control', 'private, no-store')
        .header('x-content-type-options', 'nosniff')
        // The 200 schema is documentation only (bytes are sent as they are), so the provider has no type for it.
        .send(content as never);
    },
  );
}

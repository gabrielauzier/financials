import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

const DEFAULT_LIMIT = 50;

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

/**
 * The user's imported files: `GET /imports` (newest first). Reads the database only, always through
 * `withUser` (RLS); the Storage path of an attachment is never selected.
 */
export async function importedFilesRoutes(app: FastifyInstance): Promise<void> {
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
}

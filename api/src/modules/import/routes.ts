import { randomUUID } from 'node:crypto';
import multipart, { type Multipart } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import { DateTime } from 'luxon';
import postgres, { type TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';
import { analyze, categoriesByKey, toPreview, PreviewSchema, UUID, type Category } from './preview.js';
import { categoryIdsOf, parseSelections, type Selection } from './selections.js';
import { removeImportFile, uploadImportFile } from './storage.js';
import type { ClassifiedRow, RowStatus } from './types.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Room for `selections` of the largest file a 5 MB CSV can hold (about 30 bytes per row). */
const MAX_FIELD_BYTES = 8 * 1024 * 1024;

const fileField = Type.String({ format: 'binary', description: 'The CSV file (UTF-8, at most 5 MB)' });

// Documents the multipart form only: the handler reads and validates the parts itself (see
// `readForm`), so the body schema is not compiled into a validator.
const PreviewForm = Type.Object({
  file: fileField,
  accountId: Type.String({ format: 'uuid', description: 'An active account of the user' }),
});

const ConfirmForm = Type.Object({
  file: fileField,
  accountId: Type.String({ format: 'uuid', description: 'An active account of the user' }),
  idempotencyKey: Type.String({ format: 'uuid', description: 'One per preview session; a repeated key does not import twice' }),
  selections: Type.String({
    description:
      'JSON array `[{ "index": number, "neutral": boolean, "categoryId"?: uuid }]` with the rows to import ' +
      '(status new, duplicate or unrecognized), each index once. `categoryId` is one of the user\'s categories ' +
      '(422 `invalid_category` otherwise); omitted, the row keeps the category of the parser (see `categoryId` ' +
      'of the preview rows)',
  }),
});

const ConfirmSchema = Type.Object({
  batchId: Type.String({ format: 'uuid' }),
  imported: Type.Integer(),
  skipped: Type.Integer(),
});
type ConfirmSummary = Static<typeof ConfirmSchema>;

/** Rows the user may select; `ignored` and `invalid` rows are never imported. */
const SELECTABLE: ReadonlySet<RowStatus> = new Set(['new', 'duplicate', 'unrecognized']);

const multipartRoute = {
  consumes: ['multipart/form-data'],
} as const;

const skipBodyValidation = () => () => true;

interface UploadedFile {
  filename: string;
  mimetype: string;
  content: Buffer;
}

interface ImportForm {
  file: UploadedFile;
  fields: Map<string, string>;
}

function badForm(message: string, field?: string): AppError {
  return new AppError('validation_error', 400, message, field);
}

/** Multipart errors raised while reading the parts, as API errors. */
function formError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  const code = (error as { code?: unknown }).code;
  if (code === 'FST_REQ_FILE_TOO_LARGE') {
    return new AppError('file_too_large', 413, 'The file exceeds 5 MB', 'file');
  }
  if (code === 'FST_FILES_LIMIT') return badForm('Send exactly one file', 'file');
  if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') return badForm('The body must be multipart/form-data');
  if (typeof code === 'string' && (code.startsWith('FST_') || code === 'ERR_STREAM_PREMATURE_CLOSE')) {
    return badForm('Malformed multipart form');
  }
  // busboy reports a malformed body (missing boundary, truncated data) as a plain Error.
  if (error instanceof Error && /multipart/i.test(error.message)) {
    return badForm('Malformed multipart form');
  }
  return error;
}

/**
 * Reads the form: exactly one part named `file` (buffered up to 5 MB; a larger file stops at the
 * limit with 413) and the text fields. A repeated field or a truncated field is a malformed form.
 */
async function readForm(request: FastifyRequest): Promise<ImportForm> {
  let file: UploadedFile | undefined;
  const fields = new Map<string, string>();
  try {
    for await (const part of request.parts() as AsyncIterableIterator<Multipart>) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file' || file) {
          throw badForm('Send exactly one file, in the field "file"', 'file');
        }
        file = { filename: part.filename, mimetype: part.mimetype, content: await part.toBuffer() };
      } else {
        if (part.valueTruncated || typeof part.value !== 'string') {
          throw badForm(`${part.fieldname} is malformed`, part.fieldname);
        }
        if (fields.has(part.fieldname)) throw badForm(`${part.fieldname} must be sent once`, part.fieldname);
        fields.set(part.fieldname, part.value);
      }
    }
  } catch (error) {
    throw formError(error);
  }
  if (!file) throw badForm('file is required', 'file');
  return { file, fields };
}

function requiredField(form: ImportForm, name: string): string {
  const value = form.fields.get(name);
  if (value === undefined) throw badForm(`${name} is required`, name);
  return value;
}

function invalid(message: string, field: string): AppError {
  return new AppError('validation_error', 422, message, field);
}

type SelectedRow = ClassifiedRow & { chosenCategoryId?: string };
type ChosenRow = ClassifiedRow & { categoryId: string };

/** Selected rows of the file, in file order; a selection of a non-selectable or unknown row is rejected. */
function selectedRows(rows: ClassifiedRow[], selections: Selection[]): SelectedRow[] {
  const byIndex = new Map(rows.map((row) => [row.index, row]));
  const chosen = selections.map((selection) => {
    const row = byIndex.get(selection.index);
    if (!row || !SELECTABLE.has(row.status)) {
      throw new AppError(
        'invalid_selection',
        422,
        `Row ${selection.index} cannot be imported (only new, duplicate or unrecognized rows)`,
        'selections',
      );
    }
    return {
      ...row,
      neutral: selection.neutral,
      ...(selection.categoryId === undefined ? {} : { chosenCategoryId: selection.categoryId.toLowerCase() }),
    };
  });
  return chosen.sort((a, b) => a.index - b.index);
}

/**
 * The category each selected row is saved with: the one the user chose, which must be visible to them
 * (RLS hides other users' categories), or else the one of the parser's key. One query for all rows.
 */
async function resolveCategories(tx: TransactionSql, rows: SelectedRow[], selections: Selection[]): Promise<ChosenRow[]> {
  const ids = categoryIdsOf(selections);
  const visible = new Set(
    ids.length === 0
      ? []
      : (await tx<{ id: string }[]>`select id from public.categories where id = any(${ids}::uuid[])`).map((c) => c.id),
  );
  const byKey = await categoriesByKey(tx, rows);
  return rows.map(({ chosenCategoryId, ...row }) => {
    if (chosenCategoryId !== undefined && !visible.has(chosenCategoryId)) {
      throw new AppError('invalid_category', 422, `Row ${row.index} has a category that does not exist`, 'selections');
    }
    return { ...row, categoryId: chosenCategoryId ?? (byKey.get(row.categoryKey) as Category).id };
  });
}

/** Midnight of the local day in `zone`, as an ISO instant with offset (DST-safe start of day). */
function localMidnight(localDate: string, zone: string): string {
  return DateTime.fromISO(localDate, { zone }).startOf('day').toISO() as string;
}

interface Confirmation {
  batchId: string;
  idempotencyKey: string;
  account: { id: string; bank: string };
  rowCount: number;
  rows: ChosenRow[];
  file: UploadedFile & { storagePath: string };
  tz: string;
}

/** Writes the batch, its transactions and the attachment in the caller's transaction. */
async function insertBatch(tx: TransactionSql, c: Confirmation): Promise<ConfirmSummary> {
  const imported = c.rows.length;
  const skipped = c.rowCount - imported;
  await tx`
    insert into public.import_batches (id, account_id, bank, idempotency_key, row_count, imported_count, skipped_count)
    values (${c.batchId}, ${c.account.id}, ${c.account.bank}, ${c.idempotencyKey}, ${c.rowCount}, ${imported}, ${skipped})`;
  const column = <T>(pick: (row: ChosenRow) => T): T[] => c.rows.map(pick);
  const inserted = await tx`
    insert into public.transactions
      (account_id, category_id, name, description, type, occurred_at, amount, payment_method, identifier,
       counterparty_document, counterparty_bank, neutral, import_batch_id)
    select ${c.account.id}, r.category_id, r.name, r.description, r.type, r.occurred_at, r.amount, r.payment_method, r.identifier,
           r.counterparty_document, r.counterparty_bank, r.neutral, ${c.batchId}
    from unnest(
      ${column((r) => r.categoryId)}::uuid[],
      ${column((r) => r.name)}::text[],
      ${column((r) => r.description)}::text[],
      ${column((r) => r.type)}::text[],
      ${column((r) => localMidnight(r.localDate, c.tz))}::timestamptz[],
      ${column((r) => r.amount)}::numeric[],
      ${column((r) => r.paymentMethod)}::text[],
      ${column((r) => r.identifier)}::text[],
      ${column((r) => r.counterpartyDocument)}::text[],
      ${column((r) => r.counterpartyBank)}::text[],
      -- postgres.js sends a boolean array as a scalar boolean; text round-trips exactly.
      ${column((r) => String(r.neutral))}::text[]::boolean[]
    ) as r (category_id, name, description, type, occurred_at, amount, payment_method, identifier,
            counterparty_document, counterparty_bank, neutral)`;
  if (inserted.count !== imported) throw new Error(`Inserted ${inserted.count} of ${imported} transactions`);
  await tx`
    insert into public.attachments (import_batch_id, filename, mime_type, size_bytes, storage_path)
    values (${c.batchId}, ${c.file.filename}, ${c.file.mimetype}, ${c.file.content.length}, ${c.file.storagePath})`;
  return { batchId: c.batchId, imported, skipped };
}

const IDEMPOTENCY_CONSTRAINT = 'import_batches_user_id_idempotency_key_key';

/** Summary of the user's batch confirmed with this key, if any (RLS limits it to the user). */
async function existingSummary(tx: TransactionSql, idempotencyKey: string): Promise<ConfirmSummary | undefined> {
  const [batch] = await tx<{ id: string; imported_count: number; skipped_count: number }[]>`
    select id, imported_count, skipped_count from public.import_batches where idempotency_key = ${idempotencyKey}`;
  return batch && { batchId: batch.id, imported: batch.imported_count, skipped: batch.skipped_count };
}

function isIdempotencyConflict(error: unknown): boolean {
  return (
    error instanceof postgres.PostgresError && error.code === '23505' && error.constraint_name === IDEMPOTENCY_CONSTRAINT
  );
}

export interface ImportRoutesOptions {
  supabaseUrl: string;
  /** Without it, confirm answers 503 `storage_not_configured`. */
  publishableKey?: string;
}

export async function importRoutes(app: FastifyInstance, options: ImportRoutesOptions): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 4, parts: 5, fieldSize: MAX_FIELD_BYTES },
  });
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.post(
    '/imports/preview',
    {
      schema: { ...multipartRoute, body: PreviewForm, response: { 200: PreviewSchema } },
      validatorCompiler: skipBodyValidation,
    },
    async (request) => {
      const form = await readForm(request);
      const accountId = requiredField(form, 'accountId');
      return request.withUser(async (tx) => {
        const { rows } = await analyze(tx, accountId, form.file.content, request.tz);
        return toPreview(rows, await categoriesByKey(tx, rows));
      });
    },
  );
  routes.post(
    '/imports/confirm',
    {
      schema: {
        ...multipartRoute,
        body: ConfirmForm,
        response: {
          201: ConfirmSchema,
          200: { ...ConfirmSchema, description: 'This idempotencyKey was already confirmed: the stored summary, nothing written' },
        },
      },
      validatorCompiler: skipBodyValidation,
    },
    async (request, reply) => {
      const { publishableKey } = options;
      if (!publishableKey) {
        throw new AppError('storage_not_configured', 503, 'File storage is not configured on the server');
      }
      const form = await readForm(request);
      const accountId = requiredField(form, 'accountId');
      const idempotencyKey = requiredField(form, 'idempotencyKey');
      const rawSelections = requiredField(form, 'selections');
      if (!UUID.test(idempotencyKey)) throw invalid('idempotencyKey must be a uuid', 'idempotencyKey');
      const selections = parseSelections(rawSelections);
      const user = request.user as NonNullable<typeof request.user>;
      const token = (request.headers.authorization ?? '').replace(/^Bearer /i, '');

      // A repeated confirmation (IMP-05.11) answers the first one's summary; nothing is uploaded or written.
      const done = await request.withUser((tx) => existingSummary(tx, idempotencyKey));
      if (done) return reply.status(200).send(done);

      // Re-parse and re-classify on the server: rows never come from the client.
      const prepared = await request.withUser(async (tx) => {
        const { account, rows } = await analyze(tx, accountId, form.file.content, request.tz);
        const chosen = selectedRows(rows, selections);
        return { account, rowCount: rows.length, rows: await resolveCategories(tx, chosen, selections) };
      });

      const batchId = randomUUID();
      const file = {
        filename: form.file.filename || 'import.csv',
        mimetype: form.file.mimetype || 'application/octet-stream',
        content: form.file.content,
      };
      const storage = { supabaseUrl: options.supabaseUrl, publishableKey, token };
      // Postgres and Storage share no transaction: the file goes first (a failed upload writes
      // nothing) and is removed again when the database transaction fails (IMP-05.9).
      const storagePath = await uploadImportFile({
        ...storage,
        userId: user.id,
        batchId,
        filename: file.filename,
        content: new Uint8Array(file.content),
        contentType: file.mimetype,
      });
      let summary: ConfirmSummary;
      try {
        summary = await request.withUser((tx) =>
          insertBatch(tx, { ...prepared, batchId, idempotencyKey, file: { ...file, storagePath }, tz: request.tz }),
        );
      } catch (error) {
        await removeImportFile({ ...storage, path: storagePath }).catch((cleanupError: unknown) => {
          // Best effort: the orphan path holds a batch id that has no row (design risk, cleanup out of MVP).
          request.log.error({ err: cleanupError, storagePath }, 'could not remove the file of a failed import');
        });
        // A concurrent confirmation with the same key committed first: answer its summary.
        if (isIdempotencyConflict(error)) {
          const first = await request.withUser((tx) => existingSummary(tx, idempotencyKey));
          if (first) return reply.status(200).send(first);
        }
        throw error;
      }
      return reply.status(201).send(summary);
    },
  );
}

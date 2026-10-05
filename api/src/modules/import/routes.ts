import multipart, { type Multipart } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';
import { classify } from './classify.js';
import { parseImport } from './formats.js';
import type { ClassifiedRow, RowStatus } from './types.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Room for `selections` of the largest file a 5 MB CSV can hold (about 30 bytes per row). */
const MAX_FIELD_BYTES = 8 * 1024 * 1024;

const STATUSES: readonly RowStatus[] = ['new', 'duplicate', 'ignored', 'unrecognized', 'invalid'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nullableString = Type.Union([Type.String(), Type.Null()]);
const stringEnum = <T extends string>(values: readonly T[]) => Type.Unsafe<T>({ type: 'string', enum: [...values] });

const PreviewRowSchema = Type.Object({
  index: Type.Integer({ description: '0-based data row of the file; the selection key' }),
  localDate: Type.String({ description: 'YYYY-MM-DD' }),
  type: stringEnum(['Income', 'Expense'] as const),
  amount: Type.String({ description: 'Decimal string, e.g. "1234.56"' }),
  name: Type.String(),
  paymentMethod: stringEnum(['PIX', 'DebitCard', 'BankTransfer', 'CreditCard'] as const),
  categoryName: Type.String(),
  status: stringEnum(STATUSES),
  neutral: Type.Boolean(),
  reason: Type.Optional(Type.String()),
  counterpartyDocument: nullableString,
  counterpartyBank: nullableString,
});
type PreviewRow = Static<typeof PreviewRowSchema>;

const PreviewSchema = Type.Object({
  rows: Type.Array(PreviewRowSchema),
  totals: Type.Object({
    new: Type.Integer(),
    duplicate: Type.Integer(),
    ignored: Type.Integer(),
    unrecognized: Type.Integer(),
    invalid: Type.Integer(),
  }),
});
type Preview = Static<typeof PreviewSchema>;

const fileField = Type.String({ format: 'binary', description: 'The CSV file (UTF-8, at most 5 MB)' });

// Documents the multipart form only: the handler reads and validates the parts itself (see
// `readForm`), so the body schema is not compiled into a validator.
const PreviewForm = Type.Object({
  file: fileField,
  accountId: Type.String({ format: 'uuid', description: 'An active account of the user' }),
});

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

function invalidAccount(): AppError {
  return new AppError('invalid_account', 422, 'Select an active account', 'accountId');
}

interface Analysis {
  account: { id: string; bank: string };
  rows: ClassifiedRow[];
}

/**
 * Parses and classifies the file for an active account of the user, inside the caller's `withUser`
 * transaction. Reads only: nothing is written.
 */
async function analyze(tx: TransactionSql, accountId: string, content: Buffer, tz: string): Promise<Analysis> {
  // RLS hides other users' accounts, so "not visible" covers inactive, foreign and missing.
  const [account] = UUID.test(accountId)
    ? await tx<{ id: string; bank: string }[]>`select id, bank from public.accounts where id = ${accountId} and active`
    : [];
  if (!account) throw invalidAccount();
  const { rows } = parseImport(content.toString('utf8'), account.bank);
  return { account, rows: await classify(tx, rows, account.id, tz) };
}

/** Category key → name of the user's categories (system categories always exist). */
async function categoryNames(tx: TransactionSql, rows: ClassifiedRow[]): Promise<Map<string, string>> {
  const keys = [...new Set(rows.map((r) => r.categoryKey))];
  const found = await tx<{ key: string; name: string }[]>`
    select key, name from public.categories where key = any(${keys}::text[])`;
  return new Map(found.map((c) => [c.key, c.name]));
}

function toPreview(rows: ClassifiedRow[], names: Map<string, string>): Preview {
  const totals = { new: 0, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 };
  const previewRows = rows.map((row): PreviewRow => {
    totals[row.status] += 1;
    const categoryName = names.get(row.categoryKey);
    if (categoryName === undefined) throw new Error(`System category ${row.categoryKey} is missing for this user`);
    return {
      index: row.index,
      localDate: row.localDate,
      type: row.type,
      amount: row.amount,
      name: row.name,
      paymentMethod: row.paymentMethod,
      categoryName,
      status: row.status,
      neutral: row.neutral,
      ...(row.reason === undefined ? {} : { reason: row.reason }),
      counterpartyDocument: row.counterpartyDocument,
      counterpartyBank: row.counterpartyBank,
    };
  });
  return { rows: previewRows, totals };
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10, parts: 11, fieldSize: MAX_FIELD_BYTES },
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
        return toPreview(rows, await categoryNames(tx, rows));
      });
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { DateTime } from 'luxon';
import type { PendingQuery, Row, TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';
import {
  fromJoins,
  PAYMENT_METHODS,
  selectColumns,
  toTransaction,
  TransactionSchema,
  TYPES,
  type PaymentMethod,
  type TransactionRow,
  type TransactionType,
} from './schema.js';
import { parseAmount, parseReceiptUrl } from './validation.js';

const nullableString = Type.Union([Type.String(), Type.Null()]);

// Enumerated and ISO fields are plain strings here and checked in the handler so every semantic
// error answers 422 with a field, like the other modules.
const CreateBody = Type.Object({
  name: Type.String(),
  type: Type.String({ description: `One of: ${TYPES.join(', ')}` }),
  occurredAt: Type.String({ description: 'ISO-8601 instant with offset, e.g. 2026-10-05T14:30:00-03:00' }),
  amount: Type.String({ description: 'Decimal string, > 0, up to 12 integer digits and 2 decimals' }),
  accountId: Type.String(),
  categoryId: Type.Optional(Type.String()),
  paymentMethod: Type.String({ description: `One of: ${PAYMENT_METHODS.join(', ')}` }),
  notes: Type.Optional(nullableString),
  receipt: Type.Optional(nullableString),
  neutral: Type.Optional(Type.Boolean()),
});

const PAGE_SIZE = 50 as const;

const ListQuery = Type.Object({
  from: Type.Optional(Type.String({ description: 'Local date YYYY-MM-DD in the X-Timezone zone; the whole day is included' })),
  to: Type.Optional(Type.String({ description: 'Local date YYYY-MM-DD in the X-Timezone zone; the whole day is included' })),
  accountId: Type.Optional(Type.String()),
  categoryId: Type.Optional(Type.String()),
  type: Type.Optional(Type.String({ description: `One of: ${TYPES.join(', ')}` })),
  neutral: Type.Optional(Type.String({ description: 'true or false' })),
  page: Type.Optional(Type.String({ description: 'Page number, starting at 1 (50 rows per page)' })),
});

const ListSchema = Type.Object({
  items: Type.Array(TransactionSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  pageSize: Type.Literal(PAGE_SIZE),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function invalid(message: string, field: string): AppError {
  return new AppError('validation_error', 422, message, field);
}

function requiredText(value: string, field: string): string {
  const text = value.trim();
  if (text === '') throw invalid(`${field} must not be blank`, field);
  return text;
}

function validType(value: string): TransactionType {
  if (!(TYPES as readonly string[]).includes(value)) throw invalid(`type must be one of: ${TYPES.join(', ')}`, 'type');
  return value as TransactionType;
}

function validPaymentMethod(value: string): PaymentMethod {
  if (!(PAYMENT_METHODS as readonly string[]).includes(value)) {
    throw invalid(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`, 'paymentMethod');
  }
  return value as PaymentMethod;
}

/** An instant must carry an offset (or Z): a bare date-time would depend on the server zone. */
function validOccurredAt(value: string): Date {
  const parsed = DateTime.fromISO(value.trim(), { setZone: true });
  if (!HAS_OFFSET.test(value.trim()) || !parsed.isValid) {
    throw invalid('occurredAt must be an ISO-8601 date-time with a UTC offset', 'occurredAt');
  }
  return parsed.toJSDate();
}

/** Blank notes/receipt mean "none" and are stored as NULL. */
function optionalText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
}

function validPage(value: string | undefined): number {
  if (value === undefined) return 1;
  const page = /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 0;
  if (page < 1) throw invalid('page must be an integer greater than or equal to 1', 'page');
  return page;
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Start of the local day `value` (YYYY-MM-DD) in `zone`, as an instant; `plusDays` shifts the day first. */
function localDayStart(value: string, zone: string, field: string, plusDays = 0): Date {
  const day = LOCAL_DATE.test(value) ? DateTime.fromISO(value, { zone }) : DateTime.invalid('format');
  if (!day.isValid) throw invalid(`${field} must be a valid date in the format YYYY-MM-DD`, field);
  return day.plus({ days: plusDays }).startOf('day').toJSDate();
}

function validUuidFilter(value: string, field: string): string {
  if (!UUID.test(value)) throw invalid(`${field} must be a valid uuid`, field);
  return value;
}

function validBoolean(value: string, field: string): boolean {
  if (value !== 'true' && value !== 'false') throw invalid(`${field} must be true or false`, field);
  return value === 'true';
}

interface Filters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
  neutral?: string;
}

/** WHERE clause for the list: every filter given is combined with AND. `from`/`to` are local days. */
function whereClause(tx: TransactionSql, filters: Filters, zone: string): PendingQuery<Row[]> {
  let condition = tx`true`;
  if (filters.from !== undefined) {
    condition = tx`${condition} and t.occurred_at >= ${localDayStart(filters.from, zone, 'from')}`;
  }
  if (filters.to !== undefined) {
    // Exclusive start of the next local day, so the whole `to` day is included.
    condition = tx`${condition} and t.occurred_at < ${localDayStart(filters.to, zone, 'to', 1)}`;
  }
  if (filters.accountId !== undefined) {
    condition = tx`${condition} and t.account_id = ${validUuidFilter(filters.accountId, 'accountId')}`;
  }
  if (filters.categoryId !== undefined) {
    condition = tx`${condition} and t.category_id = ${validUuidFilter(filters.categoryId, 'categoryId')}`;
  }
  if (filters.type !== undefined) {
    condition = tx`${condition} and t.type = ${validType(filters.type)}`;
  }
  if (filters.neutral !== undefined) {
    condition = tx`${condition} and t.neutral = ${validBoolean(filters.neutral, 'neutral')}`;
  }
  return tx`where ${condition}`;
}

function invalidAccount(): AppError {
  return new AppError('invalid_account', 422, 'Select an active account', 'accountId');
}

function categoryNotFound(): AppError {
  return new AppError('not_found', 404, 'Category not found', 'categoryId');
}

export async function transactionsRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.post(
    '/transactions',
    { schema: { body: CreateBody, response: { 201: TransactionSchema } } },
    async (request, reply) => {
      const body = request.body;
      const name = requiredText(body.name, 'name');
      const type = validType(body.type);
      const occurredAt = validOccurredAt(body.occurredAt);
      const amount = parseAmount(body.amount);
      const paymentMethod = validPaymentMethod(body.paymentMethod);
      const notes = optionalText(body.notes);
      const receiptText = optionalText(body.receipt);
      const receipt = receiptText === null ? null : parseReceiptUrl(receiptText);

      const row = await request.withUser(async (tx) => {
        // RLS hides other users' accounts, so "not visible" covers both inactive and foreign.
        const [account] = UUID.test(body.accountId)
          ? await tx<{ id: string }[]>`
              select id from public.accounts where id = ${body.accountId} and active`
          : [];
        if (!account) throw invalidAccount();

        let categoryId: string;
        if (body.categoryId === undefined) {
          const [fallback] = await tx<{ id: string }[]>`
            select id from public.categories where key = 'Uncategorized'`;
          if (!fallback) throw new Error('System category Uncategorized is missing for this user');
          categoryId = fallback.id;
        } else {
          const [category] = UUID.test(body.categoryId)
            ? await tx<{ id: string }[]>`select id from public.categories where id = ${body.categoryId}`
            : [];
          if (!category) throw categoryNotFound();
          categoryId = category.id;
        }

        const [inserted] = await tx<{ id: string }[]>`
          insert into public.transactions
            (account_id, category_id, name, type, occurred_at, amount, payment_method, notes, receipt, neutral)
          values
            (${account.id}, ${categoryId}, ${name}, ${type}, ${occurredAt}, ${amount}, ${paymentMethod},
             ${notes}, ${receipt}, ${body.neutral ?? false})
          returning id`;
        const [created] = await tx<TransactionRow[]>`
          select ${selectColumns(tx)} from ${fromJoins(tx)} where t.id = ${(inserted as { id: string }).id}`;
        return created as TransactionRow;
      });
      return reply.status(201).send(toTransaction(row));
    },
  );

  routes.get(
    '/transactions',
    { schema: { querystring: ListQuery, response: { 200: ListSchema } } },
    async (request) => {
      const page = validPage(request.query.page);
      const { rows, total } = await request.withUser(async (tx) => {
        const where = whereClause(tx, request.query, request.tz);
        const [count] = await tx<{ n: number }[]>`select count(*)::int as n from ${fromJoins(tx)} ${where}`;
        const rows = await tx<TransactionRow[]>`
          select ${selectColumns(tx)} from ${fromJoins(tx)}
          ${where}
          order by t.occurred_at desc, t.id desc
          limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;
        return { rows, total: (count as { n: number }).n };
      });
      return { items: rows.map(toTransaction), total, page, pageSize: PAGE_SIZE as 50 };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static, type TUnsafe } from '@sinclair/typebox';
import { DateTime } from 'luxon';
import { AppError } from '../../plugins/errors.js';
import { OPENAPI_TYPE_KEY } from '../../plugins/swagger.js';
import {
  CreditExpenseSchema,
  fromJoins,
  selectColumns,
  STATUSES,
  toCreditExpense,
  type CreditExpenseRow,
  type CreditExpenseStatus,
} from './schema.js';
import { assertPaidWithinTotal, parsePaidAmount, parseRecurrencyDay, parseTotalAmount } from './validation.js';

// Ajv coerces JSON numbers to strings for `type: 'string'` (and strings to numbers for `integer`),
// which would silently round an amount or accept `"5"` as a day. These fields therefore have no
// `type` (the handler rejects anything of the wrong JSON type with 422) and carry `x-openapi-type`,
// which the swagger transform turns back into `type` so the document still describes them.
const AmountInput = (description: string): TUnsafe<string> =>
  Type.Unsafe<string>({ description, [OPENAPI_TYPE_KEY]: 'string' });
const TOTAL_DESCRIPTION = 'Decimal string, > 0, up to 12 integer digits and 2 decimals';
const PAID_DESCRIPTION = 'Decimal string, 0 or more and not above totalAmount, up to 2 decimals';
const DayInput: TUnsafe<number> = Type.Unsafe<number>({
  description: 'Day of the month, integer from 1 to 31',
  [OPENAPI_TYPE_KEY]: 'integer',
});

const nullableString = Type.Union([Type.String(), Type.Null()]);

// Enumerated and ISO fields are plain strings here and checked in the handler so every semantic
// error answers 422 with a field, like the other modules.
const CreateBody = Type.Object({
  name: Type.String(),
  totalAmount: AmountInput(TOTAL_DESCRIPTION),
  paidAmount: Type.Optional(AmountInput(PAID_DESCRIPTION)),
  occurredAt: Type.String({ description: 'ISO-8601 instant with offset, e.g. 2026-10-05T14:30:00-03:00' }),
  recurrencyDay: DayInput,
  status: Type.String({ description: `One of: ${STATUSES.join(', ')}` }),
  accountId: Type.String({ description: 'An active account of the user' }),
  categoryId: Type.Optional(Type.String({ description: 'Defaults to the Sem categoria system category' })),
  notes: Type.Optional(nullableString),
});

// Every editable field is optional; `null` clears notes. An empty body changes nothing.
const UpdateBody = Type.Object({
  name: Type.Optional(Type.String()),
  totalAmount: Type.Optional(AmountInput(TOTAL_DESCRIPTION)),
  paidAmount: Type.Optional(AmountInput(PAID_DESCRIPTION)),
  occurredAt: Type.Optional(Type.String({ description: 'ISO-8601 instant with offset' })),
  recurrencyDay: Type.Optional(DayInput),
  status: Type.Optional(Type.String({ description: `Any of: ${STATUSES.join(', ')}; any status may follow any other` })),
  accountId: Type.Optional(Type.String({ description: 'An account of the user; inactive accounts are allowed on edit' })),
  categoryId: Type.Optional(Type.String()),
  notes: Type.Optional(nullableString),
});

const IdParams = Type.Object({ id: Type.String() });

const ListQuery = Type.Object({
  status: Type.Optional(Type.String({ description: `Only this status; one of: ${STATUSES.join(', ')}` })),
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

function validStatus(value: string): CreditExpenseStatus {
  if (!(STATUSES as readonly string[]).includes(value)) {
    throw new AppError('invalid_status', 422, `status must be one of: ${STATUSES.join(', ')}`, 'status');
  }
  return value as CreditExpenseStatus;
}

/** An instant must carry an offset (or Z): a bare date-time would depend on the server zone. */
function validOccurredAt(value: string): Date {
  const parsed = DateTime.fromISO(value.trim(), { setZone: true });
  if (!HAS_OFFSET.test(value.trim()) || !parsed.isValid) {
    throw invalid('occurredAt must be an ISO-8601 date-time with a UTC offset', 'occurredAt');
  }
  return parsed.toJSDate();
}

/** Blank notes mean "none" and are stored as NULL. */
function optionalText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
}

function invalidAccount(): AppError {
  return new AppError('invalid_account', 422, 'Select an active account', 'accountId');
}

function categoryNotFound(): AppError {
  return new AppError('not_found', 404, 'Category not found', 'categoryId');
}

function notFound(): AppError {
  return new AppError('not_found', 404, 'Credit expense not found');
}

interface CreditExpensePatch {
  name?: string;
  total_amount?: string;
  paid_amount?: string;
  occurred_at?: Date;
  recurrency_day?: number;
  status?: CreditExpenseStatus;
  account_id?: string;
  category_id?: string;
  notes?: string | null;
}

/** Validates only the fields present in the body, with the same rules as create. */
function validPatch(
  body: Omit<Static<typeof UpdateBody>, 'totalAmount' | 'paidAmount' | 'recurrencyDay'> & {
    totalAmount?: unknown;
    paidAmount?: unknown;
    recurrencyDay?: unknown;
  },
): CreditExpensePatch {
  const patch: CreditExpensePatch = {};
  if (body.name !== undefined) patch.name = requiredText(body.name, 'name');
  if (body.totalAmount !== undefined) patch.total_amount = parseTotalAmount(body.totalAmount);
  if (body.paidAmount !== undefined) patch.paid_amount = parsePaidAmount(body.paidAmount);
  if (body.occurredAt !== undefined) patch.occurred_at = validOccurredAt(body.occurredAt);
  if (body.recurrencyDay !== undefined) patch.recurrency_day = parseRecurrencyDay(body.recurrencyDay);
  if (body.status !== undefined) patch.status = validStatus(body.status);
  if (body.notes !== undefined) patch.notes = optionalText(body.notes);
  return patch;
}

export async function creditExpensesRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.post(
    '/credit-expenses',
    { schema: { body: CreateBody, response: { 201: CreditExpenseSchema } } },
    async (request, reply) => {
      const body = request.body;
      const name = requiredText(body.name, 'name');
      const totalAmount = parseTotalAmount(body.totalAmount);
      const paidAmount = body.paidAmount === undefined ? '0.00' : parsePaidAmount(body.paidAmount);
      assertPaidWithinTotal(paidAmount, totalAmount);
      const occurredAt = validOccurredAt(body.occurredAt);
      const recurrencyDay = parseRecurrencyDay(body.recurrencyDay);
      const status = validStatus(body.status);
      const notes = optionalText(body.notes);

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
          insert into public.credit_expenses
            (account_id, category_id, name, total_amount, paid_amount, occurred_at, recurrency_day, status, notes)
          values
            (${account.id}, ${categoryId}, ${name}, ${totalAmount}, ${paidAmount}, ${occurredAt},
             ${recurrencyDay}, ${status}, ${notes})
          returning id`;
        const [created] = await tx<CreditExpenseRow[]>`
          select ${selectColumns(tx)} from ${fromJoins(tx)} where ce.id = ${(inserted as { id: string }).id}`;
        return created as CreditExpenseRow;
      });
      return reply.status(201).send(toCreditExpense(row));
    },
  );

  // All of the user's rows, newest first (`id` breaks ties so the order is stable); no pagination.
  routes.get(
    '/credit-expenses',
    { schema: { querystring: ListQuery, response: { 200: Type.Array(CreditExpenseSchema) } } },
    async (request) => {
      const { status } = request.query;
      const filter = status === undefined ? undefined : validStatus(status);
      const rows = await request.withUser((tx) => tx<CreditExpenseRow[]>`
        select ${selectColumns(tx)} from ${fromJoins(tx)}
        ${filter === undefined ? tx`` : tx`where ce.status = ${filter}`}
        order by ce.occurred_at desc, ce.id desc`);
      return rows.map(toCreditExpense);
    },
  );

  routes.patch(
    '/credit-expenses/:id',
    { schema: { params: IdParams, body: UpdateBody, response: { 200: CreditExpenseSchema } } },
    async (request) => {
      const { id } = request.params;
      const { accountId, categoryId } = request.body;
      const patch = validPatch(request.body);
      if (!UUID.test(id)) throw notFound();

      const row = await request.withUser(async (tx) => {
        // The row is locked and checked first, so another user's id answers 404 whatever the body
        // holds, and two concurrent edits cannot both pass the paid <= total check below.
        const [current] = await tx<{ total_amount: string; paid_amount: string }[]>`
          select total_amount::text as total_amount, paid_amount::text as paid_amount
          from public.credit_expenses where id = ${id} for update`;
        if (!current) throw notFound();

        // The resulting pair must satisfy paid <= total, whichever of the two the body changes.
        if (patch.total_amount !== undefined || patch.paid_amount !== undefined) {
          assertPaidWithinTotal(patch.paid_amount ?? current.paid_amount, patch.total_amount ?? current.total_amount);
        }

        if (accountId !== undefined) {
          // Only creation requires an active account (spec: rows of an inactive account stay
          // editable), so any account of the user is accepted here; RLS hides foreign ones.
          const [account] = UUID.test(accountId)
            ? await tx<{ id: string }[]>`select id from public.accounts where id = ${accountId}`
            : [];
          if (!account) throw invalidAccount();
          patch.account_id = account.id;
        }
        if (categoryId !== undefined) {
          const [category] = UUID.test(categoryId)
            ? await tx<{ id: string }[]>`select id from public.categories where id = ${categoryId}`
            : [];
          if (!category) throw categoryNotFound();
          patch.category_id = category.id;
        }

        if (Object.keys(patch).length > 0) {
          await tx`update public.credit_expenses set ${tx(patch)} where id = ${id}`;
        }
        const [updated] = await tx<CreditExpenseRow[]>`
          select ${selectColumns(tx)} from ${fromJoins(tx)} where ce.id = ${id}`;
        return updated as CreditExpenseRow;
      });
      return toCreditExpense(row);
    },
  );

  routes.delete(
    '/credit-expenses/:id',
    { schema: { params: IdParams, response: { 204: Type.Null({ description: 'Deleted' }) } } },
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID.test(id)) throw notFound();
      const deleted = await request.withUser((tx) => tx`delete from public.credit_expenses where id = ${id}`);
      if (deleted.count === 0) throw notFound();
      return reply.status(204).send(null);
    },
  );
}

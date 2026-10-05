import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type TUnsafe } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';
import { OPENAPI_TYPE_KEY } from '../../plugins/swagger.js';
import { parseDate, parseSignedAmount } from './validation.js';

const nullableString = Type.Union([Type.String(), Type.Null()]);

const InvestmentReturnSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  accountId: Type.String({ format: 'uuid' }),
  accountNickname: Type.String(),
  occurredOn: Type.String({ description: 'Calendar date, YYYY-MM-DD' }),
  amount: Type.String({ description: 'Signed decimal string with 2 decimals, never zero, e.g. "50.00" or "-20.00"' }),
  notes: nullableString,
});

const ListSchema = Type.Object({
  items: Type.Array(InvestmentReturnSchema, { description: 'Newest date first' }),
  lastDate: Type.Union([Type.String(), Type.Null()], {
    description: 'Date of the newest return (YYYY-MM-DD), null when there are none',
  }),
});

// No `type` so Ajv cannot coerce a JSON number into a string; the handler rejects it with 422.
const AmountInput: TUnsafe<string> = Type.Unsafe<string>({
  description: 'Signed decimal string, never zero, up to 12 integer digits and 2 decimals',
  [OPENAPI_TYPE_KEY]: 'string',
});

const CreateBody = Type.Object({
  occurredOn: Type.String({ description: 'Calendar date, YYYY-MM-DD' }),
  amount: AmountInput,
  accountId: Type.String({ description: 'Any account of the user, active or not' }),
  notes: Type.Optional(nullableString),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReturnRow {
  id: string;
  account_id: string;
  account_nickname: string;
  occurred_on: string;
  amount: string;
  notes: string | null;
}

const columns = (tx: TransactionSql) => tx`
  r.id, r.account_id, a.nickname as account_nickname, r.occurred_on::text as occurred_on,
  r.amount::text as amount, r.notes`;

const fromJoins = (tx: TransactionSql) => tx`
  public.investment_returns r
  join public.accounts a on a.id = r.account_id and a.user_id = r.user_id`;

function toReturn(row: ReturnRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    accountNickname: row.account_nickname,
    occurredOn: row.occurred_on,
    amount: row.amount,
    notes: row.notes,
  };
}

function optionalText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
}

const invalidAccount = () => new AppError('invalid_account', 422, 'Select an account of yours', 'accountId');

/** RLS hides foreign accounts, so "not visible" covers both unknown and foreign ids. */
async function assertOwnAccount(tx: TransactionSql, accountId: string): Promise<string> {
  const [account] = UUID.test(accountId)
    ? await tx<{ id: string }[]>`select id from public.accounts where id = ${accountId}`
    : [];
  if (!account) throw invalidAccount();
  return account.id;
}

export async function investmentReturnsRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.post(
    '/investment-returns',
    { schema: { body: CreateBody, response: { 201: InvestmentReturnSchema } } },
    async (request, reply) => {
      const body = request.body;
      const amount = parseSignedAmount(body.amount);
      const occurredOn = parseDate(body.occurredOn);
      const notes = optionalText(body.notes);

      const row = await request.withUser(async (tx) => {
        // Any account of the user is accepted, inactive ones included: a return may belong to an
        // account that was closed later (spec: "entre contas do usuário").
        const accountId = await assertOwnAccount(tx, body.accountId);
        const [inserted] = await tx<{ id: string }[]>`
          insert into public.investment_returns (account_id, occurred_on, amount, notes)
          values (${accountId}, ${occurredOn}, ${amount}, ${notes}) returning id`;
        const [created] = await tx<ReturnRow[]>`
          select ${columns(tx)} from ${fromJoins(tx)} where r.id = ${(inserted as { id: string }).id}`;
        return created as ReturnRow;
      });
      return reply.status(201).send(toReturn(row));
    },
  );

  routes.get(
    '/investment-returns',
    { schema: { response: { 200: ListSchema } } },
    async (request) => {
      const rows = await request.withUser((tx) => tx<ReturnRow[]>`
        select ${columns(tx)} from ${fromJoins(tx)}
        order by r.occurred_on desc, r.created_at desc, r.id`);
      return { items: rows.map(toReturn), lastDate: rows[0]?.occurred_on ?? null };
    },
  );
}

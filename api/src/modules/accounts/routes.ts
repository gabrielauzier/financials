import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import postgres, { type TransactionSql } from 'postgres';
import { normalizeName } from '../../lib/normalize.js';
import { AppError } from '../../plugins/errors.js';

const BANKS = ['Nubank', 'SofisaDireto', 'Neon', 'XP', 'Other'] as const;

type Bank = (typeof BANKS)[number];

const AccountSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  bank: Type.Unsafe<Bank>({ type: 'string', enum: [...BANKS] }),
  nickname: Type.String(),
  holderNames: Type.Array(Type.String()),
  active: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
});
type Account = Static<typeof AccountSchema>;

// `bank` is checked in the handler so an unknown value answers 422 with a field, like the other rules.
const bankField = Type.String({ description: `One of: ${BANKS.join(', ')}` });

const CreateBody = Type.Object({
  bank: bankField,
  nickname: Type.String(),
  holderNames: Type.Array(Type.String()),
});

interface AccountRow {
  id: string;
  bank: Bank;
  nickname: string;
  holder_names: string[];
  active: boolean;
  created_at: Date;
}

const columns = (tx: TransactionSql) => tx`id, bank, nickname, holder_names, active, created_at`;

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    bank: row.bank,
    nickname: row.nickname,
    holderNames: row.holder_names,
    active: row.active,
    createdAt: row.created_at.toISOString(),
  };
}

function invalid(message: string, field: string): AppError {
  return new AppError('validation_error', 422, message, field);
}

function validBank(value: string): Bank {
  if (!(BANKS as readonly string[]).includes(value)) {
    throw invalid(`bank must be one of: ${BANKS.join(', ')}`, 'bank');
  }
  return value as Bank;
}

function validNickname(value: string): string {
  const nickname = value.trim();
  if (nickname === '') throw invalid('Nickname must not be blank', 'nickname');
  return nickname;
}

function validHolders(values: string[]): string[] {
  const holders = values.map((value) => value.trim());
  if (holders.length === 0 || holders.every((holder) => holder === '')) {
    throw new AppError('holder_required', 422, 'At least one holder name is required', 'holderNames');
  }
  if (holders.some((holder) => holder === '')) {
    throw invalid('Holder names must not be blank', 'holderNames');
  }
  const keys = new Set(holders.map(normalizeName));
  if (keys.size !== holders.length) {
    throw invalid('Holder names must not repeat within an account', 'holderNames');
  }
  return holders;
}

function isNicknameConflict(error: unknown): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === '23505' &&
    error.constraint_name === 'accounts_nickname_uq'
  );
}

function duplicateName(): AppError {
  return new AppError('duplicate_name', 409, 'An account with this nickname already exists', 'nickname');
}

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.post(
    '/accounts',
    { schema: { body: CreateBody, response: { 201: AccountSchema } } },
    async (request, reply) => {
      const bank = validBank(request.body.bank);
      const nickname = validNickname(request.body.nickname);
      const holders = validHolders(request.body.holderNames);
      try {
        const [row] = await request.withUser(
          (tx) => tx<AccountRow[]>`
            insert into public.accounts (bank, nickname, holder_names)
            values (${bank}, ${nickname}, ${holders})
            returning ${columns(tx)}`,
        );
        return reply.status(201).send(toAccount(row as AccountRow));
      } catch (error) {
        if (isNicknameConflict(error)) throw duplicateName();
        throw error;
      }
    },
  );
  routes.get(
    '/accounts',
    {
      schema: {
        querystring: Type.Object({ active: Type.Optional(Type.Boolean()) }),
        response: { 200: Type.Array(AccountSchema) },
      },
    },
    async (request) => {
      const { active } = request.query;
      const rows = await request.withUser(
        (tx) => tx<AccountRow[]>`
          select ${columns(tx)} from public.accounts
          ${active === undefined ? tx`` : tx`where active = ${active}`}
          order by created_at, id`,
      );
      return rows.map(toAccount);
    },
  );
}

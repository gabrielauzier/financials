import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import postgres, { type TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';

const CategorySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  key: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  isSystem: Type.Boolean(),
});
type Category = Static<typeof CategorySchema>;

// Only `name` is read: `key` and `isSystem` cannot be set by clients.
const NameBody = Type.Object({ name: Type.String() });

interface CategoryRow {
  id: string;
  key: string | null;
  name: string;
  is_system: boolean;
}

const columns = (tx: TransactionSql) => tx`id, key, name, is_system`;

function toCategory(row: CategoryRow): Category {
  return { id: row.id, key: row.key, name: row.name, isSystem: row.is_system };
}

function validName(value: string): string {
  const name = value.trim();
  if (name === '') throw new AppError('validation_error', 422, 'Name must not be blank', 'name');
  return name;
}

function isNameConflict(error: unknown): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === '23505' &&
    error.constraint_name === 'categories_name_uq'
  );
}

function duplicateName(): AppError {
  return new AppError('duplicate_name', 409, 'A category with this name already exists', 'name');
}

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.get(
    '/categories',
    { schema: { response: { 200: Type.Array(CategorySchema) } } },
    async (request) => {
      // The spec defines no order; alphabetical by displayed name (case-insensitive), id breaks ties.
      const rows = await request.withUser(
        (tx) => tx<CategoryRow[]>`
          select ${columns(tx)} from public.categories
          order by lower(name), id`,
      );
      return rows.map(toCategory);
    },
  );
  routes.post(
    '/categories',
    { schema: { body: NameBody, response: { 201: CategorySchema } } },
    async (request, reply) => {
      const name = validName(request.body.name);
      try {
        const [row] = await request.withUser(
          (tx) => tx<CategoryRow[]>`
            insert into public.categories (name) values (${name})
            returning ${columns(tx)}`,
        );
        return reply.status(201).send(toCategory(row as CategoryRow));
      } catch (error) {
        if (isNameConflict(error)) throw duplicateName();
        throw error;
      }
    },
  );
}

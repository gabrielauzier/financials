import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import postgres, { type TransactionSql } from 'postgres';
import { ColorInput, ColorResponse, validColor } from '../../lib/color-field.js';
import type { ColorKey } from '../../lib/palette.js';
import { AppError } from '../../plugins/errors.js';
import { categoryReferences } from './registry.js';

const CategorySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  key: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  isSystem: Type.Boolean(),
  color: ColorResponse,
});
type Category = Static<typeof CategorySchema>;

// Only `name` and `color` are read: `key` and `isSystem` cannot be set by clients.
const CreateBody = Type.Object({ name: Type.String(), color: Type.Optional(ColorInput) });

// Every field is optional; an empty body changes nothing.
const UpdateBody = Type.Object({ name: Type.Optional(Type.String()), color: Type.Optional(ColorInput) });

const IdParams = Type.Object({ id: Type.String() });

const DeleteQuery = Type.Object({
  reassignTo: Type.Optional(Type.String({ description: 'Category that receives the rows of the deleted one' })),
});

interface CategoryRow {
  id: string;
  key: string | null;
  name: string;
  is_system: boolean;
  color: ColorKey;
}

const columns = (tx: TransactionSql) => tx`id, key, name, is_system, color`;

function toCategory(row: CategoryRow): Category {
  return { id: row.id, key: row.key, name: row.name, isSystem: row.is_system, color: row.color };
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): AppError {
  return new AppError('not_found', 404, 'Category not found');
}

/**
 * Reads the category in the request transaction. RLS scopes the read to the user, so a foreign id
 * is absent (404); a system row is visible but protected (403). Users cannot change `is_system`,
 * so the answer holds for the rest of the transaction.
 */
async function assertEditable(tx: TransactionSql, id: string): Promise<void> {
  const [row] = await tx<{ is_system: boolean }[]>`select is_system from public.categories where id = ${id}`;
  if (!row) throw notFound();
  if (row.is_system) throw new AppError('category_protected', 403, 'System categories cannot be changed');
}

function invalidDestination(message: string): AppError {
  return new AppError('validation_error', 422, message, 'reassignTo');
}

function reassignRequired(): AppError {
  return new AppError('reassign_required', 422, 'Category is in use: choose a category to receive its rows', 'reassignTo');
}

/** RLS limits the reads to the user's rows, which are the only ones the composite FK allows. */
async function isInUse(tx: TransactionSql, id: string): Promise<boolean> {
  for (const { table, column } of categoryReferences()) {
    const [row] = await tx<{ used: boolean }[]>`
      select exists (select 1 from ${tx(table)} where ${tx(column)} = ${id}) as used`;
    if (row?.used) return true;
  }
  return false;
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
    { schema: { body: CreateBody, response: { 201: CategorySchema } } },
    async (request, reply) => {
      const name = validName(request.body.name);
      // An absent color is left out of the insert so the column default (slate-600) applies.
      const color = request.body.color === undefined ? undefined : validColor(request.body.color);
      const values = { name, ...(color === undefined ? {} : { color }) };
      try {
        const [row] = await request.withUser(
          (tx) => tx<CategoryRow[]>`
            insert into public.categories ${tx(values)}
            returning ${columns(tx)}`,
        );
        return reply.status(201).send(toCategory(row as CategoryRow));
      } catch (error) {
        if (isNameConflict(error)) throw duplicateName();
        throw error;
      }
    },
  );
  routes.patch(
    '/categories/:id',
    { schema: { params: IdParams, body: UpdateBody, response: { 200: CategorySchema } } },
    async (request) => {
      const { id } = request.params;
      const { name, color } = request.body;
      const patch: { name?: string; color?: ColorKey } = {};
      if (name !== undefined) patch.name = validName(name);
      if (color !== undefined) patch.color = validColor(color);
      if (!UUID.test(id)) throw notFound();
      try {
        const [row] = await request.withUser(async (tx) => {
          await assertEditable(tx, id);
          // Both fields go in one update: a name conflict leaves the color unchanged too.
          return Object.keys(patch).length === 0
            ? tx<CategoryRow[]>`select ${columns(tx)} from public.categories where id = ${id}`
            : tx<CategoryRow[]>`
                update public.categories set ${tx(patch)}
                where id = ${id}
                returning ${columns(tx)}`;
        });
        if (!row) throw notFound();
        return toCategory(row);
      } catch (error) {
        if (isNameConflict(error)) throw duplicateName();
        throw error;
      }
    },
  );
  // One transaction: the rows move and the category goes, or nothing changes.
  routes.delete(
    '/categories/:id',
    { schema: { params: IdParams, querystring: DeleteQuery, response: { 204: Type.Null({ description: 'Deleted' }) } } },
    async (request, reply) => {
      const { id } = request.params;
      const { reassignTo } = request.query;
      if (!UUID.test(id)) throw notFound();
      if (reassignTo !== undefined && !UUID.test(reassignTo)) throw invalidDestination('reassignTo must be a category id');
      // A row added concurrently after the usage check makes the delete fail on the FK (on delete
      // no action), so the transaction rolls back and nothing is lost.
      await request.withUser(async (tx) => {
        await assertEditable(tx, id);
        if (reassignTo === undefined) {
          if (await isInUse(tx, id)) throw reassignRequired();
        } else {
          if (reassignTo.toLowerCase() === id.toLowerCase()) {
            throw invalidDestination('reassignTo must be another category');
          }
          const [destination] = await tx`select 1 from public.categories where id = ${reassignTo}`;
          if (!destination) throw new AppError('not_found', 404, 'Destination category not found', 'reassignTo');
          for (const { table, column } of categoryReferences()) {
            await tx`update ${tx(table)} set ${tx(column)} = ${reassignTo} where ${tx(column)} = ${id}`;
          }
        }
        const deleted = await tx`delete from public.categories where id = ${id}`;
        if (deleted.count === 0) throw notFound();
      });
      return reply.status(204).send(null);
    },
  );
}

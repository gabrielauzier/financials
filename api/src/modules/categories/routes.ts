import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type, type Static } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';

const CategorySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  key: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  isSystem: Type.Boolean(),
});
type Category = Static<typeof CategorySchema>;

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
}

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import postgres, { type Sql, type TransactionSql } from 'postgres';

/** Verified JWT claims; `sub` is the Supabase user id. */
export interface JwtClaims {
  sub: string;
  [claim: string]: unknown;
}

export type WithUser = <T>(claims: JwtClaims, fn: (tx: TransactionSql) => Promise<T>) => Promise<T>;

declare module 'fastify' {
  interface FastifyInstance {
    withUser: WithUser;
  }
}

/**
 * AD-002: every user query runs in one transaction under the `authenticated` role with the
 * user's claims, so RLS applies. Both settings are transaction-local and end with COMMIT/ROLLBACK.
 */
export function createWithUser(sql: Sql): WithUser {
  return <T>(claims: JwtClaims, fn: (tx: TransactionSql) => Promise<T>) =>
    sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      await tx`set local role authenticated`;
      return fn(tx);
    }) as Promise<T>;
}

export interface DbPluginOptions {
  databaseUrl: string;
}

export const dbPlugin = fp(async (app: FastifyInstance, options: DbPluginOptions) => {
  const sql = postgres(options.databaseUrl, { onnotice: () => {} });
  app.decorate('withUser', createWithUser(sql));
  app.addHook('onClose', async () => {
    await sql.end();
    app.log.info('database pool closed');
  });
});

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { createRemoteJWKSet } from 'jose';
import { loadConfig, type AppConfig } from './config.js';
import { authPlugin, createTokenVerifier, type TokenVerifierConfig } from './plugins/auth.js';
import { accountsRoutes } from './modules/accounts/routes.js';
import { categoriesRoutes } from './modules/categories/routes.js';
import { creditExpensesRoutes } from './modules/creditExpenses/routes.js';
import { dashboardsRoutes } from './modules/dashboards/routes.js';
import { investmentReturnsRoutes } from './modules/investmentReturns/routes.js';
import { importRoutes } from './modules/import/routes.js';
import { transactionsRoutes } from './modules/transactions/routes.js';
import { corsPlugin } from './plugins/cors.js';
import { dbPlugin } from './plugins/db.js';
import { errorsPlugin } from './plugins/errors.js';
import { OPENAPI_TYPE_KEY, swaggerPlugin } from './plugins/swagger.js';
import { timezonePlugin } from './plugins/timezone.js';

function tokenVerifierConfig(config: AppConfig): TokenVerifierConfig {
  if (config.jwtSecret) return { mode: 'hs256', secret: config.jwtSecret };
  const jwksUrl = new URL(`${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`);
  return { mode: 'jwks', getKey: createRemoteJWKSet(jwksUrl) };
}

export interface BuildAppOptions {
  /** Fastify logger settings; off by default so tests stay quiet. */
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(config: AppConfig = loadConfig(), options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    // Only registers an annotation keyword with Ajv; coercion and the other defaults stay as they are.
    ajv: { plugins: [(ajv) => ajv.addKeyword(OPENAPI_TYPE_KEY)] },
  }).withTypeProvider<TypeBoxTypeProvider>();

  void app.register(errorsPlugin);
  // Before auth: the preflight carries no token and must be answered first.
  void app.register(corsPlugin, { origins: config.corsOrigins ?? [] });
  void app.register(swaggerPlugin);
  void app.register(dbPlugin, { databaseUrl: config.databaseUrl });
  void app.register(authPlugin, { verifyToken: createTokenVerifier(tokenVerifierConfig(config)) });
  void app.register(timezonePlugin);

  // Routes go in a registered plugin so they load after swagger and appear in the document.
  void app.register(async (routes) => {
    routes.get(
      '/health',
      { schema: { security: [], response: { 200: Type.Object({ status: Type.Literal('ok') }) } } },
      () => ({ status: 'ok' as const }),
    );
  });
  void app.register(accountsRoutes);
  void app.register(categoriesRoutes);
  void app.register(transactionsRoutes);
  void app.register(creditExpensesRoutes);
  void app.register(dashboardsRoutes);
  void app.register(investmentReturnsRoutes);
  void app.register(importRoutes, {
    supabaseUrl: config.supabaseUrl,
    ...(config.supabasePublishableKey ? { publishableKey: config.supabasePublishableKey } : {}),
  });

  return app;
}

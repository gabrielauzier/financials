import Fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { createRemoteJWKSet } from 'jose';
import { loadConfig, type AppConfig } from './config.js';
import { authPlugin, createTokenVerifier, type TokenVerifierConfig } from './plugins/auth.js';
import { dbPlugin } from './plugins/db.js';
import { errorsPlugin } from './plugins/errors.js';
import { timezonePlugin } from './plugins/timezone.js';

function tokenVerifierConfig(config: AppConfig): TokenVerifierConfig {
  if (config.jwtSecret) return { mode: 'hs256', secret: config.jwtSecret };
  const jwksUrl = new URL(`${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`);
  return { mode: 'jwks', getKey: createRemoteJWKSet(jwksUrl) };
}

export function buildApp(config: AppConfig = loadConfig()): FastifyInstance {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();

  void app.register(errorsPlugin);
  void app.register(dbPlugin, { databaseUrl: config.databaseUrl });
  void app.register(authPlugin, { verifyToken: createTokenVerifier(tokenVerifierConfig(config)) });
  void app.register(timezonePlugin);

  app.get(
    '/health',
    { schema: { response: { 200: Type.Object({ status: Type.Literal('ok') }) } } },
    () => ({ status: 'ok' as const }),
  );

  return app;
}

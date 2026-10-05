import Fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export function buildApp(): FastifyInstance {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    '/health',
    { schema: { response: { 200: Type.Object({ status: Type.Literal('ok') }) } } },
    () => ({ status: 'ok' as const }),
  );

  return app;
}

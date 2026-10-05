import Fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { errorsPlugin } from './plugins/errors.js';
import { timezonePlugin } from './plugins/timezone.js';

export function buildApp(): FastifyInstance {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();

  void app.register(errorsPlugin);
  void app.register(timezonePlugin);

  app.get(
    '/health',
    { schema: { response: { 200: Type.Object({ status: Type.Literal('ok') }) } } },
    () => ({ status: 'ok' as const }),
  );

  return app;
}

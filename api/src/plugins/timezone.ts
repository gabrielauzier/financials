import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { IANAZone } from 'luxon';
import { AppError } from './errors.js';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

declare module 'fastify' {
  interface FastifyRequest {
    tz: string;
  }
}

export const timezonePlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('tz', DEFAULT_TIMEZONE);

  app.addHook('onRequest', async (request) => {
    const header = request.headers['x-timezone'];
    if (header === undefined) return;
    if (typeof header !== 'string' || !IANAZone.isValidZone(header)) {
      throw new AppError('invalid_timezone', 400, 'X-Timezone must be a valid IANA time zone', 'X-Timezone');
    }
    request.tz = header;
  });
});

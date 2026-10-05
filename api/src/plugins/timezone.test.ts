import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { errorsPlugin } from './errors.js';
import { timezonePlugin } from './timezone.js';

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(errorsPlugin);
  await app.register(timezonePlugin);
  app.get('/tz', (request) => ({ tz: request.tz }));
  await app.ready();
  return app;
}

describe('timezone plugin', () => {
  it('defaults to America/Sao_Paulo when X-Timezone is missing', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/tz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tz: 'America/Sao_Paulo' });
  });

  it('exposes a valid IANA zone on request.tz', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/tz',
      headers: { 'x-timezone': 'Europe/Lisbon' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tz: 'Europe/Lisbon' });
  });

  it('rejects an invalid zone with 400 invalid_timezone', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/tz',
      headers: { 'x-timezone': 'Mars/Olympus_Mons' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_timezone');
  });
});

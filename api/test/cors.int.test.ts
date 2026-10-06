import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { getLocalStack } from './helpers/stack.js';

const { apiUrl, dbUrl } = getLocalStack();
const ALLOWED = 'http://localhost:8080';
const OTHER_ALLOWED = 'http://127.0.0.1:5173';
const PREFLIGHT = {
  'access-control-request-method': 'PATCH',
  'access-control-request-headers': 'authorization,content-type,x-timezone',
};

const corsHeaders = (headers: Record<string, unknown>) =>
  Object.keys(headers).filter((name) => name.startsWith('access-control-'));

let app: FastifyInstance;
let appWithoutOrigins: FastifyInstance;

beforeAll(async () => {
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, corsOrigins: [ALLOWED, OTHER_ALLOWED] });
  appWithoutOrigins = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await Promise.all([app.ready(), appWithoutOrigins.ready()]);
});

afterAll(async () => {
  await Promise.all([app.close(), appWithoutOrigins.close()]);
});

describe('CORS preflight (CORS-01, CORS-02)', () => {
  it('answers 204 without a token and with the allow headers for an allowed origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/transactions/6f1c0a52-0000-4000-8000-000000000000',
      headers: { origin: ALLOWED, ...PREFLIGHT },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS');
    const allowedHeaders = String(response.headers['access-control-allow-headers']).toLowerCase();
    expect(allowedHeaders.split(/\s*,\s*/).sort()).toEqual(['authorization', 'content-type', 'x-timezone']);
    expect(response.headers['access-control-max-age']).toBe('600');
  });

  it('works for every allowed origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/accounts',
      headers: { origin: OTHER_ALLOWED, ...PREFLIGHT },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(OTHER_ALLOWED);
  });

  it('does not depend on the route existing', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/this-route-does-not-exist',
      headers: { origin: ALLOWED, ...PREFLIGHT },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('does not advertise PUT and never sends credentials', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/accounts',
      headers: { origin: ALLOWED, 'access-control-request-method': 'PUT' },
    });
    expect(String(response.headers['access-control-allow-methods']).split(/\s*,\s*/)).not.toContain('PUT');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('CORS on real requests (CORS-03)', () => {
  it('adds the allow-origin and Vary: Origin to a normal response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: ALLOWED } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(String(response.headers.vary).toLowerCase()).toContain('origin');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('keeps the 401 readable for the browser: standard error body plus the allow-origin', async () => {
    const response = await app.inject({ method: 'GET', url: '/accounts', headers: { origin: ALLOWED } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('unauthorized');
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });
});

describe('origins that must not get CORS headers (CORS-04)', () => {
  it.each([
    ['an origin that is not listed', 'https://evil.example'],
    ['a subdomain of an allowed origin', 'http://sub.localhost:8080'],
    ['an allowed host on another port', 'http://localhost:8081'],
    ['an allowed origin with a different scheme', 'https://localhost:8080'],
    ['an allowed origin with a suffix', 'http://localhost:8080.evil.example'],
  ])('sends no Access-Control-* header to %s (preflight and real request)', async (_label, origin) => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/accounts',
      headers: { origin, ...PREFLIGHT },
    });
    expect(corsHeaders(preflight.headers)).toEqual([]);
    const real = await app.inject({ method: 'GET', url: '/health', headers: { origin } });
    expect(corsHeaders(real.headers)).toEqual([]);
  });

  it('sends no Access-Control-* header when the request has no Origin', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(corsHeaders(response.headers)).toEqual([]);
  });

  it('allows no origin at all when CORS_ORIGINS is empty', async () => {
    const preflight = await appWithoutOrigins.inject({
      method: 'OPTIONS',
      url: '/accounts',
      headers: { origin: ALLOWED, ...PREFLIGHT },
    });
    expect(corsHeaders(preflight.headers)).toEqual([]);
    const real = await appWithoutOrigins.inject({ method: 'GET', url: '/health', headers: { origin: ALLOWED } });
    expect(corsHeaders(real.headers)).toEqual([]);
  });
});

import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export interface CorsPluginOptions {
  /** Exact origins (scheme, host and port) allowed to call the API from a browser. */
  origins: string[];
}

export const CORS_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];
export const CORS_HEADERS = ['authorization', 'content-type', 'x-timezone'];
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Registered before the auth plugin: the preflight is answered in the `onRequest` hook, so the
 * token check never sees it. Origins outside the list get no `Access-Control-*` header at all.
 */
export const corsPlugin = fp(async (app: FastifyInstance, options: CorsPluginOptions) => {
  const allowed = new Set(options.origins);
  await app.register(cors, {
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: CORS_METHODS,
    allowedHeaders: CORS_HEADERS,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  });
});

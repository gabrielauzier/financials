import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { TransactionSql } from 'postgres';
import type { JwtClaims } from './db.js';
import { AppError } from './errors.js';

export interface AuthUser {
  id: string;
  claims: JwtClaims;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    /** Runs `fn` in a transaction under the authenticated user's identity (RLS on). */
    withUser<T>(fn: (tx: TransactionSql) => Promise<T>): Promise<T>;
  }
}

/**
 * - `jwks` (primary): asymmetric keys published by Supabase Auth at
 *   `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256 on the local stack).
 * - `hs256` (fallback): legacy projects that sign user tokens with the shared JWT secret.
 */
export type TokenVerifierConfig =
  | { mode: 'jwks'; getKey: JWTVerifyGetKey }
  | { mode: 'hs256'; secret: string };

export type VerifyToken = (token: string) => Promise<JwtClaims>;

const ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'];

function unauthorized(): AppError {
  return new AppError('unauthorized', 401, 'Invalid or expired token');
}

function hasSubject(payload: JWTPayload): payload is JwtClaims {
  return typeof payload.sub === 'string' && payload.sub.length > 0;
}

export function createTokenVerifier(config: TokenVerifierConfig): VerifyToken {
  const options = { requiredClaims: ['sub', 'exp'] };
  const verify =
    config.mode === 'jwks'
      ? (token: string) => jwtVerify(token, config.getKey, { ...options, algorithms: ASYMMETRIC_ALGORITHMS })
      : (token: string) =>
          jwtVerify(token, new TextEncoder().encode(config.secret), { ...options, algorithms: ['HS256'] });

  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await verify(token));
    } catch (error) {
      // Token problems are 401; anything else (e.g. JWKS endpoint unreachable) stays a server error.
      if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) throw unauthorized();
      throw error;
    }
    if (!hasSubject(payload)) throw unauthorized();
    return payload;
  };
}

/** Route patterns reachable without a token. */
function isPublicRoute(url: string | undefined): boolean {
  return url === '/health' || url === '/docs' || (url?.startsWith('/docs/') ?? false);
}

function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer (\S+)$/i.exec(header ?? '');
  return match?.[1];
}

export interface AuthPluginOptions {
  verifyToken: VerifyToken;
}

/** Requires `Authorization: Bearer <JWT>` on every route except the public ones. Needs dbPlugin. */
export const authPlugin = fp(async (app: FastifyInstance, options: AuthPluginOptions) => {
  app.decorateRequest('user', null);
  app.decorateRequest('withUser', function <T>(this: FastifyRequest, fn: (tx: TransactionSql) => Promise<T>) {
    if (!this.user) throw unauthorized();
    return app.withUser(this.user.claims, fn);
  });

  app.addHook('onRequest', async (request) => {
    // Matched route pattern, not the raw URL, so query strings or encodings cannot bypass the check.
    if (isPublicRoute(request.routeOptions.url)) return;
    const token = bearerToken(request.headers.authorization);
    if (!token) throw new AppError('unauthorized', 401, 'Missing bearer token');
    const claims = await options.verifyToken(token);
    request.user = { id: claims.sub, claims };
  });
});

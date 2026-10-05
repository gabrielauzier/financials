import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { JwtClaims } from './db.js';
import { AppError } from './errors.js';

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

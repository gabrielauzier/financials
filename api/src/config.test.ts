import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = { SUPABASE_URL: 'http://supabase.example', DATABASE_URL: 'postgres://db.example/app' };

describe('loadConfig', () => {
  it('reads the Supabase and database URLs, without a JWT secret by default (JWKS mode)', () => {
    expect(loadConfig(base)).toEqual({
      supabaseUrl: 'http://supabase.example',
      databaseUrl: 'postgres://db.example/app',
    });
  });

  it('reads the optional HS256 secret', () => {
    expect(loadConfig({ ...base, SUPABASE_JWT_SECRET: 's3cret' }).jwtSecret).toBe('s3cret');
  });

  it.each(['SUPABASE_URL', 'DATABASE_URL'])('fails naming %s when it is missing', (name) => {
    expect(() => loadConfig({ ...base, [name]: undefined })).toThrow(name);
  });
});

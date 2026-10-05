import { describe, expect, it } from 'vitest';
import { loadConfig, loadServerConfig, parseCorsOrigins } from './config.js';

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

  it('reads the optional Storage publishable key; absent or empty leaves it out', () => {
    expect(loadConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).supabasePublishableKey).toBe(
      'sb_publishable_x',
    );
    expect(loadConfig(base)).not.toHaveProperty('supabasePublishableKey');
    expect(loadConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: '' })).not.toHaveProperty('supabasePublishableKey');
  });
});

describe('loadServerConfig', () => {
  it('uses the defaults when PORT, HOST and LOG_LEVEL are absent', () => {
    const config = loadServerConfig(base);
    expect(config.port).toBe(3001);
    expect(config.host).toBe('127.0.0.1');
    expect(config.logLevel).toBe('info');
  });

  it('reads PORT, HOST and LOG_LEVEL', () => {
    const config = loadServerConfig({ ...base, PORT: '8081', HOST: '0.0.0.0', LOG_LEVEL: 'warn' });
    expect([config.port, config.host, config.logLevel]).toEqual([8081, '0.0.0.0', 'warn']);
  });

  it.each(['0', '65536', '70000', 'abc', '3001.5', '-1'])('rejects PORT=%s citing PORT', (port) => {
    expect(() => loadServerConfig({ ...base, PORT: port })).toThrow(/PORT/);
  });

  it.each(['SUPABASE_URL', 'DATABASE_URL'])('fails naming %s when it is missing', (name) => {
    expect(() => loadServerConfig({ ...base, [name]: undefined })).toThrow(name);
  });
});

describe('CORS_ORIGINS', () => {
  it('normalizes spaces, trailing slashes and empty entries', () => {
    expect(parseCorsOrigins(' http://localhost:8080/ , http://127.0.0.1:5173,, ')).toEqual([
      'http://localhost:8080',
      'http://127.0.0.1:5173',
    ]);
  });

  it('is empty when unset or blank (no origin allowed)', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('  ')).toEqual([]);
    expect(loadConfig(base).corsOrigins).toBeUndefined();
  });

  it('is exposed on the config only when it lists origins', () => {
    expect(loadConfig({ ...base, CORS_ORIGINS: 'http://localhost:8080/' }).corsOrigins).toEqual([
      'http://localhost:8080',
    ]);
  });

  it.each(['*', 'http://localhost:8080,*', ' * '])('rejects %j citing CORS_ORIGINS', (raw) => {
    expect(() => loadConfig({ ...base, CORS_ORIGINS: raw })).toThrow(/CORS_ORIGINS/);
  });
});

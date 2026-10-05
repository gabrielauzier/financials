export interface AppConfig {
  /** Supabase project URL; user tokens are verified against its JWKS. */
  supabaseUrl: string;
  /** Postgres URL of a role allowed to `set role authenticated` (AD-002). */
  databaseUrl: string;
  /** Legacy HS256 secret. When set, tokens are verified with it instead of the JWKS. */
  jwtSecret?: string;
  /** Exact browser origins allowed by CORS; absent or empty means no origin is allowed. */
  corsOrigins?: string[];
  /** Project API key sent to Storage as `apikey` (never the secret key). Without it, routes that store files answer 503. */
  supabasePublishableKey?: string;
  /** Set to `false` behind a transaction-mode pooler (Supavisor port 6543), which has no prepared statements. */
  databasePrepare?: boolean;
  /** Max connections per process; serverless instances should keep this small. */
  databasePoolMax?: number;
}

/** What `buildApp` needs plus what the process needs to listen. */
export interface ServerConfig extends AppConfig {
  port: number;
  host: string;
  logLevel: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Trims, drops the trailing slash and empty entries; a wildcard would open the API to any site. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== '');
  if (origins.includes('*')) throw new Error('CORS_ORIGINS must list exact origins; "*" is not allowed');
  return origins;
}

function parsePoolMax(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const max = Number(raw);
  if (!/^\d+$/.test(raw) || max < 1 || max > 100) {
    throw new Error(`DATABASE_POOL_MAX must be an integer between 1 and 100, got "${raw}"`);
  }
  return max;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const databasePoolMax = parsePoolMax(env.DATABASE_POOL_MAX);
  return {
    supabaseUrl: required(env, 'SUPABASE_URL'),
    databaseUrl: required(env, 'DATABASE_URL'),
    ...(jwtSecret ? { jwtSecret } : {}),
    ...(corsOrigins.length > 0 ? { corsOrigins } : {}),
    ...(supabasePublishableKey ? { supabasePublishableKey } : {}),
    ...(env.DATABASE_PREPARE === 'false' ? { databasePrepare: false } : {}),
    ...(databasePoolMax !== undefined ? { databasePoolMax } : {}),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 3001;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${raw}"`);
  }
  return port;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    ...loadConfig(env),
    port: parsePort(env.PORT),
    host: env.HOST || '127.0.0.1',
    logLevel: env.LOG_LEVEL || 'info',
  };
}

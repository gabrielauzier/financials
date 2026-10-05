export interface AppConfig {
  /** Supabase project URL; user tokens are verified against its JWKS. */
  supabaseUrl: string;
  /** Postgres URL of a role allowed to `set role authenticated` (AD-002). */
  databaseUrl: string;
  /** Legacy HS256 secret. When set, tokens are verified with it instead of the JWKS. */
  jwtSecret?: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  return {
    supabaseUrl: required(env, 'SUPABASE_URL'),
    databaseUrl: required(env, 'DATABASE_URL'),
    ...(jwtSecret ? { jwtSecret } : {}),
  };
}

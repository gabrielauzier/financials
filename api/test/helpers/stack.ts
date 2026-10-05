import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface LocalStack {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string | undefined;
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

let cached: LocalStack | undefined;

function parseEnv(output: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) env[match[1]] = match[2];
  }
  return env;
}

function readStatus(): Record<string, string> {
  try {
    const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseEnv(output);
  } catch {
    return {};
  }
}

/**
 * Real URLs and keys of the local stack. Environment variables win
 * (TEST_SUPABASE_URL, TEST_DATABASE_URL, TEST_SUPABASE_ANON_KEY,
 * TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_SUPABASE_JWT_SECRET); otherwise the
 * values come from `npx supabase status -o env` in the repo root.
 */
export function getLocalStack(): LocalStack {
  if (cached) return cached;
  const env = process.env;
  const needStatus = !(
    env.TEST_SUPABASE_URL &&
    env.TEST_DATABASE_URL &&
    env.TEST_SUPABASE_ANON_KEY &&
    env.TEST_SUPABASE_SERVICE_ROLE_KEY
  );
  const status = needStatus ? readStatus() : {};
  const pick = (override: string | undefined, key: string): string => {
    const value = override ?? status[key];
    if (!value) {
      throw new Error(
        `Local Supabase stack is down or ${key} is unavailable. ` +
          'Start it with "pnpm -C api db:start" and retry.',
      );
    }
    return value;
  };
  cached = {
    apiUrl: pick(env.TEST_SUPABASE_URL, 'API_URL'),
    dbUrl: pick(env.TEST_DATABASE_URL, 'DB_URL'),
    anonKey: pick(env.TEST_SUPABASE_ANON_KEY, 'ANON_KEY'),
    serviceRoleKey: pick(env.TEST_SUPABASE_SERVICE_ROLE_KEY, 'SERVICE_ROLE_KEY'),
    jwtSecret: env.TEST_SUPABASE_JWT_SECRET ?? status.JWT_SECRET,
  };
  return cached;
}

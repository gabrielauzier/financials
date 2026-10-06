/**
 * Integration test helpers: admin SQL connection and throwaway confirmed users.
 *
 * FINDING (Supabase CLI 2.119, local stack): the stack has two signing modes at once.
 *  - The `anon` / `service_role` API keys are HS256 JWTs signed with JWT_SECRET
 *    (`super-secret-jwt-token-with-at-least-32-characters-long` by default).
 *  - GoTrue signs *user* access tokens with an asymmetric key: ES256 (P-256), published at
 *    `${API_URL}/auth/v1/.well-known/jwks.json`. The private key is not exposed, so a user
 *    token cannot be minted locally with the HS256 secret and would not match the real flow.
 * So `createTestUser()` obtains a real access_token by signing in with password through
 * GoTrue. The API's token verification must therefore support JWKS mode (and HS256 for
 * the service/anon keys or other deployments).
 *
 * URLs and keys come from `npx supabase status -o env` (or TEST_* env vars), never hardcoded.
 */
import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { getLocalStack } from './stack.js';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export interface CreateTestUserOptions {
  name?: string;
  nickname?: string;
}

let adminSql: Sql | undefined;
const createdUserIds = new Set<string>();

export function getAdminSql(): Sql {
  adminSql ??= postgres(getLocalStack().dbUrl, { max: 2, onnotice: () => {} });
  return adminSql;
}

async function gotrue(
  path: string,
  init: { method: string; key: string; body?: unknown },
): Promise<Response> {
  const { apiUrl } = getLocalStack();
  return fetch(`${apiUrl}/auth/v1${path}`, {
    method: init.method,
    headers: {
      apikey: init.key,
      authorization: `Bearer ${init.key}`,
      'content-type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
  const { serviceRoleKey, anonKey } = getLocalStack();
  const email = `test-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;

  const created = await gotrue('/admin/users', {
    method: 'POST',
    key: serviceRoleKey,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: options.name ?? 'Test User',
        nickname: options.nickname ?? 'tester',
      },
    },
  });
  if (!created.ok) {
    throw new Error(`Admin user creation failed: HTTP ${created.status} ${await created.text()}`);
  }
  const { id } = (await created.json()) as { id: string };
  createdUserIds.add(id);

  const login = await gotrue('/token?grant_type=password', {
    method: 'POST',
    key: anonKey,
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`Test user sign-in failed: HTTP ${login.status} ${await login.text()}`);
  }
  const { access_token: token } = (await login.json()) as { access_token: string };
  return { id, email, token };
}

/** Deletes every user created by `createTestUser()` (cascades to their data). */
export async function cleanupTestUsers(): Promise<void> {
  const { serviceRoleKey } = getLocalStack();
  const ids = [...createdUserIds];
  for (const id of ids) {
    const res = await gotrue(`/admin/users/${id}`, { method: 'DELETE', key: serviceRoleKey });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cleanup of user ${id} failed: HTTP ${res.status} ${await res.text()}`);
    }
    createdUserIds.delete(id);
  }
}

export async function closeAdminSql(): Promise<void> {
  if (adminSql) {
    await adminSql.end();
    adminSql = undefined;
  }
}

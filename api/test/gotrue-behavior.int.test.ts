/**
 * Records the real behavior of the local Supabase Auth (GoTrue) that the web app depends on.
 * Findings are written in .specs/features/auth/design.md (Risks). If one of these assertions
 * starts failing after a stack upgrade, the web app's detection rules must be revisited.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeAdminSql, createTestUser, cleanupTestUsers, getAdminSql } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

interface GoTrueUser {
  id: string;
  created_at: string;
  confirmation_sent_at?: string;
  identities?: unknown[];
  user_metadata: Record<string, unknown>;
}

interface GoTrueError {
  code: number;
  error_code: string;
  msg: string;
}

const signedUpIds = new Set<string>();

afterAll(async () => {
  if (signedUpIds.size > 0) await getAdminSql()`delete from auth.users where id in ${getAdminSql()([...signedUpIds])}`;
  await cleanupTestUsers();
  await closeAdminSql();
});

async function post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const { apiUrl, anonKey } = getLocalStack();
  const res = await fetch(`${apiUrl}/auth/v1${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

/** Same call supabase-js `signUp({ email, password, options: { data } })` makes. */
async function signUp(email: string, name: string) {
  const res = await post<GoTrueUser & GoTrueError>('/signup', {
    email,
    password: `pw-${randomUUID()}`,
    data: { name, nickname: name.toLowerCase() },
  });
  if (res.status === 200) signedUpIds.add(res.body.id);
  return res;
}

const signIn = (email: string, password: string) =>
  post<GoTrueError>('/token?grant_type=password', { email, password });

const freshEmail = () => `gotrue-${randomUUID()}@example.test`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Detection rule for an existing *unconfirmed* account (see design.md Risks). */
const resentToExistingUser = (user: GoTrueUser) =>
  Date.parse(user.confirmation_sent_at ?? '') - Date.parse(user.created_at) >= 1_000;

describe('GoTrue sign-up with an e-mail that is already registered', () => {
  it('confirmed account: rejects with 422 user_already_exists and returns no user', async () => {
    const existing = await createTestUser(); // confirmed

    const res = await signUp(existing.email, 'Intruder');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
  });

  it('unconfirmed account: returns 200 with the existing user (identities NOT empty) and resends the e-mail', async () => {
    const email = freshEmail();
    const first = await signUp(email, 'Original');
    expect(first.status).toBe(200);
    expect(first.body.identities).toHaveLength(1);
    expect(resentToExistingUser(first.body)).toBe(false);

    // A retry inside auth.email.max_frequency (1s locally, 60s by default in hosted projects) is throttled.
    const immediate = await signUp(email, 'Retry');
    expect(immediate.status).toBe(429);
    expect(immediate.body.error_code).toBe('over_email_send_rate_limit');

    await sleep(1_500);
    const second = await signUp(email, 'Retry');
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.identities).toHaveLength(1); // refutes the "identities: []" assumption locally
    expect(second.body.user_metadata.name).toBe('Original'); // the new metadata is ignored
    expect(second.body.created_at).toBe(first.body.created_at);
    expect(resentToExistingUser(second.body)).toBe(true);
  });
});

describe('GoTrue password sign-in errors', () => {
  it('unconfirmed e-mail: 400 email_not_confirmed', async () => {
    const email = freshEmail();
    const password = `pw-${randomUUID()}`;
    const created = await post<GoTrueUser>('/signup', { email, password, data: { name: 'U', nickname: 'u' } });
    expect(created.status).toBe(200);
    signedUpIds.add(created.body.id);

    const res = await signIn(email, password);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
  });

  it('wrong password and unknown e-mail: the same 400 invalid_credentials (no hint about which field)', async () => {
    const existing = await createTestUser();
    const expected = { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' };

    const wrongPassword = await signIn(existing.email, 'definitely-wrong-password');
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body).toEqual(expected);

    const unknownEmail = await signIn(freshEmail(), 'definitely-wrong-password');
    expect(unknownEmail.status).toBe(400);
    expect(unknownEmail.body).toEqual(expected);
  });
});

/** Local mail catcher (Mailpit, supabase/config.toml [inbucket] port). */
const MAIL_URL = process.env.TEST_MAIL_URL ?? 'http://127.0.0.1:55324';

/** Polls the mail catcher for the confirmation e-mail sent to `email` and returns its link. */
async function confirmationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    const first = messages[0];
    if (first) {
      const message = (await (await fetch(`${MAIL_URL}/api/v1/message/${first.ID}`)).json()) as { Text: string };
      const link = /\(\s*(http\S*\/auth\/v1\/verify\?\S+)\s*\)/.exec(message.Text)?.[1];
      if (link) return link;
    }
    await sleep(250);
  }
  throw new Error(`No confirmation e-mail for ${email} in ${MAIL_URL}`);
}

describe('GoTrue e-mail confirmation link', () => {
  it('marks the e-mail as confirmed and lets the user sign in', async () => {
    const email = freshEmail();
    const password = `pw-${randomUUID()}`;
    const created = await post<GoTrueUser>('/signup', { email, password, data: { name: 'U', nickname: 'u' } });
    expect(created.status).toBe(200);
    signedUpIds.add(created.body.id);

    const before = await getAdminSql()`select email_confirmed_at from auth.users where id = ${created.body.id}`;
    expect(before[0]?.email_confirmed_at).toBeNull();
    expect((await signIn(email, password)).body).toMatchObject({ error_code: 'email_not_confirmed' });

    // The very link the user receives by e-mail; GoTrue answers with a redirect to redirect_to.
    const verify = await fetch(await confirmationLink(email), { redirect: 'manual' });
    expect(verify.status).toBe(303);

    const after = await getAdminSql()`select email_confirmed_at from auth.users where id = ${created.body.id}`;
    expect(after[0]?.email_confirmed_at).toBeInstanceOf(Date);

    const { apiUrl, anonKey } = getLocalStack();
    const login = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    expect(((await login.json()) as { access_token?: string }).access_token).toEqual(expect.any(String));
  });
});

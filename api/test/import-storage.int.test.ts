import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/plugins/errors.js';
import { removeImportFile, uploadImportFile } from '../src/modules/import/storage.js';
import { cleanupTestUsers, closeAdminSql, createTestUser as createUser, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';
import { importObjects, removeImportObjects } from './helpers/storage.js';

const userIds: string[] = [];

async function createTestUser(): Promise<TestUser> {
  const user = await createUser();
  userIds.push(user.id);
  return user;
}

afterAll(async () => {
  await removeImportObjects(userIds);
  await cleanupTestUsers();
  await closeAdminSql();
});

const CONTENT = Buffer.from('\uFEFFData,Valor,Identificador,Descrição\n02/07/2026,-82.32,x,Débito em conta\n', 'utf8');

function access(user: TestUser) {
  const { apiUrl, publishableKey } = getLocalStack();
  return { supabaseUrl: apiUrl, publishableKey, token: user.token };
}

async function upload(user: TestUser, filename: string, batchId: string = randomUUID()): Promise<string> {
  return uploadImportFile({
    ...access(user),
    userId: user.id,
    batchId,
    filename,
    content: CONTENT,
    contentType: 'text/csv',
  });
}

/** Raw Storage download as `user` (the helper itself has no download). */
async function download(user: TestUser, path: string): Promise<{ status: number; body: Buffer }> {
  const { apiUrl, publishableKey } = getLocalStack();
  const res = await fetch(`${apiUrl}/storage/v1/object/imports/${path}`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${user.token}` },
  });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

const objectNames = (user: TestUser): Promise<string[]> => importObjects([user.id]);

describe('import storage helper (real local Storage)', () => {
  it('uploads to {userId}/{batchId}/{filename} and the download returns identical bytes', async () => {
    const user = await createTestUser();
    const batchId = randomUUID();
    const path = await upload(user, 'extrato.csv', batchId);
    expect(path).toBe(`${user.id}/${batchId}/extrato.csv`);
    expect(await objectNames(user)).toEqual([path]);

    const got = await download(user, path);
    expect(got.status).toBe(200);
    expect(got.body.equals(CONTENT)).toBe(true);
  });

  it('remove deletes the object', async () => {
    const user = await createTestUser();
    const path = await upload(user, 'extrato.csv');
    await removeImportFile({ ...access(user), path });

    expect(await objectNames(user)).toEqual([]);
    // Storage answers a missing object with HTTP 400 (`statusCode: "404"` in the body).
    expect((await download(user, path)).status).toBe(400);
  });

  it('another user can neither read nor remove the object', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const path = await upload(a, 'extrato.csv');

    const read = await download(b, path);
    expect(read.status).toBe(400);
    expect(read.body.includes(CONTENT)).toBe(false);
    expect(JSON.parse(read.body.toString('utf8'))).toMatchObject({ statusCode: '404' });

    await removeImportFile({ ...access(b), path }).catch(() => undefined);
    expect(await objectNames(a)).toEqual([path]);
  });

  it('keeps unsafe filenames inside the batch folder', async () => {
    const user = await createTestUser();
    const batchId = randomUUID();
    const folder = `${user.id}/${batchId}/`;
    expect(await upload(user, '../x.csv', batchId)).toBe(`${folder}x.csv`);
    expect(await upload(user, 'a/b.csv', batchId)).toBe(`${folder}b.csv`);
    expect(await upload(user, '..', batchId)).toBe(`${folder}import.csv`);
    expect(await upload(user, 'C:\\Users\\me\\extrato julho.csv', batchId)).toBe(`${folder}extrato_julho.csv`);

    // Every object of the user sits in that one folder, and the user owns no other path.
    expect(await objectNames(user)).toEqual([
      `${folder}b.csv`,
      `${folder}extrato_julho.csv`,
      `${folder}import.csv`,
      `${folder}x.csv`,
    ]);
  });

  it('throws storage_error (502) without the token or the key when Storage rejects the upload', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const { apiUrl, publishableKey } = getLocalStack();

    // Into another user's folder: the per-folder policy rejects it.
    const error = await uploadImportFile({
      supabaseUrl: apiUrl, publishableKey, token: a.token,
      userId: b.id, batchId: randomUUID(), filename: 'x.csv', content: CONTENT, contentType: 'text/csv',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'storage_error', status: 502 });
    const message = (error as AppError).message;
    expect(message).not.toContain(a.token);
    expect(message).not.toContain(publishableKey);
    expect(message).not.toContain(apiUrl);

    expect(await objectNames(a)).toEqual([]);
    expect(await objectNames(b)).toEqual([]);
  });

  it('records that the local gateway does not check the apikey when the user token is valid', async () => {
    // FINDING (Supabase CLI local stack): Storage accepts the upload with a wrong `apikey` as long as
    // the bearer token is a valid user JWT. A wrong key is therefore not a way to make it fail here.
    const user = await createTestUser();
    const { apiUrl } = getLocalStack();
    const path = await uploadImportFile({
      supabaseUrl: apiUrl, publishableKey: 'sb_publishable_wrong', token: user.token,
      userId: user.id, batchId: randomUUID(), filename: 'x.csv', content: CONTENT, contentType: 'text/csv',
    });
    expect(await objectNames(user)).toEqual([path]);
  });
});

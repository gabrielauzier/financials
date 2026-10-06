import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../plugins/errors.js';
import { downloadImportFile, safeFilename } from './storage.js';

describe('safeFilename', () => {
  it('keeps a plain name', () => {
    expect(safeFilename('extrato_nubank-2026.07.csv')).toBe('extrato_nubank-2026.07.csv');
  });

  it('drops directories of both separators', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('a/b.csv')).toBe('b.csv');
    expect(safeFilename('C:\\tmp\\fatura.csv')).toBe('fatura.csv');
  });

  it('drops control characters and replaces other unsafe characters with _', () => {
    expect(safeFilename('ex\u0000tra\u001fto\u007f.csv')).toBe('extrato.csv');
    expect(safeFilename('fatura março?.csv')).toBe('fatura_mar_o_.csv');
  });

  it('removes leading dots so the name is never . or .. or hidden', () => {
    expect(safeFilename('..')).toBe('import.csv');
    expect(safeFilename('.')).toBe('import.csv');
    expect(safeFilename('.env')).toBe('env');
  });

  it('falls back to import.csv when nothing is left', () => {
    expect(safeFilename('')).toBe('import.csv');
    expect(safeFilename('dir/')).toBe('import.csv');
    expect(safeFilename('\u0001\u0002')).toBe('import.csv');
  });

  it('caps the name at 100 characters keeping the extension', () => {
    const name = safeFilename(`${'a'.repeat(300)}.csv`);
    expect(name).toHaveLength(100);
    expect(name).toBe(`${'a'.repeat(96)}.csv`);
  });
});

describe('downloadImportFile (IMPIMP-08, IMPIMP-10)', () => {
  const SUPABASE_URL = 'https://project-ref.supabase.test';
  const KEY = 'sb_publishable_KEY_123';
  const TOKEN = 'user.jwt.TOKEN_456';
  const PATH = '11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/extrato.csv';
  const input = { supabaseUrl: SUPABASE_URL, publishableKey: KEY, token: TOKEN, path: PATH };

  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(impl: () => Promise<Response>) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  async function thrown(): Promise<AppError> {
    try {
      await downloadImportFile(input);
    } catch (error) {
      return error as AppError;
    }
    throw new Error('downloadImportFile did not throw');
  }

  it('returns the exact bytes of a 200 answer, including non-UTF-8 bytes', async () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, 0x44, 0x00, 0xff, 0xfe, 0x0a]);
    stubFetch(() => Promise.resolve(new Response(bytes, { status: 200 })));
    const got = await downloadImportFile(input);
    expect(Buffer.isBuffer(got)).toBe(true);
    expect([...(got as Buffer)]).toEqual([...bytes]);
  });

  it.each([400, 404])('returns null when Storage answers HTTP %i (object missing or outside the policy)', async (status) => {
    stubFetch(() => Promise.resolve(new Response('{"statusCode":"404","error":"not_found"}', { status })));
    expect(await downloadImportFile(input)).toBeNull();
  });

  it.each([401, 403, 500, 502, 503])('throws storage_error 502 when Storage answers HTTP %i', async (status) => {
    stubFetch(() => Promise.resolve(new Response('boom', { status })));
    const error = await thrown();
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'storage_error', status: 502 });
    expect(error.message).toContain(`HTTP ${status}`);
  });

  it('throws storage_error 502 on a network error', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect(await thrown()).toMatchObject({ code: 'storage_error', status: 502 });
  });

  it('throws storage_error 502 on a timeout and sends a signal that aborts', async () => {
    const fetchMock = stubFetch(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')));
    expect(await thrown()).toMatchObject({ code: 'storage_error', status: 502 });
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].signal).toBeInstanceOf(AbortSignal);
    expect(init[1].signal?.aborted).toBe(false);
  });

  it.each([
    ['an HTTP error', () => Promise.resolve(new Response('x', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError(`fetch failed ${SUPABASE_URL}/${PATH} ${TOKEN} ${KEY}`))],
  ])('never puts the URL, token, key or path in the message of %s', async (_label, impl) => {
    stubFetch(impl);
    const { message } = await thrown();
    for (const secret of [SUPABASE_URL, 'project-ref', TOKEN, KEY, PATH, '11111111-2222']) {
      expect(message).not.toContain(secret);
    }
  });

  it('requests the object with the publishable key and the user token only, never a service key', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('ok', { status: 200 })));
    await downloadImportFile(input);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/imports/${PATH}`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ apikey: KEY, authorization: `Bearer ${TOKEN}` });
  });
});

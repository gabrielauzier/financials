import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { COLOR_KEYS } from '../src/lib/palette.js';

const apiDir = fileURLToPath(new URL('..', import.meta.url));

interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
}

interface SchemaDoc {
  type?: string;
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, SchemaDoc>;
  items?: SchemaDoc;
}
interface OperationDoc {
  requestBody?: { content?: Record<string, { schema?: SchemaDoc }> };
  responses?: Record<string, { content?: Record<string, { schema?: SchemaDoc }> }>;
}

describe('OpenAPI contract', () => {
  it('GET /docs/json returns a public OpenAPI 3 document that lists /health with its schema', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      expect(res.statusCode).toBe(200);
      const doc = res.json<OpenApiDoc>();
      expect(doc.openapi).toMatch(/^3\.\d+\.\d+$/);
      expect(doc.info.title).toEqual(expect.any(String));
      expect(doc.paths['/health']?.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { type: 'object', properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status'] },
          },
        },
      });

      const ui = await app.inject({ method: 'GET', url: '/docs' });
      expect(ui.statusCode).toBe(200);
      expect(ui.headers['content-type']).toContain('text/html');
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents description as a nullable string in the POST body and in every Transaction, and not in the PATCH body (TUX-09)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const body = (operation: OperationDoc | undefined): SchemaDoc | undefined =>
        operation?.requestBody?.content?.['application/json']?.schema;
      const response = (operation: OperationDoc | undefined, status: string): SchemaDoc | undefined =>
        operation?.responses?.[status]?.content?.['application/json']?.schema;
      const create = doc.paths['/transactions']?.post;
      const list = doc.paths['/transactions']?.get;
      const edit = doc.paths['/transactions/{id}']?.patch;

      const post = body(create);
      expect(post?.properties?.description).toMatchObject({ type: 'string', nullable: true });
      expect(post?.required).not.toContain('description');

      const transactions: Array<[string, SchemaDoc | undefined]> = [
        ['POST 201', response(create, '201')],
        ['GET list item', response(list, '200')?.properties?.items?.items],
        ['PATCH 200', response(edit, '200')],
      ];
      for (const [label, schema] of transactions) {
        expect(schema?.properties?.description, label).toMatchObject({ type: 'string', nullable: true });
        expect(schema?.required, label).toContain('description');
      }

      const patch = body(edit);
      expect(patch?.properties).toBeDefined();
      expect(Object.keys(patch?.properties ?? {})).toContain('name');
      expect(patch?.properties).not.toHaveProperty('description');
      expect(patch?.required ?? []).not.toContain('description');
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents identifier as a nullable string in every Transaction, and in no request body (TUXV2-03)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const body = (operation: OperationDoc | undefined): SchemaDoc | undefined =>
        operation?.requestBody?.content?.['application/json']?.schema;
      const response = (operation: OperationDoc | undefined, status: string): SchemaDoc | undefined =>
        operation?.responses?.[status]?.content?.['application/json']?.schema;
      const create = doc.paths['/transactions']?.post;
      const list = doc.paths['/transactions']?.get;
      const edit = doc.paths['/transactions/{id}']?.patch;

      const transactions: Array<[string, SchemaDoc | undefined]> = [
        ['POST 201', response(create, '201')],
        ['GET list item', response(list, '200')?.properties?.items?.items],
        ['PATCH 200', response(edit, '200')],
      ];
      for (const [label, schema] of transactions) {
        expect(schema?.properties?.identifier, label).toMatchObject({ type: 'string', nullable: true });
        expect(schema?.required, label).toContain('identifier');
      }
      for (const [label, schema] of [['POST body', body(create)], ['PATCH body', body(edit)]] as const) {
        expect(Object.keys(schema?.properties ?? {}), label).toContain('name');
        expect(schema?.properties, label).not.toHaveProperty('identifier');
        expect(schema?.required ?? [], label).not.toContain('identifier');
      }
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json lists Other with the 7 other payment methods in every enum and "One of" description (IMPFIX-02)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const body = (operation: OperationDoc | undefined): SchemaDoc | undefined =>
        operation?.requestBody?.content?.['application/json']?.schema;
      const response = (operation: OperationDoc | undefined, status: string): SchemaDoc | undefined =>
        operation?.responses?.[status]?.content?.['application/json']?.schema;
      const create = doc.paths['/transactions']?.post;
      const list = doc.paths['/transactions']?.get;
      const edit = doc.paths['/transactions/{id}']?.patch;
      const methods = ['BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX', 'Other'];

      for (const [label, schema] of [
        ['POST body', body(create)],
        ['PATCH body', body(edit)],
      ] as const) {
        const description = (schema?.properties?.paymentMethod as { description?: string } | undefined)?.description;
        expect(description, label).toBe(`One of: ${methods.join(', ')}`);
      }
      for (const [label, schema] of [
        ['POST 201', response(create, '201')],
        ['GET list item', response(list, '200')?.properties?.items?.items],
        ['PATCH 200', response(edit, '200')],
      ] as const) {
        expect((schema?.properties?.paymentMethod as { enum?: string[] } | undefined)?.enum, label).toEqual(methods);
      }
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json lists the 8 payment methods in the import preview row paymentMethod (IMPFIX-02)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const rows = doc.paths['/imports/preview']?.post?.responses?.['200']?.content?.['application/json']?.schema
        ?.properties?.rows?.items;
      expect((rows?.properties?.paymentMethod as { enum?: string[] } | undefined)?.enum).toEqual([
        'BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX', 'Other',
      ]);
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents categoryId on the preview rows and in the confirm selections (IMPIMP-14)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const rows = doc.paths['/imports/preview']?.post?.responses?.['200']?.content?.['application/json']?.schema
        ?.properties?.rows?.items;
      expect(rows?.properties?.categoryId).toMatchObject({ type: 'string', format: 'uuid' });
      expect(rows?.required).toContain('categoryId');

      const confirm = doc.paths['/imports/confirm']?.post?.requestBody?.content?.['multipart/form-data']?.schema;
      expect((confirm?.properties?.selections as { description?: string } | undefined)?.description).toContain(
        '"categoryId"?: uuid',
      );
      expect(Object.keys(doc.paths['/imports/confirm']?.post?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '201']),
      );
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents GET /imports with its limit query and the imported file fields (IMPIMP-14)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{
        paths: Record<string, Record<string, OperationDoc & { parameters?: Array<Record<string, unknown>> }>>;
      }>();
      const operation = doc.paths['/imports']?.get;
      expect(operation?.parameters).toEqual([
        expect.objectContaining({
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100 },
        }),
      ]);
      const schema = operation?.responses?.['200']?.content?.['application/json']?.schema;
      expect(schema?.type).toBe('array');
      expect(Object.keys(schema?.items?.properties ?? {}).sort()).toEqual(
        ['account', 'bank', 'createdAt', 'filename', 'id', 'importedCount', 'mimeType', 'rowCount', 'sizeBytes', 'skippedCount'],
      );
      expect(schema?.items?.required).toContain('skippedCount');
      expect(schema?.items?.properties?.account?.properties).toHaveProperty('nickname');
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents GET /imports/{id}/file with a binary 200 and the 401, 404, 502 and 503 errors (IMPIMP-14)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const responses = doc.paths['/imports/{id}/file']?.get?.responses ?? {};
      expect(Object.keys(responses).sort()).toEqual(['200', '401', '404', '502', '503']);
      expect(responses['200']?.content?.['application/octet-stream']?.schema).toMatchObject({
        type: 'string',
        format: 'binary',
      });
      for (const status of ['401', '404', '502', '503']) {
        const schema = responses[status]?.content?.['application/json']?.schema;
        expect(schema?.properties?.error?.required, status).toEqual(expect.arrayContaining(['code', 'message']));
      }
    } finally {
      await app.close();
    }
  });

  it('GET /docs/json documents color with the 22-key enum on the account and category responses and the key list on their bodies (COLOR-06)', async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/json' });
      const doc = res.json<{ paths: Record<string, Record<string, OperationDoc>> }>();
      const colorOf = (schema: SchemaDoc | undefined) =>
        schema?.properties?.color as { type?: string; enum?: string[]; description?: string } | undefined;
      const response = (operation: OperationDoc | undefined, status: string): SchemaDoc | undefined =>
        operation?.responses?.[status]?.content?.['application/json']?.schema;
      const body = (operation: OperationDoc | undefined): SchemaDoc | undefined =>
        operation?.requestBody?.content?.['application/json']?.schema;

      const list = doc.paths['/accounts']?.get;
      const create = doc.paths['/accounts']?.post;
      const edit = doc.paths['/accounts/{id}']?.patch;
      for (const [label, schema] of [
        ['GET list item', response(list, '200')?.items],
        ['POST 201', response(create, '201')],
        ['PATCH 200', response(edit, '200')],
        ['activate 200', response(doc.paths['/accounts/{id}/activate']?.post, '200')],
        ['deactivate 200', response(doc.paths['/accounts/{id}/deactivate']?.post, '200')],
      ] as const) {
        expect(colorOf(schema)?.enum, label).toEqual([...COLOR_KEYS]);
        expect(colorOf(schema)?.enum, label).toHaveLength(22);
        expect(schema?.required, label).toContain('color');
      }
      for (const [label, schema] of [
        ['POST body', body(create)],
        ['PATCH body', body(edit)],
      ] as const) {
        expect(colorOf(schema)?.type, label).toBe('string');
        expect(colorOf(schema)?.description, label).toBe(`One of: ${COLOR_KEYS.join(', ')}`);
      }
      expect(body(create)?.required ?? []).not.toContain('color');

      const categories = doc.paths['/categories'];
      const categoryEdit = doc.paths['/categories/{id}']?.patch;
      for (const [label, schema] of [
        ['categories GET list item', response(categories?.get, '200')?.items],
        ['categories POST 201', response(categories?.post, '201')],
        ['categories PATCH 200', response(categoryEdit, '200')],
      ] as const) {
        expect(colorOf(schema)?.enum, label).toEqual([...COLOR_KEYS]);
        expect(schema?.required, label).toContain('color');
      }
      for (const [label, schema] of [
        ['categories POST body', body(categories?.post)],
        ['categories PATCH body', body(categoryEdit)],
      ] as const) {
        expect(colorOf(schema)?.type, label).toBe('string');
        expect(colorOf(schema)?.description, label).toBe(`One of: ${COLOR_KEYS.join(', ')}`);
      }
      expect(body(categories?.post)?.required).toEqual(['name']);
      expect(body(categoryEdit)?.required ?? []).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('pnpm openapi:export writes the document, and the committed api/openapi.json is up to date', () => {
    const dir = mkdtempSync(join(tmpdir(), 'openapi-'));
    try {
      const out = join(dir, 'openapi.json');
      execFileSync('pnpm', ['--silent', 'openapi:export', out], { cwd: apiDir, stdio: 'ignore' });
      const exported = JSON.parse(readFileSync(out, 'utf8')) as OpenApiDoc;
      expect(Object.keys(exported.paths)).toContain('/health');

      const committed = JSON.parse(readFileSync(join(apiDir, 'openapi.json'), 'utf8')) as OpenApiDoc;
      expect(committed).toEqual(exported);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

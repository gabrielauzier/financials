import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const apiDir = fileURLToPath(new URL('..', import.meta.url));

interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
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

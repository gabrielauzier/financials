/**
 * Writes the OpenAPI document to api/openapi.json (or to the path given as the first argument).
 * Usage: pnpm -C api openapi:export [outFile]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

const outFile = process.argv[2] ?? fileURLToPath(new URL('../openapi.json', import.meta.url));

// Generating the document opens no connection, so placeholder URLs are enough.
const app = buildApp({ supabaseUrl: 'http://localhost', databaseUrl: 'postgres://localhost/unused' });
await app.ready();
writeFileSync(outFile, `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();

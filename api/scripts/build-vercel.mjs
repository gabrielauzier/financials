// Bundles the API into a single file and writes a Vercel Build Output (v3) function around it.
// Bundling avoids resolving ESM-only dependencies through Vercel's require() wrapper at runtime.
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const out = '.vercel/output';
const fn = `${out}/functions/index.func`;
await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

await build({
  entryPoints: ['vercel/entry.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // CommonJS dependencies bundled into an ES module still need `require`.
  // `__dirname` is what @fastify/swagger-ui uses to find its static files: it reads `<dir>/static` and serves
  // `<dir>/../static`, so the shim points at a `lib` folder and both copies are written (see below).
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __fu } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      "const __dirname = __dn(__filename) + '/lib';",
    ].join('\n'),
  },
});

const swaggerUi = dirname(createRequire(import.meta.url).resolve('@fastify/swagger-ui/package.json'));
for (const target of [`${fn}/static`, `${fn}/lib/static`]) {
  await cp(join(swaggerUi, 'static'), target, { recursive: true });
}

await writeFile(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 }, null, 2),
);
await writeFile(
  `${out}/config.json`,
  JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }, null, 2),
);

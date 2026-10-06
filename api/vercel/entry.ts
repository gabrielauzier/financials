import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Vercel function entry (Node runtime, req/res handler). The app is built once per instance.
let ready: ReturnType<typeof create> | undefined;

async function create() {
  const app = buildApp(loadConfig(), {
    logger: { level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'] },
  });
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  ready ??= create();
  const app = await ready;
  app.server.emit('request', req, res);
}

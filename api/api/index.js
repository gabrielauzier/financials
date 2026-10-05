// Vercel function entry: serves the Fastify app built into dist/ (see vercel.json).
import process from 'node:process';
import { buildApp } from '../dist/app.js';
import { loadConfig } from '../dist/config.js';

let ready;

function getApp() {
  ready ??= (async () => {
    const app = buildApp(loadConfig(), {
      logger: { level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'] },
    });
    await app.ready();
    return app;
  })();
  return ready;
}

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit('request', req, res);
}

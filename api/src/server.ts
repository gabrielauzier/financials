import { pathToFileURL } from 'node:url';
import { buildApp } from './app.js';
import { loadServerConfig, type ServerConfig } from './config.js';

export interface RunningServer {
  app: ReturnType<typeof buildApp>;
  /** Base URL the server is listening on, e.g. `http://127.0.0.1:3001`. */
  address: string;
  close: () => Promise<void>;
}

/** Loads the config from the environment, builds the app and starts listening. */
export async function startServer(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<ServerConfig> = {},
): Promise<RunningServer> {
  const config = { ...loadServerConfig(env), ...overrides };
  const app = buildApp(config, {
    logger: { level: config.logLevel, redact: ['req.headers.authorization'] },
  });
  try {
    const address = await app.listen({ port: config.port, host: config.host });
    return { app, address, close: () => app.close() };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function main(): Promise<void> {
  let server: RunningServer;
  try {
    server = await startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const shutdown = (signal: NodeJS.Signals) => {
    server.app.log.info({ signal }, 'shutting down');
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        server.app.log.error(error, 'shutdown failed');
        process.exit(1);
      },
    );
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

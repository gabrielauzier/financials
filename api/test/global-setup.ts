import { getLocalStack } from './helpers/stack.js';

// Fails fast with a clear message when the local Supabase stack is down.
export default async function setup(): Promise<void> {
  const stack = getLocalStack();
  try {
    const res = await fetch(`${stack.apiUrl}/auth/v1/health`, {
      headers: { apikey: stack.anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`GoTrue health returned HTTP ${res.status}`);
  } catch (cause) {
    throw new Error(
      `Local Supabase stack is not reachable at ${stack.apiUrl}. ` +
        `Start it with "pnpm -C api db:start" and retry. (${String(cause)})`,
      { cause },
    );
  }
}

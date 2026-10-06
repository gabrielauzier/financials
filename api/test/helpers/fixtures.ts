import { readFileSync } from 'node:fs';

/** Reads a committed sample file from `api/test/fixtures` (real exports from the bank). */
export function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
}

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * DASH-01 / AD-003: the calculation rules (neutral, CreditCard, Investments, Reversal, future-dated)
 * live only in `dashboards/rules.ts`. This guard fails when any other source file embeds one of them
 * in SQL text.
 *
 * Scope: only SQL text is inspected, i.e. the static parts of template literals and of quoted strings
 * that look like SQL. Plain TypeScript uses of the same words are legitimate and ignored, for example
 * the `PaymentMethod` enum values and import parsers choosing `categoryKey: 'Investments'` (a value
 * written to a row, not a rule over totals), and comments and API descriptions. No file is allowlisted.
 *
 * What counts as a duplicated rule inside SQL text:
 *  - a quoted special key: 'Reversal', 'Investments' or 'CreditCard';
 *  - `payment_method` used in a comparison (`=`, `<>`, `in`, ...). Merely listing the column in an
 *    INSERT/SELECT (as transactions and import do) is not a rule.
 */
const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "quoted special key ('Reversal' | 'Investments' | 'CreditCard')", pattern: /'(?:Reversal|Investments|CreditCard)'/ },
  { name: 'payment_method comparison', pattern: /\bpayment_method\s*(?:=|<>|!=|<|>|\bnot\b|\bin\b|\blike\b|\bis\b)/i },
];

const SQL_HINT = /\b(?:select|insert\s+into|update|delete\s+from|from|where|join|case\s+when)\b/i;

export interface Violation {
  file: string;
  line: number;
  rule: string;
}

interface Fragment {
  text: string;
  line: number;
}

/** Static text of every template literal and of SQL-looking quoted strings in a TypeScript source. */
function sqlFragments(source: string): Fragment[] {
  const out: Fragment[] = [];
  let line = 1;
  let i = 0;
  // Stack of open template literals; `braces` counts `{` inside a `${ ... }` of that template.
  const templates: { text: string; line: number; braces: number | null }[] = [];

  const top = () => templates[templates.length - 1];
  while (i < source.length) {
    const ch = source[i] as string;
    const t = top();
    const inTemplateText = t !== undefined && t.braces === null;

    if (inTemplateText) {
      if (ch === '\\') {
        t.text += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === '`') {
        out.push({ text: t.text, line: t.line });
        templates.pop();
      } else if (ch === '$' && source[i + 1] === '{') {
        t.braces = 1;
        i += 2;
        continue;
      } else {
        t.text += ch;
      }
      if (ch === '\n') line += 1;
      i += 1;
      continue;
    }

    // Code (top level or inside `${ }`).
    if (ch === '\n') line += 1;
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      line += source.slice(i, stop).split('\n').length - 1;
      i = stop;
      continue;
    }
    if (ch === '`') {
      templates.push({ text: '', line, braces: null });
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      const text = source.slice(i + 1, j);
      if (SQL_HINT.test(text)) out.push({ text: ch === '"' ? text.replace(/"/g, "'") : text, line });
      i = j + 1;
      continue;
    } else if (t !== undefined && ch === '{') {
      t.braces = (t.braces as number) + 1;
    } else if (t !== undefined && ch === '}') {
      t.braces = (t.braces as number) - 1;
      if (t.braces === 0) t.braces = null;
    }
    i += 1;
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const GUARD_FILE = fileURLToPath(import.meta.url);

/** Scans `root` for SQL that duplicates a dashboard rule; `rules.ts`, tests and this guard are exempt. */
export function scanForDuplicatedRules(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of sourceFiles(root)) {
    if (file === GUARD_FILE || file.endsWith('.test.ts') || file.endsWith(join('dashboards', 'rules.ts'))) continue;
    for (const fragment of sqlFragments(readFileSync(file, 'utf8'))) {
      for (const { name, pattern } of FORBIDDEN) {
        if (pattern.test(fragment.text)) violations.push({ file: relative(root, file), line: fragment.line, rule: name });
      }
    }
  }
  return violations;
}

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'rules-guard-'));
  temps.push(root);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  return root;
}

describe('rules duplication guard (DASH-01)', () => {
  it('passes on the current api/src tree: no SQL outside rules.ts embeds a dashboard rule', () => {
    const srcRoot = resolve(dirname(GUARD_FILE), '..', '..');
    expect(scanForDuplicatedRules(srcRoot)).toEqual([]);
  });

  it('fails on a sample file that duplicates the rules in SQL, naming file and line', () => {
    const root = tempTree({
      'modules/other/copy.ts': [
        'export const q = (tx: unknown) => tx`',
        "  select sum(t.amount) from public.transactions t join public.categories c on c.id = t.category_id",
        "  where c.key <> 'Investments' and t.payment_method <> 'CreditCard'",
        '`;',
        "export const legacy = \"select 1 from t where key = 'Reversal'\";",
        '',
      ].join('\n'),
    });
    const found = scanForDuplicatedRules(root);
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.every((v) => v.file === join('modules', 'other', 'copy.ts'))).toBe(true);
    expect(found.some((v) => v.line === 1 && v.rule.includes('quoted'))).toBe(true);
    expect(found.some((v) => v.rule === 'payment_method comparison')).toBe(true);
  });

  it('would flag the real rules.ts if it were copied elsewhere (the scanner does see the real SQL fragments)', () => {
    const root = tempTree({
      'modules/other/copy.ts': readFileSync(resolve(dirname(GUARD_FILE), 'rules.ts'), 'utf8'),
    });
    expect(scanForDuplicatedRules(root).length).toBeGreaterThan(0);
  });

  it('ignores non-SQL uses (enums, comments, plain strings), rules.ts and test files', () => {
    const root = tempTree({
      'modules/ok/enum.ts': [
        "export const METHODS = ['CreditCard', 'PIX'] as const;",
        "export const category = { key: 'Investments' };",
        "// where c.key = 'Reversal' (a comment)",
        "export const doc = 'CreditCard purchases of the period';",
        'export const insert = (tx: (s: TemplateStringsArray) => unknown) => tx`insert into t (payment_method) values (1)`;',
        '',
      ].join('\n'),
      'modules/dashboards/rules.ts': "export const R = `c.key <> 'Investments' and payment_method <> 'CreditCard'`;",
      'modules/other/x.test.ts': "export const R = `select 1 where key = 'Reversal'`;",
    });
    expect(scanForDuplicatedRules(root)).toEqual([]);
  });
});

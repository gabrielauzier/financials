import { collapseSpaces, normalizeName } from '../../../lib/normalize.js';
import type { PaymentMethod } from '../../transactions/schema.js';
import type { StatementCategoryKey } from '../types.js';
import type { Described } from './descriptions.js';

/**
 * How the name is read for a matched format:
 *  - `none`: the whole description is the format, matched exactly; the text is the name;
 *  - `sender`: `<prefix> - De NAME`; the name is what follows `De `;
 *  - `cdb`: `<prefix> - ... CDB ...`; needs the word CDB after the prefix; the text is the name.
 */
type Extract = 'none' | 'sender' | 'cdb';

interface Format {
  /** Normalized key (`normalizeName`: no accents, lowercase, collapsed spaces). */
  key: string;
  paymentMethod: PaymentMethod;
  categoryKey: StatementCategoryKey;
  extract: Extract;
}

const SEP = ' - ';

const format = (
  key: string,
  paymentMethod: PaymentMethod,
  categoryKey: StatementCategoryKey,
  extract: Extract,
): Format => ({ key, paymentMethod, categoryKey, extract });

/**
 * The single table of Sofisa Direto account statement formats, seen in real exports. Anything not
 * listed (a Pix sent, a redemption, ...) is not guessed: it stays `Other` and `unrecognized`.
 */
const FORMATS: readonly Format[] = [
  format('iof limite especial', 'Other', 'Uncategorized', 'none'),
  format('juros limite especial', 'Other', 'Uncategorized', 'none'),
  format('recebimento de transferencia via pix', 'PIX', 'Uncategorized', 'sender'),
  format('pagto fatura cartao de cred', 'BankTransfer', 'Uncategorized', 'none'),
  format('aplicacao', 'BankTransfer', 'Investments', 'cdb'),
  format('cashback - cartao sofisa visa', 'Other', 'Uncategorized', 'none'),
];

/** `Saldo em dd/mm/aaaa`: the running balance of the day, a statement line that is not a transaction. */
const BALANCE_LINE = /^saldo em \d{2}\/\d{2}\/\d{4}$/;

export function isBalanceLine(description: string): boolean {
  return BALANCE_LINE.test(normalizeName(description));
}

function unmapped(description: string): Described {
  return {
    name: collapseSpaces(description),
    paymentMethod: 'Other',
    categoryKey: 'Uncategorized',
    counterpartyDocument: null,
    counterpartyBank: null,
    status: 'unrecognized',
  };
}

function nameOf(extract: Extract, text: string, parts: string[], keyParts: number): string | null {
  const rest = parts.slice(keyParts).join(SEP);
  if (extract === 'none') return parts.length === keyParts ? text : null;
  if (extract === 'cdb') return /\bcdb\b/i.test(rest) ? text : null;
  return /^de\s+\S/i.test(rest) ? rest.replace(/^de\s+/i, '') : null;
}

/** Name, method and category of a Sofisa Direto statement row from its description text. */
export function describeSofisa(description: string): Described {
  const text = collapseSpaces(description);
  const parts = text.split(SEP);
  for (const entry of FORMATS) {
    const keyParts = entry.key.split(SEP).length;
    if (normalizeName(parts.slice(0, keyParts).join(SEP)) !== entry.key) continue;
    const name = nameOf(entry.extract, text, parts, keyParts);
    if (name === null) return unmapped(description);
    return {
      name,
      paymentMethod: entry.paymentMethod,
      categoryKey: entry.categoryKey,
      counterpartyDocument: null,
      counterpartyBank: null,
      status: 'new',
    };
  }
  return unmapped(description);
}

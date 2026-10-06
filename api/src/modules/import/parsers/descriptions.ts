import { collapseSpaces, normalizeName } from '../../../lib/normalize.js';
import type { PaymentMethod } from '../../transactions/schema.js';
import type { StatementCategoryKey } from '../types.js';

/** Longest `description` stored, in code points (the API limit for a transaction description). */
export const MAX_DESCRIPTION_CODE_POINTS = 500;

export interface Described {
  name: string;
  paymentMethod: PaymentMethod;
  categoryKey: StatementCategoryKey;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
  status: 'new' | 'unrecognized';
}

/**
 * How the name is read after the prefix:
 *  - `afterPrefix`: everything after the " - " that follows the prefix (may hold further " - ");
 *  - `transfer`: `NAME - DOCUMENT - BANK Agência: ...`, which also yields document and bank;
 *  - `none`: the whole description is the format (no fields), matched exactly.
 */
type Extract = 'afterPrefix' | 'transfer' | 'none';

interface Format {
  /** Normalized prefix (`normalizeName`: no accents, lowercase), segments joined by " - ". */
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

/** The single table of statement formats. The most specific prefix comes first; the first match wins. */
const FORMATS: readonly Format[] = [
  format('estorno - compra no debito', 'DebitCard', 'Reversal', 'afterPrefix'),
  format('estorno - ajuste de compra no debito', 'DebitCard', 'Reversal', 'afterPrefix'),
  format('estorno - compra no credito', 'CreditCard', 'Reversal', 'afterPrefix'),
  format('estorno - ajuste de compra no credito', 'CreditCard', 'Reversal', 'afterPrefix'),
  format('compra no debito via nupay', 'NuPay', 'Uncategorized', 'afterPrefix'),
  format('compra no debito', 'DebitCard', 'Uncategorized', 'afterPrefix'),
  format('compra no credito', 'CreditCard', 'Uncategorized', 'afterPrefix'),
  format('transferencia recebida pelo pix', 'PIX', 'Uncategorized', 'transfer'),
  format('transferencia enviada pelo pix', 'PIX', 'Uncategorized', 'transfer'),
  format('reembolso recebido pelo pix', 'PIX', 'Uncategorized', 'transfer'),
  format('transferencia recebida', 'BankTransfer', 'Uncategorized', 'transfer'),
  format('transferencia enviada', 'BankTransfer', 'Uncategorized', 'transfer'),
  format('pagamento de boleto efetuado', 'Boleto', 'Uncategorized', 'afterPrefix'),
  format('pagamento de fatura', 'BankTransfer', 'Uncategorized', 'none'),
  format('debito em conta', 'DebitCard', 'Uncategorized', 'none'),
  format('dinheiro guardado com resgate planejado', 'BankTransfer', 'Investments', 'none'),
];

/**
 * `NAME - DOCUMENT - BANK Agência: ...` (the text after a transfer prefix). The name stops at the
 * first " - "; the document may be masked (`•••.224.672-••`); the bank may hold " - " itself
 * (`NU PAGAMENTOS - IP (0260)`).
 */
const TRANSFER_FIELDS = /^((?:(?! - ).)+) - ([\d./•*-]+) - (.+?) Agência:/;

/** Anything that matches no format: importable, flagged for review, the raw text as the name. */
function unmapped(description: string): Described {
  return {
    name: description,
    paymentMethod: 'Other',
    categoryKey: 'Uncategorized',
    counterpartyDocument: null,
    counterpartyBank: null,
    status: 'unrecognized',
  };
}

/**
 * Derives method, category, name and counterparty from the free-text description of an account
 * statement row, by the single prefix table. The prefix is matched on its normalized form (case and
 * accents ignored, spaces collapsed); the name is cut from the collapsed original text, so its case
 * and accents are kept. No match, or a transfer without `NOME - DOC - BANCO Agência:`, is unmapped.
 */
export function describeStatement(description: string): Described {
  const text = collapseSpaces(description);
  const parts = text.split(SEP);
  for (const entry of FORMATS) {
    const keyParts = entry.key.split(SEP).length;
    // "Compra no débito -" (separator without a name) is the prefix alone.
    const head = parts.slice(0, keyParts).join(SEP).replace(/ -$/, '');
    if (normalizeName(head) !== entry.key) continue;
    const rest = parts.slice(keyParts).join(SEP);
    if (entry.extract === 'none') return parts.length === keyParts ? known(entry, text) : unmapped(description);
    if (entry.extract === 'afterPrefix') return known(entry, rest === '' ? text : rest);
    const fields = TRANSFER_FIELDS.exec(rest);
    if (fields === null) return unmapped(description);
    return {
      ...known(entry, fields[1] as string),
      counterpartyDocument: fields[2] as string,
      counterpartyBank: fields[3] as string,
    };
  }
  return unmapped(description);
}

function known(entry: Format, name: string): Described {
  return {
    name,
    paymentMethod: entry.paymentMethod,
    categoryKey: entry.categoryKey,
    counterpartyDocument: null,
    counterpartyBank: null,
    status: 'new',
  };
}

/**
 * The text stored in `transactions.description`: the statement text with collapsed spaces, cut to
 * 500 code points (never in the middle of a surrogate pair).
 */
export function originalText(description: string): string {
  return Array.from(collapseSpaces(description)).slice(0, MAX_DESCRIPTION_CODE_POINTS).join('');
}

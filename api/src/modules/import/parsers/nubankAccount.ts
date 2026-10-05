import { collapseSpaces } from '../../../lib/normalize.js';
import { readCsv } from '../csv.js';
import type { ParsedRow, ParseResult } from '../types.js';
import { canonicalAmount, invalidRow, localDateOf } from './common.js';

export const NUBANK_ACCOUNT_HEADER = ['Data', 'Valor', 'Identificador', 'Descrição'];

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/**
 * Pix description: `Transferência (recebida|enviada) pelo Pix - <name> - <document> - <bank> Agência: ...`.
 * The name stops at the first " - " (a name containing " - " is not supported and falls through to
 * `unrecognized`); the document may be masked (`•••.224.672-••`).
 */
const PIX = /^Transferência (recebida|enviada) pelo Pix - ((?:(?! - ).)+) - ([\d./•*-]+) - (.+?) Agência:/;
/** Non-Pix descriptions, matched exactly (after trimming); the type always comes from the sign. */
const KNOWN: Record<string, Pick<ParsedRow, 'paymentMethod' | 'categoryKey'> | undefined> = {
  'Débito em conta': { paymentMethod: 'DebitCard', categoryKey: 'Uncategorized' },
  'Pagamento de fatura': { paymentMethod: 'BankTransfer', categoryKey: 'Uncategorized' },
  'Dinheiro guardado com resgate planejado': { paymentMethod: 'BankTransfer', categoryKey: 'Investments' },
};
const SIGNED_AMOUNT = /^(-)?(\d+)(?:\.(\d*))?$/;

/** Parses `dd/mm/aaaa` into `YYYY-MM-DD`, or null when malformed or not a real date. */
function parseDate(value: string): string | null {
  const match = DATE.exec(value);
  return match ? localDateOf(match[3] as string, match[2] as string, match[1] as string) : null;
}

/** Parses `-82.32` / `8608.00` into the sign and the canonical absolute amount (strings only). */
function parseSignedAmount(value: string): { type: 'Income' | 'Expense'; amount: string } | null {
  const match = SIGNED_AMOUNT.exec(value);
  if (!match) return null;
  const amount = canonicalAmount(match[2] as string, match[3] ?? '');
  if (amount === null) return null;
  return { type: match[1] === '-' ? 'Expense' : 'Income', amount };
}

/**
 * Parses the Nubank account statement (`Data,Valor,Identificador,Descrição`). `index` is the
 * 0-based position of the data row, header excluded. A malformed row becomes `invalid` with a
 * reason; it never aborts the file.
 */
export function parseNubankAccount(text: string): ParseResult {
  const { records } = readCsv(text);
  return { rows: records.map((record, index) => parseRecord(record, index)) };
}

function parseRecord(record: string[], index: number): ParsedRow {
  if (record.length !== NUBANK_ACCOUNT_HEADER.length) {
    return invalidRow(index, `Expected ${NUBANK_ACCOUNT_HEADER.length} columns, found ${record.length}`);
  }
  const [rawDate, rawAmount, rawIdentifier, description] = record as [string, string, string, string];
  const identifier = rawIdentifier.trim() === '' ? null : rawIdentifier.trim();

  const localDate = parseDate(rawDate.trim());
  if (localDate === null) {
    return invalidRow(index, `Invalid date "${rawDate}"`, { identifier, name: description });
  }
  const parsed = parseSignedAmount(rawAmount.trim());
  if (parsed === null) {
    return invalidRow(index, `Invalid or zero amount "${rawAmount}"`, {
      localDate,
      identifier,
      name: description,
    });
  }
  return {
    index,
    localDate,
    type: parsed.type,
    amount: parsed.amount,
    identifier,
    ...describe(description),
  };
}

type Described = Pick<
  ParsedRow,
  'name' | 'paymentMethod' | 'categoryKey' | 'counterpartyDocument' | 'counterpartyBank' | 'status'
>;

/** Derives name, method, category and counterparty from the free-text description. */
function describe(description: string): Described {
  const pix = PIX.exec(description);
  if (pix) {
    return {
      name: collapseSpaces(pix[2] as string),
      paymentMethod: 'PIX',
      categoryKey: 'Uncategorized',
      counterpartyDocument: pix[3] as string,
      counterpartyBank: pix[4] as string,
      status: 'new',
    };
  }
  const known = KNOWN[description.trim()];
  return {
    name: description,
    paymentMethod: known?.paymentMethod ?? 'BankTransfer',
    categoryKey: known?.categoryKey ?? 'Uncategorized',
    counterpartyDocument: null,
    counterpartyBank: null,
    // Anything else is still importable, but flagged "unrecognized" for the preview.
    status: known ? 'new' : 'unrecognized',
  };
}

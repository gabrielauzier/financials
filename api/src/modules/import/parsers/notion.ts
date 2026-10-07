import { readCsv } from '../csv.js';
import { collapseSpaces, normalizeName } from '../../../lib/normalize.js';
import { AppError } from '../../../plugins/errors.js';
import type { PaymentMethod } from '../../transactions/schema.js';
import { parseReceiptUrl } from '../../transactions/validation.js';
import type { ParsedRow, ParseResult } from '../types.js';
import { canonicalAmount, invalidRow, localDateOf } from './common.js';

/** Header of the Notion database export (the `ID` and `Created time` columns are never read). */
export const NOTION_HEADER = [
  'Name',
  'Type',
  'Date',
  'Amount',
  'Category',
  'Payment Method',
  'Notes',
  'Receipt',
  'Created time',
  'ID',
  'Identifier',
];

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** `R$25.00`, `R$9,999.99`, `-R$45.00`: comma thousands, dot decimal (0 to 2 digits). */
const MONEY = /^(-)?R\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** Payment methods by `normalizeName` of the file text; a blank text is `Other` without a warning. */
const METHODS: Record<string, PaymentMethod> = {
  'debit card': 'DebitCard',
  'credit card': 'CreditCard',
  'bank transfer': 'BankTransfer',
  pix: 'PIX',
  boleto: 'Boleto',
  cash: 'Cash',
  nupay: 'NuPay',
};

type Kind = 'Income' | 'Expense';

function parseDate(value: string): string | null {
  const match = DATE.exec(value);
  return match ? localDateOf(match[3] as string, match[2] as string, match[1] as string) : null;
}

/** Sign and canonical absolute amount from the text (strings only, no float); null if malformed or zero. */
function parseMoney(value: string): { negative: boolean; amount: string } | null {
  const match = MONEY.exec(value.trim());
  if (!match) return null;
  const amount = canonicalAmount((match[2] as string).replace(/,/g, ''), match[3] ?? '');
  return amount === null ? null : { negative: match[1] !== undefined, amount };
}

function joinReasons(reasons: string[]): { status: 'new' | 'unrecognized'; reason?: string } {
  return reasons.length === 0 ? { status: 'new' } : { status: 'unrecognized', reason: reasons.join('; ') };
}

/**
 * Parses the Notion database export. Type: `Expense`/`Income` as written, `Neutral` is a neutral
 * Expense, `Canceled` is `ignored`, blank follows the sign of the amount (a positive blank-type row
 * is an Income only when it has neither category nor payment method, otherwise an `unrecognized`
 * Expense). The category text is kept raw for `analyze` to resolve; `ID` and `Created time` are ignored.
 * A malformed row becomes `invalid` with a reason; it never aborts the file.
 */
export function parseNotion(text: string): ParseResult {
  const { records } = readCsv(text);
  return { rows: records.map((record, index) => parseRecord(record, index)) };
}

function parseRecord(record: string[], index: number): ParsedRow {
  if (record.length !== NOTION_HEADER.length) {
    return invalidRow(index, `Expected ${NOTION_HEADER.length} columns, found ${record.length}`);
  }
  const [rawName, rawType, rawDate, rawAmount, rawCategory, rawMethod, rawNotes, rawReceipt, , , rawIdentifier] = record as [
    string, string, string, string, string, string, string, string, string, string, string,
  ];
  const identifier = rawIdentifier.trim() === '' ? null : rawIdentifier.trim();
  const name = collapseSpaces(rawName);
  const categoryLabel = rawCategory.trim();
  const raw = { identifier, name };

  const localDate = parseDate(rawDate.trim());
  const type = normalizeName(rawType);
  if (type === 'canceled') {
    return { ...invalidRow(index, 'Cancelada no Notion', { ...raw, ...(localDate === null ? {} : { localDate }) }), status: 'ignored' };
  }
  if (localDate === null) return invalidRow(index, `Invalid date "${rawDate}"`, raw);
  if (name === '') return invalidRow(index, 'Empty name', { localDate, ...raw });
  if (rawAmount.trim() === '') return invalidRow(index, 'Empty amount', { localDate, ...raw });
  const money = parseMoney(rawAmount);
  if (money === null) return invalidRow(index, `Invalid or zero amount "${rawAmount}"`, { localDate, ...raw });
  if (!['', 'expense', 'income', 'neutral'].includes(type)) {
    return invalidRow(index, `Unknown type "${rawType}"`, { localDate, ...raw });
  }

  const reasons: string[] = [];
  let kind: Kind;
  if (type === 'expense' || type === 'neutral') kind = 'Expense';
  else if (type === 'income') kind = 'Income';
  else if (money.negative) kind = 'Expense';
  else if (categoryLabel === '' && rawMethod.trim() === '') kind = 'Income';
  else {
    kind = 'Expense';
    reasons.push('Tipo ausente');
  }

  const methodKey = normalizeName(rawMethod);
  const paymentMethod = METHODS[methodKey] ?? 'Other';
  if (methodKey !== '' && METHODS[methodKey] === undefined) {
    reasons.push(`Forma de pagamento "${collapseSpaces(rawMethod)}" não reconhecida`);
  }

  const receiptText = rawReceipt.trim();
  let receipt: string | null = null;
  if (receiptText !== '') {
    try {
      receipt = parseReceiptUrl(receiptText);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return invalidRow(index, `Invalid receipt URL "${receiptText}"`, { localDate, ...raw });
    }
  }
  const notes = rawNotes.trim() === '' ? null : rawNotes.trim();

  return {
    index,
    localDate,
    type: kind,
    amount: money.amount,
    name,
    description: '',
    paymentMethod,
    categoryKey: 'Uncategorized',
    identifier,
    counterpartyDocument: null,
    counterpartyBank: null,
    categoryLabel,
    notes,
    receipt,
    ...(type === 'neutral' ? { neutralHint: true } : {}),
    ...joinReasons(reasons),
  };
}

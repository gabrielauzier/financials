import type { PaymentMethod } from '../transactions/schema.js';

export type RowStatus = 'new' | 'duplicate' | 'ignored' | 'unrecognized' | 'invalid';

/** System category keys a parser can assign (all seeded for every user). */
export type StatementCategoryKey = 'Uncategorized' | 'Investments' | 'Reversal';

export interface ParsedRow {
  /** 0-based position of the data row in the file (header excluded); the selection key. */
  index: number;
  /** Local calendar date, `YYYY-MM-DD`. */
  localDate: string;
  type: 'Income' | 'Expense';
  /** Canonical decimal string with 2 decimals (AD-004), e.g. `"1234.56"`. */
  amount: string;
  name: string;
  /** Original statement text (spaces collapsed, at most 500 code points); saved as `transactions.description`. */
  description: string;
  paymentMethod: PaymentMethod;
  categoryKey: StatementCategoryKey;
  identifier: string | null;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
  status: RowStatus;
  reason?: string;
  /** Raw category text of the file (Notion model), resolved against the user's categories by `analyze`. */
  categoryLabel?: string;
  /** Free-text notes saved as `transactions.notes`. */
  notes?: string | null;
  /** Receipt URL (http or https) saved as `transactions.receipt`. */
  receipt?: string | null;
  /** The file marks the row neutral (Notion `Type = Neutral`); saved as `neutral` unless the user changes it. */
  neutralHint?: boolean;
  /** Set by `analyze` from `categoryLabel`; wins over `categoryKey`. */
  resolvedCategory?: { id: string; name: string };
}

export interface ClassifiedRow extends ParsedRow {
  neutral: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
}

/** A bank-specific CSV parser: pure, never throws for a malformed row (it becomes `invalid`). */
export type Parser = (text: string) => ParseResult;

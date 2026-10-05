export type RowStatus = 'new' | 'duplicate' | 'ignored' | 'unrecognized' | 'invalid';

export interface ParsedRow {
  /** 0-based position of the data row in the file (header excluded); the selection key. */
  index: number;
  /** Local calendar date, `YYYY-MM-DD`. */
  localDate: string;
  type: 'Income' | 'Expense';
  /** Canonical decimal string with 2 decimals (AD-004), e.g. `"1234.56"`. */
  amount: string;
  name: string;
  paymentMethod: 'PIX' | 'DebitCard' | 'BankTransfer' | 'CreditCard';
  categoryKey: 'Uncategorized' | 'Investments';
  identifier: string | null;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
  status: RowStatus;
  reason?: string;
}

export interface ClassifiedRow extends ParsedRow {
  neutral: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
}

/** A bank-specific CSV parser: pure, never throws for a malformed row (it becomes `invalid`). */
export type Parser = (text: string) => ParseResult;

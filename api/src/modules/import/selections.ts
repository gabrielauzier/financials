import { AppError } from '../../plugins/errors.js';
import { UUID } from './preview.js';

export interface Selection {
  index: number;
  neutral: boolean;
  /** Absent means "use the parser's category". */
  categoryId?: string;
}

function invalid(message: string): AppError {
  return new AppError('validation_error', 422, message, 'selections');
}

/**
 * `selections` must be a non-empty JSON array of `{ index: integer >= 0, neutral: boolean, categoryId?: uuid }`,
 * each index once. `categoryId` is omitted or a UUID string; `null`, numbers, objects and `""` are rejected.
 */
export function parseSelections(raw: string): Selection[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid('selections must be a JSON array');
  }
  if (!Array.isArray(value)) throw invalid('selections must be a JSON array');
  if (value.length === 0) throw invalid('Select at least one row to import');
  const seen = new Set<number>();
  return value.map((item: unknown) => {
    const { index, neutral, categoryId } = (item ?? {}) as { index?: unknown; neutral?: unknown; categoryId?: unknown };
    if (typeof item !== 'object' || !Number.isSafeInteger(index) || (index as number) < 0 || typeof neutral !== 'boolean') {
      throw invalid('Each selection must be { index: integer >= 0, neutral: boolean, categoryId?: uuid }');
    }
    if (categoryId !== undefined && (typeof categoryId !== 'string' || !UUID.test(categoryId))) {
      throw invalid(`Row ${String(index)} has a categoryId that is not a uuid`);
    }
    if (seen.has(index as number)) throw invalid(`Row ${String(index)} is selected more than once`);
    seen.add(index as number);
    return { index: index as number, neutral, ...(categoryId === undefined ? {} : { categoryId: categoryId as string }) };
  });
}

/** The distinct category ids the selections name, in lowercase. */
export function categoryIdsOf(selections: Selection[]): string[] {
  return [...new Set(selections.flatMap((s) => (s.categoryId === undefined ? [] : [s.categoryId.toLowerCase()])))];
}

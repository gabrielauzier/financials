import { describe, expect, it } from 'vitest';
import { AppError } from '../../plugins/errors.js';
import { categoryIdsOf, parseSelections } from './selections.js';

const ID = '3f2c9a52-8e1d-4f7b-9c3a-0d5e6b7a8c91';

function failure(raw: string): AppError {
  try {
    parseSelections(raw);
  } catch (error) {
    return error as AppError;
  }
  throw new Error('parseSelections did not throw');
}

const expectValidation = (raw: string) => {
  const error = failure(raw);
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code: 'validation_error', status: 422, field: 'selections' });
};

describe('parseSelections (IMPIMP-01)', () => {
  it('accepts an item without categoryId and keeps the key absent', () => {
    const [item] = parseSelections('[{"index":0,"neutral":false}]');
    expect(item).toEqual({ index: 0, neutral: false });
    expect(item).not.toHaveProperty('categoryId');
  });

  it('accepts a lowercase and an uppercase UUID categoryId', () => {
    expect(parseSelections(`[{"index":0,"neutral":true,"categoryId":"${ID}"}]`)).toEqual([
      { index: 0, neutral: true, categoryId: ID },
    ]);
    expect(parseSelections(`[{"index":1,"neutral":false,"categoryId":"${ID.toUpperCase()}"}]`)).toEqual([
      { index: 1, neutral: false, categoryId: ID.toUpperCase() },
    ]);
  });

  it.each([
    ['null', 'null'],
    ['a number', '5'],
    ['an object', '{"id":"x"}'],
    ['an empty string', '""'],
    ['a non-UUID string', '"not-a-uuid"'],
    ['a UUID with trailing text', `"${ID}x"`],
    ['a boolean', 'true'],
    ['an array', `["${ID}"]`],
  ])('rejects %s as categoryId with 422 validation_error on selections', (_label, categoryId) => {
    expectValidation(`[{"index":0,"neutral":false,"categoryId":${categoryId}}]`);
  });

  it.each([
    ['a non-JSON text', 'nope'],
    ['an object instead of an array', '{"index":0,"neutral":false}'],
    ['an empty array', '[]'],
    ['a repeated index', '[{"index":0,"neutral":false},{"index":0,"neutral":true}]'],
    ['a negative index', '[{"index":-1,"neutral":false}]'],
    ['a fractional index', '[{"index":1.5,"neutral":false}]'],
    ['a string index', '[{"index":"0","neutral":false}]'],
    ['a non-boolean neutral', '[{"index":0,"neutral":"true"}]'],
    ['a missing neutral', '[{"index":0}]'],
    ['a null item', '[null]'],
    ['a non-object item', '[3]'],
  ])('still rejects %s with 422 validation_error on selections', (_label, raw) => {
    expectValidation(raw);
  });
});

describe('categoryIdsOf', () => {
  it('returns the distinct ids in lowercase and skips items without categoryId', () => {
    expect(
      categoryIdsOf([
        { index: 0, neutral: false },
        { index: 1, neutral: false, categoryId: ID.toUpperCase() },
        { index: 2, neutral: false, categoryId: ID },
      ]),
    ).toEqual([ID]);
    expect(categoryIdsOf([{ index: 0, neutral: false }])).toEqual([]);
  });
});

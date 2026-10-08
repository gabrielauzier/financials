import { describe, expect, it } from 'vitest';
import { applyCategoryLabels, resolveCategoryLabel, type UserCategory } from './categoryLabels.js';
import type { ParsedRow } from './types.js';

const seed = (key: string, name: string): UserCategory => ({ id: `id-${key}`, key, name });
const SEEDED: UserCategory[] = [
  seed('Food', 'Alimentação'),
  seed('Bills', 'Contas'),
  seed('Emergency', 'Emergência'),
  seed('Pets', 'Pets'),
  seed('Reversal', 'Estorno (de compras)'),
  seed('Uncategorized', 'Sem categoria'),
  seed('Investments', 'Investimentos'),
];
const mine: UserCategory = { id: 'id-mine', key: null, name: 'Viagens Éxtra' };

describe('resolveCategoryLabel', () => {
  it('step 1: the system key, ignoring case', () => {
    expect(resolveCategoryLabel('Food', SEEDED)?.id).toBe('id-Food');
    expect(resolveCategoryLabel('FOOD', SEEDED)?.id).toBe('id-Food');
    expect(resolveCategoryLabel(' bills ', SEEDED)?.id).toBe('id-Bills');
  });

  it('step 1 wins over a name match', () => {
    const clash: UserCategory = { id: 'id-clash', key: null, name: 'Food' };
    expect(resolveCategoryLabel('Food', [clash, ...SEEDED])?.id).toBe('id-Food');
  });

  it('step 2: the pt-BR name, ignoring accents and case, user-created categories included', () => {
    expect(resolveCategoryLabel('alimentacao', SEEDED)?.id).toBe('id-Food');
    expect(resolveCategoryLabel('ALIMENTAÇÃO', SEEDED)?.id).toBe('id-Food');
    expect(resolveCategoryLabel('Estorno (de compras)', SEEDED)?.id).toBe('id-Reversal');
    expect(resolveCategoryLabel('viagens extra', [...SEEDED, mine])?.id).toBe('id-mine');
  });

  it('step 3: the owner aliases, ignoring emoji, punctuation and case', () => {
    expect(resolveCategoryLabel('Needed', SEEDED)?.id).toBe('id-Emergency');
    expect(resolveCategoryLabel('needed', SEEDED)?.id).toBe('id-Emergency');
    expect(resolveCategoryLabel('Leo 😺', SEEDED)?.id).toBe('id-Pets');
    expect(resolveCategoryLabel('LEO!', SEEDED)?.id).toBe('id-Pets');
    expect(resolveCategoryLabel('😺 Leo', SEEDED)?.id).toBe('id-Pets');
  });

  it('an alias does not match a longer or different word', () => {
    expect(resolveCategoryLabel('Leonardo', SEEDED)).toBeNull();
    expect(resolveCategoryLabel('Needed stuff', SEEDED)).toBeNull();
  });

  it('step 5: no match is null', () => {
    expect(resolveCategoryLabel('Xyzzy', SEEDED)).toBeNull();
    expect(resolveCategoryLabel('😺', SEEDED)).toBeNull();
  });

  it('does not throw when a seeded category was renamed or deleted', () => {
    const renamed = SEEDED.map((c) => (c.key === 'Food' ? { ...c, name: 'Comida' } : c));
    expect(resolveCategoryLabel('Food', renamed)?.name).toBe('Comida');
    expect(resolveCategoryLabel('Comida', renamed)?.id).toBe('id-Food');
    expect(resolveCategoryLabel('Alimentação', renamed)).toBeNull();
    const withoutPets = SEEDED.filter((c) => c.key !== 'Pets');
    expect(resolveCategoryLabel('Pets', withoutPets)).toBeNull();
    expect(resolveCategoryLabel('Leo 😺', withoutPets)).toBeNull();
    const withoutEmergency = SEEDED.filter((c) => c.key !== 'Emergency');
    expect(resolveCategoryLabel('Needed', withoutEmergency)).toBeNull();
  });

  it('an alias uses the system key, so it follows a renamed target', () => {
    const renamed = SEEDED.map((c) => (c.key === 'Pets' ? { ...c, name: 'Bichos' } : c));
    expect(resolveCategoryLabel('Leo 😺', renamed)?.name).toBe('Bichos');
  });
});

function row(patch: Partial<ParsedRow>): ParsedRow {
  return {
    index: 0, localDate: '2025-03-05', type: 'Expense', amount: '10.00', name: 'Loja', description: '',
    paymentMethod: 'PIX', categoryKey: 'Uncategorized', identifier: null, counterpartyDocument: null,
    counterpartyBank: null, status: 'new', categoryLabel: '', ...patch,
  };
}

describe('applyCategoryLabels', () => {
  it('sets the resolved category of a matching label', () => {
    const [out] = applyCategoryLabels([row({ categoryLabel: 'Food' })], SEEDED);
    expect(out).toMatchObject({ status: 'new', resolvedCategory: { id: 'id-Food', name: 'Alimentação' } });
  });

  it('a blank label keeps the default category, with no warning', () => {
    const [out] = applyCategoryLabels([row({ categoryLabel: '  ' })], SEEDED);
    expect(out!.resolvedCategory).toBeUndefined();
    expect(out!.status).toBe('new');
  });

  it('a label with no match keeps the default and becomes unrecognized with the reason', () => {
    const [out] = applyCategoryLabels([row({ categoryLabel: 'Xyzzy' })], SEEDED);
    expect(out).toMatchObject({ status: 'unrecognized', reason: 'Categoria "Xyzzy" não encontrada' });
    expect(out!.resolvedCategory).toBeUndefined();
  });

  it('appends the category reason to a reason the parser already gave', () => {
    const [out] = applyCategoryLabels([row({ categoryLabel: 'Xyzzy', status: 'unrecognized', reason: 'Tipo ausente' })], SEEDED);
    expect(out).toMatchObject({ status: 'unrecognized', reason: 'Tipo ausente; Categoria "Xyzzy" não encontrada' });
  });

  it('leaves ignored, invalid and label-less rows untouched', () => {
    const rows = [
      row({ status: 'ignored', categoryLabel: 'Xyzzy' }),
      row({ status: 'invalid', categoryLabel: 'Food' }),
      row({ categoryLabel: undefined }),
    ];
    expect(applyCategoryLabels(rows, SEEDED)).toEqual(rows);
  });

  it('a neutral row in Reversal is an Income; any other neutral row stays an Expense', () => {
    const [reversal, investments, noLabel] = applyCategoryLabels(
      [
        row({ neutralHint: true, categoryLabel: 'Reversal' }),
        row({ neutralHint: true, categoryLabel: 'Investments' }),
        row({ neutralHint: true, categoryLabel: '' }),
      ],
      SEEDED,
    );
    expect(reversal).toMatchObject({ type: 'Income', resolvedCategory: { id: 'id-Reversal' } });
    expect(investments!.type).toBe('Expense');
    expect(noLabel!.type).toBe('Expense');
  });

  it('a neutral row reaches Reversal by its pt-BR name too', () => {
    const [out] = applyCategoryLabels([row({ neutralHint: true, categoryLabel: 'estorno (de compras)' })], SEEDED);
    expect(out!.type).toBe('Income');
  });

  it('a non-neutral Expense in Reversal stays an Expense', () => {
    const [out] = applyCategoryLabels([row({ categoryLabel: 'Reversal' })], SEEDED);
    expect(out!.type).toBe('Expense');
  });
});

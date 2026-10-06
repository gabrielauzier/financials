# Validation: import-fixes (T1-T8), iteration 1 - PASS

**Verdict**: PASS for the code and tests. One item stays open for the human or the orchestrator: the Verifier could not re-run the browser check (see "Browser Check"). Two low-severity real survivors (C05, C07) become optional fix tasks; none touches a spec acceptance criterion that has a stated outcome.

**Iteration**: 1
**Date**: 2026-10-05
**Spec**: `.specs/features/import-fixes/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md`, `.specs/LESSONS.md`)
**Diff range**: `15de046..HEAD`, 7 commits on `feat/import-fixes`, `HEAD` = `e9f09a6` (`1f2d964` T1, `9bf332d` T3, `9e8545b` T4, `c85f645` T5, `d019556` T6 and T2, `ea8c197` T7, `e9f09a6` T8).
**Verifier**: independent sub-agent (author != verifier). Mutants ran only in temporary git worktrees on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-impfix` and `.verify-impfix-red`, both removed; `git worktree list` shows only the real tree). No `git stash`, no `db:reset`, no hosted Supabase or Vercel, no database write by the Verifier.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1); every Done-when box is ticked (no `- [ ]` left).

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 sanitized fixture | ✅ Done | `1f2d964` | counts re-derived below |
| T2 failing reproduction test | ⚠️ Done with a recorded deviation | `d019556` | not committed red before the fixes: the commit body of T6 records the approved deviation (history kept green). The red state was reproduced independently, see "Red-first proof" |
| T3 `Other` in the transactions API | ✅ Done | `9bf332d` | - |
| T4 mapping table | ✅ Done | `9e8545b` | - |
| T5 parsers use the table | ✅ Done | `c85f645` | - |
| T6 description saved, preview enum | ✅ Done | `d019556` | - |
| T7 web `Other` and labels | ✅ Done | `ea8c197` | - |
| T8 neutral end to end | ✅ Done | `e9f09a6` | cause recorded: no API defect (holder data); web defect in the `update` fallback proven by a red-then-green test |

Cosmetic, not blocking: `tasks.md` still says `**Status**: Draft` and the `spec.md` traceability table still says Pending.

### Red-first proof (IMPFIX-01 AC 5)

Worktree at `9bf332d` (parser still old) with `import-fixes.int.test.ts` taken from `e9f09a6`: 4 of 4 tests red, with `totals new 19 (expected 96)`, `methods {BankTransfer 78, PIX 18}` (expected 61/6/19/4/6), categories `{Sem categoria 96}` (expected 8 estornos), and the neutral and stored-description tests red. The reproduction claim of the commit body is true.

---

## Fixture counts (IMPFIX-01 AC 1), re-derived by script over `api/test/fixtures/nubank_statement_sanitized.csv`

96 data rows, header `Data,Valor,Identificador,Descrição`. Prefix counts: 53 "Compra no débito - ", 6 "via NuPay", 4 "Estorno - Compra no débito", 4 "Estorno - Ajuste de compra no débito", 6 "Pagamento de boleto efetuado", 17 "Transferência enviada pelo Pix", 1 "Transferência recebida pelo Pix", 3 "Transferência Recebida", 1 "Reembolso recebido pelo Pix", 1 "Pagamento de fatura" (sum 96). 13 positive amounts (13 Income). 96 distinct UUID identifiers. 2 descriptions with repeated spaces and 11 with a masked document.

---

## Privacy check (real CSV `references/nubank_extrato_setembro.csv`, untracked)

The real file was tokenised (descriptions, identifiers, amounts) and compared with every added line of `git diff 15de046..HEAD` and with all commit messages of the range. Names are not printed here.

| Check | Count |
| ----- | ----- |
| Real identifiers (96) found in added lines or commit messages | 0 |
| Real `date,amount` pairs found in added lines; pairs shared with the fixture | 0; 0 of 96 |
| Real description words (106): words absent from the whole repository at the base commit | 51 |
| Of those 51, found in added lines or commit messages | 0 |
| Of those 51, found in the fixture | 0 |
| Real words found in the fixture beyond the format vocabulary | 1 (the generic Portuguese word "recebido", already in the repository) |
| Real CSV tracked by git | no (`git ls-files --error-unmatch` fails) |

Result: no leak. One note, not a leak: `api/src/modules/import/parsers/descriptions.ts` comment holds a masked document fragment of the form `•••.NNN.NNN-••` that is already present in tracked files at the base commit (`docs/PRD.md`, `references/exemplo_extrato_nubank.csv`, `api/test/fixtures/nubank_account.csv`), moved from `nubankAccount.ts`; no new exposure.

---

## Spec-Anchored Acceptance Criteria

Test file legend: `P/` = `api/src/modules/import/parsers/`, `A/` = `api/test/`, `W/` = `web/src/`.

### P1: Reprodução com fixture sanitizada (IMPFIX-01)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Fixture of 96 rows, counts per format, no real data | 96 rows, 53/6/8/6/18/3/1/1 | `P/nubankAccount.test.ts:265` `expect(rows).toHaveLength(96)`; `:270` `toEqual({ DebitCard: 61, NuPay: 6, PIX: 19, BankTransfer: 4, Boleto: 6 })`; privacy table above | ✅ PASS |
| 2. Preview: 96 `new`, methods, `Reversal` on 8, type by sign, names | totals `{new: 96, ...}`, 61/6/19/4/6, 8 estornos, 13/83 | `A/import-fixes.int.test.ts:155` `expect.soft(body.totals).toEqual({ new: 96, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 })`; `:156-162` methods; `:163` `{ 'Estorno (de compras)': 8, 'Sem categoria': 88 }`; `:164` `{ Income: 13, Expense: 83 }`; `:167-179` per-row `toMatchObject` of name, method, category, document, bank | ✅ PASS (mutants T01..T18, R02, R06, F01..F03 killed) |
| 3. `neutral: true` exactly on 4 rows, false on 92 | 4 and 92 | `A/import-fixes.int.test.ts:202-207` names equal the 4 expected; `:208` indexes equal `EXPECTED`; `:209` `toHaveLength(92)` | ✅ PASS |
| 4. Confirm stores `payment_method`, `name`, `neutral`, `description` | equal to expected, 96 rows | `A/import-fixes.int.test.ts:235-241` `toMatchObject({ name, payment_method, neutral, description })` per row; `:232` `toHaveLength(96)`; `:242` 4 neutral | ✅ PASS (R01, R05, R07 killed) |
| 5. Test committed before the fixes and red | red on old code | not committed before the fixes (deviation recorded in the T6 commit body); red state reproduced by the Verifier at `9bf332d` (4 of 4 red) | ⚠️ Deviation (documented, effect proven) |

### P1: Método `Other` na API e no front (IMPFIX-02, IMPFIX-03)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. API accepts `Other` on create, edit, read | 201/200 with `Other` | `A/transactions.int.test.ts:170` `expect(created.paymentMethod).toBe('Other')`; `:172` list; `:174` DB row `{ payment_method: 'Other' }`; `:699-705` PATCH `toEqual({ ...original, paymentMethod: 'Other' })` | ✅ PASS (E01 killed) |
| 2. Invalid method: 422 `validation_error` on `paymentMethod`, list includes `Other` | 422, `field: 'paymentMethod'`, message contains `Other` | `A/transactions.int.test.ts:181-184` it.each `other`, `Bitcoin`, `OTHER`: `toBe(422)`, `toMatchObject({ code: 'validation_error', field: 'paymentMethod' })`, `toContain('Other')`; PATCH `:705-710` | ✅ PASS |
| 3. Preview accepts the 8 methods | `NuPay`, `Boleto`, `Other` serialised | `A/import-preview.int.test.ts:127-146` `toEqual([['NuPay','new',...],['Boleto','new',...],['Other','unrecognized',...]])` | ✅ PASS (R02 killed) |
| 4. `openapi.json` lists `Other` (enums and descriptions), regenerated | 8 values everywhere | `A/swagger.int.test.ts:91-122` (`One of: ...Other` on POST and PATCH, enum on 201, list item, PATCH 200) and `:124-137` preview rows enum `toEqual([... 'PIX', 'Other'])`; freshness `committed == exported` | ✅ PASS (E02, E03, E04, E05 killed) |
| 5. Web types and "Outro" label in the extrato, form and preview | `Other: "Outro"` | `W/features/transactions/paymentMethodOther.test.tsx:35` `within(row).getByText("Outro")`, `:37` mobile card, `:46-55` form options end with `"Outro"`, `:75` POST `paymentMethod: "Other"` | ✅ PASS (W01, W09 killed) |
| 6. Preview shows the 8 Portuguese labels | Boleto, NuPay, Outro and 5 old | `W/features/import/ImportPreviewTable.test.tsx:152-181` loop `getByText(label, { selector: "td" })` for the 8 pairs | ✅ PASS (W01, W02, W03, W06 killed) |
| 7. Mock generates `Other` | `Other` among seeded methods | `W/lib/api/mock/transactions.test.ts:86-95` `expect([...seen].sort()).toEqual([... "Other", "PIX"])` and `:96` create | ✅ PASS (W10 killed) |

### P1: Mapeamento de formatos de descrição (IMPFIX-04, IMPFIX-05, IMPFIX-07)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. One table, prefix matched without case or accent | single `FORMATS` table | `P/descriptions.ts` is the only table (nubankAccount no longer has `PIX`/`KNOWN`); `P/descriptions.test.ts:39-45` variants | ✅ PASS |
| 2. "Compra no débito - X" | `DebitCard`, `Uncategorized`, name X, `new` | `P/descriptions.test.ts:10` + `:29` `toEqual(expected)` (whole object) | ✅ PASS (T01, T18, V11 killed) |
| 3. via NuPay | `NuPay`, name X | `P/descriptions.test.ts:11`, `:33` `toMatchObject({ paymentMethod: 'NuPay', name: 'iFood' })` | ✅ PASS (T02 killed) |
| 4. Compra no crédito | `CreditCard` | `P/descriptions.test.ts:12` | ✅ PASS (T03 killed) |
| 5. Estorno débito and ajuste débito | `DebitCard`, `Reversal`, name X, type by sign | `P/descriptions.test.ts:13-14`; type `P/nubankAccount.test.ts:274-279` (`type === 'Income'` on the 8 estornos) | ✅ PASS (T04, T05 killed) |
| 6. Estorno crédito and ajuste crédito | `CreditCard`, `Reversal`, name X | `P/descriptions.test.ts:15-16` | ✅ PASS (T06, T07 killed) |
| 7. Pix recebida/enviada | `PIX`, name, document, bank | `P/descriptions.test.ts:17-18` (document `11.222.333/0001-81`, bank `BCO ALFA (0123)`) | ✅ PASS (T08, T09, V13..V15 killed) |
| 8. Transferência Recebida/Enviada without Pix | `BankTransfer`, name, document, bank | `P/descriptions.test.ts:19-20` | ✅ PASS (T11, T12 killed) |
| 9. Reembolso Pix | `PIX`, `Uncategorized`, name, document, bank | `P/descriptions.test.ts:21` | ✅ PASS (T10, T17 killed) |
| 10. Boleto | `Boleto`, name X, `new` | `P/descriptions.test.ts:22` | ✅ PASS (T13 killed) |
| 11. Pagamento de fatura | `BankTransfer`, `new` | `P/descriptions.test.ts:23` | ✅ PASS (T14 killed) |
| 12. Débito em conta, Dinheiro guardado | `DebitCard`; `BankTransfer` + `Investments` | `P/descriptions.test.ts:24-25` | ✅ PASS (T15, T16 killed) |
| 13. Case and accent variants | same mapping, name keeps case | `P/descriptions.test.ts:39-43` ("COMPRA NO DEBITO - x", "debito em conta"), `:49-51` transfers, `P/nubankAccount.test.ts:345` | ✅ PASS (V02 killed; V01 not an effective mutant, see sensor) |
| 14. Name with repeated spaces collapsed, trimmed, case kept | `'Padaria Estrela Azul'` | `P/descriptions.test.ts:57-58` `toBe('Padaria Estrela Azul')`, `'Vitor Hugo Siqueira'` | ✅ PASS (V03 killed) |
| 15. via NuPay chooses `NuPay` not `DebitCard` | `NuPay` | `P/descriptions.test.ts:32-34`, `:40`; fixture `P/nubankAccount.test.ts:270` (6 NuPay, 61 DebitCard) | ✅ PASS (O02 killed; O03 equivalent, see sensor) |
| 16. Unmapped -> `Other`, `Uncategorized`, name = original text, `unrecognized` | exact object | `P/descriptions.test.ts:81` `toEqual(unmapped('Qualquer coisa'))`, `:89` "Estorno - Pix", `:92-97` transfer without structure | ✅ PASS (V04..V07, V09, V17 killed) |
| 17. Type by sign in every format | 13 Income, 83 Expense | `P/nubankAccount.test.ts:292-294` `toEqual({ Income: 13, Expense: 83 })` | ✅ PASS (P03 killed) |

### P1: `description` gravada pelo import (IMPFIX-06)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Every row gets the original text, spaces collapsed (invoice: `title`) | collapsed text | `P/nubankAccount.test.ts:296-304` `rows.map(description)` `toEqual(lines...)`; invoice `P/nubankInvoice.test.ts:124-133` `description: 'Loja Um - Parcela 3/6'`, `:135-141` every row and the ignored credit | ✅ PASS (P01, P02, P05, P06, X04 killed) |
| 2. > 500 code points: exactly 500, no split surrogate pair | 500 | `P/descriptions.test.ts:128-131` (501 and 600), `:133-140` surrogate; `P/nubankAccount.test.ts:307-313` 600-char line, name untouched | ✅ PASS (X01, X02, X03, X05 killed) |
| 3. Confirm stores `description`, `GET /transactions` returns it | stored text equals row text | `A/import-confirm.int.test.ts:303-322` `storedDescriptions` `toEqual([{ name: 'Padaria Estrela Azul', description: 'Compra no débito - Padaria Estrela Azul', chars: 39 }, ...])` and GET items; `A/import-fixes.int.test.ts:245-267` | ✅ PASS (R01, R07 killed) |
| 4. <= 500 stored whole | whole text, 500 kept | `A/import-confirm.int.test.ts:324-334` `bySize.M` `chars: 500, description: exact`; `P/nubankAccount.test.ts:315-319`; `P/descriptions.test.ts:123-126` | ✅ PASS (boundaries 499/500/501: X01 and X02 killed) |
| 5. `description` does not change `name` nor the neutral rule | name extracted, neutral unchanged | `A/import-confirm.int.test.ts:331-333` `name: 'L'.repeat(600)` beside the cut description; `A/import-fixes.int.test.ts:212-243` | ✅ PASS |

### P1: Deduplicação íntegra com os novos nomes (IMPFIX-08)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Existing identifier -> `duplicate` regardless of stored name | `duplicate` with a different stored name | `A/import-preview.int.test.ts:165-169` `toEqual([['Padaria Estrela Azul', 'duplicate']])` | ✅ PASS (C08 killed) |
| 2. No identifier, same extracted name, day, amount, type -> `duplicate` | `['duplicate']` | `A/import-preview.int.test.ts:171-175` | ✅ PASS |
| 3. No identifier, only the extracted name differs -> `new` | `['new']` | `A/import-preview.int.test.ts:177-181` | ✅ PASS (C06 killed) |
| 4. Preview after confirm: 96 `duplicate` | `{ new: 0, duplicate: 96, ... }` | `A/import-confirm.int.test.ts:336-352` `toEqual({ new: 0, duplicate: 96, ignored: 0, unrecognized: 0, invalid: 0 })` | ✅ PASS |

### P1: Transferências próprias neutras (IMPFIX-09, IMPFIX-10)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Normalized name equals normalized holder (new, unrecognized, duplicate) -> neutral | `neutral: true` | `A/import-classify.int.test.ts:310-325` `toEqual([[0,'new',false],[1,'new',true],[2,'unrecognized',true],[3,'duplicate',true]])` | ⚠️ PASS for rows with an identifier; rows without identifier are not asserted (survivor C05, fix task 1) |
| 2. "MARIA SOUZA LIMA LTDA" vs holder "Maria Souza Lima LTDA" | neutral | `A/import-classify.int.test.ts:291-308` 3 LTDA rows; `A/import-fixes.int.test.ts:202-207` | ✅ PASS (C01 killed) |
| 3. Pix enviada to "Maria Souza Lima" | neutral | same tests, `Maria Souza Lima` in the sorted list | ✅ PASS |
| 4. Name that only starts with the holder name -> not neutral | `neutral: false` | `A/import-classify.int.test.ts:315` row 0 `'Maria Souza Lima Santos'` -> `[0, 'new', false]` | ✅ PASS (C02 killed) |
| 5. Confirm without touching the switch stores `neutral = true` | 4 rows `neutral = true` | `A/import-fixes.int.test.ts:242` `expect(stored.filter((s) => s.neutral)).toHaveLength(4)` and per-row `:238` | ✅ PASS (R03, R04, R05 killed) |
| 6. Preview with `neutral: true` shows the switch on, selected or not | switch checked | `W/features/import/ImportPreviewTable.test.tsx:213-242` `toBeChecked()` before and after select/unselect; `W/features/import/ImportPage.test.tsx:229-234` | ✅ PASS (W08, W11, W15 killed) |
| 7. Selecting or unselecting keeps the switch | still checked | `W/features/import/ImportPreviewTable.test.tsx:224-241` | ✅ PASS (W04, W14 killed) |
| 8. Confirm sends `{ index, neutral: true }` | selections payload | `W/features/import/ImportPage.test.tsx:241-245` `toEqual([{ index: 0, neutral: true }, { index: 1, neutral: true }, { index: 2, neutral: false }])` | ✅ PASS (W12 killed) |
| 9. Switch off sends `neutral: false` | `{ index: 0, neutral: false }` | `W/features/import/ImportPage.test.tsx:258-262` | ✅ PASS (W07 killed) |
| 10. Cause proved in its layer, regression test there | layer-by-layer proof | commit body of `e9f09a6` (data cause for the API; web `update` fallback), tests `W/features/import/ImportPreviewTable.test.tsx:244-253` `toHaveBeenLastCalledWith({ 1: { selected: true, neutral: true } })` | ✅ PASS (W14 killed; the old fallback is restored by that mutant and the test turns red) |

### Edge cases

| Edge case | `file:line` + assertion | Result |
| --------- | ----------------------- | ------ |
| Empty description stays `invalid` "Empty description", no stored description | `P/nubankAccount.test.ts:325-327` `reason: 'Empty description'`, `description ''`; row never imported | ✅ PASS |
| > 500: truncate only `description`, keep `name` | `P/nubankAccount.test.ts:310-313` `row.name` `toBe(store)` | ✅ PASS |
| Tabs and repeated spaces collapsed in `description` | `P/descriptions.test.ts:120` `'  Compra no débito  -\tLoja   Um  '` -> `'Compra no débito - Loja Um'` | ✅ PASS |
| Prefix in caps or without accent ("TRANSFERENCIA RECEBIDA - ...") | `P/descriptions.test.ts:49-51` | ✅ PASS |
| Pix enviada with masked document | `P/descriptions.test.ts:62-66` `counterpartyDocument: '•••.381.754-••'`; fixture `P/nubankAccount.test.ts:281-290` | ✅ PASS (V10 killed) |
| "Compra no débito" without " - X" | `P/descriptions.test.ts:104-110` method kept, name = description, `new` | ✅ PASS (V12 killed) |
| Name of a Compra containing " - " | `P/descriptions.test.ts:113-114` `'Casa - Filial 2 - Centro'` | ✅ PASS (V16 killed) |
| Holder with another case or no accent is neutral | `A/import-classify.int.test.ts:316` `'maria souza lima ltda'` -> neutral true; fixture 3 upper-case LTDA rows | ✅ PASS (C01 killed) |
| Same fixture confirmed twice with the same key: first summary, no rewrite of `description` | `A/import-idempotency.int.test.ts:59-72` (existing rule, `importState` unchanged); not asserted on `description` specifically | ⚠️ Spec-precision gap SPG-1 (low): rule inherited, covered by the existing idempotency test, no `description` check |

---

## Gate Check

| Run | Command | Result |
| --- | ------- | ------ |
| 1 | `pnpm -C api test` | 16 unit files, 322 tests passed; 39 int files, 518 tests passed |
| 2 | `pnpm -C api typecheck` | clean |
| 3 | `pnpm -C api lint` | clean |
| 4 | `yarn --cwd web typecheck` | clean |
| 5 | `yarn --cwd web lint` | 0 errors, 7 warnings (`react-refresh/only-export-components` in `badge`, `button`, `form`, `navigation-menu`, `sidebar`, `toggle`, `useSession`; none in the diff, same 7 as the T8 commit body) |
| 6-8 | `yarn --cwd web test` x3 | 47 files, 359 tests passed in each of the 3 runs (55 s each); no flaky failure |

Test integrity: unit 322 (T1 baseline 266 plus 56 new), integration 518 (T6 commit recorded 516 and T8 added 2), web 359; no test file deleted; one parser test reworded (`nubankAccount.test.ts`) because "Compra no débito - LOJA" is now mapped, and a replacement test asserts the new outcome.

---

## Discrimination Sensor

**Depth**: expanded (data-integrity and mapping paths): 88 distinct mutants (90 runs, C05 and C07 re-run against the full integration suite). Worktree `/Volumes/MacOnlySSD/dev/personal/.verify-impfix` (symlinked `node_modules`), removed; a second worktree at `9bf332d` for the red-first proof, removed. Baseline `git status --porcelain` of the real tree (`?? .DS_Store`, `?? docs/v2/`, `?? references/nubank_extrato_setembro.csv`) is identical at the end.

| Group | IDs | Mutation themes | Result |
| ----- | --- | --------------- | ------ |
| Mapping table rows | T01-T18 | method, category `Reversal`, `Investments` of every row; reembolso and compra category flipped | 18/18 killed |
| Longest-prefix order | O01, O02, O03 | startsWith matching; startsWith plus débito before NuPay; order only | O01, O02 killed; O03 survives (equivalent) |
| Case, accent, spaces, unmapped | V01-V18 | case or accent folding, collapse, unmapped name/status/method/category, exact formats swallowing text, transfer regex (Agência, masked document, " - " in name), name extraction, document, bank | 17 killed; V01 survives (not an effective mutant) |
| 500-char truncation | X01-X05 | 499, 501, UTF-16 slice, no collapse, no cut | 5/5 killed |
| Parsers | P01-P06 | description raw, invalid-row description, sign flipped, status forced, invoice description | 6/6 killed |
| Routes and confirm | R01-R07 | description column, preview enum, preview neutral, confirm neutral ignored or forced, hard-coded method | 7/7 killed |
| Classify | C01-C08 (+C05b, C07b) | case-sensitive holder, prefix holder, duplicate and unrecognized neutral, no-identifier neutral, content dedup, identifier dedup | 6 of 8 killed; C05 and C07 survive (also against the full suite) |
| Enum and OpenAPI | E01-E05 | `Other` removed or reordered, openapi enums and description drifted | 5/5 killed |
| Fixture | F01-F03 | row dropped, a compra turned NuPay, a holder name altered | 3/3 killed |
| Web | W01-W15 | label Outro/NuPay/Boleto, `choiceOf` fallback (neutral, selected), raw method cell, switch handlers, form hides Other, mock without Other, `initialSelection`, payload fallbacks, old `update` fallback | 14 killed; W13 survives (unreachable) |

**Result**: 83/88 distinct mutants killed (83 killed and 7 survived over 90 runs, because C05 and C07 ran twice). Survivors: O03, V01, W13 (provably equivalent or not effective), C05 and C07 (real, low).

| Survivor | Why it survives | Classification |
| -------- | --------------- | -------------- |
| O03 (débito entry placed before NuPay) | the table matches by equality of the normalized prefix segment, never by `startsWith`, so entry order cannot change a result; the order-dependent version (O02: startsWith plus débito first) is killed | equivalent by construction |
| V01 (`replaceAll('à','a')` after normalisation) | the string is already accent-stripped, so the change is a no-op; the real case/accent mutant V02 is killed | not an effective mutant (equivalent) |
| W13 (`?? row.neutral` -> `?? false` in `selectedPayload`) | only rows with `selection[row.index]?.selected` truthy pass the filter, so the fallback is unreachable | equivalent (dead fallback) |
| C05 (rows without identifier never neutral) | no classify or import test gives a row with `identifier: null` a holder name; AC IMPFIX-09-1 says any row | real gap, low: fix task 1 |
| C07 (identifier rows also deduplicated by content) | no test has an identifier row that is new by identifier but equals an existing row by name, day, amount and type; spec assumption says identifier rows use the identifier only | real gap, low: fix task 2 |

---

## Browser Check

**Not executed by the Verifier.** The browser pane held an existing session (`sb-127-auth-token`), but its user no longer exists in the local `auth.users`: `GET /accounts` returned 0 accounts and `POST /accounts` answered 500 `internal_error`, with the local database log showing `accounts_user_id_fkey` violations (no row written; nothing to clean up). Signing in as the `E2E_USER_*` user from `api/.env` by script, and clearing the stale session, were both denied by the permission classifier (credential use), so the Verifier did not retry by other means.

What backs the browser criteria instead (all green in this run): `A/import-fixes.int.test.ts:155` (0 unrecognized, 96 `new`) and `:202-209` (4 neutral) on the real API and local stack; `W/features/import/ImportPage.test.tsx:229-245` (switches on, payload); `W/features/import/ImportPreviewTable.test.tsx:152-181` (labels incl. "Outro"); `W/features/transactions/paymentMethodOther.test.tsx:46-55` (form lists "Outro"). The implementer recorded a browser run in the `e9f09a6` commit body (96 new, 0 unrecognized, 4 Neutra on, "Outro" last in the form); this is an author claim not re-verified here. Open item: a human re-run, or a re-run by the orchestrator with a throwaway user, of "import the sanitized fixture, accounts with the two holders".

---

## Code Quality

| Check | Pass? |
| ----- | ----- |
| No features beyond what was asked | ✅ |
| No abstractions for single-use code (one table, two exported functions) | ✅ |
| Only files required by the tasks touched (30 files, all in the task `Where`/`Reuses`) | ✅ |
| Matches existing style (stringEnum, `PAYMENT_METHODS`, labels map reused instead of a second copy) | ✅ |
| Tests map to ACs and are non-shallow (whole-object `toEqual`, per-row loops over the 96 rows, boundary values) | ✅ |
| Spec-anchored: asserted values equal the spec outcomes (61/6/19/4/6, 13/83, 8 estornos, 4 neutrals, 500) | ✅ |
| Per-layer coverage expectation (unit all branches and edge cases; int happy plus edge plus error paths) | ✅ except C05 and C07 |
| Every new test claimed by an AC or edge case | ✅ |
| Guideline file | none beyond the test configs, strong defaults applied |

---

## Fix Plans (ranked)

| # | Severity | Gap | Fix |
| - | -------- | --- | --- |
| 1 | Low | C05: neutral rule on rows with `identifier: null` is untested (AC IMPFIX-09-1) | in `api/test/import-classify.int.test.ts`, add rows with `identifier: null` and `name: 'maria souza lima'` (status `new`) and a second one equal to an existing content-matched row (status `duplicate`); assert `neutral: true` |
| 2 | Low | C07: an identifier row that equals an existing transaction by name, day, amount and type stays `new` (spec assumption "only by identifier") is untested | in `api/test/import-preview.int.test.ts` seed an identifier-less transaction, preview a row with a fresh identifier and the same content, assert `new` |
| 3 | Open | Browser check not independently re-run | run the browser flow by a human or with a throwaway test user; the stale local session (user missing in `auth.users`) must be replaced first |
| 4 | Info | SPG-1: replay of the same idempotency key is not asserted on `description` | optional: extend `A/import-idempotency.int.test.ts` to read `description` after the replay |
| 5 | Cosmetic | `tasks.md` status Draft; `spec.md` traceability Pending; T2 not committed red before the fixes (documented deviation) | update statuses at the closing commit |

## Spec-Precision Gaps

- SPG-1 (edge case, idempotent replay): the spec says "sem regravar `description`" but gives no observable; the inherited idempotency test checks that nothing is stored again, not `description` itself.
- SPG-2 (IMPFIX-09 AC 1): the rule is stated for "uma linha" without saying whether a row without identifier is in scope for Nubank account files, where every row has one; only the invoice parser emits identifier-less rows and its names are merchants. Clarify which input can produce an identifier-less holder row.

## Isolation Proof

`git status --porcelain` of the real tree is identical to the baseline before and after the sensor and the red-first run; `git worktree list` shows only the real tree; `/Volumes/MacOnlySSD/dev/personal/` holds only `financials`. No stash, no `db:reset`, no hosted service, no database write by the Verifier.

## Requirement Traceability Update (suggested; spec.md not edited by the Verifier)

IMPFIX-01..10: all verified in code and tests; IMPFIX-09 has the C05 sub-gap; the browser success criterion is open (item 3).

## Summary

Gates green (API 322 unit and 518 integration, typecheck, lint; web typecheck, lint with 0 errors, 359 tests three times). All 10 requirements and every edge case have `file:line` evidence. 83 of 88 mutants killed; the 5 survivors are 3 equivalents and 2 real low gaps (C05, C07). No real statement data in any tracked file or commit message of the range. Ready, with the browser re-run as the single open item.

---

## Gaps closed

Closed after the verdict above; the top-line verdict is unchanged (PASS).

- C05 (IMPFIX-09): `api/test/import-classify.int.test.ts` now classifies holder-named rows with `identifier: null` as `new` and as a content-matched `duplicate`, both `neutral: true`. Mutant "neutral only when the identifier is not null" is killed.
- C07 (IMPFIX-08): `api/test/import-preview.int.test.ts` now previews a row with a new identifier and the same name, day, amount and type as an existing transaction and asserts `new`. Mutant "content match also applies to identifier rows" is killed (4 tests fail, including the new one).
- SPG-1: `api/test/import-idempotency.int.test.ts` now reads `description` of the 5 rows before and after a replay with the same key and asserts it unchanged. Mutant "replay rewrites description" is killed.
- Mutants ran in a temporary worktree on the external volume (removed); the real tree was not mutated; no stash, no `db:reset`.
- Statuses: `spec.md` IMPFIX-01..10 are Verified; `tasks.md` is Complete.
- Browser check: the Verifier could not run it (stale session); it is re-covered by the next feature's browser verification.

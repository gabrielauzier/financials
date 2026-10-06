# Validation: import (backend T1-T18 + web T24, T19-T23), iteration 1 - PASS

**Verdict**: PASS

Every spec AC the feature owns has a test that asserts the spec-defined outcome on persisted state, on the exact response or on the rendered screen and request payload. Both build gates are green: api 452 passed (162 unit, 290 integration), web 77 passed, 0 failed, 0 skipped. The feature adds 182 tests (api +69 unit, +71 integration; web +42). Sensor: 45 code mutations, 44 killed, 1 survived (M7, equivalent under the tested contract, not critical); 5 DB-object mutations in one rolled-back transaction, 5 flagged against a control.

The top gap is an edge the spec does not define: a row with an empty description (account) or empty title (invoice) is classified importable and preselected, but confirming it fails with 500 on the `transactions.name` check. The import is rolled back cleanly (atomicity holds), but the user only sees the generic error, and the 500 log carries the Postgres `detail` with that row's values. Not a failing AC; listed as Gap 1.

**Iteration**: 1 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/import/spec.md`
**Diff range**: `72d5424^..HEAD` (`72d5424^` = `e95fb94`). `HEAD` = `d0fe5007a7480b94a566da337a5b41b3dfaa71fa`, branch `feat/import`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Code mutations ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-imp`, now removed and pruned); DB-object mutations ran in one rolled-back psql transaction.

## Scope

In scope: backend T1-T18 (`api/`, `supabase/migrations/0004_imports.sql`) and web T24, T19-T23 (`web/src/features/import/`, `web/src/lib/api/client.ts`, `web/src/routes/importar.tsx`, `web/vitest.config.ts`). No Lovable step this time; the web phase is graded like the backend.

Classification key: (a) covered by tests in this diff; (b) verified by a non-test artifact; (c) deferred to a later feature; GAP = no evidence.

Manual UAT by the orchestrator (context only, not used as evidence): sign-in, `/importar`, account fixture preview with 14 new rows and 6 neutral, confirm "14 transações importadas, 0 ignoradas", DB 14 transactions / 6 neutral / 1 batch / 1 attachment / 1 Storage object, then a second preview "1 nova, 2 duplicadas" with duplicates unselected.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown`, 24 task headings, 0 unchecked boxes. All tasks ticked.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 types | ✅ | `ce6c78d` | - |
| T2 CSV reader | ✅ | `18606b5` | - |
| T3 account core fields | ✅ | `bc6ed39` | Also adds the invoice fixture (T6 scope); harmless |
| T4 Pix extraction | ✅ | `6cfd450` | - |
| T5 non-Pix descriptions | ✅ | `f2ec714` | - |
| T6 invoice parser | ✅ | `6bc0a22` | - |
| T7 format detection | ✅ | `8345af6` | - |
| T8 migration 0004 | ✅ | `6bbfb34` | - |
| T9 dedup by identifier | ✅ | `80fee51` | - |
| T10 dedup by content | ✅ | `6cbe440` | - |
| T11 neutrals | ✅ | `9ee43e3` | - |
| T12 storage helper | ✅ | `e2e00a5` | - |
| T13 preview endpoint | ✅ | `19a43ce` | - |
| T14 confirm endpoint | ✅ | `0be5e0f` | Also config/README/.env.example for `SUPABASE_PUBLISHABLE_KEY` |
| T15 atomic confirm | ✅ | `324fcc9` | - |
| T16 idempotent confirm | ✅ | `d4b29cf` | - |
| T17 re-import and cancel | ✅ | `fd0540c` | - |
| T18 isolation | ✅ | `39db382` | - |
| T24 FormData in client | ✅ | `dd1e419` | - |
| T19 hooks | ✅ | `1cb6623` | - |
| T20 account and file step | ✅ | `dd418a2` | - |
| T21 preview table | ✅ | `cb67e45` | - |
| T22 summary | ✅ | `05d5ac7` | - |
| T23 import page | ✅ | `fec5fac` | Touches `web/src/lib/api/client.test.ts` (outside scope): prettier reflow of a T24 test, no assertion change |
| (docs) | - | `72d5424`, `e64af4e`, `edc1e5f`, `f31d57a` | `edc1e5f` removed the duplicated task block |
| (test config) | - | `d0fe500` | `VITE_MOCK_AREAS: "*"` pin |

One commit per task. Process findings: two docs subjects exceed 72 characters: `72d5424` (76) and `f31d57a` (74). All feature subjects are within 72. The `spec.md` traceability footer still reads "9 total, 0 mapped to tasks" (stale).

---

## Spec-Anchored Acceptance Criteria

Paths: `P` = `api/test/import-preview.int.test.ts`, `C` = `api/test/import-confirm.int.test.ts`, `K` = `api/test/import-classify.int.test.ts`, `F` = `api/test/import-flow.int.test.ts`, `A` = `api/test/import-atomicity.int.test.ts`, `D` = `api/test/import-idempotency.int.test.ts`, `ST` = `api/test/import-storage.int.test.ts`, `IS` = `api/test/imports-isolation.int.test.ts`, `SC` = `api/test/imports-schema.int.test.ts`, `NA` = `api/src/modules/import/parsers/nubankAccount.test.ts`, `NI` = `api/src/modules/import/parsers/nubankInvoice.test.ts`, `FM` = `api/src/modules/import/formats.test.ts`, `CSV` = `api/src/modules/import/csv.test.ts`, web `W/` = `web/src/features/import/`.

### P1: Importar extrato Nubank (conta)

| # | Criterion | Spec-defined outcome | Class | Evidence (`file:line` - assertion) | Status |
| - | --------- | -------------------- | ----- | ---------------------------------- | ------ |
| 1 | Account header on active Nubank account yields a preview | preview with the rows read | a | `api/test/import-preview.int.test.ts:80` `toBe(200)`; `:82` `toHaveLength(14)`; `:84` totals `{ new: 14, ... }` | ✅ |
| 2 | Unknown header rejected, no preview | rejection with error | a | `api/test/import-preview.int.test.ts:167-168` `422` + `code: 'unsupported_format'`; `api/src/modules/import/formats.test.ts:85`. Web message: `web/src/features/import/ImportStartStep.test.tsx:89` "Formato de arquivo não reconhecido" | ✅ |
| 3 | File over 5 MB rejected with size message | 413 `file_too_large` | a | `api/test/import-preview.int.test.ts:153-154` `toEqual({ error: { code: 'file_too_large', ..., field: 'file' } })`; exactly 5 MiB accepted `:161-162`. Web: `web/src/features/import/ImportStartStep.test.tsx:48` "Arquivo excede 5 MB", `:56-57` 5 MiB accepted | ✅ (unit, see SP-1) |
| 4 | Nubank file on another bank's account rejected | 422 `bank_mismatch` | a | `api/test/import-preview.int.test.ts:174-175`; `api/src/modules/import/formats.test.ts:43` (4 banks x 2 formats). Web `ImportStartStep.test.tsx:96`, `ImportPage.test.tsx:183` | ✅ |
| 5 | `dd/mm/aaaa` to local midnight | midnight of that day in user's zone | a | Parse: `api/src/modules/import/parsers/nubankAccount.test.ts:24` `localDate: '2026-07-02'`; impossible dates `:72-78`. Storage: `api/test/import-confirm.int.test.ts:208-210` Sao Paulo `03:00Z`, New York `04:00Z`, Tokyo `2026-07-01T15:00Z` | ✅ |
| 6 | Negative = Expense with absolute value; positive = Income | type + abs amount | a | `nubankAccount.test.ts:41` Income indexes `[2, 6]`, `:42` 12 Expense; `:53-56` `amount: '82.32'`, `'7.50'`; persisted `api/test/import-confirm.int.test.ts:128`, `:136` | ✅ |
| 7 | Pix description: name, document, bank, PIX | the four fields | a | `nubankAccount.test.ts:122-131` MERCADO AUTO row `toMatchObject`; `:138-139` masked document and `NU PAGAMENTOS - IP (0260)`; `api/test/import-preview.int.test.ts:87-99` full row `toEqual`; persisted `api/test/import-confirm.int.test.ts:135-139` | ✅ |
| 8 | "Débito em conta" | name = description, DebitCard, Sem categoria | a | `nubankAccount.test.ts:178-183`; `api/test/import-preview.int.test.ts:100-103` `categoryName: 'Sem categoria'`; persisted `api/test/import-confirm.int.test.ts:127-130` | ✅ |
| 9 | "Pagamento de fatura" | Expense, BankTransfer, Sem categoria | a | `nubankAccount.test.ts:187-193` | ✅ |
| 10 | "Dinheiro guardado com resgate planejado" | BankTransfer, Investimentos | a | `nubankAccount.test.ts:197-202`; `api/test/import-preview.int.test.ts:104-106` `categoryName: 'Investimentos'`; persisted `api/test/import-confirm.int.test.ts:131-134` `category_key: 'Investments'` | ✅ |
| 11 | Unknown description | name = description, BankTransfer, Sem categoria, flagged "não reconhecida" | a | `nubankAccount.test.ts:216-225`; flag in preview `web/src/features/import/ImportPreviewTable.test.tsx:134-139` "Revise esta linha", `data-status="unrecognized"`, preselected | ✅ (see Gap 1 for empty description) |
| 12 | Repeated spaces collapsed in the extracted name | one space | a | `nubankAccount.test.ts:123` (sample has a double space); `:149` no double space in any Pix name. Killed M25 | ✅ |
| 13 | Identificador used as `identifier` | identifier = column | a | `nubankAccount.test.ts:27`, `:34`, `:46` 14 distinct; persisted `api/test/import-confirm.int.test.ts:126-127` lookup by identifier | ✅ |

### P1: Importar fatura Nubank (cartão)

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Invoice header yields a preview | preview with rows | a | `api/test/import-preview.int.test.ts:129-132` `200`, 19 rows, totals `{ new: 18, ..., ignored: 1 }` | ✅ |
| 2 | `aaaa-mm-dd` to local midnight | midnight in user's zone | a | `nubankInvoice.test.ts:32` `localDate: '2026-10-03'`; `:86-89` invalid dates; DST-gap midnight `api/test/import-confirm.int.test.ts:216-218` (invoice row, Santiago, `04:00Z`) | ✅ |
| 3 | `1.335,61` read as 1335,61 | `"1335.61"` | a | `nubankInvoice.test.ts:42`, `:62`, `:72` `'1234567.89'` | ✅ |
| 4 | Positive amount: Expense, CreditCard, name = title, Sem categoria | those fields | a | `nubankInvoice.test.ts:20`, `:27-29`; `api/test/import-preview.int.test.ts:134-136` | ✅ |
| 5 | Negative amount ignored, not imported | status `ignored`, never imported | a | `nubankInvoice.test.ts:21-23` index 11 "Pagamento recebido"; `:60-67`; selecting it `api/test/import-confirm.int.test.ts:222`, `:228-230` `422 invalid_selection`, nothing written; web no checkbox `web/src/features/import/ImportPreviewTable.test.tsx:107` | ✅ |
| 6 | "Parcela 3/6" preserved | full title | a | `nubankInvoice.test.ts:36-37` `amount: '343.72'` | ✅ |
| 7 | identifier empty; dedup by name, date, amount, type on the same account | null identifier; content dedup | a | `nubankInvoice.test.ts:47`; `api/test/import-classify.int.test.ts:163`, `:183`, `:193-195`, `:203`, `:213`; re-import `api/test/import-flow.int.test.ts:125` | ✅ |
| 8 | CreditCard outside income/expense/net-worth totals | rules in `dashboards` | c | `dashboards` feature (AD-003) | deferred |

### P1: Prévia e deduplicação

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Preview always shown before anything is written | preview writes nothing; confirm only after preview | a | `api/test/import-preview.int.test.ts:242` state unchanged after two previews; web `web/src/features/import/ImportPage.test.tsx:105` no confirm call before the preview step. Killed M1 | ✅ |
| 2 | Each row classified new / duplicate / ignored / unrecognized | status per row | a | `api/test/import-preview.int.test.ts:84`, `:124`, `:132`, `:147` (5th status `invalid`); badges `web/src/features/import/ImportPreviewTable.test.tsx:66-69` | ✅ (SP-2) |
| 3 | Existing identifier on the same account -> duplicate | `duplicate` | a | `api/test/import-classify.int.test.ts:94`; other account stays new `:108`; end to end `api/test/import-preview.int.test.ts:123`. Killed M10 | ✅ |
| 4 | No identifier + same name, date, amount, type -> duplicate | `duplicate` | a | `api/test/import-classify.int.test.ts:163`; each field differing `:183`; local day per zone `:193-195`. Killed M11-M13 | ✅ (SP-3) |
| 5 | Duplicate shown unselected | checkbox unchecked | a | `web/src/features/import/ImportPreviewTable.test.tsx:90`; default payload `api/test/import-flow.int.test.ts:107`. Killed W1 | ✅ |
| 6 | Toggling a duplicate includes/excludes it | payload follows | a | `web/src/features/import/ImportPreviewTable.test.tsx:94-101`; server imports a re-selected duplicate `api/test/import-confirm.int.test.ts:153-154`. Killed M21, W6 | ✅ |
| 7 | Confirm writes only selected rows | only those rows | a | `api/test/import-confirm.int.test.ts:121` `{ imported: 3, skipped: 11 }`, `:124` 3 rows; web payload `web/src/features/import/ImportPage.test.tsx:117-119` `[{ index: 0, neutral: true }]` | ✅ |
| 8 | Summary with imported and skipped counts | both counts | a | `api/test/import-confirm.int.test.ts:177`; `web/src/features/import/ImportSummary.test.tsx:26` "12 transações importadas, 3 ignoradas"; `ImportPage.test.tsx:109-111` | ✅ (SP-4) |
| 9 | Any write failure reverts everything, no transaction nor attachment | nothing persisted | a | `api/test/import-atomicity.int.test.ts:103-105` `500` and state `NOTHING` (file removed too); upload failure `:112-114` `502 storage_error`, `NOTHING`. Killed M6, M27 | ✅ |
| 10 | Cancel writes no transaction, batch, attachment | nothing | a | `api/test/import-flow.int.test.ts:137`; web `web/src/features/import/ImportPage.test.tsx:128` 0 confirm calls. Killed W3 | ✅ |
| 11 | Repeated confirmation writes only once | single batch | a | `api/test/import-idempotency.int.test.ts:70-72` `200`, same summary, state `ONE_IMPORT`; 5 concurrent `:80-84`; web same key on retry `web/src/features/import/ImportPage.test.tsx:152`, new key per preview `:171`. Killed M8, M9, W4, W5; M7 survived (equivalent, see sensor) | ✅ |
| 12 | Re-import classifies every importable row duplicate | all `duplicate` | a | `api/test/import-flow.int.test.ts:102-104` 14/14; invoice `:125` 18 + 1 ignored | ✅ |

### P1: Neutras automáticas

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Normalized name equals a holder of any account -> neutral | neutral in preview | a | `api/test/import-classify.int.test.ts:229` `[3, 4, 5, 8, 12, 13]`; inactive account `:260`; API `api/test/import-preview.int.test.ts:85`. Killed M15 | ✅ |
| 2 | Normalization ignores case, accents, repeated spaces | match | a | `api/test/import-classify.int.test.ts:248` `[[0,true],[1,true],[2,true],[3,false],[4,false]]`. Killed M14 | ✅ |
| 3 | User changes neutral in preview -> stored value | chosen value persisted | a | `api/test/import-confirm.int.test.ts:165-167` both directions; web `web/src/features/import/ImportPreviewTable.test.tsx:124-129`. Killed M3, W11 | ✅ |
| 4 | No holder match -> not neutral | `neutral: false` | a | `api/test/import-classify.int.test.ts:232-233`, `:280` | ✅ |
| 5 | No value/date heuristic | mirrored transfer not neutral | a | `api/test/import-classify.int.test.ts:268`, `:280` `[0, 'new', false]` | ✅ |

### P1: Anexo do arquivo original

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Original file stored and registered in `attachments` linked to the batch | identical bytes, one attachment row | a | `api/test/import-confirm.int.test.ts:188-191` attachment `toEqual`; `:194-195` downloaded bytes `equals(content)` | ✅ |
| 2 | Batch records account, bank, row count, imported, skipped | those columns | a | `api/test/import-confirm.int.test.ts:182-184` `{ account_id, bank: 'Nubank', idempotency_key, row_count: 19, imported_count: 4, skipped_count: 15 }` | ✅ |
| 3 | Each imported transaction linked by `import_batch_id` | FK set | a | `api/test/import-confirm.int.test.ts:125`, `:196`; FK enforced `api/test/imports-schema.int.test.ts:121`, `:125` | ✅ |
| 4 | Isolation by `user_id` and RLS on attachment and stored file | other user sees nothing | a | `api/test/imports-schema.int.test.ts:85-104`; Storage `:197-198`, `:212-218`, `:227-237`; `api/test/imports-isolation.int.test.ts:109`, `:126-133`; `api/test/import-storage.int.test.ts:81-86` | ✅ |

**Count**: 42 ACs. a = 41, b = 0, c = 1 (Fatura-8, `dashboards`), GAP = 0.

---

## Edge Cases

- [x] Empty or header-only file rejected with "no rows" message: `api/src/modules/import/csv.test.ts:57-71`; `api/test/import-preview.int.test.ts:183-184` `422 empty_file`; web message `web/src/features/import/useImport.test.tsx:101` "O arquivo não tem linhas".
- [x] Invalid date or non-numeric value -> `invalid`, out of the selection: `nubankAccount.test.ts:71-87`, `nubankInvoice.test.ts:75-90`; `api/test/import-preview.int.test.ts:145-147`; selecting it `api/test/import-confirm.int.test.ts:223` 422; web no checkbox and never in payload `web/src/features/import/ImportPreviewTable.test.tsx:107-112`. Killed M2, W2, W2b.
- [x] Two rows with the same `identifier` -> second is duplicate: `api/test/import-classify.int.test.ts:122` `[2, 'duplicate'], [3, 'duplicate']`. Killed M16.
- [x] Attachment storage failure reverts and reports: `api/test/import-atomicity.int.test.ts:112-114`; web keeps the preview and shows "Nada foi importado. Tente novamente." `web/src/features/import/ImportPage.test.tsx:145-146`.

Design rules checked:

- [x] Unrecognized + duplicate becomes `duplicate` and keeps `reason`: `api/test/import-classify.int.test.ts:94-96`. Killed M17.
- [x] No intra-file dedup without identifier on a first import: `api/test/import-classify.int.test.ts:203`.
- [x] `ignored`/`invalid` rows never count as a first identifier occurrence: `api/test/import-classify.int.test.ts:136-141`.
- [x] Selections validation (malformed, non-array, empty, non-integer, string, negative, non-boolean, missing, repeated): `api/test/import-confirm.int.test.ts:233-249`; unknown index `:224`. Killed M26.
- [x] DST gap midnight via Luxon `startOf('day')`: `api/test/import-confirm.int.test.ts:218`. Killed M5.
- [x] Unsafe filenames stay in `{userId}/{batchId}/`: `api/src/modules/import/storage.test.ts:9-36`; real Storage `api/test/import-storage.int.test.ts:93-104`. Killed M19, M20.
- [x] Every import route answers 401 without a valid token: `api/test/imports-isolation.int.test.ts:143-146`.
- [x] Another user's idempotency key never returns their summary: `api/test/imports-isolation.int.test.ts:98-100`.
- [x] Real samples: fixtures are byte-identical to `references/*.csv` (`diff` clean). 14 account rows, 6 neutral at 3,4,5,8,12,13; 18 invoice purchases + 1 ignored.
- [x] No float money arithmetic: `git grep -nE "parseFloat|Number\(|\* ?100|toFixed|parseInt" -- api/src web/src/features/import web/src/lib/format.ts` finds only date components (`parsers/common.ts:14`), `config.ts:52` port and the transactions page number. Amounts are built from digit strings (`parsers/common.ts:25-33`) and passed as `::numeric[]`.

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`, from the real tree at `d0fe500`.
- **api**: typecheck 0 errors, lint 0 problems. Unit 162 passed (11 files), integration 290 passed (26 files). Total 452, 0 failed.
- **web**: typecheck 0 errors; lint 0 errors, 7 warnings (all `react-refresh/only-export-components` in pre-existing `components/ui/*` and `features/auth/useSession.tsx`, none in this diff). 77 passed (16 files), 0 failed.
- **Test count before feature** (`e95fb94`, measured in the scratch worktree): api 93 unit + 219 integration, web 35.
- **Delta**: api +69 unit, +71 integration; web +42. No test deleted.
- **Skipped**: 0. `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api web/src` (excluding `process.exit(`) finds nothing.
- **Mock pin**: `VITE_MOCK_AREAS=none yarn --cwd web test` and `VITE_MOCK_AREAS= yarn --cwd web test` both 77 passed on the real tree. Control in scratch: with the `env` line removed, `VITE_MOCK_AREAS=none` gives 7 failed / 70 passed (accounts, categories, transactions tests). The pin is load-bearing.
- **Local data**: the orchestrator's UAT data (1 user, 14 transactions, 1 batch, 1 attachment, 1 object) coexisted with the suite. No test needed a clean DB; the DB snapshot was identical before and after the gate.

---

## Discrimination Sensor

Depth: P0 (data integrity, authorization, file handling). Each mutation is a single exact replacement in the scratch worktree, run against the covering test files, then reverted with `git checkout` and checked clean.

| # | File | Mutation | Result | Killing test |
| - | ---- | -------- | ------ | ------------ |
| M1 | `routes.ts` preview | Preview inserts an `import_batches` row | ✅ Killed | `import-preview.int.test.ts` "writes nothing"; `import-flow.int.test.ts` cancel, re-import |
| M2 | `routes.ts` `selectedRows` | Selectable check dropped (ignored/invalid accepted) | ✅ Killed | `import-confirm.int.test.ts:222-223` |
| M3 | `routes.ts` `selectedRows` | Neutral override ignored | ✅ Killed | `import-confirm.int.test.ts:165` |
| M4 | `routes.ts` `insertBatch` | `occurred_at` in UTC instead of `request.tz` | ✅ Killed | `import-confirm.int.test.ts:208`, `:218` |
| M5 | `routes.ts` `localMidnight` | Noon offset instead of `startOf('day')` | ✅ Killed | `import-confirm.int.test.ts:218` (DST gap) |
| M6 | `routes.ts` catch | Compensation removal of the file disabled | ✅ Killed | `import-atomicity.int.test.ts:105`; `import-idempotency.int.test.ts:84` |
| M7 | `routes.ts` | Idempotency pre-check disabled (race handler kept) | ❌ Survived (equivalent) | - |
| M8 | `routes.ts` | Unique-violation race handling disabled | ✅ Killed | `import-idempotency.int.test.ts:80` |
| M9 | `routes.ts` | Both idempotency paths disabled | ✅ Killed | `import-idempotency.int.test.ts:70`, `:80` |
| M10 | `classify.ts` | Identifier dedup not scoped to the account | ✅ Killed | `import-classify.int.test.ts:108` |
| M11 | `classify.ts` | Content dedup ignores type | ✅ Killed | `import-classify.int.test.ts:183` |
| M12 | `classify.ts` | Content dedup ignores amount | ✅ Killed | `import-classify.int.test.ts:183` |
| M13 | `classify.ts` | Local day computed in UTC | ✅ Killed | `import-classify.int.test.ts:193-195` |
| M14 | `classify.ts` | Neutral comparison without `normalizeName` | ✅ Killed | `import-classify.int.test.ts:248` |
| M15 | `classify.ts` | Neutral ignores inactive accounts | ✅ Killed | `import-classify.int.test.ts:260` |
| M16 | `classify.ts` | Second identifier in file not duplicate | ✅ Killed | `import-classify.int.test.ts:122` |
| M17 | `classify.ts` | `unrecognized` wins over `duplicate` | ✅ Killed | `import-classify.int.test.ts:94`, `:122` |
| M18 | `routes.ts` | Limit `5 MiB - 1` (exact 5 MiB rejected) | ✅ Killed | `import-preview.int.test.ts:161` |
| M18b | `routes.ts` | Limit `5 MiB + 1` (5 MiB + 1 accepted) | ✅ Killed | `import-preview.int.test.ts:153` |
| M19 | `storage.ts` | Filename not sanitized | ✅ Killed | `import-storage.int.test.ts:93-99` |
| M20 | `storage.ts` | Path not under the user folder | ✅ Killed | 11 tests in `import-confirm.int.test.ts`, `import-storage.int.test.ts` |
| M21 | `routes.ts` | Selected duplicates silently skipped | ✅ Killed | `import-confirm.int.test.ts:149`, `:153` |
| M22 | `routes.ts` `analyze` | Inactive account accepted | ✅ Killed | `import-preview.int.test.ts:192`; `import-confirm.int.test.ts:273` |
| M23 | `formats.ts` | Bank check disabled | ✅ Killed | `formats.test.ts:43`, `:78` |
| M24 | `nubankInvoice.ts` | Negative invoice amount imported as new | ✅ Killed | `nubankInvoice.test.ts:22`, `:60`, `:67` |
| M25 | `nubankAccount.ts` | Pix name keeps repeated spaces | ✅ Killed | `nubankAccount.test.ts:122`, `:149` |
| M26 | `routes.ts` `parseSelections` | Repeated index accepted | ✅ Killed | `import-confirm.int.test.ts:242` |
| M27 | `routes.ts` | Upload failure swallowed, insert proceeds | ✅ Killed | `import-atomicity.int.test.ts:112` |
| M28 | `nubankAccount.ts` | Sign to type swapped | ✅ Killed | 8 tests in `nubankAccount.test.ts` |
| W1 | `previewSelection.ts` | Duplicates start selected | ✅ Killed | `ImportPreviewTable.test.tsx:90` (+5) |
| W2 | `ImportPreviewTable.tsx` | Ignored/invalid rows get a checkbox | ✅ Killed | `ImportPreviewTable.test.tsx:107` |
| W2b | `previewSelection.ts` | Ignored/invalid rows enter the payload | ✅ Killed | `ImportPreviewTable.test.tsx:112`; `ImportPage.test.tsx:117` |
| W3 | `ImportPage.tsx` | Cancel calls confirm | ✅ Killed | `ImportPage.test.tsx:128` |
| W4 | `ImportPage.tsx` | New key on every confirm/retry | ✅ Killed | `ImportPage.test.tsx:152` |
| W5 | `ImportPage.tsx` | Key not renewed on a new preview | ✅ Killed | `ImportPage.test.tsx:171` |
| W6 | `previewSelection.ts` | Payload sends unselected rows | ✅ Killed | `ImportPreviewTable.test.tsx:99`; `ImportPage.test.tsx:117` |
| W7 | `client.ts` | `Content-Type: application/json` forced on FormData | ✅ Killed | `web/src/lib/api/client.test.ts:68` |
| W8 | `client.ts` | FormData passed through `JSON.stringify` | ✅ Killed | `web/src/lib/api/client.test.ts:66` |
| W9 | `errorMessages.ts` | English API message displayed | ✅ Killed | 14 tests (`useImport.test.tsx:111`, `ImportSummary.test.tsx:40`, ...) |
| W10 | `labels.ts` | Date formatted via `new Date` | ✅ Killed | `ImportPreviewTable.test.tsx:76` |
| W11 | `previewSelection.ts` | Neutral toggle ignored in payload | ✅ Killed | `ImportPreviewTable.test.tsx:124`; `ImportPage.test.tsx:117` |
| W12 | `fileRules.ts` | Client limit `>=` (5 MiB blocked) | ✅ Killed | `ImportStartStep.test.tsx:56` |
| W13 | `client.ts` | 401 sign-out skipped for FormData | ✅ Killed | `web/src/lib/api/client.test.ts:93` |
| W14 | `routes/importar.tsx` | Page outside `RequireAuth` | ✅ Killed | `importRoute.test.tsx:26` |
| W15 | `ImportPage.tsx` | Confirm enabled with 0 selected | ✅ Killed | `ImportPage.test.tsx:137` |

**M7 (survived, equivalent)**: without the pre-check, a repeated confirm uploads, hits `import_batches_user_id_idempotency_key_key`, removes the file and answers the first summary through the race handler. Observable result, DB and Storage state are the same, so the tests cannot tell. The pre-check saves a re-parse and an upload, and it is what makes "the key alone wins" (probe below). Not a critical behavior; a test that repeats a key with a different file or selection would pin it (Gap 2).

DB-object mutations, one `begin ... rollback` with two synthetic users, control first:

| # | Mutation | Control (real schema) | Mutant | Asserted by |
| - | -------- | --------------------- | ------ | ----------- |
| S1 | RLS off on `import_batches` | B sees 0 of A's batches | B sees 1 | `imports-schema.int.test.ts:85` |
| S2 | RLS off on `attachments` | B sees 0 | B sees all | `imports-schema.int.test.ts:86` |
| S3 | Drop `unique (user_id, idempotency_key)` | duplicate key rejected | accepted | `imports-schema.int.test.ts:72` |
| S4 | Drop `transactions_import_batch_fkey` | B's tx on A's batch rejected | accepted | `imports-schema.int.test.ts:121` |
| S5 | Storage policy without the folder check | B's insert into A's folder rejected by RLS | accepted | `imports-schema.int.test.ts:196-198` |

**Result**: 45 code mutations, 44 killed, 1 equivalent survivor; 5/5 DB mutations flagged. PASS.

### Probes (scratch worktree, temporary test file, removed)

1. Account row with empty description: preview `200`, row `[0, "unrecognized", ""]`, preselected by the web.
2. Confirming it: `500 internal_error`, state `{transactions: 0, batches: 0, attachments: 0, objects: 0}` (rollback and compensation work).
3. Invoice row with empty title: preview `[0, "new", ""]`, same 500 on confirm.
4. Same `idempotencyKey`, different account, garbage file and out-of-range selection: `200` with the first summary byte for byte. RLS scopes the lookup to the caller.
5. Unknown 1 MiB multipart field `junk`: preview `200` (accepted and buffered).

---

## Isolation Proof

- Real tree `git status --porcelain`: empty before the run; after cleanup only this report is new. HEAD unchanged `d0fe500`.
- `git worktree list`: only the main tree. `/Volumes/MacOnlySSD/dev/personal/.verify-imp` removed (`git worktree remove --force` + `prune`). No `git stash` used (`git stash list` empty).
- DB snapshot identical before and after (gates, sensor, probes): migrations `0001,0002,0003,0004`; public tables `accounts, attachments, categories, import_batches, profiles, transactions`; policies `accounts_all`, `attachments_all`, `categories_*` (4), `import_batches_all`, `transactions_all`, `storage.objects.imports_own_folder`; bucket `imports:false`; 0 `test_*` triggers, functions or policies; 8 user triggers.
- Storage bucket `imports`: 1 object, the UAT file `{uid}/2d0f2426-.../extrato_nubank.csv`. Data: 1 user, 14 transactions, 1 batch, 1 attachment (UAT).
- Processes: no vitest or worktree process left. I started no servers; listeners on 3001/8080 (orchestrator) and the `web` stack (54321-54327) untouched.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ `routes.ts` is 439 lines (design planned `service.ts` + `routes.ts`); cohesive, no dead code |
| Surgical changes | ✅ `client.ts` +3/-2; T23's edit to `client.test.ts` is a formatter reflow only |
| No scope creep | ✅ `storage_not_configured` 503 and `SUPABASE_PUBLISHABLE_KEY` are required for Storage with the user token |
| Matches patterns | ✅ `withUser`, `AppError`, test helpers as in earlier features |
| Single-use abstractions | ⚠️ minor: `PARSERS`/`HEADERS`/`BANK_OF` maps and `Bank = string` for two formats; the design asks for a per-bank `Parser` interface, so accepted |
| Spec-anchored outcomes | ✅ |
| Per-layer coverage | ✅ parsers 1:1 to ACs; both routes happy + edge + error; web per AC |
| Every test maps to a requirement | ✅ see reverse mapping |
| Guidelines | none in repo; strong defaults + `coding-principles.md` |

**Check B (shallow assertions)**: none found. Status-only checks are always paired with the error `code` and a state assertion (`importState`). The 413 test asserts the full error body; the content-dedup test asserts every `[index, status]` pair.

**Check C (reverse mapping)**: every new test maps to an AC, an edge case, a Done-when or a design risk. Tests beyond the ACs, all claimed by design or Done-when: CSV CRLF/BOM/quotes/blank lines (T2), unterminated quote (design "untrusted input"), Storage `apikey` finding (`import-storage.int.test.ts:128`, records local gateway behavior per L-002), user deletion leaving the Storage object (design risk), 503 `storage_not_configured` (T14 config), "Importar outro arquivo" and "Gerar prévia" disabled (lovable.md steps). No orphans.

---

## Security and Privacy Review

- **Auth**: global `onRequest` hook requires a bearer JWT on every non-public route (`api/src/plugins/auth.ts:86-92`), before the handler reads the multipart body. Every DB access in both handlers runs in `request.withUser` (RLS on). 401 proven `imports-isolation.int.test.ts:143`.
- **Storage**: the user's own token goes only to `options.supabaseUrl` from config (`storage.ts:43-49`); the bucket is private with a per-folder policy; path `{jwt.sub}/{randomUUID}/{safeFilename}` with per-segment `encodeURIComponent`. Errors never echo the URL, token or key (`import-storage.int.test.ts:119-122`).
- **apikey**: the local gateway accepts a wrong `apikey` when the bearer is a valid user JWT (`import-storage.int.test.ts:128-138`). The security boundary is the JWT + RLS, not the publishable key. Hosted-Supabase behavior is not verified here; confirm at deploy.
- **Idempotency by key alone**: the lookup is RLS-scoped (`existingSummary` under `withUser`); another user's key yields a separate batch (`imports-isolation.int.test.ts:98-100`). No cross-user leak. Within one user, the key alone wins over file and account (probe 4); the web renews the key per preview, so this is safe for the shipped client.
- **Multipart limits**: file 5 MiB inclusive, 1 file, 10 fields, 11 parts, `fieldSize` 8 MiB. Unknown field names are accepted (probe 5). Worst case about 85 MiB buffered per authenticated request (10 x 8 MiB + 5 MiB), plus the parsed CSV. Recommend: reject unknown field names on arrival, `fields: 3`, `fieldSize` about 2 MiB, and a per-user concurrency limit before production.
- **Logging**: success paths log nothing beyond Fastify's request line (`server.ts` redacts `authorization`). AppErrors (4xx, 502) are not logged. CSV content is never logged. Two leaks of personal data into logs: (1) the 500 handler logs the raw `PostgresError`, whose `detail` for a check violation is "Failing row contains (...)" with name, document and bank of the row (reachable via Gap 1); (2) the compensation-failure log includes `storagePath`, which carries the sanitized original filename.
- **Orphans**: Storage objects outlive a failed compensation (logged) and a deleted user (`imports-schema.int.test.ts:263`). Documented in `design.md`; cleanup out of MVP.
- **Race**: classification and insert run in two separate transactions and `transactions` has no unique `(account_id, identifier)`. Two confirms of the same file with different keys at the same time can both import the same rows. Low likelihood for one user; note for later.
- `attachments.filename` stores the raw client filename (length bounded only by busboy's header limit). React escapes it; consider storing the sanitized name or capping length.

---

## Ranked Gaps (none blocking)

1. **Empty description or title is importable but cannot be saved** - IMP-01.11 / IMP-04.4 edge, no evidence - `api/src/modules/import/parsers/nubankAccount.ts:95-104`, `nubankInvoice.ts:51-63`. The row is `unrecognized`/`new` with `name: ""`, preselected, and confirm answers 500 (`transactions.name` check). Rollback is correct, but the whole import fails with a generic message and the log carries the row values. Fix: classify a blank name as `invalid` with a reason in both parsers; add a parser test and a preview test.
2. **Idempotency pre-check not pinned (M7 equivalent survivor)** - IMP-05.11 - `api/src/modules/import/routes.ts:392-393`. Add a test that repeats a key with a different selection or file and expects the stored summary, or state in the spec that the key alone decides.
3. **Multipart memory and unknown fields** - design risk "arquivo de entrada não confiável" - `routes.ts:345`. Reject unknown fields, lower `fields`/`fieldSize` (see security notes).
4. **Personal data in error logs** - `api/src/plugins/errors.ts:50`, `routes.ts:427`. Serialize Postgres errors without `detail`/`parameters`, and log the batch id instead of the path.
5. **Process records** - commit subjects over 72 characters: `72d5424` (76), `f31d57a` (74). `spec.md` traceability footer stale ("0 mapped") and statuses still "Implementing".

## Spec-Precision Gaps

- **SP-1** "5 MB": implemented as 5 MiB (5,242,880 bytes) inclusive on both sides. The spec does not say MB vs MiB or inclusive.
- **SP-2** IMP-05.2 lists four statuses; the code and the assumptions table (commit `e64af4e`) add `invalid`. The AC text was not updated.
- **SP-3** IMP-05.4 "mesmo nome": implemented as exact, case- and accent-sensitive equality, while neutrals use `normalizeName`. The spec does not say which (recurrence of L-004).
- **SP-4** IMP-05.8 "quantidade ignorada": implemented as `row_count - imported` (unselected + ignored + invalid). The spec does not define it.
- **SP-5** Blank description/title: not covered by the spec (Gap 1).
- **SP-6** IMP-05.11 "a mesma confirmação": the spec does not say whether the key alone identifies it or key + file + account.
- **SP-7** `lovable.md` lists a 404 for confirm; the API answers 422 `invalid_account` for an unknown, inactive or foreign account (web maps it to "Selecione uma conta ativa").

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| IMP-01 | Implementing | ✅ Verified |
| IMP-02 | Implementing | ✅ Verified |
| IMP-03 | Implementing | ✅ Verified (Gap 1 edge) |
| IMP-04 | Implementing | ✅ Verified (Fatura-8 deferred to dashboards) |
| IMP-05 | Implementing | ✅ Verified |
| IMP-06 | Implementing | ✅ Verified |
| IMP-07 | Implementing | ✅ Verified |
| IMP-08 | Implementing | ✅ Verified |
| IMP-09 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 41/41 owned ACs matched the spec outcome, 1 deferred; 7 spec-precision gaps
**Sensor**: 44/45 code mutations killed (1 equivalent), 5/5 DB mutations flagged
**Gate**: api 452 passed (162 unit, 290 integration), web 77 passed, 0 skipped

**Next steps**: route Gaps 1-4 as fix tasks (none blocks the merge); align the spec on SP-1 to SP-7; record lessons for SP-3 (L-004 recurrence) and Gap 1.

# Importação de CSV Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/import/design.md`
**Status**: Draft

**Feature prerequisites**: auth, accounts-categories and transactions complete.

---

## Test Coverage Matrix

> Generated from the approved design and spec - confirm before Execute. Guidelines found: none in the repo (greenfield; no `AGENTS.md`, `CONTRIBUTING.md` or test config) - strong defaults applied. Test stack taken from the approved designs: Vitest, local Supabase Postgres (`supabase start`), React Testing Library; package manager `pnpm` (assumption, confirm).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (parsers, validators, helpers) | unit | All branches; 1:1 to spec ACs; every listed edge case | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, services, SQL rules, migrations/RLS | integration | Every route: happy path + every listed edge case + error paths; RLS and constraints exercised | `api/test/**/*.int.test.ts` | `pnpm -C api test:int` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; error and empty states | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Scaffold / config / generated types | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the approved design - confirm before Execute. Commands do not exist yet; the scaffold tasks create them.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm -C api test:unit` (API tasks) / `yarn --cwd web test` (web tasks) |
| Full | After tasks with integration tests (needs `supabase start`) | `pnpm -C api test` (unit + integration) |
| Build | After phase completion or scaffold/config-only tasks | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: CSV parsing (pure)

```
T1 → T2
T1 → T3
T2 → T3
T3 → T4
T3 → T5
T1 → T6
T2 → T6
T2 → T7
```

### Phase 2: Import schema and classification

```
T8 → T9
T9 → T10
T9 → T11
```

### Phase 3: Import endpoints

```
T12 → T14
T13 → T14
T14 → T15
T14 → T16
T15 → T17
T16 → T17
T14 → T18
```

### Phase 4: Web: import flow
```
T24 → T19
T19 → T20
T19 → T21
T19 → T22
T20 → T23
T21 → T23
T22 → T23
```

---

## Task Breakdown

### Phase 1: CSV parsing (pure)

### T1: Define the import types

**What**: `ParsedRow`, `ClassifiedRow`, `RowStatus` and the `Parser` contract from the design.
**Where**: `api/src/modules/import/types.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: IMP-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Types compile and are exported
- [x] No runtime code in the file
- [x] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(import): define the import types`

---

### T2: Create the CSV reader

**What**: `readCsv(text)` strips the BOM, parses with `csv-parse`, returns header and records; empty and header-only files yield an `empty_file` error.
**Where**: `api/src/modules/import/csv.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: IMP-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] BOM and no-BOM files parse identically
- [x] Quoted fields with commas and decimal commas are preserved
- [x] Empty and header-only files raise `empty_file` (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): create the CSV reader`

---

### T3: Parse the Nubank account CSV core fields

**What**: `parseNubankAccount`: `dd/mm/aaaa` to local date, signed value to type and absolute amount, identifier, zero or malformed rows as `invalid`; copy `exemplo_extrato_nubank.csv` to `api/test/fixtures/`.
**Where**: `api/src/modules/import/parsers/nubankAccount.ts`
**Depends on**: T1, T2
**Reuses**: -
**Requirement**: IMP-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Fixture yields 14 rows with correct date, type, amount and identifier
- [x] Negative value is Expense and positive is Income
- [x] Zero value, invalid date and non-numeric value become `invalid` with a reason (5 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): parse the Nubank account CSV core fields`

---

### T4: Extract Pix details from the account description

**What**: Regex for `Transferência (recebida|enviada) pelo Pix`: name, document, counterparty bank, method PIX; collapse repeated spaces in the name.
**Where**: `api/src/modules/import/parsers/nubankAccount.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: IMP-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Row for MERCADO AUTO yields name `MERCADO AUTO SOLUCOES PUBLICIDADE E TECNOLOGIA LTDA`, document `41.460.383/0001-68`, bank `BCO SANTANDER (BRASIL) S.A. (0033)`, method PIX
- [x] Masked document `•••.224.672-••` and bank `NU PAGAMENTOS - IP (0260)` are captured intact
- [x] All Pix rows of the fixture parse with a name and a document (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): extract Pix details from the account description`

---

### T5: Map the non-Pix account descriptions

**What**: `Débito em conta` (DebitCard, Sem categoria), `Pagamento de fatura` (BankTransfer, Sem categoria, Expense), `Dinheiro guardado com resgate planejado` (BankTransfer, Investimentos), anything else `unrecognized` with name = description and BankTransfer.
**Where**: `api/src/modules/import/parsers/nubankAccount.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: IMP-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Each known description maps to the specified method and category key
- [x] Unknown description is `unrecognized`, name equals the description, category Sem categoria
- [x] Counterparty fields are null for non-Pix rows (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): map the non-Pix account descriptions`

---

### T6: Parse the Nubank invoice CSV

**What**: `parseNubankInvoice`: ISO date, `1.335,61` decimal, positive as Expense CreditCard Sem categoria, negative (`- 1.335,61`) as `ignored`, installment text preserved, identifier null; copy `exemplo_fatura_nubank.csv` to fixtures.
**Where**: `api/src/modules/import/parsers/nubankInvoice.ts`
**Depends on**: T1, T2
**Reuses**: -
**Requirement**: IMP-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Fixture yields 18 Expense rows and 1 ignored row (`Pagamento recebido`)
- [x] `Prado Som Car - Parcela 3/6` keeps its full name and amount 343.72
- [x] Amount `1.335,61` parses to `1335.61`; identifier is null on every row
- [x] Invalid date or amount becomes `invalid` (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): parse the Nubank invoice CSV`

---

### T7: Detect the CSV format

**What**: `detectFormat(header)` returns `nubankAccount`, `nubankInvoice` or null; `assertBankMatches(format, bank)` rejects a Nubank format for a non-Nubank account.
**Where**: `api/src/modules/import/formats.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: IMP-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Account and invoice headers are recognized
- [x] Unknown header returns null
- [x] Format with a non-Nubank account raises `bank_mismatch` (3 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): detect the CSV format`

---

### Phase 2: Import schema and classification

### T8: Create the imports migration

**What**: Migration `0004`: `import_batches` (unique idempotency key per user), `attachments`, `transactions.import_batch_id` FK, RLS, private `imports` bucket with per-folder policy.
**Where**: `supabase/migrations/0004_imports.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: IMP-09

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Duplicate `(user_id, idempotency_key)` is rejected
- [x] A user cannot read another user's batches or attachments
- [x] Storage policy allows only `{auth.uid()}/...` paths in `imports` (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): create the imports migration`

---

### T9: Classify duplicates by external identifier

**What**: `classify` marks a row `duplicate` when its `identifier` already exists on the same account, and a second occurrence inside the file as `duplicate`.
**Where**: `api/src/modules/import/classify.ts`
**Depends on**: T1, T8
**Reuses**: -
**Requirement**: IMP-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Existing identifier on the same account is `duplicate`
- [x] Same identifier on another account is `new`
- [x] Second occurrence in the same file is `duplicate`
- [x] Rows with `ignored` or `invalid` status are untouched (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): classify duplicates by external identifier`

---

### T10: Classify duplicates by name, day, amount and type

**What**: For rows without identifier, compare name, local day (`request.tz`), amount and type against the account's transactions.
**Where**: `api/src/modules/import/classify.ts`
**Depends on**: T9
**Reuses**: -
**Requirement**: IMP-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Same name, day, amount and type is `duplicate`
- [x] Different amount or type is `new`
- [x] Day comparison uses the user's timezone near midnight
- [x] Two identical invoice rows on a first import are both `new`; on re-import both are `duplicate` (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): classify duplicates by name, day, amount and type`

---

### T11: Classify automatic neutrals

**What**: Mark `neutral` when the normalized row name equals a normalized holder name of any of the user's accounts (active or inactive).
**Where**: `api/src/modules/import/classify.ts`
**Depends on**: T9
**Reuses**: -
**Requirement**: IMP-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] With holder `Gabriel Vasconcelos Auzier`, the 6 Pix rows to that name (indexes 3, 4, 5, 8, 12 and 13) are neutral
- [x] Case, accent and spacing variants match
- [x] Inactive account's holder still matches
- [x] No match keeps `neutral=false` and no value/date heuristic is applied (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): classify automatic neutrals`

---

### Phase 3: Import endpoints

### T12: Create the storage helper

**What**: `uploadImportFile` and `removeImportFile` using a Storage client built with the user's JWT, path `{userId}/{batchId}/{filename}`.
**Where**: `api/src/modules/import/storage.ts`
**Depends on**: T8
**Reuses**: -
**Requirement**: IMP-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Upload then download returns identical bytes
- [x] Remove deletes the object
- [x] A user cannot read another user's path (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): create the storage helper`

---

### T13: Add the preview endpoint

**What**: `POST /imports/preview` (multipart file + `accountId`): validates size, active Nubank account, format, empty file; returns classified rows and totals; writes nothing.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T4, T5, T6, T7, T11
**Reuses**: -
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Account fixture returns 14 rows, invoice fixture 18 new plus 1 ignored
- [x] File over 5 MB returns 413; unknown header returns 422 `unsupported_format`; invoice sent to a non-Nubank account returns 422 `bank_mismatch`; empty file returns 422
- [x] No row is written to any table by preview (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): add the preview endpoint`

---

### T14: Add the confirm endpoint

**What**: `POST /imports/confirm` (file, `accountId`, `idempotencyKey`, `selections`): re-parse, re-classify, validate indexes, insert batch, transactions (local-midnight `occurred_at`) and attachment in one transaction; returns `{ batchId, imported, skipped }`.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T12, T13
**Reuses**: -
**Requirement**: IMP-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Only selected rows are inserted, linked by `import_batch_id`
- [x] Unchecked duplicates are skipped; a duplicate the user re-selects is imported
- [x] Per-row neutral override is stored
- [x] Batch counts and attachment row are recorded and the stored file equals the upload
- [x] Selecting an `ignored` or `invalid` index returns 422 (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): add the confirm endpoint`

---

### T15: Make confirm atomic

**What**: Compensation: if the transaction fails the uploaded file is removed; if upload fails nothing is written.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T14
**Reuses**: -
**Requirement**: IMP-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Forced insert failure leaves no batch, transaction, attachment or storage object
- [ ] Forced upload failure leaves no batch or transaction (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): make confirm atomic`

---

### T16: Make confirm idempotent

**What**: Second confirm with the same `idempotencyKey` returns the stored summary and writes nothing.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T14
**Reuses**: -
**Requirement**: IMP-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Repeated confirm returns the same `batchId` and counts
- [ ] Transaction count is unchanged after the second call (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): make confirm idempotent`

---

### T17: Add the re-import and cancel scenarios

**What**: End-to-end test: importing the same file again shows every importable row as `duplicate`; preview without confirm leaves zero rows in batches, attachments and transactions.
**Where**: `api/test/import-flow.int.test.ts`
**Depends on**: T15, T16
**Reuses**: -
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Re-import of the account fixture classifies all importable rows `duplicate`
- [ ] Re-import of the invoice fixture classifies all 18 rows `duplicate`
- [ ] Cancel path writes nothing (3 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): add the re-import and cancel scenarios`

---

### T18: Add the imports isolation test

**What**: Cross-user test over preview, confirm, batches, attachments and storage paths.
**Where**: `api/test/imports-isolation.int.test.ts`
**Depends on**: T14
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] User B cannot import into user A's account
- [ ] User B cannot read user A's attachment or batch (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): add the imports isolation test`

---

### Phase 4: Web: import flow
### T24: Extend the API client to send FormData

**What**: `apiRequest` accepts a `FormData` body: it is sent as is (no `JSON.stringify`) and without a `Content-Type` header so the browser sets the multipart boundary; JSON bodies, the `Authorization` and `X-Timezone` headers and the 401 handling stay as they are.
**Where**: `web/src/lib/api/client.ts`
**Depends on**: None
**Reuses**: existing `apiRequest` and its tests
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] A `FormData` body reaches `fetch` unchanged and with no `Content-Type` header
- [ ] A JSON body is still serialized with `Content-Type: application/json`
- [ ] The Bearer and `X-Timezone` headers are still sent and a 401 still signs the user out (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): let the api client send form data`

---

### T19: Create the import hooks

**What**: `useImportPreview` and `useImportConfirm` (multipart) with `idempotencyKey` generated per preview session.
**Where**: `web/src/features/import/useImport.ts`
**Depends on**: T24
**Reuses**: -
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Preview sends file and account
- [ ] Confirm sends the same file, the key and selections
- [ ] The key is stable across retries of one session (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): create the import hooks`

---

### T20: Build the account and file step

**What**: Select an active account and a CSV file; client-side size and extension checks; shows server errors.
**Where**: `web/src/features/import/ImportStartStep.tsx`
**Depends on**: T19
**Reuses**: -
**Requirement**: IMP-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] File over 5 MB is blocked with the message
- [ ] Server `unsupported_format` and `bank_mismatch` errors are shown (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): build the account and file step`

---

### T21: Build the preview table

**What**: Rows with badges (nova, duplicada, ignorada, não reconhecida), checkbox per row, duplicates unchecked, editable duplicate flag, neutral toggle, invalid rows without checkbox.
**Where**: `web/src/features/import/ImportPreviewTable.tsx`
**Depends on**: T19
**Reuses**: -
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Duplicate rows start unchecked and can be checked
- [ ] Neutral rows are flagged and the toggle changes the payload
- [ ] Invalid and ignored rows cannot be selected
- [ ] Unrecognized rows are flagged for review (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): build the preview table`

---

### T22: Build the confirmation summary

**What**: Result view with imported and skipped counts and error states with retry.
**Where**: `web/src/features/import/ImportSummary.tsx`
**Depends on**: T19
**Reuses**: -
**Requirement**: IMP-07

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Shows imported and skipped counts
- [ ] Failure shows the error and keeps the preview (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): build the confirmation summary`

---

### T23: Wire the import page

**What**: Wizard composing start step, preview, confirm, summary and cancel (cancel writes nothing); the `/importar` route renders it in place of the placeholder.
**Where**: `web/src/features/import/ImportPage.tsx`
**Depends on**: T20, T21, T22
**Reuses**: -
**Requirement**: IMP-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Full happy path with a mocked API
- [ ] Cancel returns to the start step without calling confirm
- [ ] `web/src/routes/importar.tsx` renders `ImportPage` inside the authenticated layout (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): wire the import page`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

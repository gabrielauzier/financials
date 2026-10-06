# Import: correções de método, formato e neutras Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/import-fixes/design.md`
**Status**: Draft

**Feature prerequisites**: transactions-ux complete (migration `0007` applies `transactions.description` and `Other` in the `payment_method` check; `GET /transactions` returns `description`); migrations 0001 a 0007 applied (`pnpm -C api db:reset`). Branch `feat/import-fixes`, stacked on `feat/transactions-ux`; no new migration. Do not commit `references/nubank_extrato_setembro.csv` (real names and counterparties).

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`) and the `package.json` scripts; no `AGENTS.md` or `CONTRIBUTING.md` - strong defaults applied. Floor taken from the existing tests (`api/src/modules/import/**/*.test.ts`, `api/test/import-*.int.test.ts`, `web/src/features/import/*.test.tsx`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (format table, parsers, normalization) | unit | All branches; 1:1 to spec ACs; every listed edge case (case and accent variants, multi-space names, unknown format, 500-char truncation, sign and type) | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, SQL rules, import pipeline, OpenAPI | integration | Every route touched: happy path + every listed edge case + error paths; preview JSON, confirm persistence, dedup with and without identifier | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; failure paths and conditional lists assert the Portuguese text and visible options (L-013) | `web/src/**/*.test.tsx`, `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web mocks and hand-written API types | unit when behavior (mock handlers); none for types | Mock handlers include `Other`; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
| Test fixtures (CSV data) | none | - (validated by the integration test that consumes it; token check recorded in the commit) | `api/test/fixtures/*.csv` | build gate only |
| Config / scaffold | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only (web or API) | `yarn --cwd web test` for web tasks; `pnpm -C api test:unit` for API unit tasks |
| Full | After API tasks with integration tests (needs `supabase start`) | `pnpm -C api test` |
| Build | After phase completion | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. The 8 tasks fit one worker batch (about 7 tasks per worker): execute inline or as a single batch.

### Phase 1: Reproduction (red first)

```
T1
T1 → T2
```

### Phase 2: Other, format table and import pipeline (API)

```
T2 → T3
T3 → T4
T4 → T5
T3 → T6
T5 → T6
```

### Phase 3: Web and neutrals end to end

```
T3 → T7
T6 → T8
T7 → T8
```

---

## Task Breakdown

### Phase 1: Reproduction (red first)

### T1: Create the sanitized Nubank statement fixture

**What**: A 96-row CSV with the header `Data,Valor,Identificador,Descrição` that keeps every description format of the real September statement and the count per format, with fictitious names, documents, banks, amounts and identifiers. Holders: "Maria Souza Lima" (person) and "Maria Souza Lima LTDA" (company).
**Where**: `api/test/fixtures/nubank_statement_sanitized.csv`
**Depends on**: None
**Reuses**: `references/nubank_extrato_setembro.csv` only as the shape source (never copied); `api/test/fixtures/nubank_account.csv` as the style reference
**Requirement**: IMPFIX-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The file has 96 data rows and the counts per format of the spec: 53 "Compra no débito - X", 6 "Compra no débito via NuPay - X", 4 "Estorno - Compra no débito - X", 4 "Estorno - Ajuste de compra no débito - X", 6 "Pagamento de boleto efetuado - X", 17 "Transferência enviada pelo Pix - …", 1 "Transferência recebida pelo Pix - …", 3 "Transferência Recebida - MARIA SOUZA LIMA LTDA - <cnpj fictício> - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: …", 1 "Reembolso recebido pelo Pix - …", 1 "Pagamento de fatura" (AC 1 of the reproduction story)
- [x] One Pix enviada goes to "Maria Souza Lima" with a masked document (`•••.xxx.xxx-••`); the other 16 enviadas and the recebida use unrelated fictitious names; at least one name has repeated spaces and one boleto name is truncated like the original
- [x] Signs follow the original: estornos, Pix recebida, 3 transferências recebidas and the reembolso are positive; everything else negative
- [x] Every identifier is a new, distinct UUID, and a token check against the real file finds no shared name, document, identifier or counterparty word (command and result noted in the commit body; only `api/test/fixtures/` is staged)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: the existing unit tests still pass (no silent deletions); no new test (fixture only)

**Tests**: none
**Gate**: quick

**Commit**: `test(import-fixes): add a sanitized Nubank statement fixture`

---

### T2: Write the failing integration test that reproduces the bugs

**What**: `import-fixes.int.test.ts` creates two Nubank accounts (holders "Maria Souza Lima" and "Maria Souza Lima LTDA"), previews and confirms the fixture, and asserts method, category, type, name, status, neutral and the stored `description`. It is committed red.
**Where**: `api/test/import-fixes.int.test.ts`
**Depends on**: T1
**Reuses**: `api/test/import-preview.int.test.ts` and `api/test/import-confirm.int.test.ts` (app, user, accounts, multipart, storage cleanup), `api/test/helpers/fixtures.ts`
**Requirement**: IMPFIX-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Preview assertions: 96 rows, totals `new` 96 and `unrecognized` 0, methods 61 `DebitCard` / 6 `NuPay` / 19 `PIX` / 4 `BankTransfer` / 6 `Boleto` / 0 `Other`, `categoryName` "Estorno (de compras)" on the 8 estornos and "Sem categoria" on the other 88, 13 `Income` and 83 `Expense`, extracted names for one row of every format, Pix document and bank extracted (AC 2)
- [x] `neutral: true` exactly on the Pix enviada to "Maria Souza Lima" and the 3 "Transferência Recebida" of "MARIA SOUZA LIMA LTDA", `neutral: false` on the other 92 (AC 3)
- [x] Confirm with the preview's `neutral` marks, then a read of `transactions` asserts `payment_method`, `name`, `neutral` and `description` equal to the original CSV text (AC 4)
- [x] The run is red as expected: the failures listed in the commit body are method, name, category, `description` and neutral assertions, and no other file of `pnpm -C api test` fails (AC 5)
- [x] Gate check run: `pnpm -C api test` (expected red only in `import-fixes.int.test.ts`; the rest green)
- [x] Test count: the new file has 4 tests, all red now; the existing integration tests still pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `test(import-fixes): reproduce the import mapping and neutral bugs`

---

### Phase 2: Other, format table and import pipeline (API)

### T3: Accept the Other payment method in the transactions API

**What**: Add `Other` to `PAYMENT_METHODS`; the schema enum, the request descriptions and `validPaymentMethod` derive from the list. Regenerate `api/openapi.json`.
**Where**: `api/src/modules/transactions/schema.ts`
**Depends on**: T2
**Reuses**: `validPaymentMethod` and the `One of: …` descriptions in `api/src/modules/transactions/routes.ts`; `api/test/transactions-schema.int.test.ts`; `pnpm -C api openapi:export`
**Requirement**: IMPFIX-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `POST /transactions` and `PATCH /transactions/:id` accept `paymentMethod: "Other"` and `GET /transactions` returns it (AC 1)
- [x] `paymentMethod: "other"` and `"Bitcoin"` answer 422 `validation_error` on field `paymentMethod`, with a message listing `Other` (AC 2)
- [x] The database check test inserts `Other` along with the 7 old methods (`transactions-schema.int.test.ts`)
- [x] `api/openapi.json` lists `Other` in the enums and in the `One of: …` descriptions, regenerated (not edited by hand), and the swagger test confirms it is up to date (AC 4)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: the existing transactions and swagger tests plus 4 new ones pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): accept the Other payment method in transactions`

---

### T4: Create the description format mapping table

**What**: The pure module with the single prefix table, `describeStatement` and `originalText`, exactly as in the design: normalized-prefix match (longest first), name taken from the original text, transfer structure with document and bank, unmapped -> `Other`/`unrecognized`, 500-code-point truncation.
**Where**: `api/src/modules/import/parsers/descriptions.ts`
**Depends on**: T3
**Reuses**: `normalizeName` and `collapseSpaces` in `api/src/lib/normalize.ts`; the `PIX` regex of `nubankAccount.ts`; `PaymentMethod` from the transactions schema
**Requirement**: IMPFIX-04, IMPFIX-05, IMPFIX-06, IMPFIX-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] One unit test per format asserts method, category, name, document, bank and status: compra no débito, via NuPay, compra no crédito, estorno débito and ajuste débito, estorno crédito and ajuste crédito, transferência recebida/enviada pelo Pix, transferência Recebida/Enviada sem Pix, reembolso Pix, boleto, fatura, "Débito em conta", "Dinheiro guardado com resgate planejado" (AC 2 to 12 of the mapping story)
- [x] "Compra no débito via NuPay - iFood" resolves to `NuPay`, never `DebitCard` (AC 15)
- [x] Case and accent variants ("COMPRA NO DEBITO - x", "transferencia RECEBIDA - …", "Estorno - COMPRA no debito - x") map like the canonical prefix and keep the original case of the name (AC 13)
- [x] Names with repeated spaces collapse to one space and are trimmed; a masked document (`•••.224.672-••`) is kept as text (AC 14 and edge case)
- [x] Unknown text, "Estorno - Pix - X" and a transfer without `NOME - DOC - BANCO Agência:` return `Other`, `Uncategorized`, the original text as name (not collapsed) and `unrecognized` (AC 16)
- [x] "Compra no débito" and "Pagamento de boleto efetuado" without " - X" keep the table method, use the description as name and stay `new`; a name containing " - " keeps everything after the first " - "
- [x] `originalText` collapses spaces, keeps 500 code points as is, truncates 501 and longer to exactly 500 code points and never splits a surrogate pair (AC 1, 2 and 4 of the description story)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: 30 new unit tests pass; the existing unit tests still pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): add the description format mapping table`

---

### T5: Use the table and keep the original description in the parsers

**What**: `parseRecord` calls `describeStatement` and sets `description` with `originalText`; `ParsedRow` gains `description`, the 8-method `paymentMethod` and `Reversal` in `categoryKey`; `invalidRow` and the invoice parser fill `description`; the old `PIX` and `KNOWN` constants and `describe` are removed.
**Where**: `api/src/modules/import/parsers/nubankAccount.ts`
**Depends on**: T4
**Reuses**: `descriptions.ts` (T4); `types.ts`, `common.ts` and `nubankInvoice.ts` change in this task only for the new field and the wider types; `api/src/modules/import/parsers/nubankAccount.test.ts`, `nubankInvoice.test.ts`
**Requirement**: IMPFIX-04, IMPFIX-05, IMPFIX-06, IMPFIX-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Parsing the sanitized fixture yields 96 `new` rows and the method counts 61 / 6 / 19 / 4 / 6 / 0 (`DebitCard` / `NuPay` / `PIX` / `BankTransfer` / `Boleto` / `Other`), `Reversal` on the 8 estornos and the 4 holder-name rows with the extracted names (AC 1 to 12)
- [x] The type is `Income` for positive and `Expense` for negative amounts in every format, including `Estorno` (AC 17)
- [x] Every row has `description` equal to the collapsed original text; a 600-character description is cut to 500 code points while `name` is unchanged; an invalid row has a defined `description` (never `undefined`) (AC 1 to 5 of the description story)
- [x] An unknown description is `Other`, `unrecognized`, with the original `name` (AC 16); an empty description is still `invalid` with "Empty description"
- [x] The invoice parser sets `description` to the collapsed `title` and keeps `name`, `CreditCard` and statuses unchanged
- [x] Existing parser tests updated to the new `name` of the formats (no deleted assertion without replacement)
- [x] Gate check passes: `pnpm -C api test:unit` and `pnpm -C api typecheck`
- [x] Test count: the existing parser tests plus 14 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): map formats and keep the original description`

---

### T6: Save the description and expose every method in the import routes

**What**: `PreviewRowSchema.paymentMethod` uses `PAYMENT_METHODS`; `insertBatch` writes `transactions.description` from `ParsedRow.description`. Add the deduplication tests for the new names with and without identifier. Regenerate `api/openapi.json`.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T3, T5
**Reuses**: `unnest` insert in `insertBatch`; `api/test/import-confirm.int.test.ts`, `import-classify.int.test.ts`, `import-preview.int.test.ts`, `import-idempotency.int.test.ts`
**Requirement**: IMPFIX-02, IMPFIX-06, IMPFIX-08, IMPFIX-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Preview JSON carries `NuPay`, `Boleto` and `Other` without a serialization error; `api/openapi.json` shows the 8 values for the preview `paymentMethod` and the swagger test passes (AC 3 and 4 of the Other story)
- [x] Confirm stores `description` equal to the row text and `GET /transactions` returns it; `name` stays the extracted name; a 600-character line stores exactly 500 code points (AC 3 to 5 of the description story)
- [x] Dedup with identifier: a row whose identifier exists with a different `name` stays `duplicate` (AC 1 of the dedup story)
- [x] Dedup without identifier: same extracted name, local day, amount and type is `duplicate`; same data with a different extracted name stays `new` (AC 2 and 3)
- [x] Previewing the fixture again after confirm marks 96 rows `duplicate` (AC 4)
- [x] `import-fixes.int.test.ts` now passes every assertion except, at most, the neutral assertion for the single Pix enviada row; the 3 LTDA transfers are neutral (AC 2 of the neutral story)
- [x] Gate check passes: `pnpm -C api test` (only an eventual Pix neutral assertion of `import-fixes.int.test.ts` may still fail; the failure message is recorded in the commit body for T8)
- [x] Test count: the existing import integration tests plus 6 new ones pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): save the description and expose all methods in preview`

---

### Phase 3: Web and neutrals end to end

### T7: Add Other and the new methods to the web types, labels and mocks

**What**: `PaymentMethod` gets `Other`, `ImportPaymentMethod = PaymentMethod`, `paymentMethodLabels` gets `Other: "Outro"` and becomes the single label map (import labels and `TransactionForm` stop keeping their own copies), and the transactions mock includes `Other`.
**Where**: `web/src/features/transactions/labels.ts`
**Depends on**: T3
**Reuses**: `web/src/lib/api/types.ts`, `web/src/features/import/labels.ts`, `web/src/features/transactions/TransactionForm.tsx`, `web/src/lib/api/mock/transactions.ts`, `web/src/features/import/ImportPreviewTable.test.tsx`, `web/src/features/transactions/*.test.tsx`
**Requirement**: IMPFIX-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] `PaymentMethod` and `ImportPaymentMethod` include `Other`, and `yarn --cwd web typecheck` passes with no duplicate label map left (AC 5)
- [x] The extrato table and the mobile card show "Outro" for a transaction with `Other` (AC 5)
- [x] The transaction form lists "Outro" in "Método de pagamento" and sends `paymentMethod: "Other"` when chosen (AC 5)
- [x] The import preview shows "Boleto", "NuPay" and "Outro" next to the 5 old labels; a test renders one row per each of the 8 methods and asserts the Portuguese text (AC 6)
- [x] The mock generates `Other` transactions among the methods (AC 7)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: the existing web tests plus 5 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the Other method and label every import method`

---

### T8: Diagnose and fix the own-holder neutral transfers end to end

**What**: Run the T2 test on the finished mapping and, if the single Pix enviada row is still not neutral, prove the cause layer by layer (parser output, `classify` with both accounts, preview JSON, `ImportPreviewTable`, `ImportPage` payload) and fix it there; if it is already green, change no production code, record the finding (holder data) and add the guards below. The end state is the whole `import-fixes.int.test.ts` green and the web preview showing and confirming the 4 rows as neutral.
**Where**: `api/src/modules/import/classify.ts` (starting point; the fix lands in the layer the diagnosis proves)
**Depends on**: T6, T7
**Reuses**: `normalizeName`, `holderNames`, `web/src/features/import/previewSelection.ts`, `ImportPreviewTable.tsx` (`update` fallback `{ selected: false, neutral: false }` vs render fallback `row.neutral`), `ImportPage.tsx`, `web/src/features/import/ImportPage.test.tsx`
**Requirement**: IMPFIX-09, IMPFIX-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] The proven cause (or "no code defect: holder data") is written in the commit body with the layer and the failing assertion that showed it (AC 10 of the neutral story)
- [x] `import-fixes.int.test.ts` passes entirely: the preview JSON has `neutral: true` on exactly the 4 transfers with a holder name and `false` on the other 92; the confirmed transactions have `neutral = true` on those 4 (AC 1 to 3 and 5)
- [x] A regression test in the layer of the cause (or, for a data-only cause, a `classify` integration test with both accounts) covers: holder in a different case, a name that only starts with the holder name staying `neutral: false`, and an `unrecognized` or `duplicate` row still marked neutral (AC 1 and 4)
- [x] Web test: a preview with `neutral: true` rows shows the "Neutra" switch on for those rows before and after selecting or unselecting them, and a confirm with a neutral row selected sends `{ index, neutral: true }`; turning the switch off sends `neutral: false` (AC 6 to 9 of the neutral story); the `update` fallback uses `row.neutral` if the web test proves the old fallback loses it
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [x] Browser check against the local API recorded in the commit body: import the fixture with both accounts and see 4 "Neutra" switches on, no "Não reconhecida" row and the "Outro" label available in the form
- [x] Test count: the existing API and web tests plus 6 new ones pass (no silent deletions)

**Tests**: integration
**Gate**: build

**Commit**: `fix(import): make the own-holder transfers neutral end to end`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 ------→ T2
Phase 2:  T3 ------→ T4 ------→ T5 ------→ T6
Phase 3:  T7 ------→ T8   (T8 also after T6)
```

Execution is strictly sequential - there is no intra-phase parallelism.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: sanitized fixture | 1 data file | ✅ Granular |
| T2: failing integration test | 1 test file | ✅ Granular |
| T3: `Other` in the transactions API | 1 enum through schema, routes and OpenAPI | ✅ Granular |
| T4: format mapping table | 1 pure module | ✅ Granular |
| T5: parsers use the table | 1 parser; 1 field through types and invoice | ✅ Granular |
| T6: import routes | 1 file, 2 cohesive changes (enum and insert column) plus dedup tests | ✅ Granular |
| T7: web `Other` and labels | 1 label map through types, form and mock | ✅ Granular |
| T8: neutral diagnosis | 1 root cause, fix in the layer proven | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 | ✅ Match |
| T5 | T4 | T4 | ✅ Match |
| T6 | T3, T5 | T3, T5 | ✅ Match |
| T7 | T3 | T3 | ✅ Match |
| T8 | T6, T7 | T6, T7 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: fixture | Test fixtures | none | none | ✅ OK |
| T2: reproduction test | API routes and import pipeline (test only) | integration | integration | ✅ OK |
| T3: `Other` in the API | API routes, schema, OpenAPI | integration | integration | ✅ OK |
| T4: format table | API pure logic | unit | unit | ✅ OK |
| T5: parsers | API pure logic | unit | unit | ✅ OK |
| T6: import routes | API routes and import pipeline | integration | integration | ✅ OK |
| T7: web types, labels, mock | Web components, helpers, mocks | unit | unit | ✅ OK |
| T8: neutral end to end | API pipeline (integration) and web components (unit) | integration | integration | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| IMPFIX-01 | T1, T2 |
| IMPFIX-02 | T3, T6 |
| IMPFIX-03 | T7 |
| IMPFIX-04 | T4, T5 |
| IMPFIX-05 | T4, T5 |
| IMPFIX-06 | T4, T5, T6 |
| IMPFIX-07 | T4, T5 |
| IMPFIX-08 | T6 |
| IMPFIX-09 | T6, T8 |
| IMPFIX-10 | T8 |

**Notes for the worker**: `api/openapi.json` is regenerated by `pnpm -C api openapi:export` (T3 and T6), never edited by hand. The T2 test is committed red on purpose and must not be weakened to turn green; if the diagnosis in T8 proves an expectation wrong, fix the fixture or the expectation in T8 and say why in the commit body. The real file `references/nubank_extrato_setembro.csv` stays untracked: never `git add` it.

# Import: melhorias do preview e arquivos importados Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/import-improvements/design.md`
**Status**: Draft

**Feature prerequisites**: import-fixes complete (parser table, `Other` method, `description`, neutrals); migrations 0001 to 0007 applied (`pnpm -C api db:reset`; the local Supabase stack must be running for integration tests, `pnpm -C api db:start`). Branch `feat/import-improvements`, stacked on `feat/import-fixes`; no new migration and no push. The Storage bucket `imports` and its policy come from migration 0004 and are not changed.

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`) and the `package.json` scripts; no `AGENTS.md` or `CONTRIBUTING.md` - strong defaults applied. Floor taken from the existing tests (`api/src/modules/import/**/*.test.ts`, `api/test/import-*.int.test.ts`, `api/test/imports-isolation.int.test.ts`, `web/src/features/import/*.test.tsx`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (selections parsing, content-disposition, Storage helper with mocked fetch) | unit | All branches; 1:1 to spec ACs; every listed edge case (categoryId shapes, header injection, Storage status mapping) | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, SQL, import pipeline, Storage round trip, OpenAPI | integration | Every route touched: happy path + every listed edge case + error paths (404, 422, 502, 503, 401); two-user isolation; real local Storage; `openapi.json` up to date | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web pure helpers (selection state, amount helper, file from blob) | unit | All branches; 1:1 to spec ACs | `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web components, hooks, pages | unit | Spec-visible behavior per AC; failure paths and conditional lists assert the Portuguese text and the visible options (L-013): loading, empty, error and retry of the list, download failure, inactive account, categories failing to load | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Web API client, mocks and hand-written types | unit when behavior (client, mock handlers, error messages); none for types | Blob request headers and errors, every mock handler, every new message; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
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

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. Phases 1 and 2 (6 tasks) form the first worker batch; phases 3 and 4 (7 tasks) the second.

### Phase 1: API preview and category per row

```
T1 → T2
```

### Phase 2: API imported files

```
T3
T4
T3 → T5
T4 → T5
```

### Phase 3: Web preview (select all, value, category, duplicates)

```
T7 → T8 → T9 → T10
```

### Phase 4: Web imported files

```
T11 → T12
T11 → T13
T12 → T13
```

---

## Task Breakdown

### Phase 1: API preview and category per row

### T1: Move the preview analysis out of the routes file

**What**: Behavior-preserving extraction of `PreviewRowSchema`, `PreviewSchema`, `analyze`, `categoriesByKey`, `toPreview`, `invalidAccount` and their types into `preview.ts`, so the upload route and the upcoming stored-file route share one implementation. `routes.ts` imports them; nothing else changes.
**Where**: `api/src/modules/import/preview.ts`
**Depends on**: None
**Reuses**: the current code of `api/src/modules/import/routes.ts` (moved, not rewritten); all `api/test/import-*.int.test.ts` and `api/test/imports-isolation.int.test.ts` as the safety net
**Requirement**: IMPIMP-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `preview.ts` exports `PreviewSchema`, `PreviewRowSchema`, `analyze`, `categoriesByKey`, `toPreview`, `invalidAccount`; `routes.ts` no longer defines them and the preview and confirm responses are byte-for-byte what they were (the OpenAPI export has no diff)
- [x] No test is changed or deleted; `pnpm -C api openapi:export` leaves `api/openapi.json` unchanged
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [x] Test count: the existing API unit and integration tests all pass, same count as before (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `refactor(import): move the preview analysis into its own module`

---

### T2: Accept and validate a category per selected row

**What**: Preview rows gain `categoryId`; the confirm accepts `categoryId` in each `selections` item and saves the row with it. New `selections.ts` holds the pure `parseSelections` (moved from `routes.ts`, now validating `categoryId`); the confirm resolves categories in one RLS query inside the analysis transaction, before the Storage upload, and answers 422 `invalid_category` for an id that is not the user's. Regenerate `api/openapi.json`.
**Where**: `api/src/modules/import/routes.ts`
**Depends on**: T1
**Reuses**: `api/src/modules/import/preview.ts` (`toPreview`, `categoriesByKey`); `api/src/modules/import/selections.ts` (new, with `selections.test.ts`); `api/test/import-preview.int.test.ts`, `import-confirm.int.test.ts`, `imports-isolation.int.test.ts`; `pnpm -C api openapi:export`
**Requirement**: IMPIMP-01, IMPIMP-02, IMPIMP-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Preview JSON carries `categoryId` (the user's category id of the parser key) on every row, ignored and invalid included, and it equals the id behind `categoryName` (AC 1 of the API story)
- [x] Unit tests of `parseSelections` (`selections.test.ts`): omitted `categoryId` accepted; lowercase and uppercase UUID accepted; `null`, number, object, empty string and non-UUID string rejected with 422 `validation_error` field `selections`; the old rules still hold (empty array, repeated index, negative or fractional index, non-boolean `neutral`) (AC 5)
- [x] Integration: confirm with a custom category on two rows (different categories) stores each transaction with its own category, read back by `GET /transactions` (AC 2 and 7); without `categoryId` the parser category is stored as before (AC 3); a neutral row with a chosen category stores `neutral = true` and that category (AC 6)
- [x] Integration: a well-formed `categoryId` that does not exist, and the category id of another user, answer 422 `invalid_category` with field `selections` and the row `index` in the message; no batch, transaction, attachment or Storage object is created (`importState` unchanged) (AC 4)
- [x] Integration: an upper-case `categoryId` of the user's category is accepted; replaying the same idempotency key returns the stored summary (HTTP 200) without writing again
- [x] `api/openapi.json` regenerated (never edited by hand) documents `categoryId` on the preview rows and in the `selections` description, and the swagger test passes
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [x] Test count: the existing API tests plus about 10 new unit tests and 8 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): accept a category per selected row in the confirm`

---

### Phase 2: API imported files

### T3: Add the Storage download to the import helper

**What**: `downloadImportFile` reads one object of the user from the `imports` bucket with the user's token: bytes on 200, `null` when Storage says the object is missing (HTTP 400 or 404), `storage_error` 502 for everything else.
**Where**: `api/src/modules/import/storage.ts`
**Depends on**: None
**Reuses**: `objectUrl`, `headers`, `storageError`, `STORAGE_TIMEOUT_MS` in the same file; `api/src/modules/import/storage.test.ts`; `api/test/import-storage.int.test.ts` (round-trip style)
**Requirement**: IMPIMP-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Unit tests with a mocked `fetch`: 200 returns the exact bytes; 400 and 404 return `null`; 401, 403, 500 and 503 throw `storage_error` 502; a network error and a timeout throw `storage_error` 502 (AC 4 and 5 of the download story)
- [ ] The thrown error message contains the operation and the HTTP status only: no URL, token, key or path (asserted with the mocked URL and token as the forbidden strings) (AC 7)
- [ ] The request carries `apikey` and `Authorization: Bearer <user token>` and never a service key (asserted on the mocked call) (AC 4 of the isolation story)
- [ ] Gate check passes: `pnpm -C api test:unit` and `pnpm -C api typecheck`
- [ ] Test count: the existing unit tests plus about 8 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): download a stored import file with the user token`

---

### T4: List the user's imported files

**What**: `GET /imports?limit=` returns the user's batches newest first (`id`, `filename`, `mimeType`, `sizeBytes`, `bank`, `account { id, nickname }`, `createdAt`, `rowCount`, `importedCount`, `skippedCount`), with the earliest attachment per batch via a lateral join; creates `batches.ts` with `importedFilesRoutes`, registered from `importRoutes`; also adds the shared batch-and-attachment lookup used by T5. Regenerate `api/openapi.json`.
**Where**: `api/src/modules/import/batches.ts`
**Depends on**: T1
**Reuses**: `api/src/modules/import/routes.ts` (registration, `ImportRoutesOptions`); `api/src/modules/accounts/routes.ts` (list and `querystring` pattern); `api/test/imports-isolation.int.test.ts` (two users, real Storage); `api/test/helpers/*`
**Requirement**: IMPIMP-07, IMPIMP-10, IMPIMP-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Two confirmed imports are listed newest first with the fields above and the counts of each confirm summary; the account `nickname` is the account's (AC 1 of the list story)
- [ ] A user without batches gets `200 []` (AC 2); `limit` omitted returns at most 50 (52 batches inserted by admin SQL), `limit=1` returns only the newest, `limit=100` accepted (AC 3)
- [ ] `limit=0`, `limit=101`, `limit=1.5` and `limit=abc` answer 400 `validation_error` (AC 4)
- [ ] The response has no `storage_path`, `user_id` or `idempotency_key` (the raw JSON string is asserted not to contain the stored path nor those keys) (AC 5); two batches with the same `created_at` come back by `id` descending, stable across calls (AC 6)
- [ ] A batch whose account was inactivated is still listed with its nickname
- [ ] Isolation: user B's `GET /imports` never contains user A's batches while A's does (AC 2 of the isolation story); without a token or with an invalid token the route answers 401 `unauthorized` (AC 1)
- [ ] `api/openapi.json` regenerated documents `GET /imports` with its `limit` query and response; the swagger test passes
- [ ] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [ ] Test count: the existing API tests plus about 12 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): list the user's imported files`

---

### T5: Download an imported file

**What**: `GET /imports/:id/file` finds the user's batch and attachment (RLS), reads the object with `downloadImportFile` using the user's token, and answers the bytes with `Content-Type`, `Content-Disposition: attachment` (new pure `contentDisposition.ts`), `Content-Length`, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Order of checks: 503 without `publishableKey`, then 404 for a non-UUID, unknown or foreign id, then Storage. Regenerate `api/openapi.json`.
**Where**: `api/src/modules/import/batches.ts` (modify)
**Depends on**: T3, T4
**Reuses**: `api/src/modules/import/storage.ts` (`downloadImportFile`); `api/src/modules/import/contentDisposition.ts` (new, with `contentDisposition.test.ts`); `api/test/helpers/storage.ts` (removes objects with the service key, test only); `api/test/imports-isolation.int.test.ts`
**Requirement**: IMPIMP-08, IMPIMP-09, IMPIMP-10, IMPIMP-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Unit tests of `contentDisposition`: plain ASCII name; accents (`extrato março.csv`) give an ASCII fallback and a percent-encoded `filename*`; double quote, backslash, `;` and slash are neutralized in the fallback; CR, LF and other control characters never appear in the output; an empty name falls back to a fixed ASCII name (AC 2 of the download story)
- [ ] Integration: download after a confirm returns bytes identical to the uploaded CSV, `Content-Type` equal to the stored mime type, `Content-Disposition` with the original filename, `Cache-Control: private, no-store` (AC 1)
- [ ] Integration: after confirming every row of a fixture, the downloaded bytes sent to `POST /imports/preview` on the batch's account give the file's row count with every confirmed row `duplicate` (AC 2 of the shared-preview story)
- [ ] Integration: a stored file name with accents and a quote still produces a valid response; a stored `mime_type` that is not `type/subtype` is answered as `application/octet-stream` (AC 2 and edge case)
- [ ] Integration: non-UUID id, unknown UUID and another user's batch all answer the same 404 `not_found` and the same body; a removed Storage object answers 404 `not_found` (AC 3 and 4); Storage errors answer 502 `storage_error` without URL, token or path in the body (the Storage URL of the app is pointed at an unreachable address in this test) (AC 5)
- [ ] Integration: an app built without `publishableKey` answers 503 `storage_not_configured` (AC 6); no response body or header contains the storage path, the Storage URL or the project key (AC 7)
- [ ] Isolation: user B requesting user A's id gets 404 and none of A's bytes; the route answers 401 without a valid token; A downloads its own bytes even when B has a batch with the same filename (AC 1, 3 and 5 of the isolation story)
- [ ] `api/openapi.json` regenerated documents `GET /imports/{id}/file` with 200 binary, 401, 404, 502, 503; the swagger test passes
- [ ] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [ ] Test count: the existing API tests plus about 7 new unit tests and 11 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(import): download a stored import file by batch id`

---

### T6: Preview an imported file from its stored copy

**Status**: Dropped. The endpoint `POST /imports/:id/preview` is not built: the web reimports by downloading the file as a `Blob` (T5) and reusing the normal `POST /imports/preview` and `POST /imports/confirm`, so nothing would call it. No work, no commit; the number is kept so references stay stable.

**Tests**: none
**Gate**: none

---

### Phase 3: Web preview (select all, value, category, duplicates)

### T7: Select all rows in the preview

**What**: Header checkbox in the "Selecionar" column using the pure helpers `selectAllState` and `setAllSelected` in `previewSelection.ts`: checked when every selectable row is selected, indeterminate when partial, unchecked when none, disabled with no selectable rows; click on checked clears, click on unchecked or indeterminate selects all selectable rows. Ignored and invalid rows are never touched; neutral flags are kept.
**Where**: `web/src/features/import/ImportPreviewTable.tsx`
**Depends on**: None
**Reuses**: `web/src/features/import/previewSelection.ts` (`isSelectable`, `initialSelection`); `web/src/components/ui/checkbox.tsx`; `web/src/features/import/ImportPreviewTable.test.tsx`
**Requirement**: IMPIMP-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Unit tests of `selectAllState` and `setAllSelected` over rows with new, duplicate, unrecognized, ignored and invalid statuses: all, some, none, disabled (no selectable rows), and the set functions leave `neutral` untouched and never mark ignored or invalid rows (AC 2, 3, 6 and 8)
- [ ] Table test: the header checkbox named "Selecionar todas as linhas" selects every selectable row and the "N linhas selecionadas" counter matches; ignored and invalid rows have no checkbox and stay out (AC 1 and 2)
- [ ] Table test: with one row selected the checkbox has `aria-checked="mixed"`; clicking it selects all; with all selected it is checked and clicking clears all; neutral switches keep their value (AC 3, 4, 5 and 6)
- [ ] Table test: a preview with only ignored and invalid rows renders the checkbox disabled and unchecked (AC 8); `initialSelection` still starts new and unrecognized selected and duplicates unselected (AC 7)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add select all to the import preview`

---

### T8: Show the preview value in green and red without the type column

**What**: Add `amountClassName(type)` and `formatSignedAmount(type, amount)` to `transactions/utils.ts` with the exact classes and signs the extrato uses today, switch the extrato table and card to them, and use them in the preview Valor cell; remove the "Tipo" header and cell from the preview table. The preview has no mobile card, so nothing else changes there.
**Where**: `web/src/features/transactions/utils.ts`
**Depends on**: T7
**Reuses**: `web/src/features/transactions/TransactionsPage.tsx` (current expressions at the table and card amount cells); `web/src/features/import/ImportPreviewTable.tsx`; `web/src/lib/format.ts` (`formatBRL`); `web/src/features/transactions/utils.test.ts`
**Requirement**: IMPIMP-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Unit tests of both helpers: income class contains `text-emerald-700` and `dark:text-emerald-400`, expense class contains `text-destructive`, both `font-semibold` and `whitespace-nowrap`; income text `R$ 1.234,56`; expense text `-R$ 1.234,56` for `"1234.56"` and for `"-1234.56"` (a single minus); zero and large values format (AC 2, 3 and 4)
- [ ] Preview table test: no column header "Tipo" and no "Receita" or "Despesa" cell; an income row shows its Valor with the green classes and no sign, an expense row shows `-R$ …` with the red class, whether the preview `amount` carries a minus or not (AC 1, 2 and 3)
- [ ] The extrato table and mobile card render the same text and classes as before (the existing extrato tests pass unchanged) and call the helpers (AC 4)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 7 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): color the preview value like the extrato`

---

### T9: Choose the category of each row in the preview

**What**: Types `PreviewRow.categoryId` and `ImportSelection.categoryId`; `RowChoice` gains `categoryId`; `initialSelection` starts from the preview's id, `selectedPayload` sends the effective one; the Categoria column renders a `CategorySelect` per selectable row (new `ariaLabel` and `className` props, item content in a single `CategoryOptionLabel`), text `categoryName` for ignored and invalid rows and when the categories query fails.
**Where**: `web/src/features/import/previewSelection.ts`
**Depends on**: T2, T8
**Reuses**: `web/src/features/categories/CategorySelect.tsx` and `hooks.ts` (`useCategories`); `web/src/features/import/ImportPreviewTable.tsx` (the `update` fallback must include `categoryId: row.categoryId`); `web/src/lib/api/types.ts`; `web/src/features/import/ImportPage.test.tsx`, `ImportPreviewTable.test.tsx`
**Requirement**: IMPIMP-03, IMPIMP-14

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Unit tests: `initialSelection` sets each row's `categoryId` from the preview; `selectedPayload` sends `{ index, neutral, categoryId }` with the default and with a chosen category, and only for selected selectable rows (AC 4)
- [ ] Table test: every new, duplicate and unrecognized row shows a select with the user's category names pre-selected on the row's `categoryId`; ignored and invalid rows show the `categoryName` text with no select (AC 1 and 2)
- [ ] Table test: choosing another category on one row changes only that row; the selection and the "Neutra" switch of that row and the other rows are unchanged; editing the "Neutra" switch of a row absent from the selection keeps its `categoryId` (AC 3)
- [ ] Page test: confirming after a category change posts `selections` with `categoryId` of the chosen category for that row and of the preview default for the others (AC 4)
- [ ] Table test: while categories load the select is disabled with "Carregando categorias…"; when the categories request fails the column shows the `categoryName` text and the confirm still posts the preview `categoryId`s (AC 5 and 6, L-013)
- [ ] `CategoryOptionLabel` is the only place that renders an option's content, used by the select items and the displayed value (AC 7); the existing category-select usages in the extrato and forms are unchanged and their tests pass
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 10 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): choose the category of each row in the import preview`

---

### T10: Ask before importing duplicate rows

**What**: `DuplicateConfirmDialog` (AlertDialog, "Importar mesmo assim" and "Voltar") and the page logic: "Confirmar importação" opens the dialog when `selectedDuplicateCount` is above zero and imports directly otherwise; the retry of the failure alert imports without the dialog; the button stays disabled while confirming.
**Where**: `web/src/features/import/ImportPage.tsx`
**Depends on**: T9
**Reuses**: `web/src/features/import/DuplicateConfirmDialog.tsx` (new, with its own test); `web/src/features/import/previewSelection.ts` (`selectedDuplicateCount`); `web/src/components/ui/alert-dialog.tsx`; `web/src/features/import/ImportPage.test.tsx`
**Requirement**: IMPIMP-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Unit test of `selectedDuplicateCount`: counts only selected rows with status `duplicate`; new, unrecognized and unselected duplicates do not count
- [ ] Page test: with one duplicate selected, "Confirmar importação" opens the dialog "Importar linhas duplicadas?" with "1 linha selecionada já foi importada antes" and no confirm request is sent; with 3 it shows "3 linhas selecionadas já foram importadas antes" (AC 1 and 6)
- [ ] Page test: with no duplicate selected, clicking the button posts `/imports/confirm` directly and no dialog appears (AC 2)
- [ ] Page test: "Importar mesmo assim" posts the confirm exactly once with the same selections and the same idempotency key as a later retry would use (AC 3)
- [ ] Page test: "Voltar" and the Escape key close the dialog, send nothing and keep the selection, the chosen categories and the "Neutra" switches (AC 4)
- [ ] Page test: while the confirm is pending the "Confirmar importação" button is disabled and a second click opens no dialog and sends no second request; after a failure, "Tentar novamente" re-posts with the same key and without the dialog (AC 5 and 7)
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): confirm before importing duplicate rows`

---

### Phase 4: Web imported files

### T11: Add the imported-files data layer to the web

**What**: Hand-written types (`ImportedFile`), `apiRequestBlob` in the API client (same token, `X-Timezone`, 401 and `ApiError` mapping as `apiRequest`, returns `Blob`), `listImports`, `downloadImportFile`, `fileFromBlob`, the hooks `useImportedFiles`, `useDownloadImport`, `useReimportFile`, the `["imports"]` invalidation on a successful confirm, and the Portuguese messages for `storage_error`, `storage_not_configured` and `invalid_category`.
**Where**: `web/src/features/import/api.ts`
**Depends on**: T5
**Reuses**: `web/src/lib/api/client.ts` (shared request code with `apiRequest`); `web/src/lib/api/types.ts`; `web/src/features/import/useImport.ts`; `web/src/lib/api/errorMessages.ts`; `web/src/features/import/errorMessages.ts`; `web/src/lib/api/client.test.ts`, `errorMessages.test.ts`, `useImport.test.tsx`
**Requirement**: IMPIMP-14, IMPIMP-15

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `apiRequestBlob` sends the bearer token and `X-Timezone`, returns the response `Blob` on 200, throws `ApiError` with the API code on an error body, throws `unexpected_error` on a non-JSON error, and signs the user out on 401 like `apiRequest` (client test) (AC 2 of the contract story)
- [ ] `listImports` calls `GET /imports`, `downloadImportFile` calls `GET /imports/:id/file` through `apiRequestBlob`, `fileFromBlob` returns a `File` with the original name and mime type and the blob's bytes
- [ ] `useImportedFiles` loads the list under the `["imports"]` key; a successful confirm invalidates `["imports"]` and `["transactions"]` (hook tests)
- [ ] `messageForError` returns "Não foi possível acessar o arquivo guardado. Tente novamente." for `storage_error` and "O armazenamento de arquivos não está disponível no momento." for `storage_not_configured` in the `import` context; `importErrorMessage` returns "Há linhas com categoria inválida. Gere a prévia de novo." for `invalid_category` and the shared messages for the storage codes; none falls to the generic text and none returns the API `message` (AC 4 and 5)
- [ ] `yarn --cwd web typecheck` passes with `ImportedFile`, `PreviewRow.categoryId` and `ImportSelection.categoryId` matching `api/openapi.json`
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 12 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the imported files api, hooks and messages`

---

### T12: Mock the import endpoints in memory

**What**: In-memory handlers for `GET /imports` (2 seeded batches, newest first), `GET /imports/:id/file` (a CSV `Blob`), `POST /imports/preview` and `POST /imports/confirm` (adds a new batch at the top); `apiRequestBlob` returns the handler's `Blob` in mock mode; the area key `import` becomes `imports` so it matches `/imports/...`.
**Where**: `web/src/lib/api/mock/import.ts`
**Depends on**: T11
**Reuses**: `web/src/lib/api/mock/index.ts` (`pathAreaMap`, `mockApiError`, `MockHandler`); `web/src/lib/api/mock/accounts.ts`, `categories.ts`; `web/src/lib/api/mock/transactions.test.ts` (test style)
**Requirement**: IMPIMP-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `areaFromPath("/imports/preview")` and `areaFromPath("/imports")` return `imports`, and with `VITE_MOCK_AREAS=imports` only the import routes are mocked (AC 3 of the contract story)
- [ ] `GET /imports` returns the seeded batches newest first with the `ImportedFile` shape and an account nickname from the mock accounts; the mock confirm adds a new batch that the next list call returns first
- [ ] `GET /imports/:id/file` returns a `Blob` with the CSV text; an unknown id throws a mock `not_found` error with status 404
- [ ] `POST /imports/preview` returns an `ImportPreview` whose rows carry `categoryId` of mock categories and the 8 methods' labels remain valid; a file whose content matches a seeded batch marks those rows `duplicate`
- [ ] `POST /imports/confirm` honors `selections` (counts imported and skipped, ignores `categoryId` validity except an unknown id, which throws `invalid_category` 422) and returns a `ImportConfirmResult`
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): mock the import endpoints in memory`

---

### T13: List the imported files with Baixar and Reimportar

**What**: `ImportedFilesList` (skeleton, empty, error with retry, one row per file with "Baixar" and "Reimportar", per-row disabled state, `role="alert"` for action errors) shown in the "Conta e arquivo" step; `ImportPage` gets `reimport(file)`: download the Blob, build the `File`, set the batch's account and file, and generate the preview through the normal `POST /imports/preview`; the download button saves the Blob with the original name through an object URL.
**Where**: `web/src/features/import/ImportedFilesList.tsx`
**Depends on**: T11, T12, T10
**Reuses**: `web/src/features/import/ImportPage.tsx` (`generatePreview`, step state, `useIdempotencyKey`); `web/src/features/import/api.ts` and `useImport.ts` (T11); `web/src/components/ui/skeleton.tsx`, `alert.tsx`, `button.tsx`; `web/src/features/import/labels.ts` (`formatLocalDate`) and `web/src/lib/format.ts` (`formatDateLocal`); `web/src/features/import/ImportPage.test.tsx`
**Requirement**: IMPIMP-11, IMPIMP-12, IMPIMP-13

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] List test: each file shows its filename, the account nickname, the date as `dd/mm/aaaa`, "N importadas · M ignoradas" with singular and plural, and the buttons "Reimportar" and "Baixar"; the section is shown only in the "Conta e arquivo" step (AC 1)
- [ ] List test: while loading it shows 3 skeleton rows; with no files it shows "Nenhum arquivo importado ainda." and no buttons; on a list error it shows the Portuguese message from `messageForError(error, "import")` (storage and generic cases) and "Tentar novamente" refetches (AC 2, 3 and 4, L-013)
- [ ] Download test: "Baixar" requests `GET /imports/:id/file` with the authenticated client, creates an object URL, triggers an anchor with `download` equal to the original filename and revokes the URL; no token or Storage path appears in the URL; the row buttons are disabled while it runs; a failure shows the Portuguese alert without the API text (AC 5, 6 and 7)
- [ ] Reimport test: "Reimportar" downloads the file, posts `/imports/preview` with a `File` of the original name and type and the batch's `accountId`, and shows the "Prévia" step with the account selected; the preview's duplicates start unselected; confirming posts the same `File` to `/imports/confirm` with a new idempotency key and the `selections` payload (AC 8 and 9)
- [ ] Reimport failure tests: a failed download keeps the start step and shows the list alert with no preview request (AC 10); a preview failure (`invalid_account`) keeps the start step with the account and file filled and shows "Selecione uma conta ativa" in the form (AC 11, L-013); a file name without `.csv` is accepted (edge case)
- [ ] After a successful confirm, returning to the start step shows the new batch (the `["imports"]` query is invalidated and refetched) (AC 12)
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [ ] Browser check against the local API recorded in the commit body: import a file, see it in "Arquivos importados", "Baixar" saves an identical CSV, "Reimportar" opens the preview in the right account with the rows as "Duplicada", "Selecionar todas" then "Confirmar importação" shows the duplicates dialog, and category, value colors and the missing "Tipo" column are as specified
- [ ] Test count: the existing web tests plus about 16 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: build

**Commit**: `feat(web): list imported files with download and reimport`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2
Phase 2:  T3, T4 (independent), then T5 (after T3 and T4); T6 dropped
Phase 3:  T7 ------→ T8 ------→ T9 ------→ T10
Phase 4:  T11, then T12 (after T11), then T13 (after T11 and T12)
```

T4 also depends on T1, T9 on T2 and T13 on T10 (earlier phases).

Execution is strictly sequential - there is no intra-phase parallelism; T3 and T4 are independent, so their order is free.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: extract the preview analysis | 1 module move, no behavior change | ✅ Granular |
| T2: category per selected row | 1 contract change through preview, selections parsing and confirm | ✅ Granular |
| T3: Storage download | 1 function | ✅ Granular |
| T4: list imported files | 1 endpoint (plus the shared lookup) | ✅ Granular |
| T5: download imported file | 1 endpoint (plus 1 pure header helper) | ✅ Granular |
| T6: dropped | - | n/a |
| T7: select all | 1 header control with 2 pure helpers | ✅ Granular |
| T8: value color and no type column | 1 helper pair applied to the preview (and the extrato) | ✅ Granular |
| T9: category select per row | 1 choice field through state, payload and one column | ✅ Granular |
| T10: duplicate dialog | 1 component and its page logic | ✅ Granular |
| T11: data layer | 1 client function set, hooks and messages | ✅ Granular |
| T12: mocks | 1 mock module | ✅ Granular |
| T13: list UI and reimport | 1 component and its page wiring | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | None | none | ✅ Match |
| T4 | T1 | T1 (previous phase) | ✅ Match |
| T5 | T3, T4 | T3, T4 | ✅ Match |
| T6 | Dropped | none | ✅ Match |
| T7 | None | none | ✅ Match |
| T8 | T7 | T7 | ✅ Match |
| T9 | T2, T8 | T8 (T2 in an earlier phase) | ✅ Match |
| T10 | T9 | T9 | ✅ Match |
| T11 | T5 | T5 (previous phase) | ✅ Match |
| T12 | T11 | T11 | ✅ Match |
| T13 | T11, T12, T10 | T11, T12 (T10 in an earlier phase) | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: extract preview | API routes and import pipeline (move) | integration | integration | ✅ OK |
| T2: category per row | API pure logic (selections) and API routes | unit + integration | integration (unit tests in Done when) | ✅ OK |
| T3: Storage download | API pure logic (Storage helper, mocked fetch) | unit | unit | ✅ OK |
| T4: list files | API routes, SQL, OpenAPI | integration | integration | ✅ OK |
| T5: download file | API pure logic (header helper) and API routes | unit + integration | integration (unit tests in Done when) | ✅ OK |
| T6: dropped | - | - | - | ✅ OK |
| T7: select all | Web pure helpers and components | unit | unit | ✅ OK |
| T8: value color | Web pure helpers and components | unit | unit | ✅ OK |
| T9: category select | Web helpers, components and hand-written types | unit | unit | ✅ OK |
| T10: duplicate dialog | Web components and page | unit | unit | ✅ OK |
| T11: data layer | Web client, hooks, messages, types | unit | unit | ✅ OK |
| T12: mocks | Web mocks | unit | unit | ✅ OK |
| T13: list UI and reimport | Web components and page | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| IMPIMP-01 | T2 |
| IMPIMP-02 | T2 |
| IMPIMP-03 | T9 |
| IMPIMP-04 | T7 |
| IMPIMP-05 | T8 |
| IMPIMP-06 | T10 |
| IMPIMP-07 | T4 |
| IMPIMP-08 | T3, T5 |
| IMPIMP-09 | T1, T5 |
| IMPIMP-10 | T4, T5 |
| IMPIMP-11 | T13 |
| IMPIMP-12 | T13 |
| IMPIMP-13 | T13 |
| IMPIMP-14 | T2, T4, T5, T9, T11, T12 |
| IMPIMP-15 | T11 |

**Notes for the worker**: `api/openapi.json` is regenerated by `pnpm -C api openapi:export` (T2, T4, T5), never edited by hand. The Storage download uses the user's token only; the service key appears only in test helpers that clean up or remove objects. Never return, log or put in a test expectation a storage path in a client-facing response. The web does not call `POST /imports/:id/preview`; it reuses `POST /imports/preview` and `POST /imports/confirm` with the downloaded `File` (design decision: one confirm path). `CategoryOptionLabel` must stay the single place that renders a category option so the colors-and-icons feature can swap it for the badge. Do not commit `references/nubank_extrato_setembro.csv`.

# Extrato: UX e descrição Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transactions-ux/design.md`
**Status**: Draft

**Feature prerequisites**: front-fixes complete (`messageForError` exists); migrations 0001 to 0006 applied. Branch `feat/transactions-ux`; the next feature (import-fixes) stacks on this one and shares migration `0007`.

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`) and the `package.json` scripts; no `AGENTS.md` or `CONTRIBUTING.md` - strong defaults applied. Floor taken from the existing tests (`api/test/transactions*.int.test.ts`, `web/src/features/transactions/*.test.tsx`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (validators, helpers) | unit | All branches; 1:1 to spec ACs; every listed edge case | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, SQL rules, migrations/RLS | integration | Every route touched: happy path + every listed edge case + error paths; constraints and RLS exercised | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; failure paths assert the Portuguese text and visible options (L-013) | `web/src/**/*.test.tsx`, `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web mocks and generated or hand-written API types | unit when behavior (mock handlers); none for types | Mock handlers behave like the API for `description`; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
| Config / scaffold | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After web tasks with unit tests only | `yarn --cwd web test` |
| Full | After API tasks with integration tests (needs `supabase start`) | `pnpm -C api test` |
| Build | After phase completion | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. Phases 1 and 2 (6 tasks) form the first worker batch; phases 3 and 4 (5 tasks) the second.

### Phase 1: Shared building blocks

```
T1
T2
```

### Phase 2: Extrato filters, toasts and form

```
T2 → T3
T3 → T4
T1 → T5
T4 → T5
T1 → T6
T2 → T6
```

### Phase 3: Description backend

```
T7 → T8
```

### Phase 4: Description in the web

```
T8 → T9
T9 → T10
T5 → T10
T9 → T11
T6 → T11
```

---

## Task Breakdown

### Phase 1: Shared building blocks

### T1: Create the notify helper and mount the Toaster

**What**: `notifySuccess(message)` and `notifyError(error, context)` over `sonner`, the error text always from `messageForError`; mount `<Toaster />` once in `RootComponent`.
**Where**: `web/src/lib/notify.ts`
**Depends on**: None
**Reuses**: `web/src/components/ui/sonner.tsx`, `web/src/lib/api/errorMessages.ts`
**Requirement**: TUX-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] `notifySuccess` calls `toast.success` with the exact text and `notifyError` calls `toast.error` with `messageForError(error, context)` (AC 2)
- [x] An unknown code, a network error and a non-ApiError value show "Não foi possível concluir a operação. Tente novamente." and the API `message` is never used (AC 3)
- [x] `RootComponent` in `web/src/routes/__root.tsx` renders `<Toaster />` once; a test renders it and finds exactly one "Notifications" region (AC 1)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 5 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): add the notify helper and mount the toaster`

---

### T2: Create the DatePicker component

**What**: `DatePicker` (Popover + Calendar, locale `ptBR`, clearable) with a `YYYY-MM-DD` string value and the pure helpers `parseLocalDate` and `formatLocalDate`; no `toISOString` or ISO-string `Date` parsing.
**Where**: `web/src/components/ui/date-picker.tsx`
**Depends on**: None
**Reuses**: `web/src/components/ui/calendar.tsx`, `web/src/components/ui/popover.tsx`, `web/src/components/ui/button.tsx`
**Requirement**: TUX-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Picking a day calls `onChange` with the exact `YYYY-MM-DD`, including `2026-12-31` and `2027-01-01`, under a non-UTC `TZ` (AC 2 and 3)
- [x] "Limpar" calls `onChange("")` and only shows when there is a value (AC 1 and 4)
- [x] A disabled picker does not open the calendar and shows the received value; an empty value shows "Selecione a data" (AC 5 and 6)
- [x] An invalid string is treated as empty; the trigger keeps the `id` so `getByLabelText` finds it (edge case)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 8 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): add the date picker component`

---


### Phase 2: Extrato filters, toasts and form

### T3: Use the DatePicker in the extrato filters and hide the Tipo column

**What**: Reproduce the filled De/Até in the browser, then replace the two `type="date"` inputs with `DatePicker` (empty initial state and after "Limpar filtros"), remove the Tipo column and the Tipo field of the mobile card, and update the existing filter tests to the picker interaction.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T2
**Reuses**: `web/src/features/transactions/extratoFilters.test.tsx`
**Requirement**: TUX-01, TUX-02, TUX-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] The first query has no `from` or `to` and De/Até show "Selecione a data"; the same after "Limpar filtros" (AC 7 and 8 of the DatePicker story)
- [x] Choosing a day in De or Até queries with `from`/`to` equal to that string and goes back to page 1 (AC 9)
- [x] No "Tipo" column header or cell in the table and no Tipo field in the mobile card; the Tipo filter still sends `type` (AC 1 and 2 of the quick-filter story)
- [x] The browser check against the local API is recorded in the commit body (cause of the filled inputs)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: the existing filter tests plus 4 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): use the date picker in the filters and hide the type column`

---

### T4: Add the quick month and year filter

**What**: `monthRange` and `applyDateFilter` in utils, plus the Mês/Ano selects and the "Limpar mês" button in the extrato: from/to set to the month, De/Até disabled while active, picking a date or clearing resets it.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T3
**Reuses**: `web/src/features/transactions/utils.ts`, `SimpleSelect` in the page
**Requirement**: TUX-07

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] `monthRange` returns the first and last day, including `2028-02-29`, `2027-02-28`, 30-day and 31-day months and December (AC 3 and 4)
- [x] Choosing month and year queries with the range on page 1 and disables De/Até showing the dates; only month or only year does not query (AC 3, 5 and 6)
- [x] "Limpar mês" removes the quick filter and `from`/`to`; "Limpar filtros" clears it too (AC 7 and 8)
- [x] `applyDateFilter` clears the quick filter and keeps the date; changing the page keeps the month range (AC 9 and edge case)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 9 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): add the quick month and year filter`

---

### T5: Replace the extrato action alert with toasts

**What**: Bulk category, single-row category, neutral switch and delete use `notifySuccess`/`notifyError`; remove `actionError` and its `role="alert"`; update the tests that depended on the alert and on the fixed category text.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T1, T4
**Reuses**: `web/src/features/transactions/extratoInline.test.tsx`, `web/src/features/transactions/extratoCrud.test.tsx`
**Requirement**: TUX-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Bulk success emits "Categoria aplicada a 1 transação" for one row and "Categoria aplicada a N transações" for more; bulk failure emits the mapped error and keeps the selection and categories (AC 4 and 5)
- [x] Single-row category success emits "Categoria atualizada"; failure restores the previous category and emits the mapped error text (AC 6 and 7)
- [x] A failing neutral switch goes back and emits the mapped error (AC 8)
- [x] Delete success emits "Transação excluída" and failure keeps the row and emits the mapped error text; cancel emits nothing (AC 12 and 13)
- [x] No `role="alert"` action error remains on the page (AC 14); `sonner` is mocked and the exact Portuguese text is asserted for each failure
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 9 tests added or updated pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): show toasts for the extrato actions`

---

### T6: Use the DatePicker and toasts in the transaction form

**What**: `DatePicker` in the Data field, `todayLocal()` as the default date computed on open, `notifySuccess` ("Transação criada"/"Transação atualizada") after closing and `notifyError` on failure besides the inline field error.
**Where**: `web/src/features/transactions/TransactionForm.tsx`
**Depends on**: T1, T2
**Reuses**: `web/src/features/transactions/utils.ts`, `web/src/features/transactions/extratoCrud.test.tsx`
**Requirement**: TUX-04, TUX-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] `todayLocal` returns the local day (fake timer at 23:30 in `America/Sao_Paulo` still returns that day) and the create form opens with it (AC 11)
- [x] Choosing a day in the form sends `occurredAt` at local noon of that day; submitting without a date shows "Informe a data" (AC 10 and 12)
- [x] Create and edit success close the dialog and emit "Transação criada" and "Transação atualizada" (AC 9 and 10 of the toast story)
- [x] A failing create or edit keeps the dialog open, keeps the inline field error when the API sends `field`, and emits the mapped error text (AC 11)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 8 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): use the date picker and toasts in the form`

---


### Phase 3: Description backend

### T7: Create the description and Other migration

**What**: Migration `0007` with two separate commented statements: `transactions.description text` nullable, and the `payment_method` check recreated with `'Other'` (constraint `transactions_payment_method_check`, looked up in 0003); extend the schema test.
**Where**: `supabase/migrations/0007_transactions_description.sql`
**Depends on**: None
**Reuses**: `api/test/transactions-schema.int.test.ts`
**Requirement**: TUX-08

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] `description` exists, is nullable and defaults to null on existing rows (AC 1)
- [x] A row with `payment_method` `'Other'` is accepted and a value outside the list is still rejected with `transactions_payment_method_check` (AC 2)
- [x] The file has two separated statements with comments naming transactions-ux and import-fixes
- [x] RLS still isolates rows with the new column (existing isolation tests pass)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 3 new tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-ux): add the transaction description column and the Other payment method`

---

### T8: Expose description in the transactions API

**What**: `description` in `TransactionSchema`, the row type, `selectColumns` and `toTransaction` (schema.ts), accepted in POST (trimmed, blank to null, max 500 after trim, 422 over the limit, 400 for a wrong type), ignored by PATCH; regenerate `api/openapi.json` with `pnpm -C api openapi:export`.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T7
**Reuses**: `optionalText` and `invalid` in `routes.ts`, `api/src/modules/transactions/schema.ts`, `api/openapi.json`
**Requirement**: TUX-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `description` is present (string or null) in list, create and edit responses and the response shape test lists it (AC 3)
- [x] POST trims it, stores null for blank, whitespace-only and null, and null when omitted; 500 characters are accepted and 501 returns 422 `validation_error` with field `description` without creating the row (AC 4, 5, 6 and edge cases)
- [x] POST with a number returns 400 `validation_error` (AC 7)
- [x] PATCH with `description` returns 200, leaves the stored value unchanged also when `name` changes in the same body (AC 8)
- [x] Another user cannot read the `description` of the first user (AC 9)
- [x] `api/openapi.json` regenerated: `description` in Transaction and POST body, not in the PATCH body, `swagger.int.test.ts` passes (AC 10)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 9 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-ux): expose the transaction description in the API`

---


### Phase 4: Description in the web

### T9: Add description to the web types and the transactions mock

**What**: `description: string | null` in `Transaction` (types.ts; `TransactionInput` and `TransactionUpdate` unchanged) and the mock: seed with some descriptions, POST keeps it trimmed (blank to null), PATCH ignores it.
**Where**: `web/src/lib/api/mock/transactions.ts`
**Depends on**: T8
**Reuses**: `web/src/lib/api/types.ts`, `hydrate` in the mock
**Requirement**: TUX-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] The mock returns `description` in list and create, trims it and stores null for blank (AC 14)
- [ ] A PATCH with `description` leaves the stored value unchanged (AC 14)
- [ ] `TransactionInput` and `TransactionUpdate` have no `description` and `yarn --cwd web typecheck` passes (AC 13)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): add the description to the web types and mock`

---

### T10: Show the description below the name in the extrato

**What**: Second line in the name cell (table) and under the name (mobile card): `text-xs text-muted-foreground`, one-line truncation with `title`, nothing when null.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T9, T5
**Reuses**: `web/src/features/transactions/extratoFilters.test.tsx`
**Requirement**: TUX-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] A row with `description` shows it below the name in the same cell with the muted small classes and the full text in `title` (AC 11)
- [ ] A row without `description` renders no extra element in the name cell and the card
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): show the description in the extrato`

---

### T11: Show the description as a read-only subtitle in the edit modal

**What**: `DialogDescription` shows the transaction `description` when editing and it exists; no field for it, create mode shows nothing, and the body sent never contains `description`.
**Where**: `web/src/features/transactions/TransactionForm.tsx`
**Depends on**: T9, T6
**Reuses**: `web/src/features/transactions/extratoCrud.test.tsx`
**Requirement**: TUX-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Editing a transaction with `description` shows it as plain text under the title and there is no input or textarea for it (AC 12)
- [ ] Editing one without `description` and creating a new one show the default subtitle and no description element (AC 12)
- [ ] The PATCH and POST bodies sent by the form have no `description` key (AC 13)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux): show the description in the edit modal`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1, T2 (independent)
Phase 2:  T3 ------→ T4 ------→ T5   (T6 after T1 and T2)
Phase 3:  T7 ------→ T8
Phase 4:  T9 ------→ T10  (T11 after T9 and T6)
```

Execution is strictly sequential - there is no intra-phase parallelism.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: notify helper and Toaster mount | 1 function module (+ one-line mount) | ✅ Granular |
| T2: DatePicker | 1 component | ✅ Granular |
| T3: filters with DatePicker, hide Tipo | 1 file, cohesive (filter inputs and one column) | ✅ Granular |
| T4: quick month/year filter | 1 feature in the page, plus 2 pure helpers | ✅ Granular |
| T5: toasts in the extrato | 1 file, 4 handlers | ✅ Granular |
| T6: form date picker and toasts | 1 file | ✅ Granular |
| T7: migration | 1 file | ✅ Granular |
| T8: description in the API | 1 field through schema, routes and OpenAPI | ✅ Granular |
| T9: web types and mock | 1 field through type and mock | ✅ Granular |
| T10: description in the extrato | 1 display change | ✅ Granular |
| T11: description in the modal | 1 display change | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | None | none | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 | ✅ Match |
| T5 | T1, T4 | T1, T4 | ✅ Match |
| T6 | T1, T2 | T1, T2 | ✅ Match |
| T7 | None | none | ✅ Match |
| T8 | T7 | T7 | ✅ Match |
| T9 | T8 | T8 | ✅ Match |
| T10 | T9, T5 | T9, T5 | ✅ Match |
| T11 | T9, T6 | T9, T6 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: notify helper | Web helpers | unit | unit | ✅ OK |
| T2: DatePicker | Web components | unit | unit | ✅ OK |
| T3: filters | Web components | unit | unit | ✅ OK |
| T4: quick filter | Web components and helpers | unit | unit | ✅ OK |
| T5: toasts | Web components | unit | unit | ✅ OK |
| T6: form | Web components | unit | unit | ✅ OK |
| T7: migration | Migrations/RLS | integration | integration | ✅ OK |
| T8: API | Routes and schema | integration | integration | ✅ OK |
| T9: types and mock | Mock handlers (behavior) and types | unit | unit | ✅ OK |
| T10: extrato description | Web components | unit | unit | ✅ OK |
| T11: modal description | Web components | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| TUX-01 | T3 |
| TUX-02 | T3 |
| TUX-03 | T1 |
| TUX-04 | T5, T6 |
| TUX-05 | T2 |
| TUX-06 | T3, T6 |
| TUX-07 | T4 |
| TUX-08 | T7 |
| TUX-09 | T8 |
| TUX-10 | T9, T10, T11 |

**Notes for the worker**: the `Other` payment method is only in the migration here; the API and web enums stay unchanged until import-fixes. `api/openapi.json` is regenerated in T8 and not edited by hand.

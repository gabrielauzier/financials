# Transações Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transactions/design.md`
**Status**: Draft

**Feature prerequisites**: auth and accounts-categories complete.

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

### Phase 1: Schema, validation and create

```
T1 → T3
T2 → T3
```

### Phase 2: Read: list, filters, search, sort

```
T4 → T5
T4 → T6
T4 → T7
```

### Phase 3: Mutations and integrity

```
T8 → T12
T9 → T12
T10 → T12
```

### Phase 4: Web: formatting and listing (substituída pelo Lovable, ver lovable.md)
```
T13 → T15
T14 → T15
T13 → T16
```

### Phase 5: Web: editing (substituída pelo Lovable, ver lovable.md)
```
T17 → T21
T18 → T21
T19 → T21
T20 → T21
```

---

## Task Breakdown

### Phase 1: Schema, validation and create

### T1: Create the transactions migration

**What**: Migration `0003`: `unaccent` extension, `transactions` table with composite FKs, check constraints, three indexes and RLS.
**Where**: `supabase/migrations/0003_transactions.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-04

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Amount `0`, negative and 3-decimal values are rejected by the table
- [x] A transaction cannot reference another user's account or category
- [x] Invalid type or payment method is rejected
- [x] RLS isolates rows between two users (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): create the transactions migration`

---

### T2: Create the transaction validators

**What**: `parseAmount` (`^\d{1,12}(\.\d{1,2})?$`, greater than zero) and `parseReceiptUrl` (http/https only).
**Where**: `api/src/modules/transactions/validation.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Valid amounts pass, including `0.01` and 12-digit integers
- [x] Zero, negative, 3 decimals, 13 integer digits and non-numeric input are rejected
- [x] `http` and `https` URLs pass; `ftp`, `javascript:` and plain text are rejected (6 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): create the transaction validators`

---

### T3: Add the create transaction endpoint

**What**: `POST /transactions` validates required fields, active owned account, category default `Uncategorized`, stores `uuid`, amount positive with type deciding direction.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T1, T2
**Reuses**: -
**Requirement**: TXN-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Valid payload returns 201 with a uuid and category Sem categoria when none is given
- [x] Invalid amount, empty required field, inactive account, other user's account and invalid receipt URL are rejected with 422
- [x] `identifier` stays empty for manual rows (6 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the create transaction endpoint`

---

### Phase 2: Read: list, filters, search, sort

### T4: Add the list transactions endpoint with pagination

**What**: `GET /transactions` returns `{ items, total, page, pageSize: 50 }` ordered by date descending, tie-break by id, with all display fields.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: TXN-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] 120 rows return page 1 with 50 items and `total` 120; page 3 has 20
- [x] Default order is date descending and stable across pages
- [x] Another user's rows never appear (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the list transactions endpoint with pagination`

---

### T5: Add transaction list filters

**What**: Filters `from`/`to` (local dates converted with `request.tz`), `accountId`, `categoryId`, `type`, `neutral`, combined with AND.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T4
**Reuses**: -
**Requirement**: TXN-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Each filter alone and combined returns only matching rows
- [x] `from`/`to` include the whole local day at both edges in `America/Sao_Paulo`
- [x] `neutral=true` and `neutral=false` filter correctly (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add transaction list filters`

---

### T6: Add transaction name search

**What**: `q` matches names containing the text, ignoring case and accents via `unaccent`.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T4
**Reuses**: -
**Requirement**: TXN-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `cafe` matches `Café Central` and `CAFE`
- [x] Non-matching text returns an empty page (2 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add transaction name search`

---

### T7: Add transaction sorting

**What**: `sort` ∈ date, name, amount, category with `order`; sorts the whole result set with id tie-break.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T4
**Reuses**: -
**Requirement**: TXN-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sorting by each column orders the entire set, not only the page
- [x] Invalid `sort` returns 422 (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add transaction sorting`

---

### Phase 3: Mutations and integrity

### T8: Add the edit transaction endpoint

**What**: `PATCH /transactions/:id` edits editable fields (including `neutral`) preserving the rest.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: TXN-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Edited fields persist and the others are unchanged
- [x] Same validations as create apply
- [x] Toggling `neutral` persists
- [x] Unknown and other user's id return 404; edits on an inactive account's transaction are allowed (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the edit transaction endpoint`

---

### T9: Add the delete transaction endpoint

**What**: `DELETE /transactions/:id` removes the row.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: TXN-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Existing row is removed and no longer listed
- [ ] Unknown and other user's id return 404 (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the delete transaction endpoint`

---

### T10: Add the bulk category endpoint

**What**: `PATCH /transactions/category` with `{ ids[], categoryId }` in one `UPDATE`; any unknown id aborts everything.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: TXN-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] All listed rows get the category in one operation
- [ ] One unknown or foreign id returns 404 and no row changes
- [ ] Unknown category returns 422 (3 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the bulk category endpoint`

---

### T11: Register transactions in category reassignment

**What**: Add `transactions` to the category-delete reference registry.
**Where**: `api/src/modules/categories/registry.ts`
**Depends on**: T3
**Reuses**: Registry created in accounts-categories T10.
**Requirement**: TXN-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Deleting a category with `reassignTo` moves its transactions to the destination and the table shows the destination name
- [ ] Failure keeps rows unchanged (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): register transactions in category reassignment`

---

### T12: Add the transactions isolation test

**What**: Cross-user test over create, list, patch, delete and bulk.
**Where**: `api/test/transactions-isolation.int.test.ts`
**Depends on**: T3, T8, T9, T10
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] User B gets 404 on every mutation of user A's rows
- [ ] User B's list never includes user A's rows (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions): add the transactions isolation test`

---

### Phase 4: Web: formatting and listing (substituída pelo Lovable, ver lovable.md)
### T13: Create the formatting helpers

**What**: `formatBRL('1234.56')` -> `R$ 1.234,56` and `formatDateLocal(iso)` in the browser's timezone, string-based (no float money math).
**Where**: `web/src/lib/format.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Formats thousands, cents, negative and zero values
- [ ] Dates near midnight UTC render the correct local day (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): create the formatting helpers`

---

### T14: Create the transactions hook

**What**: `useTransactions(params)` mapping filters, search, sort and page to the endpoint with a stable query key.
**Where**: `web/src/features/transactions/useTransactions.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Params map to the right query string
- [ ] Changing a filter resets to page 1 (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): create the transactions hook`

---

### T15: Build the transactions table

**What**: Table with the columns from the spec, sortable headers, pagination, neutral indicator and the empty state 'Nenhuma transação encontrada'.
**Where**: `web/src/features/transactions/TransactionsTable.tsx`
**Depends on**: T13, T14
**Reuses**: -
**Requirement**: TXN-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] All columns render with BRL and local date
- [ ] Clicking a header changes sort and order
- [ ] Empty result shows 'Nenhuma transação encontrada'
- [ ] Neutral rows show the visual indicator (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): build the transactions table`

---

### T16: Build the filters and search bar

**What**: Period, account, category, type and neutral filters plus a debounced search box.
**Where**: `web/src/features/transactions/TransactionFilters.tsx`
**Depends on**: T13
**Reuses**: -
**Requirement**: TXN-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Each control emits the right params
- [ ] Search is debounced (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): build the filters and search bar`

---

### Phase 5: Web: editing (substituída pelo Lovable, ver lovable.md)
### T17: Build the transaction form

**What**: Create/edit form with required-field, amount and receipt-URL validation and account/category selects.
**Where**: `web/src/features/transactions/TransactionForm.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Empty required field shows the field error
- [ ] Zero, negative or 3-decimal amount shows the invalid-amount message
- [ ] Non-http URL shows the invalid-URL message
- [ ] Inactive accounts are not offered (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): build the transaction form`

---

### T18: Add inline category editing

**What**: Category selector in each row with optimistic update, rollback and error message on failure.
**Where**: `web/src/features/transactions/useUpdateCategory.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Selecting a category saves without opening a form
- [ ] A failed save restores the previous category and shows an error (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): add inline category editing`

---

### T19: Add bulk category selection

**What**: Row checkboxes and an 'apply category' action calling the bulk endpoint, with all-or-nothing error handling.
**Where**: `web/src/features/transactions/BulkCategoryBar.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-07

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Selected rows receive the chosen category in one call
- [ ] Failure keeps every row with the previous category (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): add bulk category selection`

---

### T20: Add the neutral toggle

**What**: Toggle in the row and in the form persisting `neutral`.
**Where**: `web/src/features/transactions/NeutralToggle.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: TXN-08

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Toggling calls the update and shows the new state
- [ ] Failure reverts the toggle (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): add the neutral toggle`

---

### T21: Wire the transactions page

**What**: Page composing filters, table, form dialog, delete confirmation, bulk bar and neutral toggle.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T15, T16, T17, T18, T19, T20
**Reuses**: -
**Requirement**: TXN-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Create, edit and delete flows work with a mocked API
- [ ] Delete asks for confirmation and cancelling keeps the row (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): wire the transactions page`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

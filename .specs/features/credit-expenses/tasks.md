# Despesas de Cartão Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/credit-expenses/design.md`
**Status**: Draft

**Feature prerequisites**: auth and accounts-categories complete; import complete (migration ordering 0004 before 0005).

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

### Phase 1: Credit expenses API

```
T1 → T2
T2 → T3
T2 → T4
T2 → T5
T2 → T6
T2 → T7
T3 → T7
T4 → T7
T5 → T7
```

### Phase 2: Web: credit expenses
```
T13 → T8
T8 → T9
T8 → T10
T8 → T11
T9 → T12
T10 → T12
T11 → T12
```

---

## Task Breakdown

### Phase 1: Credit expenses API

### T1: Create the credit expenses migration

**What**: Migration `0005`: `credit_expenses` with checks (total > 0, 0 ≤ paid ≤ total, day 1-31, status list), composite FKs and RLS.
**Where**: `supabase/migrations/0005_credit_expenses.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: CARD-01

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Each check constraint rejects its invalid value
- [x] Cross-user account/category references are rejected
- [x] RLS isolates rows (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): create the credit expenses migration`

---

### T2: Add the create credit expense endpoint

**What**: `POST /credit-expenses` validating amounts, day, status, active account; `paid_amount` defaults to 0.
**Where**: `api/src/modules/creditExpenses/routes.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: CARD-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Valid payload creates the row with `paidAmount` 0
- [x] Total ≤ 0, paid out of range, day outside 1-31, invalid status and inactive account return 422 (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): add the create credit expense endpoint`

---

### T3: Add the list credit expenses endpoint

**What**: `GET /credit-expenses?status=` with computed `remainingAmount`.
**Where**: `api/src/modules/creditExpenses/routes.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: CARD-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `remainingAmount` equals total minus paid (R$ 600,00 total, R$ 200,00 paid -> 400.00)
- [x] `status` filter returns only that status for each of the 5 statuses (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): add the list credit expenses endpoint`

---

### T4: Add the edit credit expense endpoint

**What**: `PATCH /credit-expenses/:id` edits any field including status in any direction; rejects lowering total below paid; never changes status or paid by itself.
**Where**: `api/src/modules/creditExpenses/routes.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: CARD-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Any status can be changed to any other status
- [x] Total below `paid_amount` returns 422 `invalid_paid_amount`
- [x] Editing one field preserves the others and does not touch status or paid (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): add the edit credit expense endpoint`

---

### T5: Add the delete credit expense endpoint

**What**: `DELETE /credit-expenses/:id`.
**Where**: `api/src/modules/creditExpenses/routes.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: CARD-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Existing row is deleted
- [x] Unknown and foreign ids return 404 (2 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): add the delete credit expense endpoint`

---

### T6: Register credit expenses in category reassignment

**What**: Add `credit_expenses` to the category-delete registry.
**Where**: `api/src/modules/categories/registry.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: CARD-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Deleting a category with `reassignTo` moves its credit expenses (1 test)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): register credit expenses in category reassignment`

---

### T7: Add the credit expenses isolation test

**What**: Cross-user test over create, list, patch and delete.
**Where**: `api/test/credit-expenses-isolation.int.test.ts`
**Depends on**: T2, T3, T4, T5
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] User B gets 404 on every mutation of user A's rows and never lists them (2 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(credit-expenses): add the credit expenses isolation test`

---

### Phase 2: Web: credit expenses
### T13: Add the credit expense error messages

**What**: Extend the shared error module with the `creditExpense` context and the codes `invalid_paid_amount` ("Valor pago inválido"), `invalid_day` ("Dia inválido (use de 1 a 31)"), `invalid_status` ("Status inválido"); in that context `invalid_amount` reads "Valor total inválido". Existing contexts and texts stay unchanged.
**Where**: `web/src/lib/api/errorMessages.ts`
**Depends on**: None
**Reuses**: existing `messageForError` and its tests
**Requirement**: CARD-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Each new code returns its Portuguese text and `invalid_amount` reads "Valor total inválido" only in the `creditExpense` context
- [x] The API `message` is still never returned and existing codes and contexts are unchanged (4 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): add the credit expense error messages`

---

### T8: Create the credit expenses hooks

**What**: `useCreditExpenses({ status })` and mutations with cache invalidation.
**Where**: `web/src/features/creditExpenses/hooks.ts`
**Depends on**: T13
**Reuses**: -
**Requirement**: CARD-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Hooks call the endpoints with the status filter
- [x] Mutations invalidate the list (2 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): create the credit expenses hooks`

---

### T9: Build the credit expenses table

**What**: Table with remaining amount and a status filter.
**Where**: `web/src/features/creditExpenses/CreditExpensesTable.tsx`
**Depends on**: T8
**Reuses**: -
**Requirement**: CARD-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Shows remaining amount per row
- [x] Status filter emits the chosen status (2 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): build the credit expenses table`

---

### T10: Build the credit expense form

**What**: Form with the field validations of the spec.
**Where**: `web/src/features/creditExpenses/CreditExpenseForm.tsx`
**Depends on**: T8
**Reuses**: -
**Requirement**: CARD-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Invalid total, paid and day show their messages
- [x] Valid data submits (3 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): build the credit expense form`

---

### T11: Build the status select

**What**: Select offering all 5 statuses with no transition restrictions.
**Where**: `web/src/features/creditExpenses/StatusSelect.tsx`
**Depends on**: T8
**Reuses**: -
**Requirement**: CARD-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] All 5 statuses are offered from any current status
- [x] Changing the status calls the update (2 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): build the status select`

---

### T12: Wire the credit expenses page

**What**: Page composing table, form dialog, status select and delete confirmation; the `/cartao` route renders it in place of the placeholder, inside `RequireAuth` and `AppLayout`.
**Where**: `web/src/features/creditExpenses/CreditExpensesPage.tsx`
**Depends on**: T9, T10, T11
**Reuses**: -
**Requirement**: CARD-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] Create, edit, status change and delete work with a mocked API
- [x] `web/src/routes/cartao.tsx` renders the page (3 tests)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(credit-expenses): wire the credit expenses page`

---

## Phase Execution Map

```
Phase 1 → Phase 2
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

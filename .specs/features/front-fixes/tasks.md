# Correções do Front Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/front-fixes/design.md`
**Status**: Draft

**Feature prerequisites**: api-server and import branches (web import screens and shared client exist).

---

## Test Coverage Matrix

> Generated from the approved design and spec - confirm before Execute. Guidelines found: none in the repo (greenfield; no `AGENTS.md`, `CONTRIBUTING.md` or test config) - strong defaults applied. Test stack taken from the approved designs: Vitest, local Supabase Postgres (`supabase start`), React Testing Library; package manager `pnpm` (assumption, confirm).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (parsers, validators, helpers) | unit | All branches; 1:1 to spec ACs; every listed edge case | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, services, SQL rules, migrations/RLS | integration | Every route: happy path + every listed edge case + error paths; RLS and constraints exercised | `api/test/**/*.int.test.ts` | `pnpm -C api test:int` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; error and empty states | `web/src/**/*.test.tsx` | `pnpm -C web test` |
| Scaffold / config / generated types | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the approved design - confirm before Execute. Commands do not exist yet; the scaffold tasks create them.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm -C api test:unit` (API tasks) / `pnpm -C web test` (web tasks) |
| Full | After tasks with integration tests (needs `supabase start`) | `pnpm -C api test` (unit + integration) |
| Build | After phase completion or scaffold/config-only tasks | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `pnpm -C web typecheck && pnpm -C web lint && pnpm -C web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Shared messages and screen fixes

```
T1 → T2
T1 → T3
T1 → T4
T4 → T5
```

### Phase 2: Sign-up, period and appearance

```
T7 → T8
```

### Phase 3: Statement UI tests and lockfile

```
T9 T10 T11 T12
```

---

## Task Breakdown

### Phase 1: Shared messages and screen fixes

### T1: Create the shared error message module

**What**: `messageForError(error, context)` and `fieldForError(error)` mapping every API code to Portuguese, never returning the API `message`; `GENERIC_ERROR` for unknown codes, network failures and non-ApiError values; the import module reuses it for the common codes.
**Where**: `web/src/lib/api/errorMessages.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: FIX-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Each code (`duplicate_name` per context, `holder_required`, `category_protected`, `reassign_required`, `invalid_amount`, `invalid_account`, `invalid_receipt_url`, `not_found`, `validation_error`, `unauthorized`) returns its Portuguese text
- [ ] Unknown code, `TypeError` and non-error values return `GENERIC_ERROR`
- [ ] The API `message` is never part of the result
- [ ] `fieldForError` returns the API `field` (7 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): create the shared error message module`

---

### T2: Use the messages in the accounts screens and handle activation errors

**What**: `AccountForm` and `AccountsPage` read errors through `messageForError`; a failed activate or deactivate keeps the dialog open with the message.
**Where**: `web/src/features/accounts/AccountsPage.tsx`
**Depends on**: T1
**Reuses**: -
**Requirement**: FIX-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] A failing activate or deactivate keeps the dialog open and shows the Portuguese message
- [ ] Duplicate nickname and missing holder still show their messages through the shared module
- [ ] No `error.message` or `reason.message` is read in the accounts feature (3 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): use the messages in the accounts screens and handle activation errors`

---

### T3: Use the messages in the categories screen

**What**: `CategoriesPage` reads create, rename and delete errors through `messageForError`.
**Where**: `web/src/features/categories/CategoriesPage.tsx`
**Depends on**: T1
**Reuses**: -
**Requirement**: FIX-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Duplicate name, protected category and reassign required show the Portuguese texts
- [ ] An unknown code shows the generic text
- [ ] No `error.message` or `reason.message` is read in the categories feature (3 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): use the messages in the categories screen`

---

### T4: Use the messages in the transactions screens

**What**: `TransactionForm` and `TransactionsPage` read form, inline, bulk, delete and neutral errors through `messageForError`, marking the form field when the API sends `field`.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T1
**Reuses**: -
**Requirement**: FIX-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] An `invalid_amount` with `field: amount` is shown on the amount field in Portuguese
- [ ] A `not_found` on the bulk call and a failed delete show Portuguese texts
- [ ] No `error.message` or `reason.message` is read in the transactions feature (3 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): use the messages in the transactions screens`

---

### T5: Send null when notes or receipt are cleared on edit

**What**: The edit submit sends `notes: null` and `receipt: null` when the user empties them, trimmed text otherwise; create keeps omitting empty fields.
**Where**: `web/src/features/transactions/TransactionForm.tsx`
**Depends on**: T4
**Reuses**: -
**Requirement**: FIX-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Emptying notes on edit sends `notes: null`
- [ ] Emptying the receipt on edit sends `receipt: null`
- [ ] Creating with empty notes and receipt omits both
- [ ] Filled values are sent trimmed and untouched fields keep their current values (4 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): send null when notes or receipt are cleared on edit`

---

### Phase 2: Sign-up, period and appearance

### T6: Detect an already registered e-mail by the confirmation timestamps

**What**: `isEmailAlreadyRegistered` also returns true for `user_already_exists`, for empty `identities` and when `confirmation_sent_at` is at least 1000 ms after `created_at`.
**Where**: `web/src/features/auth/emailExists.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: FIX-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Error code `user_already_exists` returns true
- [ ] Empty `identities` returns true
- [ ] A gap of 1000 ms or more returns true and a gap below 1000 ms returns false
- [ ] The sign-up form shows 'E-mail já cadastrado' on the e-mail field for the unconfirmed case (5 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): detect an already registered e-mail by the confirmation timestamps`

---

### T7: Validate an inverted period in the statement filters

**What**: The statement shows 'A data inicial deve ser anterior à final' and does not query the API when `from` is after `to`.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T5
**Reuses**: -
**Requirement**: FIX-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] From after to shows the message and sends no list request with that period
- [ ] Equal dates and a valid period query normally (2 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): validate an inverted period in the statement filters`

---

### T8: Show income amounts in green

**What**: Income values use `text-emerald-700` (light) and `text-emerald-400` (dark) and expenses stay red with a minus sign, in the table and in the mobile cards.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T7
**Reuses**: -
**Requirement**: FIX-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] An Income row has the green class and an Expense row the destructive class with a minus sign, in table and cards (2 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): show income amounts in green`

---

### Phase 3: Statement UI tests and lockfile

### T9: Test inline category, bulk and neutral flows

**What**: Interface tests for category change with rollback, bulk apply in one call with failure handling, and the neutral switch with rollback.
**Where**: `web/src/features/transactions/extratoInline.test.tsx`
**Depends on**: T4
**Reuses**: -
**Requirement**: FIX-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Choosing a category saves without a form and a forced failure restores the previous category with 'Não foi possível salvar a categoria'
- [ ] Two selected rows apply a category in one call with both ids; a failure keeps selection and categories
- [ ] The neutral switch persists and a failure reverts it (6 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): test inline category, bulk and neutral flows`

---

### T10: Test search, filters, sorting and pagination

**What**: Interface tests for the 300 ms search debounce, filter parameters and page reset, clearing filters, sorting by Value twice, empty state and pagination.
**Where**: `web/src/features/transactions/extratoFilters.test.tsx`
**Depends on**: T4
**Reuses**: -
**Requirement**: FIX-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Typing queries once after 300 ms with fake timers and resets to page 1
- [ ] Each filter sends its parameter and resets the page; 'Limpar filtros' restores the default
- [ ] Clicking Valor twice requests ascending then descending
- [ ] Empty result shows 'Nenhuma transação encontrada' and Próxima/Anterior move between pages (6 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): test search, filters, sorting and pagination`

---

### T11: Test delete, create and edit flows

**What**: Interface tests for delete confirmation and cancel, creating through the form with '1.234,56' sent as '1234.56', editing, and the inactive account missing from the form selector.
**Where**: `web/src/features/transactions/extratoCrud.test.tsx`
**Depends on**: T4
**Reuses**: -
**Requirement**: FIX-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Confirming removes the row and cancelling keeps it
- [ ] Creating sends the converted amount and the chosen account; editing sends the changed fields
- [ ] An inactive account is not offered in the form (4 tests)
- [ ] Gate check passes: `pnpm -C web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(front-fixes): test delete, create and edit flows`

---

### T12: Synchronize the yarn lockfile

**What**: Run `yarn install` in `web/` so `yarn.lock` matches `package.json` and commit the result.
**Where**: `web/yarn.lock`
**Depends on**: None
**Reuses**: -
**Requirement**: FIX-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `yarn install --frozen-lockfile` in a clean copy of `web/` finishes without changes
- [ ] `yarn --cwd web test`, `typecheck` and `lint` still pass
- [ ] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(front-fixes): synchronize the yarn lockfile`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

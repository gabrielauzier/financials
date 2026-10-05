# Contas e Categorias Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/accounts-categories/design.md`
**Status**: Draft

**Feature prerequisites**: auth complete (api foundation, withUser, test helpers, web scaffold).

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

### Phase 1: Schema, seed and helpers

```
T1 T2
```

### Phase 2: Accounts API

```
T3 → T4
T3 → T5
T3 → T6
```

### Phase 3: Categories API

```
T7 → T8
T7 → T9
T7 → T10
T8 → T11
T9 → T11
T10 → T11
```

### Phase 4: Web: accounts and categories (substituída pelo Lovable, ver lovable.md)
```
T12 → T13
T12 → T14
T12 → T15
T12 → T16
```

---

## Task Breakdown

### Phase 1: Schema, seed and helpers

### T1: Create the accounts and categories migration

**What**: Migration `0002`: `accounts` and `categories` with composite uniques, case-insensitive unique names, RLS (system categories blocked from insert/update/delete), `revoke delete on accounts`, `seed_categories` with the 17 pt-BR rows, and `create or replace` of `handle_new_user` to call the seed.
**Where**: `supabase/migrations/0002_accounts_categories.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: CAT-01

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Creating a user seeds 17 categories with the identifiers and pt-BR names from the spec; exactly 3 have `is_system`
- [x] Updating or deleting a system category as `authenticated` affects 0 rows
- [x] Deleting from `accounts` as `authenticated` fails
- [x] Duplicate account nickname or category name (any case) violates the unique index
- [x] RLS isolates both tables between two users
- [x] Running the seed twice does not duplicate categories (6 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): create the accounts and categories migration`

---

### Phase 2: Accounts API

```
T3 → T4
T3 → T5
T3 → T6
```

### Phase 3: Categories API

```
T7 → T8
T7 → T9
T7 → T10
T8 → T11
T9 → T11
T10 → T11
```

### Phase 4: Web: accounts and categories (substituída pelo Lovable, ver lovable.md)
```
T12 → T13
T12 → T14
T12 → T15
T12 → T16
```

---

## Task Breakdown

### Phase 1: Schema, seed and helpers

### T1: Create the accounts and categories migration

**What**: Migration `0002`: `accounts` and `categories` with composite uniques, case-insensitive unique names, RLS (system categories blocked from insert/update/delete), `revoke delete on accounts`, `seed_categories` with the 17 pt-BR rows, and `create or replace` of `handle_new_user` to call the seed.
**Where**: `supabase/migrations/0002_accounts_categories.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: CAT-01

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Creating a user seeds 17 categories with the identifiers and pt-BR names from the spec; exactly 3 have `is_system`
- [x] Updating or deleting a system category as `authenticated` affects 0 rows
- [x] Deleting from `accounts` as `authenticated` fails
- [x] Duplicate account nickname or category name (any case) violates the unique index
- [x] RLS isolates both tables between two users
- [x] Running the seed twice does not duplicate categories (6 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): create the accounts and categories migration`

---

### T2: Create the name normalization helper

**What**: `normalizeName` (NFD, strip diacritics, lowercase, collapse spaces, trim) and `collapseSpaces`, shared by accounts and import.
**Where**: `api/src/lib/normalize.ts`
**Depends on**: None
**Reuses**: Deviation from design: lives in `api/src/lib/normalize.ts` (shared), not `import/normalize.ts`.
**Requirement**: ACCT-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Accents, case and repeated spaces normalize to the same string
- [ ] Empty and whitespace-only input yields an empty string
- [ ] `collapseSpaces` keeps case and accents (4 tests)
- [ ] Gate check passes: `pnpm -C api test:unit`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): create the name normalization helper`

---

### Phase 2: Accounts API

### T3: Add the create account endpoint

**What**: `POST /accounts` with `{ bank, nickname, holderNames[] }`; trims holders, rejects blank nickname, no holder, duplicate holder in the account, duplicate nickname.
**Where**: `api/src/modules/accounts/routes.ts`
**Depends on**: T1, T2
**Reuses**: -
**Requirement**: ACCT-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Valid payload creates an active account
- [x] Duplicate nickname returns 409 `duplicate_name`
- [x] No holder returns 422 `holder_required`
- [x] Blank nickname and duplicate holder in the same account return 422
- [x] Invalid bank value returns 422 (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the create account endpoint`

---

### T4: Add the list accounts endpoint

**What**: `GET /accounts` with optional `active` filter.
**Where**: `api/src/modules/accounts/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: ACCT-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Lists all of the user's accounts and none of another user's
- [x] `active=true` omits inactive accounts (2 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the list accounts endpoint`

---

### T5: Add the edit account endpoint

**What**: `PATCH /accounts/:id` edits bank, nickname and holders without touching transactions.
**Where**: `api/src/modules/accounts/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: ACCT-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Edits persist and unspecified fields stay
- [x] Same validations as create apply
- [x] Unknown id and another user's id return 404 (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the edit account endpoint`

---

### T6: Add the activate and deactivate endpoints

**What**: `POST /accounts/:id/deactivate` and `/activate`; no delete route exists.
**Where**: `api/src/modules/accounts/routes.ts`
**Depends on**: T3
**Reuses**: -
**Requirement**: ACCT-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Deactivate sets `active=false` and the row is kept
- [x] Activate restores `active=true`
- [x] `DELETE /accounts/:id` returns 404 (no route)
- [x] Inactive accounts' holder names remain readable for neutral detection (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the activate and deactivate endpoints`

---

### Phase 3: Categories API

### T7: Add the list categories endpoint

**What**: `GET /categories` returning `id`, `key`, `name`, `isSystem`.
**Where**: `api/src/modules/categories/routes.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: CAT-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Returns 17 seeded categories with pt-BR names for a new user
- [x] Never returns another user's categories (2 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the list categories endpoint`

---

### T8: Add the create category endpoint

**What**: `POST /categories` with a name; rejects blank and duplicate (case-insensitive).
**Where**: `api/src/modules/categories/routes.ts`
**Depends on**: T7
**Reuses**: -
**Requirement**: CAT-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Creates a non-system category
- [x] Blank or whitespace name returns 422
- [x] Duplicate name in any case returns 409 `duplicate_name` (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the create category endpoint`

---

### T9: Add the rename category endpoint

**What**: `PATCH /categories/:id` renames a regular category; 403 `category_protected` for system ones.
**Where**: `api/src/modules/categories/routes.ts`
**Depends on**: T7
**Reuses**: -
**Requirement**: CAT-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Rename persists and the `key` is unchanged
- [x] Renaming Estorno, Sem categoria or Investimentos returns 403 `category_protected`
- [x] Duplicate and blank names are rejected (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the rename category endpoint`

---

### T10: Add the delete category endpoint with reassignment

**What**: `DELETE /categories/:id?reassignTo=` runs one transaction: reassigns every row of the registered referencing tables, then deletes. Referencing tables are a registry that transactions and credit-expenses extend later.
**Where**: `api/src/modules/categories/routes.ts`
**Depends on**: T7
**Reuses**: Registry is empty until the transactions and credit-expenses features register their tables.
**Requirement**: CAT-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Unused category is deleted
- [x] System category returns 403
- [x] In-use category without `reassignTo` returns 422 `reassign_required`
- [x] `reassignTo` equal to the category returns 422
- [x] Failure during reassignment leaves the category and its rows unchanged
- [x] Registry mechanism is tested with a temporary test table (6 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the delete category endpoint with reassignment`

---

### T11: Add the accounts and categories isolation test

**What**: Cross-user test: user B gets 404 when reading, editing, deactivating or deleting user A's account/category.
**Where**: `api/test/accounts-categories-isolation.int.test.ts`
**Depends on**: T3, T8, T9, T10
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Every mutating route returns 404 for another user's id
- [ ] No data of user A appears in user B's lists (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(accounts-categories): add the accounts and categories isolation test`

---

### Phase 4: Web: accounts and categories (substituída pelo Lovable, ver lovable.md)
### T12: Create the accounts and categories hooks

**What**: `useAccounts({ active })`, `useCategories()` and their mutations with cache invalidation.
**Where**: `web/src/features/accounts/hooks.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: ACCT-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Hooks call the right endpoints and parameters
- [ ] Mutations invalidate the cached lists (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): create the accounts and categories hooks`

---

### T13: Build the accounts page

**What**: List with bank label (Nubank, Sofisa Direto, Neon, XP, Outro), create/edit form with holder chips, deactivate and reactivate actions, no delete action.
**Where**: `web/src/features/accounts/AccountsPage.tsx`
**Depends on**: T12
**Reuses**: -
**Requirement**: ACCT-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Create form requires at least one holder and shows duplicate-nickname error
- [ ] Deactivate and reactivate update the row state
- [ ] There is no delete control
- [ ] Inactive accounts are visibly marked (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): build the accounts page`

---

### T14: Build the account select

**What**: `AccountSelect` listing only active accounts.
**Where**: `web/src/features/accounts/AccountSelect.tsx`
**Depends on**: T12
**Reuses**: -
**Requirement**: ACCT-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Inactive accounts are not selectable
- [ ] Emits the selected account id (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): build the account select`

---

### T15: Build the categories page

**What**: List with pt-BR names; create, rename and delete (with a reassignment dialog); system rows show no edit or delete actions.
**Where**: `web/src/features/categories/CategoriesPage.tsx`
**Depends on**: T12
**Reuses**: -
**Requirement**: CAT-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] System categories show no rename or delete controls
- [ ] Deleting an in-use category requires choosing a destination
- [ ] Duplicate name shows the error message
- [ ] All names render in Portuguese (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): build the categories page`

---

### T16: Build the category select

**What**: `CategorySelect` with all categories by pt-BR name.
**Where**: `web/src/features/categories/CategorySelect.tsx`
**Depends on**: T12
**Reuses**: -
**Requirement**: CAT-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Lists every category including system ones
- [ ] Emits the selected category id (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(accounts-categories): build the category select`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

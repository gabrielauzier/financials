# Dashboards e Patrimônio Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/dashboards/design.md`
**Status**: Draft

**Contract**: the wire contract of the endpoints is the one in `lovable.md` ("Contrato da API"): wrapped responses (`{ points }`, `{ items }`), `categoryName`, `accountNickname`, `invalid_period` (422). Where `design.md` differs, `lovable.md` wins. Web tasks T14-T20 are implemented directly in `web/` (Lovable is not the development path anymore); `lovable.md` stays the behavior spec for the UI.

**Feature prerequisites**: auth, accounts-categories, transactions, import and credit-expenses complete.

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

### Phase 1: Rules, time helpers and storage

```
T1 T2 T3
```

### Phase 2: Dashboard endpoints

```
T4 T5 T6 T7 T8
```

### Phase 3: Investment returns and guards

```
T9 → T10
T9 → T11
T9 → T13
T10 → T13
T11 → T13
```

### Phase 4: Web: dashboard
```
T14 → T20
T15 → T20
T16 → T20
T17 → T20
T18 → T20
T19 → T20
```

---

## Task Breakdown

### Phase 1: Rules, time helpers and storage

### T1: Create the investment returns migration

**What**: Migration `0006`: `investment_returns` with `amount <> 0`, composite account FK, index and RLS.
**Where**: `supabase/migrations/0006_investment_returns.sql`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-06

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Amount 0 is rejected by the table
- [x] Another user's account cannot be referenced
- [x] RLS isolates rows (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): create the investment returns migration`

---

### T2: Create the calculation rules module

**What**: `rules.ts` exporting `COUNTABLE`, `EXPENSE_VALUE`, `INCOME_VALUE` and `NET_VALUE` SQL fragments (AD-003).
**Where**: `api/src/modules/dashboards/rules.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-01

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Fixed dataset with one row of each special case yields exactly the spec totals: neutral, CreditCard, Investments, Reversal Income (abates expense), Reversal Expense (normal expense), future-dated, inactive-account rows
- [x] Income and expense totals exclude each special case as specified
- [x] Net value counts the Reversal as positive and the invoice payment as expense (6 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): create the calculation rules module`

---

### T3: Create the time window helpers

**What**: Luxon helpers: last-30-days window, previous 30 days, 12-calendar-month list and month boundaries as instants for a given IANA zone.
**Where**: `api/src/modules/dashboards/time.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Window is 30 days ending today inclusive in `America/Sao_Paulo` and in `UTC`
- [x] Previous window is the 30 days immediately before
- [x] Month list has the current month plus 11 earlier, crossing year boundaries (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): create the time window helpers`

---

### Phase 2: Dashboard endpoints

### T4: Add the last 30 days endpoint

**What**: `GET /dashboard/last-30-days` -> total, previousTotal, changePct (null when previous is zero).
**Where**: `api/src/modules/dashboards/routes.ts`
**Depends on**: T2, T3
**Reuses**: -
**Requirement**: DASH-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] R$ 100 and R$ 50 in the window and R$ 100 before gives total 150.00 and +50%
- [x] Previous total zero returns `changePct` null
- [x] No expenses returns 0.00 (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the last 30 days endpoint`

---

### T5: Add the 12-month trend endpoint

**What**: `GET /dashboard/trend` with income, expense and balance for 12 calendar months, empty months as 0.00.
**Where**: `api/src/modules/dashboards/routes.ts`
**Depends on**: T2, T3
**Reuses**: -
**Requirement**: DASH-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Transactions in 3 months leave the other 9 at 0.00
- [x] Balance equals income minus expense each month
- [x] A transaction at 23:30 local on the last day of a month belongs to that month (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the 12-month trend endpoint`

---

### T6: Add the categories distribution endpoint

**What**: `GET /dashboard/categories?from&to` (default current month) with Estorno as a negative value.
**Where**: `api/src/modules/dashboards/routes.ts`
**Depends on**: T2, T3
**Reuses**: -
**Requirement**: DASH-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sum of all rows equals the total expense for the same period
- [x] Estorno appears as a negative row
- [x] Default period is the current local month; empty period returns an empty list; `from > to` returns 422 (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the categories distribution endpoint`

---

### T7: Add the net worth endpoint

**What**: `GET /dashboard/net-worth` -> current value and monthly cumulative series including investment returns.
**Where**: `api/src/modules/dashboards/routes.ts`
**Depends on**: T1, T2, T3
**Reuses**: -
**Requirement**: DASH-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Income 1000.00, expense 300.00 and return 50.00 give 750.00
- [x] Series has one point per month with cumulative values, no gaps
- [x] Invoice payment counts as expense; Estorno counts positive; Investments, neutral and CreditCard rows do not move the value
- [x] No data returns 0.00 and an empty series (5 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the net worth endpoint`

---

### T8: Add the card view endpoint

**What**: `GET /dashboard/card?from&to` -> CreditCard transactions by category plus active, once and to-cancel credit expenses by category with remaining amount.
**Where**: `api/src/modules/dashboards/routes.ts`
**Depends on**: T2, T3
**Reuses**: -
**Requirement**: DASH-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Two CreditCard rows in Alimentação sum under that category
- [x] Credit expenses show total minus paid for Active, Once and ToCancel only
- [x] Creating a credit expense and CreditCard rows leaves last-30-days, trend, categories and net worth unchanged (CARD-05)
- [x] Empty period returns empty lists (4 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the card view endpoint`

---

### Phase 3: Investment returns and guards

### T9: Add the create investment return endpoint

**What**: `POST /investment-returns` with date, non-zero amount (2 decimals), owned account, notes.
**Where**: `api/src/modules/investmentReturns/routes.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: DASH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Positive and negative amounts are created
- [ ] Zero, 3 decimals and foreign account return 422 (3 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the create investment return endpoint`

---

### T10: Add the list investment returns endpoint

**What**: `GET /investment-returns` ordered by date descending with `lastDate`.
**Where**: `api/src/modules/investmentReturns/routes.ts`
**Depends on**: T9
**Reuses**: -
**Requirement**: DASH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Rows are ordered by date descending and `lastDate` is the newest date
- [ ] Empty list returns `lastDate` null (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the list investment returns endpoint`

---

### T11: Add the edit and delete investment return endpoints

**What**: `PATCH` and `DELETE /investment-returns/:id`; the net worth changes on the next read.
**Where**: `api/src/modules/investmentReturns/routes.ts`
**Depends on**: T9
**Reuses**: -
**Requirement**: DASH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Edit persists and net worth reflects it
- [ ] Delete removes the row and net worth reflects it
- [ ] Foreign and unknown ids return 404 (3 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the edit and delete investment return endpoints`

---

### T12: Add the rules duplication guard

**What**: Static test that fails when SQL outside `rules.ts` under `api/src` references the special categories (`Reversal`, `Investments`) or `CreditCard` for totals.
**Where**: `api/src/modules/dashboards/rules.guard.test.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: DASH-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Guard passes on the current tree
- [ ] Guard fails when a sample file with a duplicated rule is introduced in a temporary directory (2 tests)
- [ ] Gate check passes: `pnpm -C api test:unit`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): add the rules duplication guard`

---

### T13: Add the dashboards isolation test

**What**: Cross-user test over every dashboard endpoint and investment returns.
**Where**: `api/test/dashboards-isolation.int.test.ts`
**Depends on**: T9, T10, T11
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] User B's dashboards never include user A's data
- [ ] User B gets 404 on user A's investment returns (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(dashboards): add the dashboards isolation test`

---

### Phase 4: Web: dashboard

### T14: Build the last 30 days card

**What**: Total, variation percent and the 'sem base de comparação' state.
**Where**: `web/src/features/dashboard/Last30DaysCard.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-02

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Shows total and variation
- [ ] Null variation shows 'sem base de comparação'
- [ ] Zero total shows R$ 0,00 (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the last 30 days card`

---

### T15: Build the trend chart

**What**: 12 months of income, expense and balance.
**Where**: `web/src/features/dashboard/TrendChart.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Renders 12 months with zero months
- [ ] Shows income, expense and balance series (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the trend chart`

---

### T16: Build the category breakdown

**What**: Distribution by category with a period selector and pt-BR names, negative Estorno row.
**Where**: `web/src/features/dashboard/CategoryBreakdown.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Changing the period requests the new range
- [ ] Negative Estorno renders as a negative value
- [ ] Empty state renders (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the category breakdown`

---

### T17: Build the net worth chart

**What**: Current value and monthly series.
**Where**: `web/src/features/dashboard/NetWorthChart.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Shows the current value and the series
- [ ] Empty data shows R$ 0,00 and the empty state (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the net worth chart`

---

### T18: Build the card view

**What**: Card transactions by category and credit-expense remaining amounts in separate sections.
**Where**: `web/src/features/dashboard/CardView.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-07

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Both sections render with totals
- [ ] Empty period shows the empty state (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the card view`

---

### T19: Build the investment returns list and form

**What**: List with CRUD, non-zero amount validation and a highlight when the last entry is older than 30 days.
**Where**: `web/src/features/dashboard/InvestmentReturns.tsx`
**Depends on**: None
**Reuses**: -
**Requirement**: DASH-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Create and edit validate non-zero amount
- [ ] Last entry older than 30 days is highlighted with its date
- [ ] Delete removes the row (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): build the investment returns list and form`

---

### T20: Wire the dashboard page

**What**: Page composing all panels with a global empty state when there is no data.
**Where**: `web/src/features/dashboard/DashboardPage.tsx`
**Depends on**: T14, T15, T16, T17, T18, T19
**Reuses**: -
**Requirement**: DASH-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] All panels render from a mocked API
- [ ] No data renders every panel at R$ 0,00 with empty states (2 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dashboards): wire the dashboard page`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

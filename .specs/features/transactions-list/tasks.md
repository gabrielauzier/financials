# Extrato: resumo e paginação Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transactions-list/design.md`
**Status**: Done (implemented; the independent Verifier report is FAIL on iteration 1, its gaps were fixed afterwards by the author and **not re-verified by a fresh independent agent**; the traceability in `spec.md` is Verified on the Verifier evidence plus those fixes; the owner's browser check and the owner's decision on the Investimentos definition stay open)

**Feature prerequisites**: `transactions-ux-v2` implemented on `feat/transactions-ux-v2` (branch `feat/transactions-list` is stacked on it); migrations 0001 to 0009 applied locally (no new migration); local Supabase running. No push, no `db reset`, nothing touches the hosted Supabase or Vercel.

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`), the `package.json` scripts, `web/AGENTS.md` (money as decimal strings, transaction list state as TanStack Query state, mocks resolving relations from their area mocks) and the confirmed lessons L-004, L-006, L-013 and L-027 plus the candidates L-014, L-015, L-020, L-021, L-023, L-024, L-039, L-040 and L-041 - strong defaults applied. Floor taken from the existing tests (`api/test/transactions*.int.test.ts`, `api/test/dashboards-rules.int.test.ts`, `api/test/swagger.int.test.ts`, `web/src/features/transactions/*.test.tsx`, `web/src/components/ui/toast-styles.test.ts`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API routes, rules fragments, schema and OpenAPI | integration | Every route touched (list with `pageSize`, summary): happy path + every listed edge case + error paths (422, 401) + RLS; fragments checked against Postgres; `openapi.json` content | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web components and hooks | unit | Spec-visible behavior per AC; failure paths assert the Portuguese text and the exact option lists (L-013, L-024); every page reset starts from page 2 (L-021, L-041); requests asserted through the `apiSpy` log | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Web pure helpers (`pageNumbers`, `summaryStyles`, `summaryFilters`) | unit | All branches; 1:1 to spec ACs; 1, 2, 7, 8 and 100 pages with the current at the edges and the middle; contrast of every color class in both themes | `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web mocks and hand-written API types | unit when behavior (mock handlers); none for types | Mock list and summary behave like the API for `pageSize` and the rules; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
| Styles, config | none | - (build gate only; the color classes are covered through the contrast test of the module that holds them) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After web tasks with unit tests only | `yarn --cwd web test` |
| Full | After API tasks with integration tests (needs `supabase start`) | `pnpm -C api test` |
| Build | After phase completion and at the end (three runs in a row) | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. The 11 tasks would pack into two batches (phases 1 and 2, then 3 and 4); the owner asked for no sub-agents, so a single agent executes them inline, in order.

### Phase 1: Summary and page size in the API

```
T1
T2 → T3
```

### Phase 2: Web contract, hooks and storage

```
T1 → T4
T3 → T4
T5
T4 → T6
T4 → T7
```

### Phase 3: Components

```
T8
T7 → T9
T8 → T9
T5 → T10
T6 → T10
```

### Phase 4: Extrato

```
T9 → T11
T10 → T11
```

---

## Task Breakdown

### Phase 1: Summary and page size in the API

### T1: Accept pageSize in the transactions list

**What**: `pageSize` (`25`, `50` or `100`, default 50) in the list query with `validPageSize` (422 on the field `pageSize`), the response `pageSize` as an integer enum 25/50/100 returning the used value, `limit` and `offset` from it; regenerate `api/openapi.json` with `pnpm -C api openapi:export`; integration tests in `api/test/transactions.int.test.ts` and `api/test/swagger.int.test.ts`.
**Where**: `api/src/modules/transactions/routes.ts`
**Depends on**: None
**Reuses**: `validPage`, `invalid`, the `GET /transactions` test block (`seed`, `list`), `api/test/swagger.int.test.ts`
**Requirement**: TLIST-05, TLIST-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Without `pageSize` the list returns 50 items and `pageSize` 50 (AC 1 of the page size story)
- [x] With `pageSize` 25, 50 and 100 the list returns that many items on page 1, the same `total` and the used `pageSize`; the last page holds the remainder (AC 2)
- [x] `pageSize` equal to `0`, `10`, `101`, `abc`, an empty value, `050`, `50.0` and ` 50` answers 422 `validation_error` with the field `pageSize` (AC 3)
- [x] A page past the end answers `items: []`, the `total` and the used `pageSize`, for each size (AC 4)
- [x] The pages of 25, of 50 and of 100 concatenate to the same ids in the same order, with equal instants in the data (AC 5)
- [x] `pageSize` combined with `type` and `sort` applies to the filtered and sorted set (AC 6)
- [x] `api/openapi.json` documents `pageSize` in the list query and as the 25/50/100 enum in the list response; `swagger.int.test.ts` asserts the content (the summary path is asserted in T3) and that the file is current (AC 7, part)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 652 integration tests (625 existing plus 27 new) and 382 unit tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-list): accept pageSize in the transactions list`

---

### T2: Add the investment fragments to the rules module

**What**: `COUNTABLE_BASE`, `INVESTMENT_ROW` and `INVESTMENT_VALUE` in `rules.ts`, with `COUNTABLE` recomposed from `COUNTABLE_BASE` and a category different from Investments (same meaning as today); integration tests in `api/test/dashboards-rules.int.test.ts` against Postgres.
**Where**: `api/src/modules/dashboards/rules.ts`
**Depends on**: None
**Reuses**: `api/test/dashboards-rules.int.test.ts` (`DATASET`, `setup`, `totals`), `api/src/modules/dashboards/rules.guard.test.ts`
**Requirement**: TLIST-03, TLIST-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `COUNTABLE` still yields the exact dashboard totals of the existing dataset (income `1000.00`, expense `100.00`, net `900.00`) and every existing test of the file and the dashboard suites pass unchanged
- [x] `INVESTMENT_ROW` with `INVESTMENT_VALUE` sums an Expense contribution as positive and an Income redemption as negative (`200.00 - 5.00 = 195.00` on the dataset) (AC 11 of the summary story)
- [x] `INVESTMENT_ROW` leaves out neutral, CreditCard and future-dated Investments rows and rows of any other category (AC 10)
- [x] No row is both `COUNTABLE` and `INVESTMENT_ROW` on the dataset (an Investments row never reaches income or expense) (AC 10)
- [x] The category is matched by key: an Investments category renamed by the user still counts (AC 3 of the click story, rule side)
- [x] `rules.guard.test.ts` passes without an allowlist (AC 17)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 656 integration tests (652 existing plus 4 new) and 382 unit tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-list): add the investment fragments to rules.ts`

---

### T3: Add the transactions summary endpoint

**What**: `summary.ts` with `SummarySchema` and `summaryTotals` (one query: `count` and four sums from the rules fragments over `fromJoins` and the shared `whereClause`, money converted to text in SQL); `GET /transactions/summary` registered in `routes.ts` next to the list, reusing its `whereClause`; regenerate `api/openapi.json`; integration tests in `api/test/transactions-summary.int.test.ts` and `api/test/swagger.int.test.ts`.
**Where**: `api/src/modules/transactions/summary.ts`
**Depends on**: T2
**Reuses**: `api/src/modules/dashboards/rules.ts`, `whereClause` and `fromJoins`, `api/test/helpers/dashboards.ts`, `api/test/dashboards-rules.int.test.ts` (`DATASET`), `api/test/transactions-isolation.int.test.ts`
**Requirement**: TLIST-01, TLIST-02, TLIST-03, TLIST-04, TLIST-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `GET /transactions/summary` answers 200 with exactly `count`, `income`, `expense`, `investments` and `balance`, the four values matching `^-?\d+\.\d{2}$` (AC 1)
- [x] No token and an invalid token answer 401 (AC 2)
- [x] Another user's rows never enter the totals and a user with no rows gets the zeros (AC 3 and 8)
- [x] Without a filter `count` equals the list `total`; with each of `from`, `to`, `accountId`, `categoryId`, `type`, `neutral` and `q` (and a combination) `count` equals the list `total` for the same query; the `X-Timezone` day boundaries and the accent-blind search behave as in the list (AC 4 and 5)
- [x] Invalid `type`, `neutral`, `from`, `to`, `accountId` and `categoryId` answer 422 `validation_error` with the field name; a repeated filter parameter answers like the list (AC 6 and edge case)
- [x] `sort`, `order`, `page` and `pageSize` change nothing (AC 7)
- [x] An inverted period answers 200 with the zeros and `count` 0 (assumption)
- [x] On the fixed dataset (neutral, CreditCard, Investments Expense and Income, Reversal Income, Reversal Expense, future-dated, inactive account, rows on the first and last local-day boundaries) the unfiltered summary equals the literal values derived from the spec rules and `income` and `expense` equal the totals computed with `INCOME_VALUE` and `EXPENSE_VALUE` over `COUNTABLE` for the same rows (AC 9 to 14)
- [x] On the same dataset the summary filtered by `type`, `categoryId` (Food, Investments, Reversal), `accountId` (active and inactive), `neutral`, `from`/`to` and `q` equals the expected literals of the rows each filter selects (AC 15)
- [x] With only future-dated rows the money fields are `"0.00"` and `count` equals the row count (AC 16)
- [x] 0.10 plus 0.20 sums exactly `"0.30"`, and an expense made only of Reversal Income is negative with the balance positive (AC 12 and 13, edge case)
- [x] `rules.guard.test.ts` still passes: `summary.ts` carries no special key in SQL (AC 17)
- [x] `api/openapi.json` documents the path with the seven filters in the query and the five fields in the 200 response; `swagger.int.test.ts` asserts it and that the file is current (AC 7 of the page size story)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 702 integration tests (656 existing plus 46 new) and 382 unit tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-list): add the transactions summary endpoint`

---

### Phase 2: Web contract, hooks and storage

### T4: Add pageSize and the summary to the web types and mocks

**What**: `PageSize`, `TransactionFilters.pageSize`, `TransactionsPage.pageSize: PageSize` and `TransactionSummary` in the web types; the mock list accepts `pageSize` (422 on invalid) and returns it; a mock `GET /transactions/summary` reusing the list filter (extracted to `filterTransactions`) with the dashboard rules in integer cents; `apiSpy` route key excludes `summary` from `:id`; fix the fixtures the new type breaks.
**Where**: `web/src/lib/api/mock/transactions.ts`
**Depends on**: T1, T3
**Reuses**: `web/src/lib/api/types.ts`, `web/src/lib/api/mock/transactions.test.ts`, `web/src/lib/api/mock/categories.ts`, `web/src/test/apiSpy.tsx`
**Requirement**: TLIST-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The types compile: `TransactionFilters.pageSize` accepts 25, 50 and 100 and rejects 30 (a `@ts-expect-error` line in the mock test) and `TransactionSummary` has a numeric `count` and four decimal strings (AC 1 of the web types story)
- [x] The mock list returns up to 25, 50 or 100 items with `pageSize` 25, 50 or 100, and 50 by default (AC 2)
- [x] The mock list rejects `pageSize` 30 with `validation_error`, status 422 and field `pageSize` (AC 3)
- [x] The mock summary applies the list filters and the rules on a fixture that has neutral, CreditCard, Investments, Reversal Income, Reversal Expense and future-dated rows, with exact 2-decimal strings (0.10 plus 0.20 gives `"0.30"`) (AC 4)
- [x] The mock summary ignores `sort`, `order`, `page` and `pageSize` (AC 5)
- [x] The existing mock tests and the `transactions.test.tsx` suite pass unchanged
- [x] Gate check passes: `yarn --cwd web test` and `yarn --cwd web typecheck`
- [x] Test count: 733 web tests pass (717 existing plus 16 new; no silent deletions); typecheck 0 errors; lint 0 errors and the same 7 existing warnings

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add pageSize and the summary to the web mocks`

---

### T5: Create the page number list

**What**: `pageNumbers(current, total)`, a pure function returning page numbers and `"…"`, with its unit tests.
**Where**: `web/src/features/transactions/pageNumbers.ts`
**Depends on**: None
**Reuses**: `web/src/features/transactions/utils.test.ts` (style)
**Requirement**: TLIST-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] For 1 page the result is `[1]`, for 2 pages `[1, 2]`, for 7 pages `[1, 2, 3, 4, 5, 6, 7]` with the current at the first, a middle and the last page (AC 1)
- [x] For 8 pages: current 1 to 4 gives `[1, 2, 3, 4, 5, "…", 8]`; current 5 to 8 gives `[1, "…", 4, 5, 6, 7, 8]` (AC 2 and 3, the boundary between the two branches)
- [x] For 100 pages: current 1 gives `[1, 2, 3, 4, 5, "…", 100]`; current 4 gives the same; current 5 gives `[1, "…", 4, 5, 6, "…", 100]`; current 50 gives `[1, "…", 49, 50, 51, "…", 100]`; current 96 gives `[1, "…", 95, 96, 97, "…", 100]`; current 97 and 100 give `[1, "…", 96, 97, 98, 99, 100]` (AC 2, 3 and 4)
- [x] Every result for more than 7 pages has exactly 7 entries, starts with 1 and ends with the total (width stays fixed)
- [x] `total` 0 or negative is treated as 1, and a current below 1 or above the total is clamped (AC 5)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 743 web tests pass (733 existing plus 10 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the page number list`

---

### T6: Create the page size hook

**What**: `usePageSize` and `readStoredPageSize` over `localStorage` (key `financials:transactions:page-size`), every access in `try/catch`, an invalid or unreadable value falling back to 50, with hook tests.
**Where**: `web/src/features/transactions/usePageSize.ts`
**Depends on**: T4
**Reuses**: `web/src/lib/api/types.ts` (`PageSize`)
**Requirement**: TLIST-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] With nothing stored the hook returns 50; with `"25"` and `"100"` stored it returns 25 and 100 (AC 18)
- [x] Stored `"30"`, `"25 "`, `"25.0"`, `"abc"`, an empty text and a missing key return 50 (AC 19 and edge case)
- [x] When `localStorage.getItem` throws the hook returns 50 (AC 19)
- [x] The setter updates the returned value and stores the exact text `"25"` or `"100"` under the key (AC 16, storage side)
- [x] When `localStorage.setItem` throws the setter still updates the returned value and nothing is thrown to the caller (AC 20)
- [x] The exported `PAGE_SIZES` is exactly `[25, 50, 100]` and the default is 50 (AC 15, source of the option list)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 764 web tests pass (743 existing plus 21 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the page size hook`

---

### T7: Add the summary query and its invalidation

**What**: `getTransactionSummary` in `api.ts`, `summaryFilters` in `utils.ts`, `transactionSummaryQueryOptions` and `useTransactionSummary` in `hooks.ts` with the key `["transaction-summary", filters]`; the create, delete, update (on settle) and bulk-category hooks also invalidate `["transaction-summary"]`; hook tests.
**Where**: `web/src/features/transactions/hooks.ts`
**Depends on**: T4
**Reuses**: `web/src/features/transactions/api.ts`, `web/src/features/transactions/utils.ts`, `web/src/test/apiSpy.tsx`, `web/src/features/creditExpenses/hooks.test.tsx` (hook test style)
**Requirement**: TLIST-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `summaryFilters` drops `sort`, `order`, `page` and `pageSize` and keeps `from`, `to`, `accountId`, `categoryId`, `type`, `neutral` and `q`, returning an equal object whatever the page or order (AC 10 of the card story)
- [x] `useTransactionSummary` requests `/transactions/summary` with only the active filters in the query string and none of `sort`, `order`, `page` and `pageSize` (AC 10)
- [x] Re-rendering with only the page, the order or the page size changed sends no second summary request, and a changed filter sends one (AC 9, hook side)
- [x] With `enabled` false no summary request is sent (AC 13, hook side)
- [x] Creating, deleting, editing (with the summary in cache) and bulk recategorizing a transaction refetch the summary, and the edit's optimistic update does not break the cached summary (AC 11, risk of the shared prefix)
- [x] A failed summary request surfaces the error and `refetch` repeats only the summary request (AC 5, hook side)
- [x] The existing transactions hook and page tests pass unchanged
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 777 web tests pass (764 existing plus 13 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the summary query and its invalidation`

---

### Phase 3: Components

### T8: Define the summary colors and prove their contrast

**What**: `summaryStyles.ts` with the color classes of income, expense, investments and the neutral text, `balanceClassName` (by the sign of the decimal string, with no arithmetic) and the active ring; a test that resolves each class from `tailwindcss/theme.css` and `styles.css` and checks contrast against `--card` and the hues.
**Where**: `web/src/features/transactions/summaryStyles.ts`
**Depends on**: None
**Reuses**: `web/src/test/colorContrast.ts`, `web/src/components/ui/toast-styles.test.ts` (token resolution)
**Requirement**: TLIST-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `balanceClassName("120.00")` gives the income classes, `"-0.01"` and `"-50.00"` the expense classes, and `"0.00"` and `"-0.00"` the neutral class (AC 2 of the card story)
- [x] The text color of income, expense and investments in the light and the dark theme has contrast of at least 4.5:1 against the card color (`--card`) of the theme (AC 14)
- [x] The resolved hues are green for income (110 to 180), red for expense (0 to 40) and blue for investments (230 to 270), and the three are pairwise distinct (AC 14 and 2)
- [x] The neutral class resolves to `--foreground` and has at least 4.5:1 against `--card` in both themes (AC 14)
- [x] Every color class of the module has a `dark:` counterpart (the guard does not pass on an empty list)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 793 web tests pass (777 existing plus 16 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the summary colors and prove their contrast`

---

### T9: Create the summary card

**What**: `SummaryCard` (section "Resumo do extrato"; loading skeleton, error with "Tentar novamente", empty state; highlighted count with the plural rule; income, expense, investments and balance from the API through `formatBRL`; Receitas, Despesas and Investimentos as `aria-pressed` buttons that call `onSelectType` and `onSelectCategory`; Investimentos as text without the category; Saldo as text) with component tests.
**Where**: `web/src/features/transactions/SummaryCard.tsx`
**Depends on**: T7, T8
**Reuses**: `web/src/features/transactions/hooks.ts`, `web/src/features/categories/hooks.ts`, `web/src/lib/format.ts`, `web/src/features/transactions/summaryStyles.ts`, `web/src/test/apiSpy.tsx`
**Requirement**: TLIST-08, TLIST-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] With a canned summary the card shows the count and "R$ 1.234,56", "R$ 100,00", "R$ 50,00" and "-R$ 10,00" exactly as the API strings format, under the labels "Receitas", "Despesas", "Investimentos" and "Saldo" (AC 1 of the card story)
- [x] Each value carries the class of its color (income, expense, investments, and the balance by sign: positive, negative, zero) (AC 2)
- [x] A count of 1 shows "transação"; 0 and 5 show "transações"; 1234 shows "1.234" (AC 3)
- [x] While loading a status named "Carregando resumo" is shown and no value is (AC 4)
- [x] A failing request shows "Não foi possível carregar o resumo." and "Tentar novamente", and activating it requests only the summary again and then shows the values (AC 5)
- [x] A zero summary shows count 0 and four "R$ 0,00" values (AC 6)
- [x] Receitas, Despesas and Investimentos are buttons and Saldo is not a button and has no `aria-pressed`; keyboard activation works through native buttons (a click on the button element and focusability asserted) (AC 7 of the click story)
- [x] With `type` Income in the filters Receitas has `aria-pressed="true"` and the others "false"; with `type` Expense, Despesas; with `categoryId` of the Investments category, Investimentos (AC 4)
- [x] Activating an inactive Receitas calls `onSelectType("Income")`, Despesas `onSelectType("Expense")` and Investimentos `onSelectCategory(<id of the key "Investments">)`; activating an active one calls the same callback with `undefined` (AC 1, 2, 3 and 5)
- [x] With `type` Expense active, activating Receitas selects Income, and with another `categoryId` active, Investimentos selects the Investments id (AC 6)
- [x] When the category list lacks the key `Investments`, or has not loaded, or failed, Investimentos is plain text with no button (AC 9)
- [x] When the list holds a user category named "Investments" (key null) and the system category has another name, the button selects the id of the key (AC 10; the real API protects system categories from renaming, so the test models the name difference with a canned list)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 818 web tests pass (793 existing plus 25 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the summary card`

---

### T10: Create the pagination component

**What**: `Pagination` (nav "Paginação do extrato"; the text "N transações · Página X de Y"; the "Itens por página" select with 25, 50 and 100; "Anterior"; numbered buttons from `pageNumbers` with `aria-current` and names `Página N`; ellipsis as non-button; "Próxima"; `hidden sm:flex` numbered group, `flex-wrap` bar and `min-h-9 min-w-9` buttons) with component tests.
**Where**: `web/src/features/transactions/Pagination.tsx`
**Depends on**: T5, T6
**Reuses**: `web/src/features/transactions/pageNumbers.ts`, `web/src/features/transactions/usePageSize.ts`, `web/src/components/ui/select.tsx`, `web/src/components/ui/button.tsx`
**Requirement**: TLIST-13, TLIST-14

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] For 120 rows with page size 50 on page 1 the bar shows "120 transações · Página 1 de 3", buttons "1", "2", "3" and "Anterior" disabled and "Próxima" enabled (AC 6 and 8 of the pagination story)
- [x] The page button of the current page has `aria-current="page"`, the others have no `aria-current`, and the ellipsis elements are not buttons, for 100 pages at pages 1, 5, 50 and 100 (AC 7)
- [x] On the last page "Próxima" is disabled and "Anterior" is enabled (AC 8)
- [x] "Anterior", "Próxima" and a numbered button call `onPageChange` with the previous, next and clicked page; the current page button does not call it (AC 9)
- [x] One page (50 rows of 50) shows only "1" with both navigation buttons disabled, and 51 rows of 50 show two pages (AC 10, edge case)
- [x] The page count uses the `pageSize` prop (the API size) and not the selected size (AC 12)
- [x] The select named "Itens por página" shows the selected size and lists exactly "25", "50", "100" in that order (AC 14 and 15)
- [x] Choosing 25 calls `onPageSizeChange(25)` and choosing 100 calls `onPageSizeChange(100)` (AC 16, component side)
- [x] The numbered group carries `hidden sm:flex`, the bar `flex-wrap` and the buttons `min-h-9 min-w-9` (AC 11)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 836 web tests pass (818 existing plus 18 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): add the pagination component`

---

### Phase 4: Extrato

### T11: Mount the summary card and the pagination in the extrato

**What**: `TransactionsPage` renders `SummaryCard` between the filters and the list (not while the period is inverted), wires `onSelectType` and `onSelectCategory` to `changeFilter`, replaces the footer with `Pagination` fed by `usePageSize`, sends `pageSize` only when it is not 50, clears the row selection when it changes and resets to page 1; integration tests in new `extrato` files.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T9, T10
**Reuses**: `web/src/features/transactions/extratoClearFilters.test.tsx` (`lightList`, fake clock), `web/src/features/transactions/extratoFilters.test.tsx`, `web/src/test/apiSpy.tsx`
**Requirement**: TLIST-08, TLIST-09, TLIST-10, TLIST-14, TLIST-15

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [x] The extrato requests `/transactions/summary` once on open with no parameters and shows the API values in a region "Resumo do extrato" placed after the filters and before the list (AC 8 and 2 of the card story)
- [x] Changing each of Tipo, Conta, Categoria, Neutra, De, Até, the quick month and the search sends a new summary request with that filter, and none of `sort`, `order`, `page` or `pageSize` (AC 8 and 10)
- [x] Next page, "Página N" button, sorting by a column and changing the page size send no new summary request (assertion on the `apiSpy` log) (AC 9)
- [x] A summary failure keeps the list and a list failure keeps the card; "Tentar novamente" of the card requests only the summary (AC 5 and 7)
- [x] With an inverted period no card is rendered and no summary request is sent (AC 13)
- [x] Clicking Receitas from page 2 sends `type=Income&page=1` and the Tipo select shows "Receita" with its "x"; clicking again removes `type`; Despesas and Investimentos (the id of the key `Investments`) do the same with their parameter; each keeps the other filters and the sort (AC 1 to 6, 8 of the click story)
- [x] The footer text "N transações · Página X de Y" and "Anterior"/"Próxima" still work as before, and the page count uses the `pageSize` of the response (AC 6, 9 and 12 of the pagination story)
- [x] With 120 rows the bar shows buttons "1", "2", "3"; clicking "Página 3" requests `page=3`; the summary count and values are the API ones, not the sum of the rows on screen (AC 12 of the card story)
- [x] With total 0 no pagination is rendered (AC 13)
- [x] Opening without a stored size sends no `pageSize` and the select shows 50; choosing 25 from page 2 sends `pageSize=25&page=1`, stores `"25"` and clears the row selection; choosing 100 sends `pageSize=100`; choosing 50 sends none (AC 14, 16 and 17)
- [x] A stored `"100"` makes the first list request carry `pageSize=100`; an invalid stored value falls back to the default with no `pageSize` (AC 18 and 19)
- [x] "Limpar filtros" keeps the chosen size and `FilterState` has no `pageSize` (AC 21)
- [x] The existing `extrato*` and `transactions` suites pass with no assertion weakened (only structure adjusted where the new card or buttons require it)
- [x] `TransactionsPage.tsx` ends shorter than its 741 lines
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 871 web tests pass (836 existing plus 35 new; no silent deletions); TransactionsPage.tsx 740 lines (was 741)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-list): mount the summary and pagination in the extrato`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1   (independent)         T2 ------→ T3
Phase 2:  T4 (after T1 and T3) ------→ T6, T7 (after T4)     T5 (independent)
Phase 3:  T8 (independent)  T9 (after T7, T8)  T10 (after T5, T6)
Phase 4:  T11 (after T9, T10)
```

Execution is strictly sequential, in the order T1 to T11 - there is no intra-phase parallelism.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: pageSize in the list | 1 query parameter and the response size in one route file | ✅ Granular |
| T2: investment fragments | 3 constants in the rules module | ✅ Granular |
| T3: summary endpoint | 1 endpoint with its query module and mount | ✅ Granular |
| T4: web types and mocks | 1 contract change through types and mock handlers | ✅ Granular |
| T5: page number list | 1 function | ✅ Granular |
| T6: page size hook | 1 hook | ✅ Granular |
| T7: summary query | 1 query with its key and invalidation | ✅ Granular |
| T8: summary colors | 1 style module and its contrast test | ✅ Granular |
| T9: summary card | 1 component | ✅ Granular |
| T10: pagination | 1 component | ✅ Granular |
| T11: mount in the extrato | 1 file, two imports and one removed footer | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | None | none | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T1, T3 | T1, T3 | ✅ Match |
| T5 | None | none | ✅ Match |
| T6 | T4 | T4 | ✅ Match |
| T7 | T4 | T4 | ✅ Match |
| T8 | None | none | ✅ Match |
| T9 | T7, T8 | T7, T8 | ✅ Match |
| T10 | T5, T6 | T5, T6 | ✅ Match |
| T11 | T9, T10 | T9, T10 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: pageSize in the list | API routes, schema and OpenAPI | integration | integration | ✅ OK |
| T2: investment fragments | API rules fragments | integration | integration | ✅ OK |
| T3: summary endpoint | API routes, schema and OpenAPI | integration | integration | ✅ OK |
| T4: web types and mocks | Mock handlers (behavior) and types | unit | unit | ✅ OK |
| T5: page number list | Web pure helpers | unit | unit | ✅ OK |
| T6: page size hook | Web components and hooks | unit | unit | ✅ OK |
| T7: summary query | Web components and hooks | unit | unit | ✅ OK |
| T8: summary colors | Web pure helpers and styles | unit | unit | ✅ OK |
| T9: summary card | Web components and hooks | unit | unit | ✅ OK |
| T10: pagination | Web components and hooks | unit | unit | ✅ OK |
| T11: extrato mount | Web components and hooks | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| TLIST-01 | T3 |
| TLIST-02 | T3 |
| TLIST-03 | T2, T3 |
| TLIST-04 | T2, T3 |
| TLIST-05 | T1 |
| TLIST-06 | T1, T3 |
| TLIST-07 | T4 |
| TLIST-08 | T9, T11 |
| TLIST-09 | T7, T11 |
| TLIST-10 | T9, T11 |
| TLIST-11 | T8 |
| TLIST-12 | T5 |
| TLIST-13 | T10 |
| TLIST-14 | T6, T10, T11 |
| TLIST-15 | T11 |

**Notes for the worker**: `api/openapi.json` is regenerated in T1 and T3 and never edited by hand. Web tests that depend on time use the fake `Date` and timers of `extratoClearFilters.test.tsx` (`shouldAdvanceTime`), no fixed sleeps, no raised timeouts, no month or year dropdown of the DatePicker, and each new test stays well under 3 s alone; every test of a return to page 1 starts from page 2. Prove each new guard test with a quick mutation in a temporary git worktree on the external volume (never in the real tree, never `git stash`) and record the proof in the commit body. The box "browser check by the owner" of the spec stays open: no agent logs in to the app.

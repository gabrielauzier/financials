# Validation: dashboards (backend T1-T13 + web T14-T20), iteration 1 - PASS

**Verdict**: PASS

Every in-scope AC (DASH-01..DASH-07), the CARD-05 cross-feature requirement and all three spec edge cases have `file:line` evidence that asserts the spec-defined outcome. All gates are green: api 263 unit + 473 integration, web 284 (3 runs), typecheck clean, lint 0 errors, 0 skips, OpenAPI in sync. The sensor injected 102 behavior-level mutants (64 API, 38 web) plus 5 database-object probes. 90 code mutants were killed, 3 are provably equivalent (R12, I2, E9), 1 is not testable in jsdom (W7c) and 8 survived as real test gaps: E6, E16, E24, E17, E18, E20 (API) and W19, W27 (web). The survivors do not touch a critical path (money storage, authorization, data integrity, the shared calculation rules): every rules.ts clause, every sign, every window bound that the spec defines, the RLS role and the validation of returns are all killed. The implementation was not found wrong in any probe; the gaps are weak assertions at month boundaries and on UI text, listed as fix tasks (non-blocking, same policy as the credit-expenses report).

**Iteration**: 1
**Date**: 2026-10-05
**Spec**: `.specs/features/dashboards/spec.md` (also `design.md`, `tasks.md`, `lovable.md` "Contrato da API" which overrides design.md, `.specs/STATE.md` AD-001..AD-005, `.specs/LESSONS.md`)
**Diff range**: `17e70ef..HEAD`, 20 feature commits (T1 `6f993c7` .. T20 `61955d4`) after the docs commit `17e70ef`. `HEAD` = `61955d409ea63f1e87a4aa58267bcb1e26575365`, branch `feat/dashboards`.
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in the temporary worktrees `/Volumes/MacOnlySSD/dev/personal/.verify-dash` (api) and `.verify-dash-web` (web), both removed. DB-object probes ran inside rolled-back psql transactions.

## Scope

- Backend: `supabase/migrations/0006_investment_returns.sql`, `api/src/modules/dashboards/{rules,time,routes}.ts`, `api/src/modules/investmentReturns/{validation,routes}.ts`, `api/src/app.ts` (2 registrations), `api/openapi.json`, and the tests under `api/src/modules/dashboards/*.test.ts`, `api/src/modules/investmentReturns/validation.test.ts`, `api/test/dashboards-*.int.test.ts`, `api/test/investment-returns*.int.test.ts`, `api/test/helpers/dashboards.ts`.
- Web: `web/src/features/dashboard/*`, `web/src/lib/api/{errorMessages,types}.ts`, `web/src/lib/api/mock/{dashboard,investmentReturns,dates}.ts`, `web/src/routes/index.tsx`, `web/src/test/apiSpy.tsx`, `web/vitest.config.ts`.

Documented decisions treated as the spec of record: the reversal row name comes from the seeded category name ("Estorno (de compras)"); `/dashboard/categories` and `/dashboard/card` need both `from` and `to` or neither; credit expenses ignore the period; future-dated returns and transactions are excluded from the net worth; any account of the user (inactive too) is accepted for returns.

Test file legend (basenames in the evidence tables): `dashboards-rules.int.test.ts`, `dashboards-last-30-days.int.test.ts`, `dashboards-trend.int.test.ts`, `dashboards-categories.int.test.ts`, `dashboards-net-worth.int.test.ts`, `dashboards-card.int.test.ts`, `dashboards-isolation.int.test.ts`, `investment-returns.int.test.ts`, `investment-returns-schema.int.test.ts` are in `api/test/`; `time.test.ts` and `rules.guard.test.ts` are in `api/src/modules/dashboards/`; `validation.test.ts` is in `api/src/modules/investmentReturns/`; the web tests are in `web/src/features/dashboard/` unless a path is shown.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1). 94 boxes are ticked and 0 are unticked (`grep -c "^- \[ \]"` returns 0).

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 migration 0006 | ✅ Done | `6f993c7` | RLS, check `amount <> 0`, composite FK, truncate revoked |
| T2 rules.ts | ✅ Done | `0d36111` | - |
| T3 time.ts | ✅ Done | `84996d5` | - |
| T4 last-30-days | ✅ Done | `3b11faa` | - |
| T5 trend | ✅ Done | `d67018c` | - |
| T6 categories | ✅ Done | `01c5cd3` | - |
| T7 net-worth | ✅ Done | `258092b` | - |
| T8 card | ✅ Done | `86a7144` | - |
| T9 POST returns | ✅ Done | `5d22fd2` | - |
| T10 GET returns | ✅ Done | `d53b780` | - |
| T11 PATCH/DELETE returns | ✅ Done | `2db0837` | - |
| T12 rules duplication guard | ✅ Done | `b460a40` | - |
| T13 isolation test | ✅ Done | `5c08863` | - |
| T14 last 30 days card | ✅ Done | `7dbeebd` | - |
| T15 trend chart | ✅ Done | `11c76e0` | - |
| T16 category breakdown | ✅ Done | `1c0ec11` | - |
| T17 net worth chart | ✅ Done | `7523ee9` | - |
| T18 card view | ✅ Done | `e94cc54` | - |
| T19 returns list and form | ✅ Done | `6b3939e` | - |
| T20 page and route `/` | ✅ Done | `61955d4` | - |

Process notes (cosmetic, non-blocking):
- `tasks.md` still says `**Status**: Draft` (line 12), and `spec.md` traceability (lines 190-196) still shows DASH-01..DASH-07 "Pending". See the traceability table at the end.
- The commit subjects are 40-69 characters, all within the 72 limit, and match the `Commit:` lines of tasks.md.
- `web/vitest.config.ts` gained `testTimeout: 15_000` (see Gate Check for the flakiness judgement).

---

## Spec-Anchored Acceptance Criteria

### P1: Regras de cálculo (DASH-01)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Expense = non-neutral, non-CreditCard, non-Investments Expenses minus Reversal Incomes | Fixed set with one of each special row gives exactly the spec total | `dashboards-rules.int.test.ts:60` `toEqual({ income: '1000.00', expense: '100.00', net: '900.00' })` (100 + 20 Reversal-typed Expense + 10 invoice payment - 30 Reversal Income); `:75` `expense '50.00'` (80 - 30); `:78-81` Reversal typed Expense is a normal `'20.00'` | ✅ PASS |
| 2. Income = non-neutral, non-CreditCard Incomes that are not Investments or Reversal | Reversal Income is never income | `dashboards-rules.int.test.ts:60` `income '1000.00'`; `:75` `income '0.00'` with a 30.00 Reversal; `dashboards-trend.int.test.ts:84-89` `income '500.00', expense '100.00', balance '400.00'` | ✅ PASS |
| 3. Neutral rows ignored in income, expense and net worth | Zero effect | `dashboards-rules.int.test.ts:63-68` all-ignored set gives `{ '0.00', '0.00', '0.00' }`; `dashboards-last-30-days.int.test.ts:79` `total '75.00'`; `dashboards-net-worth.int.test.ts:99` `current '630.00'`; `dashboards-categories.int.test.ts:127` `toEqual([])` | ✅ PASS |
| 4. CreditCard rows ignored in income, expense and net worth | Zero effect | same tests as AC 3 plus `dashboards-card.int.test.ts:114` `expect(await snapshot()).toEqual(before)` | ✅ PASS |
| 5. Investments rows ignored in income, expense and net worth | Zero effect | same tests as AC 3 (`dashboards-trend.int.test.ts:84-89`, `dashboards-net-worth.int.test.ts:99`) | ✅ PASS |
| 6. One single module used by every panel | Only `rules.ts` knows the rules | `rules.guard.test.ts:148-151` `scanForDuplicatedRules(srcRoot)` `toEqual([])` on the real tree; `:153-169` fails on a copy naming file and line; `:171-176` flags a copy of the real `rules.ts`; `:178-195` ignores non-SQL uses. Sensor: R1-R11 killed (each clause lives only in `rules.ts` and the 5 queries embed it with `rule()`) | ✅ PASS |
| 7. Ignore transactions dated after today | Future rows excluded everywhere | `dashboards-rules.int.test.ts:63-68` (2 future rows in the ignored set); `dashboards-trend.int.test.ts:98` `points[11]` zero; `dashboards-categories.int.test.ts:128`; `dashboards-net-worth.int.test.ts:123` `'100.00'` with 999.00 and 888.00 in the future; `dashboards-card.int.test.ts:138` | ✅ PASS |

### P1: Despesas dos últimos 30 dias (DASH-02)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Total of the 30 calendar days ending today | Window `[D-29, D+1)` local | `dashboards-last-30-days.int.test.ts:38` `toEqual({ total: '150.00', previousTotal: '100.00', changePct: 50 })`; per zone `:91` (SP, UTC, Tokyo) first window instant counts and the 1 ms before counts as previous (`total '10.00', previousTotal '4.00', changePct 150`); unit `time.test.ts:18-37` (SP, UTC, DST in New York) | ✅ PASS |
| 2. Percentage change against the previous 30 days | 100 + 50 vs 100 gives 150.00 and +50% | `dashboards-last-30-days.int.test.ts:38` `changePct: 50`; `:64` `changePct: -66.7` (1 decimal, drop negative); web `Last30DaysCard.test.tsx:23-24` `"R$ 150,00"` and `"+50,0%"` | ✅ PASS ⚠️ SPG-2 |
| 3. Previous total zero gives "sem base de comparação" | `changePct` null and the text | API `dashboards-last-30-days.int.test.ts:45` `toEqual({ total: '80.00', previousTotal: '0.00', changePct: null })`; web `Last30DaysCard.test.tsx:43-44` text shown and `queryByText(/%/)` absent | ✅ PASS |
| 4. No expenses gives R$ 0,00 | `'0.00'` | `dashboards-last-30-days.int.test.ts:52` `toEqual({ total: '0.00', previousTotal: '0.00', changePct: null })`; web `Last30DaysCard.test.tsx:50` `"R$ 0,00"` | ✅ PASS |

### P1: Tendência de 12 meses (DASH-03)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. 12 calendar months, the current one and the 11 previous | 12 points oldest first | `dashboards-trend.int.test.ts:54` months `toEqual(Array.from({ length: 12 }, (_, i) => monthKey(11 - i)))`; unit `time.test.ts:54-60` (year boundary); web `TrendChart.test.tsx:61-75` 12 rows "out/25".."set/26" | ✅ PASS (⚠️ oldest month has no data in any API test, mutant E6) |
| 2. Balance = income minus expense | per month | `dashboards-trend.int.test.ts:56-58` (`balance '700.00'`, `'-40.50'`, `'10.00'`); `:84-89` `'400.00'`; web `TrendChart.test.tsx:92-105` `"-R$ 300,00"` | ✅ PASS |
| 3. Month without transactions shows R$ 0,00 | 0.00 in all three | `dashboards-trend.int.test.ts:59-61` 9 empty months `toEqual({ month, ...ZERO })`; `:64-69` user without data; web `TrendChart.test.tsx:76-81` three `"R$ 0,00"` cells | ✅ PASS |
| 4. Month of the date in the local time zone | 23:30 on the last day stays in that month | `dashboards-trend.int.test.ts:106-107` (SP: month -1 has `'25.00'`, current `'0.00'`); `:114-119` (UTC: next month); unit `time.test.ts:72-85`, `:126-130` | ✅ PASS |

### P1: Gastos por categoria (DASH-04)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Current month grouped by category, Portuguese names | Default period current local month | `dashboards-categories.int.test.ts:53-58` names `Transporte`, `Alimentação` (150.25), `Compras`; `:85-93` default period `[{ name: 'Alimentação', total: '12.00' }]` (row on the 1st at 00:05 counts, the day before does not) | ✅ PASS |
| 2. Selected period recalculates | New range | `dashboards-categories.int.test.ts:97-98` (`'2026-03-16'..'2026-03-31'` gives `[]`, `'03-15'..'03-15'` gives 1); web `CategoryBreakdown.test.tsx:55-69` new request per option, `:71-92` custom range | ✅ PASS |
| 3. Rules applied to each value | shared rules | `dashboards-categories.int.test.ts:120-128`; `:65-83` the sum over the last-30-days window equals the last-30-days total (`last30.total '40.40'`, cents `4040`) | ✅ PASS |
| 4. Reversal shown negative in *Estorno* | `-30.00` row | `dashboards-categories.int.test.ts:57` `{ name: 'Estorno (de compras)', total: '-30.00' }`; web `CategoryBreakdown.test.tsx:99-102` `"-R$ 50,00"`, `data-reversal`, share `"—"` | ✅ PASS ⚠️ SPG-1 |
| 5. Sum of categories = total expense | exact | `dashboards-categories.int.test.ts:62` `expect(cents).toBe(40025)` (200.00 + 150.25 + 80.00 - 30.00); `:82` `expect(cents).toBe(4040)` against the independent last-30-days total | ✅ PASS |
| 6. No expenses shows the empty state | `[]` / text | `dashboards-categories.int.test.ts:97,100`; `:103-111` zero-sum category omitted; web `CategoryBreakdown.test.tsx:109-111` "Sem despesas no período" and no table | ✅ PASS |

### P1: Patrimônio (DASH-05)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Current = income - expense + returns | 1000 - 300 + 50 = 750.00 | `dashboards-net-worth.int.test.ts:53` `current toBe('750.00')`; the return counts (mutant E11 killed) | ✅ PASS |
| 2. Series with one point per month, cumulative to month end | no gaps | `dashboards-net-worth.int.test.ts:65-71` `[1000.00, 1050.00, 750.00, 750.00]` over 4 consecutive months; `:80-84` series starts at the first return, negative return counted; web `NetWorthChart.test.tsx:39-43` rows | ✅ PASS (⚠️ return on the 1st of a month, mutant E17) |
| 3. No data gives R$ 0,00 and empty series | `{ '0.00', [] }` | `dashboards-net-worth.int.test.ts:104` `toEqual({ current: '0.00', series: [] })`; web `NetWorthChart.test.tsx:51-53` "R$ 0,00" and "Ainda não há movimentações" | ✅ PASS |
| 4. Reversal counts positive | `+30.00` | `dashboards-net-worth.int.test.ts:99` `current '630.00'` (1000 - 400 + 30); `dashboards-rules.int.test.ts:89` `net toBe('-470.00')` (+30 - 500) | ✅ PASS |
| 5. Invoice payment counts as expense | Expense on the account statement | `dashboards-net-worth.int.test.ts:91,99` (Boleto Expense 400.00 reduces to 630.00); `dashboards-rules.int.test.ts:86-89` | ✅ PASS ⚠️ SPG-9 |

### P1: Lançamentos de rendimento (DASH-06)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Valid date, non-zero amount, account creates the return | 201 with the row | `investment-returns.int.test.ts:35-42` `toEqual({ id: stringMatching(UUID_SHAPE), accountId, accountNickname: 'Corretora', occurredOn: '2026-10-01', amount: '50.00', notes: 'CDB' })`; `:45-51` negative and canonical `'-20.50'`, `'7.00'`; web `InvestmentReturns.test.tsx:176-182` body `amount: "-1234.56"` | ✅ PASS |
| 2. Zero or more than 2 decimals rejected with invalid-value message | 422 `invalid_amount`; "Valor inválido" | API `investment-returns.int.test.ts:63-67` (`'0','0.00','-0','-0.00','00.0'`), `:72-75` (`'1.234'`, JSON numbers, malformed), `{ error: { code: 'invalid_amount', field: 'amount' } }`; unit `validation.test.ts:15-19`; DB `investment-returns-schema.int.test.ts:38-40` `/investment_returns_amount_check/`; web `InvestmentReturns.test.tsx:149-157` `"Valor inválido"` for `0,00` and `10,123`, no POST | ✅ PASS |
| 3. Edit or delete persists and recalculates the net worth on the next read | net worth changes | `investment-returns.int.test.ts:195-201` 50.00 then edit to -20.50 gives `'-20.50'`; `:271-277` +50 and -20 give `'30.00'`, delete of the 50 gives `'-20.00'`; web `InvestmentReturns.test.tsx:223-236` PATCH body, `:263-282` DELETE; `DashboardPage.test.tsx:124-143` net worth refetched after delete | ✅ PASS |
| 4. List ordered by date descending | newest first | `investment-returns.int.test.ts:147-151` `[2026-09-30, 2026-03-10, 2026-01-02]` whatever the insertion order; `:164` tie broken by newest created; web `InvestmentReturns.test.tsx:64-84` | ✅ PASS |
| 5. `user_id`, RLS, `uuid` id | per-user rows | `investment-returns.int.test.ts:36` uuid id; `investment-returns-schema.int.test.ts:86-113` select hidden, update/delete count 0 for another user, forged insert refused; `dashboards-isolation.int.test.ts:105-145` 404 on foreign PATCH/DELETE, no foreign account | ✅ PASS |
| 6. Last return older than 30 days highlights the date | amber and reminder after 30 days | API `investment-returns.int.test.ts:153` `lastDate '2026-09-30'`, `:136` `null`; web `InvestmentReturns.test.tsx:89-114` `it.each` `2026-09-15` not stale (30 days), `2026-09-14` stale (`data-stale`, `bg-amber-50`, "Atualize seus rendimentos") with now = 2026-10-15 | ✅ PASS |

### P1: Visão de cartão (DASH-07)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. CreditCard rows by category in the period, with total | two in Alimentação sum | `dashboards-card.int.test.ts:60-63` `[{ 'Alimentação', '65.50' }, { 'Transporte', '10.00' }]` (the PIX row of 500.00 is excluded); web `CardView.test.tsx:41-47` | ✅ PASS |
| 2. Active, Once, ToCancel credit expenses with remaining | total - paid by category | `dashboards-card.int.test.ts:90-93` `[{ 'Entretenimento', '500.00' }, { 'Utilidades', '40.00' }]` (600-200 + 100-0; Inactive and Canceled excluded) for three different periods | ✅ PASS |
| 3. Not summed in income, expense or net worth | CARD-05 | `dashboards-card.int.test.ts:106` `current '880.00'`, `:114` all four endpoint payloads `toEqual(before)` after a credit expense and 2 CreditCard rows (one neutral) are added; `:69` neutral card row absent from categories | ✅ PASS |
| 4. Period without card purchases shows the empty state | empty lists | `dashboards-card.int.test.ts:126,128`; web `CardView.test.tsx:62-66` both section texts and the notice | ✅ PASS |

### Cross-feature: CARD-05 (credit expenses and card rows do not move the dashboard totals)

| Requirement | Spec-defined outcome | `file:line` + assertion | Result |
| ----------- | -------------------- | ----------------------- | ------ |
| Credit expense not in income, expense, trend, category or net worth | Totals identical before and after creating one | `dashboards-card.int.test.ts:97-122` (`before` of last-30-days, trend, categories and net-worth equals `after` at `:114`); sensor E12 (changing the net-worth cumulation) and R2 (dropping the CreditCard clause) are killed by this and the sibling tests | ✅ PASS |
| Shown only in the card view | card endpoint holds it | `dashboards-card.int.test.ts:121` `creditExpenses toEqual([{ 'Entretenimento', '500.00' }])`; `:90-93` | ✅ PASS |

**Status**: all ACs covered. 5 spec-precision gaps flagged (below), 0 uncovered ACs.

---

## Edge Cases

- [x] **No account or transaction: every panel shows R$ 0,00 and the empty state.** API: `dashboards-last-30-days.int.test.ts:52`, `dashboards-trend.int.test.ts:64-69`, `dashboards-categories.int.test.ts:100`, `dashboards-net-worth.int.test.ts:104`, `dashboards-card.int.test.ts:126`, `dashboards-isolation.int.test.ts:76-85` (a user without data on all 6 endpoints). Web: `DashboardPage.test.tsx:76-100` (`R$ 0,00`, 36 zero trend cells, all empty texts).
- [x] **Browser time zone change recalculates windows and months on the next read.** `dashboards-trend.int.test.ts:101-120` (the 23:30 row moves to the next month under UTC), `dashboards-net-worth.int.test.ts:126-134`, `dashboards-categories.int.test.ts:131-138`, `dashboards-card.int.test.ts:141-145`, `dashboards-last-30-days.int.test.ts:82-93` (SP, UTC, Tokyo; first window instant and the 1 ms before), unit `time.test.ts:18-37,72-85`. The same header drives all endpoints; the "23:30 local month border" is asserted in `America/Sao_Paulo` and `UTC`.
- [x] **A neutral CreditCard transaction stays out of the totals and appears in the card view.** `dashboards-card.int.test.ts:66-70` (`[{ 'Compras', '15.00' }]` in the card view and `{ items: [] }` in the categories).

Further boundaries checked: inactive account rows count (`dashboards-rules.int.test.ts:92-100`, `dashboards-net-worth.int.test.ts:107-112`); a renamed Reversal still abates because rules match `c.key` (`dashboards-rules.int.test.ts:102-107`); a Reversal typed Expense is a normal expense (`:78-81`, `dashboards-categories.int.test.ts:113-118`); `invalid_period` 422 with the field (`dashboards-categories.int.test.ts:140-154`, `dashboards-card.int.test.ts:147-158`); invalid zone header 400 (`dashboards-last-30-days.int.test.ts:95-99`); 401 on every route (`dashboards-isolation.int.test.ts:147+`).

---

## Gate Check

- **Commands** (Build gate in tasks.md): `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`, all exit 0.
- **api**: unit 15 files, 263 passed. Integration 38 files, 473 passed (120 s). Typecheck clean, lint clean.
- **web**: 39 files, 284 passed. Typecheck clean. Lint: 0 errors and 7 warnings (`react-refresh/only-export-components`, all in pre-existing files `components/ui/*` and `auth/useSession.tsx`; none in the feature).
- **Test count before the feature**: api 209 unit + 365 integration and web 199 (credit-expenses addendum). **After**: api 263 + 473, web 284. **Delta**: +54 unit, +108 integration, +85 web. `git diff --numstat 17e70ef..HEAD` shows no deletion in any test file (only additions); `apiSpy.tsx` adds `responses` and one route-key rule.
- **Skips**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api web/src` finds 0 matches (after dropping `process.exit(`).
- **OpenAPI in sync**: `pnpm openapi:export` in the scratch worktree leaves `git status` clean and `cmp` with the real `api/openapi.json` is identical.
- **`testTimeout: 15_000` and flakiness**: the web suite ran 3 times (284/284 each) plus 38 mutant runs under load (the 3 survivors and every control ran green, no timeout failure). The timeout only raises the ceiling for a test that is slow in parallel; it does not touch the Testing Library `waitFor` window (1 s), so assertions stay strict. Every killed web mutant failed on an assertion (spec value or text), not on a timeout, so the larger ceiling hides nothing. Tests that wait for a never-resolving promise only assert the skeleton and do not depend on the timeout.

---

## Discrimination Sensor

**Depth**: full (P0-style: money, rules, authorization, data integrity). **Scratch**: two worktrees on the external volume at `HEAD` with symlinked `node_modules`; each mutant restored with `git checkout -- <file>`. Covering tests: API `vitest unit --bail 1 && vitest int --bail 1 test/dashboards test/investment-returns` (control green first), web `vitest --bail 1 src/features/dashboard src/lib/api`. A pure no-op control (E23) survived as expected, proving the harness reports survivors.

### Backend (64 mutants, 55 killed)

| # | File:line | Mutation | Result | Killing test |
| - | --------- | -------- | ------ | ------------ |
| R1 | `rules.ts:21` | Drop `NOT t.neutral` | ✅ Killed | `dashboards-last-30-days.int.test.ts:67` |
| R2 | `rules.ts:22` | Drop `payment_method <> 'CreditCard'` | ✅ Killed | `dashboards-last-30-days.int.test.ts:67` |
| R3 | `rules.ts:23` | Drop `c.key <> 'Investments'` | ✅ Killed | `dashboards-last-30-days.int.test.ts:67` |
| R4a | `rules.ts:24` | Drop `occurred_at <= now()` from COUNTABLE | ✅ Killed | `dashboards-categories.int.test.ts:120` |
| R5 | `rules.ts:34` | Flip Reversal sign (`-t.amount` to `t.amount`) | ✅ Killed | `dashboards-last-30-days.int.test.ts:67` |
| R6 | `rules.ts:33` | Reversal typed Expense no longer an expense | ✅ Killed | `dashboards-categories.int.test.ts:103` |
| R7 | `rules.ts:41` | Reversal Income counted as income | ✅ Killed | `dashboards-net-worth.int.test.ts:87` |
| R8 | `rules.ts:53` | Card view includes future purchases | ✅ Killed | `dashboards-card.int.test.ts:131` |
| R9 | `rules.ts:57` | Card refund added instead of subtracted | ✅ Killed | `dashboards-card.int.test.ts:72` |
| R10 | `rules.ts:60` | Credit expenses include `Inactive` | ✅ Killed | `dashboards-card.int.test.ts:80` |
| R11 | `rules.ts:60` | Credit expenses drop `ToCancel` | ✅ Killed | `dashboards-card.int.test.ts:80` |
| R12 | `rules.ts:14` | Drop `c.user_id = t.user_id` from the join | ⚪ Survived, **equivalent** | composite FK `transactions (category_id, user_id)` (migration 0003 line 29) makes the clause redundant |
| T1 | `time.ts:38` | Window start D-30 | ✅ Killed | `time.test.ts:18` |
| T2 | `time.ts:38` | Window end excludes today | ✅ Killed | `time.test.ts:18` |
| T3 | `time.ts:43` | Previous start D-60 | ✅ Killed | `time.test.ts:41` |
| T4 | `time.ts:43` | Previous end D-28 (overlap) | ✅ Killed | `time.test.ts:41` |
| T5 | `time.ts:59` | Month list shifted by one | ✅ Killed | `time.test.ts:54` |
| T6 | `time.ts:76` | `monthsFrom` stops before the current month | ✅ Killed | `time.test.ts:113` |
| T7 | `time.ts:64` | `localMonth` ignores the zone | ✅ Killed | `time.test.ts:126` |
| T8 | `time.ts:28` | `localDay` uses UTC | ✅ Killed | `time.test.ts:18` |
| T9 | `time.ts:112` | Period end exclusive of the `to` day | ✅ Killed | `time.test.ts:94` |
| T10 | `time.ts:111` | `start > end` becomes `>=` (single-day period rejected) | ✅ Killed | `time.test.ts:94` |
| T11 | `time.ts:58` | `last12Months` uses UTC | ✅ Killed | `time.test.ts:62` |
| E1 | `routes.ts:118` | `changePct` 0 instead of null when previous is 0 | ✅ Killed | `dashboards-last-30-days.int.test.ts:41` |
| E2 | `routes.ts:119` | Round to 2 decimals | ✅ Killed | `dashboards-last-30-days.int.test.ts:55` |
| E3 | `routes.ts:111` | Previous total uses the current window | ✅ Killed | `dashboards-last-30-days.int.test.ts:27` |
| E4 | `routes.ts:148` | Balance = income + expense | ✅ Killed | `dashboards-trend.int.test.ts:43` |
| E5 | `routes.ts:135` | Trend query excludes the current month | ✅ Killed | `dashboards-trend.int.test.ts:110` |
| E6 | `routes.ts:134` | Trend query starts at the second month (drops the oldest month's data) | ❌ **Survived** → fix task 1 | none: no API test seeds a row in the month 11 back |
| E8 | `routes.ts:87` | Categories default period = last 30 days | ✅ Killed | `dashboards-card.int.test.ts:131` and `dashboards-categories.int.test.ts:85` |
| E9 | `routes.ts:88` | Lone bound reaches `periodWindow(undefined)` | ⚪ Survived, **equivalent** in output: still 422 `invalid_period` with the same `field` (`from` lone gives `to`, `to` lone gives `from`); only the message text differs and tests use `expect.any(String)` |
| E10 | `routes.ts:94` | `invalid_period` answers 400 | ✅ Killed | `dashboards-card.int.test.ts:147` |
| E7 | `routes.ts:167` | Categories keep zero-sum groups (`having` removed) | ✅ Killed | `dashboards-categories.int.test.ts:43` (the Income row forms a 0.00 group, so a `Salários` row appears) |
| E11 | `routes.ts:209` | Net worth ignores returns | ✅ Killed | `investment-returns.int.test.ts:191` |
| E12 | `routes.ts:208` | Net worth not cumulative | ✅ Killed | `dashboards-card.int.test.ts:97` |
| E13 | `routes.ts:191` | Series starts at the latest first month | ✅ Killed | `dashboards-net-worth.int.test.ts:56` |
| E14 | `routes.ts:205` | Future returns counted in the net worth | ✅ Killed | `dashboards-net-worth.int.test.ts:114` |
| E15 | `routes.ts:213` | `current` = first series point | ✅ Killed | `dashboards-net-worth.int.test.ts:56` |
| E16 | `routes.ts:183` | First-transaction lookup includes future rows | ❌ **Survived** → fix task 3 | none: no net-worth test with only future-dated rows |
| E24 | `routes.ts:184` | First-return lookup includes future returns | ❌ **Survived** → fix task 3 | none (same scenario: by code reading, only future rows would give an empty month list and a 500; not executed) |
| E17 | `routes.ts:209` | Return dated on the 1st of next month counted in the previous point (`<` to `<=` on the date bound) | ❌ **Survived** → fix task 2 | none: every net-worth test dates returns on day 10 |
| E18 | `routes.ts:208` | Transaction at exactly the month-end instant counted in the previous point | ❌ **Survived** → fix task 2 | none: no row at exactly 00:00 local on the 1st |
| E19 | `routes.ts:232` | Remaining = total (paid ignored) | ✅ Killed | `dashboards-card.int.test.ts:80` |
| E20 | `routes.ts:229` | Card transactions keep zero-sum categories | ❌ **Survived** → fix task 4 | none: no purchase and refund that net to 0 (spec silent, SPG-5) |
| E21 | `routes.ts:227` | Card view lists non-CreditCard rows | ✅ Killed | `dashboards-card.int.test.ts:52` |
| E22 | `routes.ts:222` | Card accepts a lone bound (defaults the other) | ✅ Killed | `dashboards-card.int.test.ts:131` |
| E26 | `routes.ts:168` | Categories order ascending | ✅ Killed | `dashboards-categories.int.test.ts:43` |
| E27 | `routes.ts:230` | Card transactions order ascending | ✅ Killed | `dashboards-card.int.test.ts:52` |
| E28 | `routes.ts:237` | Credit expenses order ascending | ✅ Killed | `dashboards-card.int.test.ts:80` |
| E29 | `routes.ts:110` | Total counts only `type = 'Expense'` (no Reversal abatement) | ✅ Killed | `dashboards-categories.int.test.ts:65` |
| I1 | `plugins/db.ts:27` | `set local role authenticated` removed (RLS bypass) | ✅ Killed | `dashboards-isolation.int.test.ts:65,76` (also run alone as I1b) |
| I2 | `investmentReturns/routes.ts:67` | Drop `a.user_id = r.user_id` from the list join | ⚪ Survived, **equivalent** | composite FK `(account_id, user_id)` (0006 line 13) and RLS make it redundant |
| I3 | `routes.ts:235` | Credit expenses filtered by period | ✅ Killed | `dashboards-card.int.test.ts:80` |
| I4 | `routes.ts:211` | Net-worth series ordered descending | ✅ Killed | `dashboards-card.int.test.ts:97` |
| V1 | `validation.ts:19` | Zero amount allowed | ✅ Killed | `validation.test.ts:15` |
| V2 | `validation.ts:4` | 3 decimals allowed | ✅ Killed | `validation.test.ts:15` |
| V3 | `routes.ts:93` | Foreign account check removed | ✅ Killed | `investment-returns.int.test.ts:83` |
| V4 | `routes.ts:130` | List ascending | ✅ Killed | `investment-returns.int.test.ts:139` |
| V5 | `routes.ts:131` | `lastDate` = oldest date | ✅ Killed | `investment-returns.int.test.ts:139` |
| V6 | `routes.ts:171` | DELETE of unknown id answers 204 | ✅ Killed | `investment-returns.int.test.ts:266` |
| V7 | `validation.ts:20` | Sign dropped | ✅ Killed | `validation.test.ts:5` |
| V8 | `routes.ts:130` | Tie-break oldest created first | ✅ Killed | `investment-returns.int.test.ts:156` |
| V9 | `routes.ts:152` | PATCH skips the own-account check | ✅ Killed | `investment-returns.int.test.ts:225` |
| V10 | `routes.ts:145` | Malformed id reaches the database (500) | ✅ Killed | `investment-returns.int.test.ts:246` |
| E23 | control | no-op edit | ⚪ Survived as intended (harness control, not counted) | - |

Counting the sensor: 64 unique API mutants (R1-R12 with R4a, T1-T11, E1-E22 except the control E23 with E7 re-run, E24, E26-E29, I1-I4, V1-V10). 55 killed, 3 equivalent (R12, I2, E9), 6 non-equivalent survivors (E6, E16, E24, E17, E18, E20).

### DB objects (5 probes, rolled-back psql transactions with savepoints)

Probes ran inside `BEGIN ... ROLLBACK` against the local stack with two throwaway `auth.users` rows created in the transaction; table row counts before and after are identical (auth.users 1, accounts 1, categories 17, transactions 0, credit_expenses 1, investment_returns 0), and no object named `%probe%` remains.

| # | Mutation | Control | Mutant | Test that asserts the control |
| - | -------- | ------- | ------ | ----------------------------- |
| DB1 | `disable row level security` | foreign user sees 0 rows | sees 1 | `investment-returns-schema.int.test.ts:90` `toHaveLength(0)` |
| DB2 | Policy `using (true) with check (true)` | 0 rows | 1 | `investment-returns-schema.int.test.ts:90` |
| DB3 | Drop `investment_returns_amount_check` | `violates check constraint "investment_returns_amount_check"` | zero stored | `investment-returns-schema.int.test.ts:38-40` |
| DB4 | `grant truncate ... to authenticated` | `permission denied` | table emptied | `investment-returns-schema.int.test.ts:63` |
| DB5 | Drop the composite FK | `violates foreign key constraint "investment_returns_account_id_user_id_fkey"` | foreign-account row stored | `investment-returns-schema.int.test.ts:52` |

### Web (38 mutants, 35 killed)

| # | File:line | Mutation | Result | Killing test |
| - | --------- | -------- | ------ | ------------ |
| W1 | `Last30DaysCard.tsx:24` | null change not handled | ✅ Killed | `Last30DaysCard.test.tsx:39` |
| W2 | `Last30DaysCard.tsx:30-31` | Red and green swapped | ✅ Killed | `Last30DaysCard.test.tsx:29` |
| W3 | `TrendChart.tsx:89` | Oldest month dropped from the table | ✅ Killed | `TrendChart.test.tsx:57` |
| W4 | `TrendChart.tsx:56` | Zero months filtered out | ✅ Killed | `TrendChart.test.tsx:57` |
| W5 | `period.ts:31` | Current-month start on day 2 | ✅ Killed | `CardView.test.tsx:30` |
| W6 | `hooks.ts:31` | Categories query key without the period (no refetch) | ✅ Killed | `CategoryBreakdown.test.tsx:55` |
| W7 | `shares.ts:14` | Negative row counted in the share base | ✅ Killed | `CategoryBreakdown.test.tsx:44` |
| W7b | `CategoryBreakdown.tsx:81` | Estorno not highlighted | ✅ Killed | `CategoryBreakdown.test.tsx:94` |
| W7c | `CategoryBreakdown.tsx:28` | Negative row included in the pie data | ⚠️ Survived, not testable in jsdom | the chart is `aria-hidden` and Recharts renders no slices at 0 size; the table (which is asserted) is unaffected. Non-blocking |
| W8 | `CategoryBreakdown.tsx:45` | Empty state never shown | ✅ Killed | `CategoryBreakdown.test.tsx:107` |
| W9 | `InvestmentReturns.tsx:42` | `>` becomes `>=` (30 days is stale) | ✅ Killed | `InvestmentReturns.test.tsx:89` |
| W9b | `InvestmentReturns.tsx:31` | Threshold 31 | ✅ Killed | `InvestmentReturns.test.tsx:89` |
| W10 | `money.ts:13` | Sign dropped from the BRL conversion | ✅ Killed | `money.test.ts:4` |
| W11a | `hooks.ts:57-61` | Create does not invalidate the net worth | ✅ Killed | `investmentReturnsHooks.test.tsx:58` |
| W11b | `hooks.ts:69-73` | Delete does not invalidate the net worth | ✅ Killed | `DashboardPage.test.tsx:124` |
| W11c | `hooks.ts:102-106` | Update does not invalidate the net worth | ✅ Killed | `investmentReturnsHooks.test.tsx:68` |
| W12 | `hooks.ts:100` | Optimistic rollback removed | ✅ Killed | `investmentReturnsHooks.test.tsx:92` (PATCH and refetch both fail, L-011) |
| W13 | `api.ts:16` | `from` and `to` swapped | ✅ Killed | `CardView.test.tsx:30` |
| W14 | `CardView.tsx:78-80` | Not-in-totals notice removed | ✅ Killed | `CardView.test.tsx:30` |
| W15 | `CardView.tsx:94` | Remaining value altered | ✅ Killed | `CardView.test.tsx:30` |
| W16 | `Last30DaysCard.tsx:9` | "+" sign dropped | ✅ Killed | `Last30DaysCard.test.tsx:20` |
| W17 | `InvestmentReturns.tsx:119` | "+" prefix dropped | ✅ Killed | `InvestmentReturns.test.tsx:59` |
| W17b | `InvestmentReturns.tsx:116` | Gain/loss colors swapped | ✅ Killed | `InvestmentReturns.test.tsx:59` |
| W18 | `InvestmentReturns.tsx:140` | Delete without confirmation | ✅ Killed | `InvestmentReturns.test.tsx:263` |
| W19 | `InvestmentReturnForm.tsx:82` | Edit no longer sends `notes: null` (cleared notes not persisted) | ❌ **Survived** → fix task 5 | none: no test clears the notes of an existing return |
| W20 | `period.ts:41` | Last 90 days uses 91 days | ✅ Killed | `CategoryBreakdown.test.tsx:55` |
| W21 | `period.ts:36` | Previous month ends on the 1st | ✅ Killed | `CategoryBreakdown.test.tsx:55` |
| W22 | `months.ts:19` | Month abbreviations off by one | ✅ Killed | `NetWorthChart.test.tsx:19`, `TrendChart.test.tsx:57` |
| W23 | `Last30DaysCard.tsx:9` | Percentage with 0 decimals | ✅ Killed | `Last30DaysCard.test.tsx:20` |
| W24 | `shares.ts:17` | Share truncated instead of rounded | ✅ Killed | `shares.test.ts:14` |
| W25 | `period.ts:45` | Custom range from after to accepted | ✅ Killed | `CategoryBreakdown.test.tsx:71` |
| W26 | `InvestmentReturnForm.tsx:66` | Account not required | ✅ Killed | `InvestmentReturns.test.tsx:161` |
| W27 | `InvestmentReturnForm.tsx:118` | Account select hides inactive accounts | ❌ **Survived** → fix task 6 | none (the documented decision "inactive accounts accepted" is untested on the web) |
| W28 | `NetWorthChart.tsx:47` | Net-worth empty state never shown | ✅ Killed | `NetWorthChart.test.tsx:48` |
| W29 | `isoDate.ts:12` | `daysSince` off by one | ✅ Killed | `InvestmentReturns.test.tsx:89` |
| W30 | `CategoryBreakdown.tsx:33` | No loading skeleton | ✅ Killed | `CategoryBreakdown.test.tsx:114` |
| W31 | `errorMessages.ts:14` | `invalid_period` text removed | ✅ Killed | `errorMessages.test.ts` (new test "maps the dashboard code invalid_period") |
| W32 | `DashboardPage.tsx:20` | Net worth panel removed from the page | ✅ Killed | `DashboardPage.test.tsx:33` |

**Sensor depth**: full. **Result**: 102 code mutants (64 API + 38 web). 90 killed, 4 equivalent or untestable (R12, I2, E9, W7c) and 8 real survivors of which E16/E24 are one scenario. DB probes 5/5 confirmed. Every survivor is a test-strength gap on a month boundary or UI text, none on a rule clause, sign, window, authorization or validation, so the sensor passes with fix tasks. The two survivors in the net-worth month bounds (E17, E18) and the oldest trend month (E6) are the most worth closing.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / no scope creep | ✅ (nits below) |
| Surgical changes | ✅ `app.ts` +4 lines (2 imports and 2 registrations); `errorMessages.ts` adds `invalid_period`, `invalid_date`, one account context branch; existing codes unchanged; `apiSpy.tsx` adds a `responses` map |
| Matches patterns | ✅ Same shape as the transactions and credit-expenses modules (`withUser`, `AppError` codes, TypeBox schemas with the no-coercion `x-openapi-type` technique for amounts, 404 before body-dependent 422) |
| Money as strings (AD-004) | ✅ SQL `numeric(14,2)::text`; `parseSignedAmount` works on the string; the web converts BRL to a decimal string without floats (`money.ts`, tested at `money.test.ts:35`). `Number()` appears only to feed Recharts (`TrendChart.tsx:33-35`, `CategoryBreakdown.tsx:53`, `NetWorthChart.tsx:57`); every visible value is formatted from the API string |
| Rules single-sourced (AD-003, DASH-01.6) | ✅ `rules.ts` holds all fragments; the guard test scans the tree and the 5 queries only embed fragments through `rule()` |
| Time boundaries in one place (AD-005) | ✅ `time.ts` with Luxon; windows passed as parameters; tested in SP, UTC, Tokyo and New York (DST) |
| Spec-anchored outcome check (asserted values match spec numbers) | ✅ 150.00 and +50 (`dashboards-last-30-days.int.test.ts:38`), 750.00 (`dashboards-net-worth.int.test.ts:53`), +30 and -20 net worth (`investment-returns.int.test.ts:271,277`), cents 40025 and 4040 (`dashboards-categories.int.test.ts:62,82`) |
| Per-layer Coverage Expectation (unit 1:1 pure logic; routes happy + edge + error) | ✅ time, validation and guard unit tests; every route has happy, edge and error tests; RLS and constraints exercised directly |
| Every test maps to a spec requirement - no unclaimed tests | ✅ Reverse mapping below |
| Documented guidelines followed | none in repo; tasks.md matrix and `.specs/LESSONS.md` applied (L-001 401 matrix `dashboards-isolation.int.test.ts:147`, L-005 no coercion `investment-returns.int.test.ts:72`, L-011 rollback with the refetch also failing `investmentReturnsHooks.test.tsx:92`, L-013 failure path of the destructive action `InvestmentReturns.test.tsx:284`) |

**Shallow-assertion check**: none found. API tests assert whole payloads with `toEqual`; the 4-endpoint snapshot at `dashboards-card.int.test.ts:114` compares full bodies; DB probes confirm the schema tests discriminate. Web tests assert exact request paths (`CategoryBreakdown.test.tsx:48`), exact bodies (`InvestmentReturns.test.tsx:176`) and Portuguese text (never the API message: `:190-205`, `:284-299`).

**Reverse mapping (check C)**: every new test maps to an AC, a listed edge case or a Done-when item. Supporting tests that map to design.md or the lovable contract rather than a spec AC: 401 per route (design: `withUser`), invalid zone header 400 (design error table), `invalid_period`/`invalid_date` mapping (`errorMessages.test.ts`), the mock contract tests (`web/src/lib/api/mock/dashboard.test.ts`, lovable "Mocks"), skeleton and retry per panel (lovable `DashboardPage`), `shares.test.ts`, `isoDate.test.ts`, `money.test.ts` (lovable component rules). None is unclaimed.

Nits (non-blocking):
- `web/src/lib/api/mock/dashboard.ts` (+162 lines) re-implements the aggregates for the mock mode, which is what the mock area is for, but it is a second copy of the arithmetic; its contract is pinned by `dashboard.test.ts`, so drift against the API is only caught by the wire-shape checks, not by shared fixtures.
- The share percentage in `CategoryBreakdown` (`shares.ts`) is computed in the front on integer cents. lovable.md asks for "valor e percentual" and "não reimplemente regras de cálculo no front"; this is display arithmetic, consistent with the checklist item only if percentages are not treated as totals. Flagged for the author's judgement (SPG-6).
- `InvestmentReturnForm.tsx:25` default date uses `toLocalDateInput(new Date().toISOString())`, which is the browser-local date, correct (the credit-expenses UTC nit does not apply here).
- `routes.ts:93` in dashboards computes the offending field with up to two extra `periodWindow` calls; correct and tested, slightly clever.

---

## Fix Plans (survivors that are not provably equivalent)

All are test-only changes; none touches source code. Priority "Minor" means the behavior is correct today and only the test is weak.

### Fix 1 (Major among the minors): the oldest trend month is never asserted (E6)
- **Root cause**: `dashboards-trend.int.test.ts` seeds rows only 5, 3, 2 and 1 months back, so a query window that drops the first of the 12 months passes.
- **Fix task**: add a row at `midMonth(11)` and assert `points[0]` equals `{ month: monthKey(11), income, expense, balance }`, plus a row in the month 12 back asserted absent.
- **Priority**: Major (DASH-03.1 boundary).

### Fix 2: net-worth month boundaries (E17, E18)
- **Root cause**: net-worth tests place returns and transactions mid-month.
- **Fix task**: in `dashboards-net-worth.int.test.ts` add (a) a return dated on the 1st of the current month and one on the last day of the previous month, asserting the previous point excludes the first and the current point includes it; (b) a transaction at exactly 00:00 local on the 1st asserting it belongs to the new month.
- **Priority**: Major.

### Fix 3: only future-dated rows (E16, E24)
- **Root cause**: the "ignores future" test also has past data, so a future first month never reaches the empty `monthsFrom`.
- **Fix task**: a user with only a future-dated transaction and a future-dated return gets `{ current: '0.00', series: [] }` (not a 500).
- **Priority**: Minor.

### Fix 4: card category netting to zero (E20)
- **Root cause**: no purchase and refund of equal value in one category; the spec is silent on whether a 0.00 row is listed (SPG-5).
- **Fix task**: decide the outcome in the spec (omit, like the categories panel), then assert it in `dashboards-card.int.test.ts`.
- **Priority**: Minor.

### Fix 5: cleared notes on edit (W19)
- **Root cause**: the edit test keeps the notes; nothing asserts that emptying the field sends `notes: null`.
- **Fix task**: in `InvestmentReturns.test.tsx`, edit a row with notes, empty the "Observações" field, save, and assert the PATCH body has `notes: null` and the row shows "—".
- **Priority**: Minor (same lesson as credit-expenses W5).

### Fix 6: inactive account in the returns form (W27)
- **Root cause**: `includeInactive` on the account select of the form has no test, although inactive accounts are an accepted decision (API test `investment-returns.int.test.ts:94-99`).
- **Fix task**: deactivate a mock account and assert it is offered (marked "(inativa)") when creating and when editing a row that uses it.
- **Priority**: Minor.

W7c (pie data with the negative row) cannot be asserted in jsdom; accept, or assert the chart data through a mocked Recharts if desired.

---

## Spec-Precision Gaps

- **SPG-1**: DASH-04.4 says the Reversal appears in the category "*Estorno*", but the name shown is the seeded category name "Estorno (de compras)". Tests pin that name (`dashboards-categories.int.test.ts:57`); the web highlights by negative sign, not by name. The spec should state the display name.
- **SPG-2**: DASH-02.2 does not define the percentage format. The API returns `changePct` as a number rounded to 1 decimal (`-66.7` pinned at `dashboards-last-30-days.int.test.ts:64`) and the web prints `"+50,0%"`. The spec shows "+50%".
- **SPG-3**: Wire shape, `invalid_period` (422 with `field`), partial period handling and the default period of the card view exist only in lovable.md and the backend decisions, not in the spec ACs.
- **SPG-4**: DASH-06.6 "mais de 30 dias" does not say how days are counted. Implemented as whole local calendar days from the last return date to the local today; pinned at 30 (no reminder) and 31 (reminder) in `InvestmentReturns.test.tsx:89-114`.
- **SPG-5**: DASH-07 does not define card refunds (an Income on a CreditCard row subtracts from its category, pinned at `dashboards-card.int.test.ts:72-78`), zero-net categories (mutant E20), the order of rows, or that credit expenses ignore the period (pinned at `:89-94`).
- **SPG-6**: Percentages in the category table are a display value computed in the front from API totals; the spec asks only for the values.
- **SPG-7**: P1 "Patrimônio" says the series starts at "a primeira transação ou rendimento"; the implementation uses the first non-future transaction of any kind (even a neutral, CreditCard or Investments one) or return, so such a row creates a series of 0.00 points. Not defined by the spec.
- **SPG-8**: DASH-05.5 names the invoice payment ("Expense no extrato da conta") but the rules identify it only as an ordinary non-CreditCard Expense; there is no marker, which the tests mirror (`dashboards-rules.int.test.ts:86` only names it for readability).

---

## Isolation Proof

- Real tree: `git status --porcelain` showed `?? .DS_Store` before and after the sensor; the only new files are this report and the lessons state. `HEAD` is still `61955d4`.
- `git worktree list` shows only the main worktree. The `node_modules` symlinks were unlinked before `git worktree remove --force`, then `git worktree prune`. Neither `.verify-dash` nor `.verify-dash-web` exists. The real `api/node_modules` and `web/node_modules` are intact.
- DB: probes ran only in rolled-back transactions; row counts per table are identical before and after; no `%probe%` relation exists. `db:reset` was never run. The integration mutants wrote through the test helpers (`createTestUser`, cleaned up by `cleanupTestUsers`); the counts after equal the counts before.
- No leftover `vitest` processes.

---

## Requirement Traceability Update (suggested; spec.md not edited by the Verifier)

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| DASH-01 | Pending | ✅ Verified |
| DASH-02 | Pending | ✅ Verified |
| DASH-03 | Pending | ✅ Verified (⚠️ fix task 1) |
| DASH-04 | Pending | ✅ Verified |
| DASH-05 | Pending | ✅ Verified (⚠️ fix tasks 2, 3) |
| DASH-06 | Pending | ✅ Verified (⚠️ fix tasks 5, 6) |
| DASH-07 | Pending | ✅ Verified (⚠️ fix task 4) |
| CARD-05 (credit-expenses) | Pending | ✅ Verified here (`dashboards-card.int.test.ts:97-122`) |

---

## Summary

**Overall**: ✅ Ready, with 6 test-only fix tasks recommended before merge.

**Spec-anchored check**: 7/7 DASH stories and CARD-05 matched the spec outcome; 8 spec-precision gaps flagged (none blocks an AC).
**Sensor**: 102 code mutants plus 5 DB probes; 90 killed, 4 equivalent or untestable, 8 survivors turned into 6 fix tasks.
**Gate**: api 263 unit + 473 integration, web 284 (3 runs), typecheck and lint clean, OpenAPI in sync.

**What works**: one rules module reused by all 5 queries, enforced by a guard test; windows and months computed in SP, UTC and DST zones; Reversal, invoice payment, neutral, CreditCard, Investments and future rows handled as specified; returns CRUD with strict signed-amount validation, RLS and composite FK; net-worth invalidation after every returns mutation; per-panel loading, error and empty states.

**Issues found**: the 6 fix tasks above (month-boundary and UI-text assertions). No defect in the implementation was demonstrated.

**Next steps**: implement fix tasks 1-3 (API tests) and 5-6 (web tests), decide fix 4 in the spec, then update `spec.md` traceability and `tasks.md` status.

---

## Addendum: fix tasks closed (2026-10-05)

All 6 test-only fix tasks are closed; no implementation file changed and no defect surfaced.

| Fix | Survivors | Test added | Proof (mutation in a temporary worktree, reverted) |
| --- | --------- | ---------- | -------------------------------------------------- |
| 1 | E6 | `dashboards-trend.int.test.ts` oldest month (11 back) asserted as `points[0]`, month 12 back absent | trend query starting at `months[1]` fails it |
| 2 | E17, E18 | `dashboards-net-worth.int.test.ts` return on the 1st and transaction at 00:00 local on the 1st, in America/Sao_Paulo and UTC | `<=` on the date bound fails the return tests; `<=` on the month-end instant fails the transaction tests |
| 3 | E16, E24 | `dashboards-net-worth.int.test.ts` only future-dated rows give 200, `current` "0.00", `series` [] | dropping either future filter fails it |
| 4 | E20 | `dashboards-card.int.test.ts` zero-sum category omitted; decision recorded in `spec.md` Assumptions | removing the `having` clause fails it |
| 5 | W19 | `InvestmentReturns.test.tsx` clearing notes sends `notes: null` and the row shows a dash | sending `undefined` instead of `null` fails it |
| 6 | W27 | `InvestmentReturns.test.tsx` the form offers inactive accounts, marked "(inativa)", on create and edit | dropping `includeInactive` fails both tests |

Traceability updated: `spec.md` DASH-01..DASH-07 Verified, `credit-expenses/spec.md` CARD-05 Verified, `tasks.md` Status Complete.

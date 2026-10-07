# Validation: transactions-list (T1-T11), iteration 2 - PASS (pending the owner's decision on the Investimentos total and the owner's browser steps)

**Verdict**: PASS. The iteration 2 Verifier closed every iteration 1 fix task and left one test-only blocker (the large-sum test covered the expense column only, mutants S20b and S20c). The orchestrator closed it in commit `4954649` and proved it with both float8 mutants (income and investments), which now fail the new test. That last step was not re-verified by a fresh agent. Still open for the owner: the meaning of the Investimentos total (spec.md, AC 11) and the logged-in, app-level browser steps.

**Date**: 2026-10-06
**Iteration**: 1 (independent Verifier; the author's self-report is in `tasks.md` and the commit bodies)
**Spec**: `.specs/features/transactions-list/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md` AD-001..AD-005, `.specs/LESSONS.md` L-004, L-006, L-013, L-014, L-015, L-020, L-021, L-023, L-024, L-027, L-034, L-039, L-040, L-041), `docs/v1/plano-melhoria-transacoes.md`, `docs/PRD.md`, `.specs/features/dashboards/spec.md`.
**Diff range**: `4facfa3^..HEAD` (docs commit `4facfa3`, then T1 `3e78a81`, T2 `8704756`, T3 `a5c7703`, T4 `ce8eb70`, T5 `9fe7b6a`, T6 `0b7f001`, T7 `418b7ca`, T8 `1a47f66`, T9 `835e684`, T10 `09a8f63`, T11 `4f4b0d5`, and the author's status commit `4675b2b`), branch `feat/transactions-list`.
**Verifier**: fresh agent (author != verifier), no sub-agents. Read-only on the real tree. Mutants, the base-commit timing runs and the browser probe ran only in temporary git worktrees on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-tl`, `.verify-tl-base` at `484b1e6`, `.verify-tl-probe`), all removed with `git worktree remove --force` and `git worktree prune` (`git worktree list` shows the real tree and the pre-existing `.fix-ci` only). `git status --porcelain` of the real tree is identical before and after (five untracked paths: `.DS_Store`, `docs/v1/ajustes-pontuais.md`, `docs/v1/plano-ajustes-pontuais.md`, `docs/v2/`, `references/nubank_extrato_setembro.csv`). No `db:reset`, no hosted Supabase or Vercel, no `git stash`, no credentials read, printed or created (the probe page ran on the app's mock API with dummy Supabase variables).

Test file legend: API tests are in `api/test/`; web tests are in `web/src/features/transactions/` unless a full path is shown.

---

## Task completion

`tasks.md` has 11 tasks, status Done, 112 ticked boxes and 0 unticked; one commit per task and each subject matches its `Commit:` line. T11 "ends shorter than 741 lines": `TransactionsPage.tsx` is 740 lines (`git show 4facfa3^:...` gives 741). The tasks.md claim that the owner's browser box stays open is respected (no agent logged in). All 11 tasks are complete.

## Spec-anchored acceptance criteria (evidence-or-zero)

I re-derived every numeric expectation of the API suite by hand from the 19-row fixed dataset in `transactions-summary.int.test.ts:40-61` (rules: income = Income that is not Reversal; expense = Expense minus Reversal Income; neutral, CreditCard, future-dated and, for income and expense, Investments rows never count). Unfiltered: income 1000 + 40 (inactive account) = 1040.00; expense 100 + 20 (Reversal typed Expense) + 10 + 15 + (0.10 + 0.20 + 0.20 + 0.40) - 30 (Reversal Income) = 115.90; investments 200 - 5 = 195.00; balance 924.10; count 19. Also by hand: `type=Expense` 12 rows, expense 145.90, investments 200.00; `type=Income` 7 rows, income 1040.00, expense -30.00, investments -5.00, balance 1070.00; Food 9 rows and expense 115.90; Reversal 2 rows, expense -10.00; active account 17 rows (income 1000.00, expense 100.90); inactive 2 rows (40.00 and 15.00); `from=2026-01-10` 18 rows, expense 115.70; `to=2026-01-09` only Borda 2 (0.20); `from=2026-01-10&to=2026-01-12` 15 rows, expense 115.30; UTC day Jan 10 holds Borda 2 and Borda 1 (0.30); `type=Expense&categoryId=Food&from=2026-01-10` 8 rows, expense 115.70. Every literal in the tests agrees with my derivation.

**Dashboard parity, beyond the suite**: the suite compares the summary with `INCOME_VALUE` and `EXPENSE_VALUE` over `COUNTABLE` run as SQL (`transactions-summary.int.test.ts:157-175`). I added a throwaway integration test (scratch worktree only, deleted) that seeds the same neutral, CreditCard, Investments, Reversal Income, Reversal Expense, future-dated and inactive-account rows and calls the real dashboard routes: the summary `balance` equals `GET /dashboard/net-worth` `current`, the summary `expense` equals both the sum of `GET /dashboard/categories` totals and the sum of `GET /dashboard/trend` expenses, and the summary `income` equals the sum of the trend incomes. It passed. The filter-free summary therefore equals what the dashboard queries compute for the same rows.

### P1: Resumo do filtro na API (TLIST-01 to TLIST-04)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| TLIST-01 AC1 | 200, exactly count, income, expense, investments, balance; money matches `^-?\d+\.\d{2}$` | `transactions-summary.int.test.ts:109` `expect(Object.keys(body).sort()).toEqual(['balance','count','expense','income','investments'])`; `:112` `toMatch(/^-?\d+\.\d{2}$/)` | OK |
| TLIST-01 AC2 | 401 without and with an invalid token | `transactions-summary.int.test.ts:117` and `:123` `expect(...statusCode).toBe(401)` | OK |
| TLIST-01 AC3 | only the user's rows | `transactions-summary.int.test.ts:133` other user `toEqual({count:2, income:'9000.00', ...})`, `:134` owner `toMatchObject({count:19, income:'1040.00', expense:'115.90'})`; mutant S19 (RLS bypassed) killed | OK |
| TLIST-02 AC4 | `count` equals list `total`, no filter | `transactions-summary.int.test.ts:299-301` (it.each, first entry is the empty query) `expect(count).toBe(await listTotal(...))`; `:177-182` `toBe(19)` | OK |
| TLIST-02 AC5 | same semantics as the list for from, to, accountId, categoryId, type, neutral, q (X-Timezone days, case and accent blind, AND) and count equal to the list total | `:244-251` boundary days (`count: 18`, `count: 1`, `count: 15`); `:253-259` UTC vs São Paulo (`count: 1` then `count: 2`); `:261-264` `q=CAFE` count 1; `:266-274` AND; `:299-309` count vs list total per filter and per timezone | OK |
| TLIST-02 AC6 | 422 `validation_error` with the field for bad type, neutral, from, to, accountId, categoryId | `:317-332` `toEqual({ error: { code: 'validation_error', message: expect.any(String), field } })` for 7 inputs, and the list gives the same body | OK |
| TLIST-02 AC7 | sort, order, page, pageSize ignored | `:311-315` `expect(await summary(owner, 'sort=amount&order=asc&page=9&pageSize=25')).toEqual(plain)` and the invalid-value variant | OK |
| TLIST-03 AC8 | 200, `count` 0 and four `"0.00"` | `:137-140` `toEqual({ count: 0, ...zeros })` (mutants S4, S5 killed) | OK |
| TLIST-03 AC9 | income and expense by the rules of `rules.ts` | `:144-155` `toEqual({count:19, income:'1040.00', expense:'115.90', investments:'195.00', balance:'924.10'})`; `:205-210` Reversal-only expense `'-30.00'`; rules killed: R9, R10, R11 | OK |
| TLIST-03 AC10 | neutral, CreditCard, future excluded from income, expense, investments; Investments also out of income and expense; `count` keeps them | `:177-182` count 19; `dashboards-rules.int.test.ts:129-139` `toMatchObject({ investments: '7.00', investmentRows: 1 })`; `:141-145` `toMatchObject({ countable: 5, investmentRows: 2, both: 0 })`; mutants R1 to R4, R7 killed | OK |
| TLIST-03 AC11 | investments = Expense sum minus Income sum of the Investments rows; not in balance | `:144-155` `investments: '195.00'`, `:212-220` `investments: '-15.50', balance: '0.00'`; `dashboards-rules.int.test.ts:124` `investments: '195.00'`; mutants R6, R8, S3, S9 killed | OK, but see the spec-precision gap on the meaning of "investments" |
| TLIST-03 AC12 | balance = income - expense, negative allowed | `:202` `balance: '-0.30'`, `:209` `balance: '30.00'`, `:148` `'924.10'`; mutants S1, S2 killed | OK |
| TLIST-03 AC13 | money computed and formatted in the database, 0.10 + 0.20 is exactly `"0.30"` | `:195-203` `expense: '0.30'` | Spec-precision gap: the example cannot discriminate a float sum, because the final `::numeric(20,2)` rounds it back (mutant S20, `sum(...::float8)`, survives). Code review confirms no `number` touches money in `summary.ts`. |
| TLIST-04 AC14 | unfiltered income and expense equal the dashboard rules totals on the fixed set | `:157-165` `expect({income, expense}).toEqual(rules)` (rules computed with the fragments in SQL); my extra check against the dashboard routes above | OK |
| TLIST-04 AC15 | per-filter literals for type, category, account (active and inactive), neutral, period, search | `:224-231` four literal rows, `:233-237` Food/Investments/Reversal, `:239-242` accounts, `:244-264`; all hand-verified above | OK |
| TLIST-04 AC16 | only future rows: money zero, count = rows | `:184-193` `toEqual({ count: 3, ...zeros })` | OK |
| TLIST-04 AC17 | no `Investments`, `Reversal`, `CreditCard` key in SQL outside `rules.ts` | `api/src/modules/dashboards/rules.guard.test.ts:148` guard passes on the tree; mutant S17 (a quoted key added to `summary.ts`) killed by it | OK |

### P1: Tamanho da página na API (TLIST-05, TLIST-06)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| TLIST-05 AC1 | no `pageSize`: up to 50 items, `pageSize` 50 | `transactions.int.test.ts:394` `toMatchObject({ total: 120, page: 1, pageSize: 50 })` and `toHaveLength(50)` | OK |
| TLIST-05 AC2 | 25, 50, 100: that many items, same total, used size | `transactions.int.test.ts:400` and `:406` (remainder 20 on the last page of each size) | OK |
| TLIST-05 AC3 | `0`, `10`, `101`, `abc`, empty, `050`, `50.0`, ` 50` give 422 on `pageSize` | `transactions.int.test.ts:414` `toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'pageSize' } })` over 13 values (all 8 of the spec plus `30`, `125`, `+50`, `1e2`, `-25`); mutants P1, P4, P5, P10 killed | OK |
| TLIST-05 AC4 | page past the end: `items: []`, total, used size | `transactions.int.test.ts:430` `toEqual({ items: [], total: 120, page: 1000, pageSize: size })` | OK |
| TLIST-05 AC5 | pages of 25, 50, 100 give the same ids in the same order, equal instants included | `transactions.int.test.ts:435` `expect(ids).toEqual(expected)` against `order by occurred_at desc, id desc`, with every 10th row sharing an instant | OK |
| TLIST-05 AC6 | size applies to the filtered and sorted set | `transactions.int.test.ts:447` first 25 amounts `1, 4, ... 73`, second page starts at `'76.00'` | OK |
| TLIST-06 AC7 | openapi: summary with seven filters and five fields; `pageSize` in query and response enum 25, 50, 100 | `swagger.int.test.ts:124` `toMatchObject({ type: 'integer', enum: [25, 50, 100] })`, query description exact; `:148` parameters `toEqual` the seven names, response keys and `required` `toEqual` the five; the committed file is current (existing test in the same file); mutants P9, S14, S16, S18 killed | OK |

### P1: Tipos e mocks do web (TLIST-07)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| AC1 | `PageSize = 25 \| 50 \| 100`; `TransactionSummary` numeric `count` plus four strings | `web/src/lib/api/mock/transactions.test.ts:220` `@ts-expect-error` on `pageSize: 30` (typecheck gate); `:269` summary strings | OK |
| AC2 | mock list: 25 or 100 items and the size; default 50 | `transactions.test.ts:182`, `:188` (25, 50, 100), `:198` (page 2 of 25 continues page 1); mutants M10, M12 killed | OK |
| AC3 | mock list rejects other sizes with 422 on `pageSize` | `transactions.test.ts:209` (`"30"`, `"0"`, `"101"`, `""`, `"050"`); mutant M11 killed | OK |
| AC4 | mock summary: list filters plus rules in integer cents | `transactions.test.ts:269` rules on one row of each special case, `:280` a type filter leaves the Reversal Income out, `:312` `10 + 10.5 = 20.50`; mutants M1 to M7, M13, M14 killed; M9 equivalent; M8 (the mock summary drops the `neutral` filter) survives, no test filters the mock by neutral | OK with a low gap |
| AC5 | sort, order, page, pageSize ignored by the mock summary | `transactions.test.ts:297` `toEqual` the plain summary, with an invalid `pageSize` | OK |

### P1: Cartão de resumo no extrato (TLIST-08, TLIST-09, TLIST-11)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| TLIST-08 AC1 | count and four values formatted as the API strings (`"1234.56"` to "R$ 1.234,56", `"-50.00"` to "-R$ 50,00") | `SummaryCard.test.tsx:70-81` `toHaveTextContent("R$ 1.234,56")`, Saldo `"-R$ 50,00"`; `extratoSummary.test.tsx:55-62`; mutants C12, C13 killed | OK |
| TLIST-08 AC2 | between filters and list; green, red, blue; balance by sign; values smaller than the count | `extratoSummary.test.tsx:65-68` `compareDocumentPosition(...)` filters before card before table; `SummaryCard.test.tsx:83-106` `toHaveClass(...classesOf(tone))` (income, expense, investments, positive, negative, zero); `:108-113` `text-4xl` vs `text-lg`; mutants C16, C20, Y1 to Y8 killed | OK; painted in a real browser, see Browser |
| TLIST-08 AC3 | "transação" for 1; "transações" for 0 and above 1; pt-BR thousands | `SummaryCard.test.tsx:115-128` (1, 0, 5, 1234 gives "1.234"); mutants C1, C2, C3 killed | OK |
| TLIST-08 AC4 | skeleton named "Carregando resumo", no values | `SummaryCard.test.tsx:139-145` `findByRole("status", { name: "Carregando resumo" })`, `queryByText(/R\$/)` null; mutants C14, C17 killed | OK |
| TLIST-08 AC5 | failure text, "Tentar novamente" repeats only the summary | `SummaryCard.test.tsx:147-160` `expect(added.map(r => r.path)).toEqual(["/transactions/summary"])`; `extratoSummary.test.tsx:81`; mutant C15 killed | OK |
| TLIST-08 AC6 | empty: count 0 and four "R$ 0,00" | `SummaryCard.test.tsx:130-136` `getAllByText("R$ 0,00")).toHaveLength(4)`; `extratoPagination.test.tsx:98-102` | OK |
| TLIST-08 AC7 | summary failure keeps the list; list failure keeps the card | `extratoSummary.test.tsx:81` and `:100` | OK |
| TLIST-09 AC8 | one summary request on open with no parameters; a new one when De, Até, Conta, Categoria, Tipo, Neutra, busca or mês rápido changes | `extratoSummary.test.tsx:57` `toEqual(["/transactions/summary"])`; `:131-171` it.each over the 8 controls, `expect(lastSummaryParams()).toEqual(await expected())` | OK |
| TLIST-09 AC9 | page, sort, size changes do not requery the summary | `extratoSummary.test.tsx:176-187` `expect(summaryPaths()).toEqual(["/transactions/summary"])`; `summaryHooks.test.tsx:90`; `extratoPagination.test.tsx:154`; mutants H1 to H4, W12 (equivalent: `summaryFilters` already strips `page`) | OK |
| TLIST-09 AC10 | the request carries the filters and none of sort, order, page, pageSize | `extratoSummary.test.tsx:168-171`; `summaryHooks.test.tsx:63`; mutants H1 to H4, H12 killed | OK |
| TLIST-09 AC11 | create, edit, delete, bulk recategorize refetch the summary | `summaryHooks.test.tsx:143`, `:159`, `:168`, `:184`; mutants H6 to H9, H13 killed | OK |
| TLIST-09 AC12 | values are the API ones, not a sum of the page | `extratoSummary.test.tsx:71-79` `findByText("R$ 9.999,99")`, count "3.000" while the list has 3 rows | OK |
| TLIST-09 AC13 | inverted period: no card, no request | `extratoSummary.test.tsx:108-119` `queryByRole("region", { name: "Resumo do extrato" })` null, `summaryPaths()).toHaveLength(2)` unchanged; `summaryHooks.test.tsx:81`; mutants W5, C21, H10 killed | OK |
| TLIST-11 AC14 | contrast at least 4.5:1 per color and theme from the theme values; distinct green, red, blue | `summaryStyles.test.ts:39-67` (light and dark, contrast, hues, `--foreground`), `:69-80` pairs with `dark:`, `:82-100` `balanceClassName`; mutants Y1 to Y8 killed | OK; re-measured on painted pixels in Chromium, see Browser |

### P1: Filtro rápido pelos valores (TLIST-10)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| AC1, AC2 | Receitas gives `type=Income`, Despesas `type=Expense`, page 1, other filters and sort kept | `extratoSummary.test.tsx:214-236` `expect(params).toEqual({ ...KEEP, page: "1", type })` starting from page 2 (`:200-210`); `SummaryCard.test.tsx:230-243` | OK |
| AC3 | Investimentos gives the id of the category with key `Investments` | `extratoSummary.test.tsx:246-260` `toEqual({ ...KEEP, page: "1", categoryId: id })`; `SummaryCard.test.tsx:230-243`; mutant C6 killed | OK |
| AC4 | `aria-pressed` true only on the active value | `SummaryCard.test.tsx:196-217` (six states); `extratoSummary.test.tsx:225`, `:252`, `:262-267`; mutants C8, C9 killed | OK |
| AC5 | acting on an active value removes only that filter and returns to page 1 | `SummaryCard.test.tsx:246-267` `toHaveBeenCalledExactlyOnceWith(undefined)`; `extratoSummary.test.tsx:231-233`, `:257-259`; mutants C4, C10, W6 killed | OK |
| AC6 | Expense then Receitas swaps to Income; other category then Investimentos swaps to Investments | `SummaryCard.test.tsx:270-285`; `extratoSummary.test.tsx:237-244` | OK |
| AC7 | native buttons reachable by Tab, Enter, Space; Saldo is text | `SummaryCard.test.tsx:172-194` `tagName).toBe("BUTTON")`, `type="button"`, focusable, Saldo `closest("button")` null and no `aria-pressed`; `extratoSummary.test.tsx:270-277` Saldo click changes nothing; mutant C7 killed | OK (keyboard activation is native-button behavior and is not simulated; accepted) |
| AC8 | the Tipo or Categoria control shows the value and its "x" appears | `extratoSummary.test.tsx:223-224` `getByLabelText("Tipo")).toHaveTextContent(shown)` and `clearButton("Tipo")`; `:251` `clearButton("Categoria")` | OK |
| AC9 | categories not loaded, failed or without the key: Investimentos is text | `SummaryCard.test.tsx:323-354` (missing key, failed list, still loading); mutant C11 killed | OK |
| AC10 | a renamed Investments still applies its id (by key) | `SummaryCard.test.tsx:287-321` decoy user category named "Investments" with key null; mutant C6 killed; rules side `dashboards-rules.int.test.ts:147` | OK |

### P1: Paginação com botões numerados (TLIST-12 to TLIST-15)

| AC | Spec-defined outcome | `file:line` + assertion expression | Result |
| -- | -------------------- | ---------------------------------- | ------ |
| TLIST-12 AC1 | 1 to 7 pages show all | `pageNumbers.test.ts:7-20` | OK |
| TLIST-12 AC2, AC3, AC4 | head `[1,2,3,4,5,"…",total]`, tail `[1,"…",total-4..total]`, middle `[1,"…",c-1,c,c+1,"…",total]`; 8 pages boundary | `pageNumbers.test.ts:22-34` (8 pages), `:36-48` (100 pages, pages 1, 4, 5, 50, 96, 97, 100), `:50-61` seven entries; mutants N1 to N10 killed | OK |
| TLIST-12 AC5 | total below 1 is 1; current clamped | `pageNumbers.test.ts:63-75`; mutant N7 killed | OK |
| TLIST-13 AC6 | text "{total} transações · Página X de Y", Anterior, numbers, Próxima | `Pagination.test.tsx:30-36` `getByText("120 transações · Página 1 de 3")`, buttons `["1","2","3"]`; `extratoPagination.test.tsx:51-57`; mutant G16 killed | OK |
| TLIST-13 AC7 | only the current has `aria-current="page"`; ellipsis not a button | `Pagination.test.tsx:70-92` (pages 1, 5, 50, 100), `:94-100` `gap.closest("button")` null; mutant G1 killed | OK |
| TLIST-13 AC8 | Anterior disabled on the first page, Próxima on the last | `Pagination.test.tsx:30-43`; `extratoPagination.test.tsx:75`; mutants G3, G4 killed | OK |
| TLIST-13 AC9 | each control requests its page, keeping filters, sort and size | `Pagination.test.tsx:104-123` (`toHaveBeenLastCalledWith(2/4/8/1)`, current page and disabled ones silent); `extratoPagination.test.tsx:65-79` `toEqual({ sort: "amount", order: "asc", page: "3" })`; mutants G6, G7, G15, W11 killed | OK |
| TLIST-13 AC10 | one page: only "1", both arrows disabled | `Pagination.test.tsx:45-60` | OK |
| TLIST-13 AC11 | below 640 px numbers hidden, text, select and arrows kept | `Pagination.test.tsx:154-170` `toHaveClass("hidden", "sm:flex")`, `min-h-9 min-w-9`; mutants G8, G11 killed; painted check in Chromium at 375: numbered group `display: none`, no horizontal overflow, arrows 36 px high | OK; the wrap class of the controls row (G12) is not asserted |
| TLIST-15 AC12 | page count from the API `pageSize` | `Pagination.test.tsx:62-67` `"120 transações · Página 1 de 5"` with `pageSize: 25, selectedPageSize: 50`; `extratoPagination.test.tsx:81-86`; mutant W8 killed | OK |
| TLIST-15 AC13 | total 0: no pagination | `extratoPagination.test.tsx:99` `queryByRole("navigation", { name: "Paginação do extrato" })` null; mutant W10 killed | OK |
| TLIST-14 AC14 | opens with no stored size: no `pageSize`, select shows 50 | `extratoPagination.test.tsx:54-55` `toEqual({ ...SORT, page: "1" })`, `sizeSelect()).toHaveTextContent("50")`; mutants W1, W2 killed | OK |
| TLIST-14 AC15 | options exactly 25, 50, 100 in that order | `Pagination.test.tsx:140-143` `toEqual(["25","50","100"])`; `extratoPagination.test.tsx:110`; mutants G13, U3 killed | OK |
| TLIST-14 AC16 | 25 or 100: `pageSize` on page 1, stored, selection cleared; 50: none | `extratoPagination.test.tsx:127-132` `toEqual({ sort: "amount", order: "asc", page: "1", pageSize: "25" })`, stored `"25"`, no "selecionada(s)"; `:140-151`; `Pagination.test.tsx:145-151`; mutants W4, W13, G14, U4 killed | OK |
| TLIST-14 AC17 | size change from page 2 goes to page 1 | `extratoPagination.test.tsx:117-132` starts on page 2 (`:120-123`); mutant W3 killed | OK |
| TLIST-14 AC18 | stored 25 or 100: first query already uses it | `extratoPagination.test.tsx:168` `listPaths()[0]).toBe("/transactions?sort=date&order=desc&page=1&pageSize=100")`; `usePageSize.test.ts:26-29` | OK |
| TLIST-14 AC19 | invalid stored value or throwing read: 50 | `usePageSize.test.ts:31-46` (10 invalid texts, throwing getItem); `extratoPagination.test.tsx:173-196`; mutants U1, U2, U6 killed | OK |
| TLIST-14 AC20 | a throwing write still changes the size, no error on screen | `usePageSize.test.ts:63-70`; `extratoPagination.test.tsx:183-196`; mutant U5 killed | OK |
| TLIST-14 AC21 | size is not filter state; "Limpar filtros" keeps it | `extratoPagination.test.tsx:198-207` `toEqual({ ...SORT, page: "1", pageSize: "25" })` and stored `"25"`; `summaryFilters` strips it (H1) | OK |

### Edge cases

| Edge case (spec) | `file:line` + assertion | Outcome |
| ---------------- | ----------------------- | ------- |
| 1 transaction: "transação" and page 1 of 1 | `SummaryCard.test.tsx:115-128` (count 1); `Pagination.test.tsx:45-51` | OK |
| Investimentos negative, shown with sign in blue, Saldo excludes it | API: `transactions-summary.int.test.ts:212-220` `investments: '-15.50', balance: '0.00'`. Card: no test renders a negative Investimentos (mutant C22 strips the sign and survives) | GAP (rendering untested) |
| Despesa negative (only reversals): sign, red, Saldo positive | API: `:205-210` `expense: '-30.00', balance: '30.00'`. Card: no test renders a negative Despesas (mutant C23 survives); only the balance sign is tested (`SummaryCard.test.tsx:93-106`) | GAP (rendering untested) |
| Count larger than the countable sum | `transactions-summary.int.test.ts:177-182`, `:144-155` | OK |
| Page 3 of 50, filter to 1 page: page 1 of 1 | existing per-filter page-reset tests (`extratoFilters.test.tsx`) plus `extratoSummary.test.tsx:131-171`; pagination text `extratoPagination.test.tsx:51-57` | OK |
| Page past the end after a size change | `transactions.int.test.ts:430`; size change from page 2 `extratoPagination.test.tsx:117-132` | OK |
| Total from 120 to 0: empty card, no pagination | `extratoPagination.test.tsx:88-102` | OK |
| Stored `"25 "` or `"25.0"` gives 50 | `usePageSize.test.ts:31` | OK |
| Total exactly a multiple (50 of 50, 100 of 100); 51 of 50 | `Pagination.test.tsx:45-60` | OK |
| Repeated filter parameter: 400 like the list | `transactions-summary.int.test.ts:334-340`; pageSize `transactions.int.test.ts:422` | OK |

## Author decisions and owner decisions, checked literally

| Decision | Verdict | Evidence |
| -------- | ------- | -------- |
| Summary follows exactly the dashboard rules, single rules module (AD-003) | Verified | `summary.ts` imports `COUNTABLE`, `EXPENSE_VALUE`, `INCOME_VALUE`, `INVESTMENT_ROW`, `INVESTMENT_VALUE`; no quoted key in it (guard `rules.guard.test.ts:148`, mutant S17); `COUNTABLE` keeps its meaning (all dashboard suites green in `pnpm -C api test`); parity with the real dashboard routes (above) |
| Highlighted count = total rows of the filter | Verified | `count(*)` over the filtered set; `transactions-summary.int.test.ts:299-309` against the list total for 11 queries |
| Saldo not clickable | Verified | `SummaryCard.test.tsx:192-194`, `extratoSummary.test.tsx:270-277`, mutant C7 killed |
| Receitas gives type Income, Despesas type Expense, Investimentos the Investments category by `key` | Verified | `extratoSummary.test.tsx:214-260`; `SummaryCard.test.tsx:287-321`; mutants C5, C6 killed |
| Clicking an active value clears the filter | Verified | `SummaryCard.test.tsx:246-267`, `extratoSummary.test.tsx:231-233`, `:257-259` |
| Page sizes 25, 50 (default), 100, in localStorage, invalid falls back to 50 | Verified, with one unpinned detail | tests above; the literal key `financials:transactions:page-size` is only reached through the imported constant (`usePageSize.test.ts:6`, `extratoPagination.test.tsx:15`), so mutant U7 (key renamed) survives |
| API limit is 100 | Verified | `transactions.int.test.ts:414` rejects `101`, `125`; mutant P1 killed |
| `pageSize` not part of saved filters | Verified | `summaryFilters` and `listFilters` join it only at the call (`TransactionsPage.tsx`); `extratoPagination.test.tsx:198-207` |

### Author decision: `investments` as the net of the Investments category

Implemented as Expense minus Income of the countable Investments rows, may be negative, never part of `balance` (`rules.ts` `INVESTMENT_VALUE`, spec row "investments", AC 11). Judgment: **the spec and the sources do not support it beyond doubt, flag it for the owner (spec-precision gap 1).**
- `docs/PRD.md` (lines 273 and 294) says Investments rows (aporte or resgate) are "ignorado" in receitas, despesas and patrimônio and that the money "apenas muda de lugar"; it never defines a total of investments for a list.
- `.specs/features/dashboards/spec.md` AC 5 only says to ignore Investments in income, expense and net worth.
- `docs/v1/plano-melhoria-transacoes.md` and `melhoria-transacoes.md` ask for "investimentos" as a separate total next to receitas, despesas and saldo (the plan even hints at "âmbar/azul"), and give no sign or netting rule.
- The spec marks the row as unconfirmed (`n`) and justifies the sign by the `CARD_VALUE` precedent.
Consequences the owner may not expect: with the quick filter Receitas on, the card shows Investimentos `-R$ 5,00` (redemptions only); a month with more redemptions than contributions shows a negative blue value; the "x aportados" reading (gross contributions) would give 200.00 in the fixed dataset instead of 195.00. The code does what the spec says; the question is whether "investimentos" means net, gross contributions, or the sum of absolute movements.

## Gates (run by the Verifier)

| Gate | Outcome |
| ---- | ------- |
| `pnpm -C api typecheck`, `pnpm -C api lint` | clean, no warning |
| `pnpm -C api test` | 382 unit + 702 integration pass, 0 failed (625 integration before the feature, 77 new; unit unchanged at 382), integration 149.5 s |
| `yarn --cwd web typecheck` | clean |
| `yarn --cwd web lint` | 0 errors, 7 warnings, all `react-refresh/only-export-components` in `badge.tsx`, `button.tsx`, `form.tsx`, `navigation-menu.tsx`, `sidebar.tsx`, `toggle.tsx`, `useSession.tsx`, none touched by the feature, none new |
| `yarn --cwd web test` x3, sequential | 83 files, 871 tests, 0 failed in each run (69.3 s, 67.7 s, 68.1 s); 717 tests before the feature, 154 new, none removed; the only changed existing assertion is `mock/transactions.test.ts` dropping `?pageSize=500` (now a 422) from the loop that already walks every page |

Slowest tests in the three runs (full suite, files in parallel): `extratoQuickMonth.test.tsx` "só o mês ou só o ano não consulta a API nem altera De e Até" 10.9 s, 10.5 s, 10.1 s; "'Limpar filtros' limpa o filtro rápido junto com os demais filtros" 9.1, 8.7, 9.4 s; "'Limpar mês' remove o filtro rápido e from/to..." 8.6, 8.8, 8.6 s; `extratoFilters.test.tsx` "o filtro conta/tipo/categoria envia o seu parâmetro..." 7.6 to 8.9 s; `extratoDescriptionForm.test.tsx` 8.0 s. The `testTimeout` is 15 s, so the slowest test sits at 67 to 73 percent of it; no new test appears in the top six. The new files are well behaved alone (the author's budget of 3 s per new test holds).

### The `extratoQuickMonth` timing question (L-027)

The author's one 15.4 s timeout on "só o mês ou só o ano..." did not reproduce in my 3 full runs (10.1 to 10.9 s) or in 5 isolated runs (2.81 to 3.16 s). It is a load effect; but the feature does make the file slower.

| Measurement | HEAD | base `484b1e6` (temporary worktree) |
| ----------- | ---- | ----------------------------------- |
| `extratoQuickMonth.test.tsx` alone, 5 runs, 13 tests, file wall time | 24.1 to 27.0 s (median 24.4 s) | 20.2 to 21.0 s (median 20.7 s) |
| "só o mês ou só o ano..." alone | 2.81, 2.87, 2.85, 2.86, 3.16 s | 2.21, 2.26, 2.26, 2.25, 2.27 s |
| "'Limpar filtros' limpa o filtro rápido..." alone | 3.00 to 3.15 s | 2.53 to 2.66 s |
| Two full suites started at the same time (L-027's two-suite run) | 52 of 871 failed | 46 of 717 failed |

Every extrato test renders `TransactionsPage`, which now also mounts `SummaryCard` (one more query plus the categories list) and `Pagination` (a Radix select), about +0.6 s per rendering test (+18 to +27 percent). Under two-suite load the pre-existing files fail on both sides (same families: `extratoCrud`, `extratoFilters`, `extratoInline`, `extratoQuickMonth`, `extratoAccountLabel`, `extratoDescriptionForm`, `paymentMethodOther`, `transactions`); the failures that exist only at HEAD are in the feature's own new files, 4 tests in `extratoPagination.test.tsx` and 5 in `extratoSummary.test.tsx`, plus `extratoClearFilters` De (6 there vs 5 at base). Conclusion: the feature made the heavy extrato tests slower in a way that erodes the margin (slowest full-suite test at 73 percent of the timeout, L-027 asks for under 50 percent, and the base was already above it), and its new extrato tests do not survive a shared machine. A fix task is needed (fix task 2). The 15.4 s timeout is not by itself a finding about this feature.

## Discrimination sensor

146 behavior-level mutants plus 1 no-op control (`S13`, survived as it must), each in the temporary worktree `.verify-tl` against the tests of its area, original restored with `git checkout -- <file>` after every run, the real tree untouched. 135 killed, 11 survive: 4 are equivalent, 7 need fix tasks. (An early web batch used a wrong test path and was discarded and re-run; only the re-run is counted.)

Killed, by area: rules fragments (R1 to R11: each exclusion clause of `COUNTABLE_BASE`, the Investments exclusion, `INVESTMENT_ROW` by name instead of key and without the base, `INVESTMENT_VALUE` sign and redemptions, Reversal Income and Reversal Expense branches); summary SQL and route (S1 to S3 balance, S4 and S5 coalesce, S6 count, S7 to S9 filters per sum, S10 cents, S11 where not applied, S14 query loses `q`, S15 timezone, S16 schema accepts page, S17 guard, S18 route name, S19 RLS bypass); pageSize (P1 to P11: accepted set, default, strict text match, empty value, offset, limit, response size, response enum, error field, ignored); mock (M1 to M7, M10 to M14); `pageNumbers` (N1 to N10: both boundaries off by one, width, minimum 1, run lengths, neighbors, first page); `usePageSize` (U1 to U6, U8: strict match, fallbacks, order, stored text, write failure, read failure); page wiring (W1 to W11, W13: always or never send the size, page reset on size change, selection cleared, inverted period, toggle off, category page reset, page count source, total 0, off by one); summary query and invalidation (H1 to H13: each of sort, order, page, pageSize kept in the key or request, key under the transactions prefix, create, delete, bulk, edit invalidation, `enabled`, the `?` in the path, the request carrying page); SummaryCard (C1 to C21: plural rule, thousands, toggle-off, wrong type, Investments by name, Saldo clickable, aria-pressed, active inversion, id of the key, button without id, swapped values, loading name, retry, error as loading, ring, region name, tones, `enabled`); colors (Y1 to Y8: dark pair, low contrast light and dark, hue, sign swap, `-0.00`, neutral tone, ring); Pagination (G1, G3 to G11, G13 to G16: aria-current, arrow disabling, floor, current-page click, Anterior, phone hiding, label, button names, 36 px, option order, select value, Próxima step, text).

| ID | Mutation | Outcome | Judgment |
| -- | -------- | ------- | -------- |
| C22 | negative Investimentos shown without the sign | SURVIVED | gap: spec edge case "Investimentos negativo com sinal em azul" is untested at the card (fix task 1) |
| C23 | negative Despesas shown without the sign | SURVIVED | gap: spec edge case "Despesa negativa em vermelho, Saldo positivo" untested at the card (fix task 1) |
| U7 | storage key renamed to `financials:page-size` | SURVIVED | gap: the spec fixes the literal key and every test reads it through the exported constant (fix task 3) |
| S20 | expense summed as `float8`, rounded back to 2 decimals | SURVIVED | gap: the AC 13 example (0.10 + 0.20) cannot see it because of the final `numeric(20,2)`; only huge sums would differ (fix task 4, and spec-precision gap 2) |
| G2 | current page button not the filled variant | SURVIVED | gap: spec row "variante preenchida" has no jsdom assertion; Chromium confirmed it is painted (fix task 4) |
| G12 | the controls row loses `flex-wrap` | SURVIVED | gap: only the inner row's wrap is asserted; Chromium at 375 px showed no horizontal overflow (fix task 4) |
| M8 | mock summary ignores the `neutral` filter | SURVIVED | gap: no test filters the mock list or summary by neutral (fix task 4) |
| S12 | expense cast through `float8` after the sum | SURVIVED | equivalent in practice: a 2-decimal numeric of at most 14 digits survives `float8` exactly |
| M9 | mock cents padding without `slice(0, 2)` | SURVIVED | equivalent: mock amounts have at most 2 decimals |
| W9 | select shows the API size instead of the chosen one | SURVIVED | equivalent: the API echoes the requested size (the component level is tested in `Pagination.test.tsx:62-67`) |
| W12 | the card receives `page: 1` in its filters | SURVIVED | equivalent by construction: `summaryFilters` strips `page` before the key |

## Browser check

The Browser pane had no logged-in session (and I did not read or print any credentials). I built a throwaway Vite page in a temporary worktree (not in the repo) that mounts the app's real `TransactionsPage` with the app's own `styles.css` and Tailwind plugin on the app's mock API (`VITE_MOCK_AREAS=*`, dummy Supabase variables), then read `getComputedStyle` in Chromium. Contrast is the WCAG ratio of the painted colors against the painted card background; colors are the browser's, not the tests' class names (L-040).

| Theme and width | Element | Painted color | Contrast vs card |
| --------------- | ------- | ------------- | ---------------- |
| light, desktop | Receitas | `oklch(0.508 0.118 165.612)` (green) | 5.36 |
| light, desktop | Despesas and negative Saldo | `oklch(0.505 0.213 27.518)` (red) | 6.42 |
| light, desktop | Investimentos | `oklch(0.488 0.243 264.376)` (blue) | 6.83 |
| dark, desktop | Receitas | `oklch(0.765 0.177 163.223)` | 9.20 |
| dark, desktop | Despesas and negative Saldo | `oklch(0.704 0.191 22.216)` | 6.17 |
| dark, desktop | Investimentos | `oklch(0.707 0.165 254.624)` | 6.75 |
| 375 px (viewport 391 px wide), light and dark | the same four values | same colors | 5.36, 6.42, 6.83 and 9.20, 6.17, 6.75 |

Card background: `oklch(1 0 0)` light, `oklch(0.208 0.042 265.755)` dark (`bg-card`). Count 36 px, values 18 px. After clicking Receitas: `aria-pressed="true"`, a painted 2 px ring (`ring-ring`), text color unchanged, the Tipo select shows "Receita", the count went from 120 to 9 and Despesas/Investimentos show R$ 0,00; clicking again returned to 120 and `aria-pressed="false"`. Pagination: current page filled (light text `oklch(0.985 ...)` on `oklch(0.31 ...)`, 12.21), others outline (17.62); dark current 14.46 and others 19.27; buttons 36 by 36 px; the text "120 transações · Página 1 de 3" and the select "Itens por página". At 375 px the numbered group is `display: none`, the text, select, Anterior and Próxima stay, no horizontal overflow (document width equals viewport width). Page size: with `"25"` stored the page showed "Página 1 de 5", 25 rows and buttons 1 to 5; with an invalid `"30"` stored it fell back to 50 rows. The focus or pressed ring color measures about 2.57:1 against the light card and 3.69:1 against the dark card (non-text contrast, not covered by the spec; see spec-precision gap 3).

Not done by an agent, pending for the owner (needs the real login, no agent session): the app-level steps from the author's report, run against the real API: summary card position and values compared with the dashboard for the same period; refresh behavior after creating, editing, deleting a transaction; click-to-filter from page 2 for Receitas, Despesas and Investimentos and the second click clearing it; Investimentos with the real Investments category and a negative net; pagination with real data and the numbered buttons; page size persisted across a reload; dark theme; phone width.

## Code quality

No feature beyond the ask; `TransactionsPage.tsx` shrank by one line (741 to 740) and the new UI is in `SummaryCard.tsx`, `Pagination.tsx`, `pageNumbers.ts`, `usePageSize.ts`, `summaryStyles.ts`; `COUNTABLE` was recomposed with the same meaning and the dashboard suites pass unchanged; the summary reuses the list's `whereClause` and `fromJoins` (parity by construction, proven by the count-vs-total tests); web money is never summed (`balanceClassName` reads the string only). Tests map to ACs and are non-shallow; the weaknesses are the survivors above. Guidelines: none beyond the test configs, `web/AGENTS.md` and the lessons (strong defaults applied); L-020 and L-027 (no fixed sleeps, no raised timeouts) were respected in the new files, L-021 and L-041 (reset tests start from page 2) hold for `extratoSummary.test.tsx:200-210` and `extratoPagination.test.tsx:117-123`.

## Fix tasks (ranked)

1. **Negative Investimentos and Despesas at the card (edge cases 2 and 3; mutants C22, C23)**: in `SummaryCard.test.tsx` render `investments: "-15.50"` and assert "-R$ 15,50" with the investments (blue) classes and Saldo untouched; render `expense: "-30.00"` with `balance: "30.00"` and assert "-R$ 30,00" with the expense (red) classes and the income class on Saldo.
2. **L-027 for the extrato tests**: make the extrato page tests cheaper or lighter so the slowest test falls well under half of the 15 s timeout and the two-suite run has no failure in the new files: share one render or one open select per test where several tests only need the page loaded, avoid re-fetching the categories list per test (seed the cache through the kit), keep fake timers; no timeout increase. Acceptance: the same two-suite experiment as above (HEAD and base side by side) gives no failure in `extratoPagination.test.tsx` and `extratoSummary.test.tsx`, and the three sequential full runs keep the slowest test under 7.5 s.
3. **Literal storage key (mutant U7)**: in `usePageSize.test.ts` assert `localStorage.getItem("financials:transactions:page-size")` equals `"25"` after choosing 25 and read a value seeded under that literal key.
4. **Low-risk assertions**: in `Pagination.test.tsx` assert the filled variant of the current page (a class that differs from the others, mutant G2) and `flex-wrap` on the controls row (G12); in `mock/transactions.test.ts` add a `neutral=true` list and summary case (M8); in `transactions-summary.int.test.ts` add a large-amount case whose float sum would differ from the exact sum, for example many rows of `999999999999.99` plus `0.01` (mutant S20), or accept the risk in writing.
5. **Owner and spec decisions** (not code): see the spec-precision gaps.

## Spec-precision gaps

1. **What "investimentos" totals (for the owner).** The spec (row "investments", AC 11, status unconfirmed) defines the net of the Investments category (Expense minus Income) and lets it go negative; the PRD and the dashboards spec only say Investments is ignored in income, expense and net worth, and the plan only asks for a separate total. State the intended meaning (net, gross contributions, or movement total) and the sign, with an example on the fixed dataset (195.00 net versus 200.00 gross), and say what the card shows when the Receitas quick filter hides the contributions.
2. **AC 13 "0,10 mais 0,20 some exatamente 0.30"** is satisfied by the rounding to 2 decimals even with a float sum; the AC should name an input whose float sum differs (or state that the no-float rule is checked by review).
3. **Active-value highlight**: the spec fixes `ring-2 ring-ring` and says the contrast of the text does not change, but not the visibility of the ring itself (2.57:1 on the light card, below the 3:1 usual for non-text indicators; `aria-pressed` carries the state for assistive tech). Say whether the ring must meet 3:1 or whether the shared `--ring` token is accepted.
4. **Neutral filter shows all zeros** (`neutral=true` gives count 2 and four R$ 0,00), a consequence of the dashboard rules; it follows the spec, but the owner may want a hint in the card.
5. **TLIST-10 AC7 "acionáveis por Tab, Enter e Espaço"** is satisfied by native buttons and checked by focusability and click, not by key events; accepted, stated here so it is not read as covered by key simulation.

## Requirement traceability (suggested; `spec.md` not edited by the Verifier)

TLIST-01 to TLIST-12, TLIST-13, TLIST-15: evidence present. TLIST-03 AC 13 carries spec-precision gap 2. TLIST-08 edge cases on negative values (card) carry fix task 1. TLIST-14: evidence present, with the unpinned literal key (fix task 3). TLIST-09, TLIST-11: evidence present; painted colors re-measured in Chromium. Keep the spec's browser box open until the owner's steps are recorded (L-039).

## Isolation proof

Baseline and final `git status --porcelain` of the real tree: the same five untracked paths. Mutants, the timing runs on `484b1e6` and the Vite probe lived only in `/Volumes/MacOnlySSD/dev/personal/.verify-tl`, `.verify-tl-base` and `.verify-tl-probe` (removed with `git worktree remove --force` and `git worktree prune`). The `node_modules`, `.env` and `.env.local` files of the real tree were only symlinked into those worktrees and are intact. Only this file and the lessons files are committed by the Verifier.

## Summary

Verdict FAIL with no functional defect. Ranked: 1 the two negative-value edge cases at the card are untested (C22, C23), 2 the extrato tests got about 25 percent slower and nine new ones time out under two-suite load (L-027), 3 the literal storage key is unpinned (U7), 4 four low-risk weak assertions (S20, G2, G12, M8), 5 owner decision on the meaning of "investimentos" and four smaller spec-precision gaps. Gates are green, 135 of 146 mutants are killed (4 of the 11 survivors are equivalent), the summary equals the dashboard routes on the fixed dataset, and the painted colors meet 4.5:1 in both themes at desktop and 375 px.

---

## Fixes after independent validation

This addendum was written by the **author** of the fixes, not by the Verifier. **No fresh independent agent re-verified these fixes**, so the verdict at the top of this file stays FAIL (iteration 1, as the Verifier wrote it). The statuses in `spec.md` (Verified; TLIST-03 "Verified (AC 11 definition pending owner)") rest on the Verifier's evidence above plus the fixes below; a new independent Verifier run is still needed before this report can say PASS. The owner's logged-in browser steps and the owner's decision on the Investimentos definition also remain open.

| Fix task | What changed | Commit | Mutation proof (temporary worktree on the external volume, real tree untouched) |
| -------- | ------------ | ------ | ------------------------------------------------------------------------------ |
| 1. Negative values at the card | `SummaryCard.test.tsx`: Investimentos `-15.50` shown as "-R$ 15,50" in the investments tone with Saldo `0.00` plain; Despesas `-30.00` as "-R$ 30,00" in the expense tone with Saldo `30.00` in the income tone | `6b4b186` | C22 and C23 now fail (survived before) |
| 2. L-027 | see the timings below | `6f0244c` | filter change that keeps the page fails 4 `extratoFilters` tests; a month ending one day early fails 5 `extratoQuickMonth` tests |
| 3. Literal storage key | `usePageSize.test.ts` reads and writes `financials:transactions:page-size` by its literal text | `452038c` | U7 now fails |
| 4. Weak assertions | G2 (current page has `bg-primary`, the others the outline classes), G12 (`flex-wrap` on the controls row), M8 (mock list and summary with `neutral`), S20 (1001 rows of `999999999999.99` must sum to `1000999999999989.99`) | `213a9b7` | G2, G12, M8, S20 now fail; S12 (float8 cast) fails too |
| 5. Ring contrast | `summaryActiveRing` is `ring-2 ring-slate-500` (4.77:1 light, 3.74:1 dark by the theme values; test asserts at least 3:1 per theme) | `5ac4904` | `ring-ring` back in fails the light-theme test |
| 6. Spec precision | `spec.md` records the Investimentos definition as an author decision pending the owner, with the three alternatives and the fixed-dataset numbers (195.00 net, 200.00 gross, 205.00 movement); AC 13 names the large-sum example; the ring class and its contrast are in the spec | see git log | not a guard test |

Notes on the two numbers the Verifier suggested:

- **S20**: the suggested small example (many `0.10` rows, or `999999999999.99` plus `0.01`) cannot discriminate. Postgres casts a `float8` to `numeric` with 15 significant digits, so a float sum below about 1e14 is rounded back to the exact two-decimal value. The test needs a total of 16 or more digits: 1001 rows of the largest `numeric(14,2)` amount give `1000999999999989.99`, which a `float8` sum or cast cannot produce (the `float8` mutants fail it).
- **Ring**: measured in Chromium with a throwaway Vite page that mounts the real `SummaryCard` with the app `styles.css` and the mock API (temporary worktree, no login, dummy Supabase variables, page and worktree removed): the pressed Receitas has a 2 px ring `oklch(0.554 0.046 257.417)`, painted contrast 4.76:1 on the white card and 3.74:1 on the dark card (`oklch(0.208 0.042 265.755)`); the inactive value has no ring.

### L-027 timings (`yarn --cwd web test`, files in parallel)

| Measurement | Before (HEAD `213a9b7`, 875 tests) | After (HEAD `5ac4904`, 877 tests) |
| ----------- | ---------------------------------- | --------------------------------- |
| Slowest test, full suite alone | 12.6 s (the Verifier measured 10.1 to 10.9 s) | 1.96, 1.88 and 1.88 s in three runs (limit 15 s, goal under 7.5 s) |
| Full suite wall time | about 68 s (the Verifier's three runs) | 26.1, 26.2 and 26.0 s |
| Two suites started together | 29 and 30 failed (extratoFilters 6, extratoQuickMonth 6, extratoCrud 5, extratoInline 4, transactions 4 or 5, extratoDescriptionForm 3, extratoAccountLabel 1; none in the new files this time, the Verifier saw 9 there) | 0 and 0 failed; slowest test 4.78 and 4.76 s (`extratoSummary`) |
| `extratoQuickMonth.test.tsx` alone | 24 s | 5.6 s |
| `extratoCrud.test.tsx` alone | 16.4 s | 5.7 s |

The commit body of `6f0244c` quotes an interim measurement (slowest 5.5 s, taken before the last two lightening edits); the table above is the final one. How: tests that only check the query use the 3-row `lightList` of `web/src/test/extratoKit.ts`; the ones that act on real rows shrink the 120-row mock with the new `trimTransactions` helper; two 51-row seeds were replaced by a total of 60; tests that start from a light list fake the timers before rendering and let the search debounce settle (L-021). No timeout raised, no assertion removed (one scenario, the Receitas to Despesas swap, starts from the light page instead of a page-2 setup that the two neighboring tests already cover).

### Gates after the fixes (author's run)

- `yarn --cwd web typecheck`: clean. `yarn --cwd web lint`: 0 errors, the same 7 pre-existing `react-refresh/only-export-components` warnings, none new.
- `yarn --cwd web test` three times: 877 tests (871 before, plus 6 new), 0 failed each time. One more run with two suites started together: 0 failed in both.
- `pnpm -C api typecheck` and `pnpm -C api lint`: clean. `pnpm -C api test`: 382 unit and 703 integration tests pass, 0 failed (702 integration before, plus the large-sum case).


## Iteration 2 closure

The only blocker of the iteration 2 report (S20b, S20c) is closed by `4954649` (`api/test/transactions-summary.int.test.ts`: 1001 rows of 999999999999.99 as Income and as Investments, expected 1000999999999989.99 each). Proof: `sum(... ::float8)` on the income aggregate and on the investments aggregate of `api/src/modules/transactions/summary.ts`, each in a temporary worktree, fails the new test and nothing else (46 of 47 pass). The worktree was removed.

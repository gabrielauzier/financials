# Validation: front-fixes (web T1-T12 + F1-F3), iteration 2 - FAIL

**Verdict**: FAIL

Gaps 1-3 from iteration 1 are closed. Their mutants (M17, M23, and the neutral text swap) are now killed by the new assertions. Gates are green: web 133 passed in 20 files, typecheck clean, lint 0 errors, 0 skips.

The FAIL comes from M14. Iteration 1 judged it equivalent. A scratch-only probe shows it is not. When the PATCH fails and the refetch triggered by `onSettled` also fails (the network is down), removing the `onError` rollback leaves the unsaved category, or the neutral switch, on screen next to the error. The suite cannot see this, because every failure test lets the refetch succeed and restore the row from the unchanged server. FIX-05 AC1 ("restaurar a categoria anterior") and AC3 ("voltar ao valor anterior") are therefore proven only through the refetch, not through the rollback the code relies on. The product code is correct. The fix is one test-only addition.

**Iteration**: 2 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/front-fixes/spec.md`
**Diff range**: `050949a^..HEAD` for the feature. Fixes since iteration 1: `13b88d7..HEAD` = commit `ffda433` (3 test files + tasks.md). `HEAD` = `ffda433ee2b6fb71ec01a581f2ebfd2a9319d35f`, branch `feat/front-fixes`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations and the probe ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-ff2`, `web/node_modules` symlinked). That worktree is removed and pruned.

## Scope

In scope: the whole feature surface (`web/src/lib/api/errorMessages.ts` (+test), `web/src/lib/api/types.ts`, `web/src/lib/api/mock/transactions.ts`, the changed files in `web/src/features/{accounts,categories,transactions,auth,import}`, `web/src/test/apiSpy.tsx`, the three `extrato*.test.tsx` files, `web/yarn.lock`). The fix commit `ffda433` gets the closest look:
- `web/src/features/accounts/accounts.test.tsx`
- `web/src/features/transactions/extratoFilters.test.tsx`
- `web/src/features/transactions/extratoInline.test.tsx`
- `.specs/features/front-fixes/tasks.md`

Classification key: (a) covered by tests; (b) verified by a non-test artifact; (c) deferred; GAP = no evidence or a non-discriminating test.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1). T1-T12 are all ticked. The new section "Fix tasks (Verifier iteration 1)" has F1-F3, all ticked.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 shared module | ✅ | `aa1c07c` | - |
| T2 accounts | ✅ | `ca5dd9d` + `ffda433` | Field placement now pinned (M23 killed) |
| T3 categories | ✅ | `0f6a29c` | - |
| T4 transactions screens | ✅ | `7243089` | - |
| T5 null on edit | ✅ | `4587075` | - |
| T6 e-mail detection | ✅ | `fbbf475` | - |
| T7 inverted period | ✅ | `7ab7195` | - |
| T8 income green | ✅ | `ab00adc` | - |
| T9 inline/bulk/neutral tests | ⚠️ | `722070a` + `ffda433` | Neutral text now pinned. The rollback on a failed save is not discriminated (M14, Gap 1) |
| T10 filters tests | ✅ | `2dfd203` + `ffda433` | Clear from page 2 now tested (M17 killed) |
| T11 CRUD tests | ✅ | `ce8a489` | - |
| T12 lockfile | ✅ | `6968f86` | - |
| F1 clear from page 2 | ✅ | `ffda433` | `extratoFilters.test.tsx:123-130` |
| F2 account error placement | ✅ | `ffda433` | `accounts.test.tsx:147-157` |
| F3 neutral failure text | ✅ | `ffda433` | `extratoInline.test.tsx:209-211` |

Process notes (unchanged from iteration 1, cosmetic):
- The `Commit:` lines in tasks.md say `feat(front-fixes)`. The real commits use `feat(web)`, `test(web)` and `build(web)`.
- The gate commands in tasks.md still say `pnpm -C web ...`. The project uses `yarn --cwd web ...`.
- `.specs/STATE.md` (47 lines) still has no entry for this feature.

---

## Spec-Anchored Acceptance Criteria

### FIX-01: Error messages in Portuguese (P1)

| AC | Spec-defined outcome | Evidence (`file:line` + assertion) | Class | Result |
| -- | -------------------- | ---------------------------------- | ----- | ------ |
| 1. One module, never the API `message` | No API text in any result | `web/src/lib/api/errorMessages.test.ts:51-53` `expect(messageForError(api(code), "account")).not.toContain("Technical English")`. UI: `web/src/features/transactions/transactions.test.tsx:325` `queryByText("Kaboom")).not.toBeInTheDocument()`, `:342` (`Missing ids`), `:353` (`DB down`); `web/src/features/categories/categories.test.tsx:109-110,120,141`; `web/src/features/accounts/accounts.test.tsx:111,158`; `web/src/features/transactions/extratoInline.test.tsx:211` `expect(alert).not.toHaveTextContent("boom")`. Non-test: grep below | a + b | ✅ |
| 2. `duplicate_name` by context | account "Já existe uma conta com esse apelido"; category "Já existe uma categoria com esse nome" | `errorMessages.test.ts:10-17` `toBe(...)` for both contexts, generic for others. Screens: `accounts.test.tsx:147-150` `findByText("Já existe uma conta com esse apelido")).toHaveAttribute("id", "account-error")`; `categories.test.tsx:103` `findByText("Já existe uma categoria com esse nome")` | a | ✅ |
| 3. Text for each listed code | "a mensagem definida para ele" | `errorMessages.test.ts:20-31` `it.each` over the 9 codes, `toBe(text)`. Screens: `transactions.test.tsx:288` (invalid_amount), `:299-302` (invalid_account), `:308-311` (validation_error), `:318-321` (unauthorized), `:339` (not_found bulk); `categories.test.tsx:108` (category_protected), `:133` reassign dialog; `accounts.test.tsx:154-157` (holder_required) | a | ✅ ⚠️ spec-precision gap 1 |
| 4. Unknown / network / other → generic | "Não foi possível concluir a operação. Tente novamente." | `errorMessages.test.ts:34-38` `toBe(GENERIC_ERROR)` for unknown code, `TypeError("Failed to fetch")`, string, undefined. Screens: `transactions.test.tsx:324`; `categories.test.tsx:119`; `accounts.test.tsx:110`; `extratoInline.test.tsx:210` `toHaveTextContent("Não foi possível concluir a operação. Tente novamente.")` | a | ✅ |
| 5. `field` → message on that field | Shown on the matching field | `transactions.test.tsx:288` `toHaveAttribute("id", "transaction-amount-error")`, `:299-302` `transaction-account-error`, `:308-311` `transaction-date-error`; `errorMessages.test.ts:59-67` `fieldForError`. Accounts (new): `accounts.test.tsx:154-157` `findByText("Informe ao menos um titular")).toHaveAttribute("id", "holder-error")` and `:147-150` `account-error` | a | ✅ (iteration-1 Gap 2 closed, M23/M23b killed) |
| 6. Map used in accounts, categories, statement (form, inline, bulk, delete, neutral) | Portuguese on every path | Form `transactions.test.tsx:280-326`; inline `extratoInline.test.tsx:95` `findByText("Não foi possível salvar a categoria")`; bulk `extratoInline.test.tsx:160-162`, `transactions.test.tsx:339`; delete `transactions.test.tsx:352`; neutral `extratoInline.test.tsx:209-211` exact generic text and no "boom"; status `accounts.test.tsx:110,135-137`; categories `categories.test.tsx:97-143` | a | ✅ (iteration-1 Gap 3 closed, MN1/MN2 killed) |

Non-test check for AC1:
- `grep -rnE "error\.message|reason\.message" web/src/features` finds nothing (exit 1).
- A wider `\.message\b` grep over non-test files in `web/src/features` and `web/src/lib` finds 4 hits. None reaches the UI: `web/src/lib/api/client.ts:26` checks the payload shape, `:69` stores the message in `ApiError`, `web/src/lib/lovable-error-reporting.ts:51` is editor telemetry, `web/src/lib/error-capture.ts:28` builds a diagnostic string.

### FIX-02: Editing clears notes and receipt (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Emptying notes on edit | `notes: null`; shown without notes | `transactions.test.tsx:385` `toHaveProperty("notes", null)`, `:391` stored `notes` `toBeNull()`; `web/src/features/transactions/extratoCrud.test.tsx:115-117` `toMatchObject({ notes: null, ... })`, `:129` `queryByText("Nota antiga")).not.toBeInTheDocument()` | a | ✅ |
| 2. Emptying receipt on edit | `receipt: null` | `transactions.test.tsx:400` `toHaveProperty("receipt", null)` | a | ✅ |
| 3. Create with empty notes/receipt | Fields omitted | `transactions.test.tsx:446-447` `not.toHaveProperty("notes")`, `not.toHaveProperty("receipt")` | a | ✅ |
| 4. Filled values trimmed | Trimmed text | `transactions.test.tsx:415` `toMatchObject({ notes: "nova nota", receipt: "https://exemplo.com/novo.pdf" })` from padded input | a | ✅ |

### FIX-03: Sign-up with an e-mail already in use (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `user_already_exists` | Registered | `web/src/features/auth/emailExists.test.ts:26-32` `.toBe(true)` | a | ✅ |
| 2. Empty `identities` | Registered | `emailExists.test.ts:5-11` `.toBe(true)`; screen `web/src/features/auth/authForms.test.tsx:57` | a | ✅ |
| 3. Gap ≥ 1000 ms | Registered | `emailExists.test.ts:34-52`: exactly 1000 ms `toBe(true)` (`:43`), 5 min `toBe(true)` (`:52`) | a | ✅ |
| 4. Gap < 1000 ms | New sign-up | `emailExists.test.ts:54-68`: 999 ms and 0 ms `toBe(false)`; `:70-84` missing or unparseable timestamps `toBe(false)` | a | ✅ |
| 5. Message on the e-mail field | "E-mail já cadastrado" on the field | `authForms.test.tsx:80-83` `findByText("E-mail já cadastrado")`, `getByLabelText("E-mail")).toHaveAccessibleDescription("E-mail já cadastrado")`, no "Verifique seu e-mail" | a | ✅ ⚠️ spec-precision gap 4 |

### FIX-04: Accounts, period and appearance (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Activate/deactivate failure | Dialog stays open with a Portuguese message | `accounts.test.tsx:89-123` (both actions): `within(dialog).findByText(GENERIC_ERROR)` (`:110`), no English (`:111`), action button still in the dialog (`:112`); `:125-138` mapped `not_found` text | a | ✅ |
| 2. Inverted period | "A data inicial deve ser anterior à final" and no API call with that period | `transactions.test.tsx:461-473`: `findByText("A data inicial deve ser anterior à final")`, then the list requests with `from=2026-10-10&to=2026-10-01` `toEqual([])`; `:476-499` equal and valid periods query with no message | a | ✅ ⚠️ spec-precision gap 2 |
| 3. Income green, expense red with minus | `text-emerald-700` / `dark:text-emerald-400`; expense destructive with `-` | `transactions.test.tsx:516-539`, table row and mobile card: `toHaveClass("text-emerald-700", "dark:text-emerald-400")`, no leading `-`; expense `toHaveClass("text-destructive")`, `toMatch(/^-/)` | a | ✅ |

### FIX-05: Statement interface tests (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Inline category; on failure restore + text | Saves with no form; on failure restores the previous category and shows "Não foi possível salvar a categoria" | `extratoInline.test.tsx:69-73` exact `toEqual({ method: "PATCH", path, body: { categoryId } })`, `:74` no dialog, `:75-79` new name; failure `:95` text, `:97-101` row back to the old category. **The restore is reached through the `onSettled` refetch, not the rollback.** M14 survives in the suite and the probe kills it (see sensor) | a (partial) | ❌ GAP 1 |
| 2. Bulk in one call; failure keeps state | One call with all ids; on failure selection and categories kept | `extratoInline.test.tsx:129-132` `toHaveLength(1)`, `body toEqual({ ids: [first.id, second.id], categoryId })`, no single PATCH; `:160-172` mapped text, one call, "2 selecionada(s)", both checked, old categories | a | ✅ |
| 3. Neutral switch persists / reverts | New value persisted; on failure reverts | `extratoInline.test.tsx:185-197` exact `{ neutral: true }`, badge, switch checked; failure `:212-219` switch not checked, no badge. **Same mechanism as AC1: the revert comes from the refetch** | a (partial) | ❌ GAP 1 |
| 4. Search once after 300 ms, page 1 | One request with `q`, page 1 | `web/src/features/transactions/extratoFilters.test.tsx:64` no request during typing; `:68-70` exactly `["/transactions?sort=date&order=desc&page=1&q=Supermercado"]` | a | ✅ |
| 5. Filter param + page 1; "Limpar filtros" restores the default | Each param with page 1; default restored | `extratoFilters.test.tsx:96-103` six filters from page 2: `toContain(param)`, `toContain("page=1")`, `not.toContain("page=2")`; `:114-120` `lastList()).toBe(DEFAULT_QUERY)` and controls reset. New: `:123-130` from page 2 with no pending search, `findByText(/Página 1 de 3/)`, `lastList()).toBe(DEFAULT_QUERY)`, `not.toContain("page=2")` | a | ✅ (iteration-1 Gap 1 closed, M17 killed) |
| 6. Valor twice → asc then desc | Ordered requests | `extratoFilters.test.tsx:156-163` `toEqual(["...sort=amount&order=asc&page=1", "...sort=amount&order=desc&page=1"])`, first row matches each order (`:142-155`) | a | ✅ |
| 7. Empty state; pagination | "Nenhuma transação encontrada"; Próxima/Anterior | `extratoFilters.test.tsx:171-174` text, no footer, no table; `:177-198` pages 1 → 2 → 3 → 1 with exact page params, ends disabled | a | ✅ |
| 8. Delete confirm / cancel | Confirm removes; cancel keeps | `extratoCrud.test.tsx:44-64`: cancel `toHaveLength(0)` DELETE (`:54`), row kept; confirm one DELETE, row gone (`:60`) | a | ✅ |
| 9. Create/edit payload; "1.234,56" → "1234.56" | Exact payload | `extratoCrud.test.tsx:83-92` `toMatchObject({ amount: "1234.56", accountId, occurredAt, categoryId, ... })`; edit `:115-127` with `notes: null`; `:133-150` inactive account not offered (T11 Done-when) | a | ✅ |

### FIX-06: Lockfile (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `yarn install --frozen-lockfile` in `web/` | Finishes with no lockfile change | Iteration 1 ran it on a clean copy: `Done in 22.74s`, exit 0, no diff. Re-confirmed that the evidence still applies: `git diff --stat 6968f86..HEAD -- web/yarn.lock web/package.json` is empty. Changed line: `web/yarn.lock:1718` | b | ✅ |

**Summary**: 28 ACs. (a) 27, (b) 1 (FIX-06; FIX-01 AC1 also has b), (c) 0. GAP: FIX-05 AC1 and AC3 share one root cause (Gap 1). Spec-precision gaps: 4.

---

## Edge Cases

- [x] Unknown code → generic, never API text: `errorMessages.test.ts:35`, `categories.test.tsx:119-120`, `transactions.test.tsx:324-325`.
- [x] Edit without touching notes/receipt keeps the values: `transactions.test.tsx:386` (`receipt` unchanged), `:401` (`notes: "Manter"`). The form re-sends the current value, which the spec assumption allows.
- [x] Network failure → generic: `errorMessages.test.ts:36` `new TypeError("Failed to fetch")` → `GENERIC_ERROR`. No screen-level `TypeError` test exists. Screens call the same function, so this is acceptable.

---

## Gate Check

Run once from the real tree at `HEAD` `ffda433`:

- `yarn --cwd web typecheck`: exit 0.
- `yarn --cwd web lint`: exit 0, `✖ 7 problems (0 errors, 7 warnings)`. These are the same pre-existing `react-refresh/only-export-components` warnings in untouched files.
- `yarn --cwd web test`: **Test Files 20 passed (20), Tests 133 passed (133)**, exit 0 (28.5 s). This matches the author's 133. Iteration 1 had 132, so the delta is +1 (the new clear-from-page-2 test). No test was removed, and the other two fix edits only strengthen assertions.
- Skips: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- web/src` → no matches (exit 1).
- Flakiness: `extratoFilters.test.tsx` ran twice more: 7/7 passed (22.6 s), 7/7 passed (22.9 s). The 400 ms real sleeps and the 30 s budget of the six-filter test are unchanged. The risk stays low locally and moderate on a slow CI runner.

---

## Discrimination Sensor

Scratch: `git worktree add --detach /Volumes/MacOnlySSD/dev/personal/.verify-ff2 HEAD`, with `web/node_modules` symlinked. Each mutation was a single exact-string replacement (anchor count checked = 1). The covering tests ran in the scratch, then `git checkout -- web/src` restored it. Depth: P1, expanded.

| # | File:line | Mutation | Covering run | Killed? | Killing test |
| - | --------- | -------- | ------------ | ------- | ------------ |
| M17 | `web/src/features/transactions/TransactionsPage.tsx:218` | "Limpar filtros" keeps the current page (`{ ...baseFilters, page: c.page }`) | extratoFilters | ✅ (was ❌) | `extratoFilters.test.tsx:123` |
| M23 | `web/src/features/accounts/AccountForm.tsx:113-114` | `holder_required` shown under the nickname | accounts | ✅ (was ❌) | `accounts.test.tsx:140` (`:154` `id holder-error`) |
| M23b | `AccountForm.tsx:114` | Every other error (duplicate nickname) shown under the holders | accounts | ✅ | `accounts.test.tsx:140` (`:147` `id account-error`) |
| MN1 | `TransactionsPage.tsx:113` | Neutral failure shows the API message (`reason.message`) | transactions dir | ✅ (Check B gap from iteration 1) | `extratoInline.test.tsx:200` |
| MN2 | `TransactionsPage.tsx:113` | Neutral failure shows the category text | transactions dir | ✅ | `extratoInline.test.tsx:200` |
| M14 | `web/src/features/transactions/hooks.ts:56-57` | Optimistic rollback (`onError`) removed | transactions dir (38 tests) | ❌ **survived in the suite**; killed by the scratch probe (below) | - |
| M14b | `TransactionsPage.tsx:112` | Inline category failure shows the generic text | transactions dir | ✅ | `extratoInline.test.tsx:83` |
| M14c | `hooks.ts:56-58` | Rollback and refetch both removed (category never restored) | transactions dir | ✅ 2 failed | `extratoInline.test.tsx:83`, `:200` |
| M14d | `hooks.ts:58` | Refetch (`onSettled`) removed, rollback kept | transactions dir | ❌ survived (equivalent: the rollback restores, server unchanged) | - |
| F1 | `web/src/lib/api/errorMessages.ts:35` | Unknown codes return the API message | lib/api + features | ✅ 8 failed | `errorMessages.test.ts:51`, `accounts.test.tsx:89`, `categories.test.tsx:113`, `transactions.test.tsx:314,345` |
| F2 | `errorMessages.ts:33` | `duplicate_name` ignores context | lib/api, categories, accounts | ✅ 2 failed | `errorMessages.test.ts:9`, `categories.test.tsx:97` |
| F3 | `web/src/features/accounts/AccountsPage.tsx:41` | Status failure also closes the dialog | accounts | ✅ 3 failed | `accounts.test.tsx:89` (both), `:125` |
| F4 | `web/src/features/transactions/TransactionForm.tsx:132` | Edit sends `notes: undefined` when cleared | transactions dir | ✅ 2 failed | `transactions.test.tsx:379`, `extratoCrud.test.tsx:99` |
| F4b | `TransactionForm.tsx:132` | Edit sends `receipt: undefined` when cleared | transactions dir | ✅ | `transactions.test.tsx:394` |
| F5 | `TransactionForm.tsx:124` | Create always sends `notes` (empty) | transactions dir | ✅ | `transactions.test.tsx:421` |
| F6 | `web/src/features/auth/emailExists.ts:14` | `>=` → `>` | auth | ✅ | `emailExists.test.ts:34` |
| F7 | `emailExists.ts:11` | Empty-identities criterion removed | auth | ✅ 2 failed | `emailExists.test.ts:5`, `authForms.test.tsx:43` |
| F16 | `emailExists.ts:8` | `user_already_exists` criterion removed | auth | ✅ | `emailExists.test.ts:26` |
| F8 | `TransactionsPage.tsx:61` | Inverted period still queries | transactions dir | ✅ | `transactions.test.tsx:461` |
| F9 | `TransactionsPage.tsx:500` | Income class in table row → `text-primary` | transactions.test | ✅ | `transactions.test.tsx:516` |
| F10 | `TransactionsPage.tsx:121` | Bulk sends one call per id | transactions dir | ✅ | `extratoInline.test.tsx:115` |
| F11 | `TransactionsPage.tsx:76` | Debounce 300 → 0 ms | extratoFilters | ✅ | `extratoFilters.test.tsx:53` |
| F12 | `TransactionsPage.tsx:92` | Sort toggle always `asc` | extratoFilters | ✅ | `extratoFilters.test.tsx:132` |
| F13 | `TransactionsPage.tsx:387` | Cancel also deletes | extratoCrud | ✅ | `extratoCrud.test.tsx:44` |
| F14 | `TransactionForm.tsx:192` | Inactive account offered in the form | extratoCrud | ✅ | `extratoCrud.test.tsx:133` |
| F15 | `TransactionsPage.tsx:219` | "Limpar filtros" does not clear the search | extratoFilters | ✅ | `extratoFilters.test.tsx:106` |

**Sensor outcome**: 26 mutations, 24 killed, 2 survived. M14d is equivalent. **M14 is not equivalent.** All three survivors from iteration 1 that were real (M17, M23, and the neutral text in Check B) are now killed.

### M14 re-assessment (probe)

Iteration 1 called M14 equivalent because `onSettled` refetches the unchanged server state. That holds only when the refetch succeeds. Facts:
- react-query 5.104.1 awaits `onError` and then `onSettled` before `mutateAsync` rejects (`node_modules/@tanstack/query-core/build/modern/mutation.js:191-206`). So when the error text appears, the refetch has already finished. The optimistic intermediate state cannot be observed at that moment in the happy refetch case. That part of the iteration-1 reasoning is right.
- If the refetch fails, the query keeps its last data, which is the optimistic cache. `TransactionsPage` still renders rows when `isError` is true and `items.length > 0` (`TransactionsPage.tsx:264-277`). The typical case is the network going down: the PATCH and the GET fail together.

Probe: a scratch-only test file in the worktree, never in the real tree. It sets `failures` for `PATCH /transactions/:id` and `GET /transactions` (`new TypeError("Failed to fetch")`), changes a row's category (test 1) or toggles the neutral switch (test 2), waits for the error text, then asserts that the old category is shown or that the switch is unchecked.
- At `HEAD`: 2 passed.
- With M14 (`onError` removed): 2 failed. Test 1: `toHaveTextContent()` fails because the row still shows the new category. Test 2: `Received element is checked`.

Conclusion: the rollback is the only code that makes FIX-05 AC1/AC3 hold when the save fails offline. No test in the suite pins it. This is a surviving, non-equivalent mutant on a P1 AC.

---

## Check B / Check C

- Payload/conjunction rule: request bodies are asserted by value (`toEqual`/`toMatchObject`/`toHaveProperty(…, null)`) in every create, edit, inline, bulk and neutral test. The new tests assert value and placement (`toHaveAttribute("id", …)`) and exact text (`toHaveTextContent(GENERIC)` plus `not.toHaveTextContent("boom")`), not just existence.
- Check B for the three changed tests: each new assertion kills its target mutant (M17, M23/M23b, MN1/MN2). Each also fails for the opposite fault: duplicate-under-holder (M23b), category text on the neutral path (MN2).
- Check C (reverse mapping): `extratoFilters.test.tsx:123` → FIX-05 AC5; `accounts.test.tsx:140` → FIX-01 AC2/3/5 and T2; `extratoInline.test.tsx:200` → FIX-05 AC3 and FIX-01 AC4/6. The other tests map as in iteration 1. There are no unclaimed tests.

---

## Code Quality (fix commit `ffda433`)

| Check | Status | Note |
| ----- | ------ | ---- |
| Only touched files required | ✅ | 3 test files + the F1-F3 checklist in tasks.md. No product code |
| Surgical, no weakened assertions | ✅ | Two `toBeInTheDocument()` became stricter `toHaveAttribute("id", …)`; one `findByRole("alert")` gained exact-text checks; one test added |
| Clear and matches existing style | ✅ | Reuses `renderLoaded`, `goToPageTwo`, `clickButton`, `DEFAULT_QUERY`. The comments in `accounts.test.tsx:146,153` explain the field intent |
| Test name matches behavior | ✅ | "volta à página 1 mesmo quando o usuário está na página 2 sem nenhuma busca pendente" names the exact condition that defeats the debounce reset |
| No UI text from API `message` | ✅ | `grep -rnE "error\.message|reason\.message" web/src/features` → no matches |
| Documented guidelines | ✅ | `web/AGENTS.md`; otherwise strong defaults |

Minor: `accounts.test.tsx:147` and `:154` assert the element `id` rather than the accessible association (`toHaveAccessibleDescription` on the input). This is enough for placement, because `AccountForm.tsx:150,171` wire `aria-describedby` to those ids. It is not a defect.

---

## Ranked Gaps (fix tasks)

### Fix 1 (Major): the optimistic rollback on a failed inline save is not tested (FIX-05 AC1 and AC3, M14)
- **Root cause**: every failure test in `web/src/features/transactions/extratoInline.test.tsx` (`:83`, `:200`) lets the `onSettled` refetch succeed. The refetch restores the row from the unchanged mock, so the `onError` rollback in `web/src/features/transactions/hooks.ts:56-57` is never what the assertion depends on.
- **Fix task**: in `extratoInline.test.tsx`, add a test (or extend `:83` and `:200`) that also sets `failures.set("GET /transactions", new TypeError("Failed to fetch"))` before the change. Then assert:
  - the category case: the error text is shown and the row's category combobox shows `item.categoryName`;
  - the neutral case: the switch is not checked and there is no "Neutra" badge.
  The `apiSpy` key `GET /transactions` already strips the query string. The page keeps rendering rows when the refetch errors.
- **Done when**: removing `onError` from `useUpdateTransaction` (M14) fails the new test(s), and the suite stays green at HEAD.

Not blocking, listed for the record:
- Flaky-risk timings in `extratoFilters.test.tsx` (real 350-400 ms sleeps).
- The `invalid_account` text "Selecione uma conta ativa" is slightly off on edit, where inactive accounts are allowed.
- Stale `pnpm` gate commands and `Commit:` prefixes in tasks.md. No STATE.md entry for the feature.
- `AccountForm.tsx:113` routes `holder_required` to the holder field only for `instanceof ApiError`. In mock mode (plain `Error` with a code), it lands under the nickname. This affects mock mode only.

---

## Spec-Precision Gaps

1. FIX-01 AC3 says "a mensagem definida para ele" but the spec defines no text for the nine codes. The tests pin the texts chosen in `web/src/lib/api/errorMessages.ts:5-15`. They were never confirmed in the spec.
2. FIX-04 AC2 does not say what the list shows while the period is invalid. The implementation shows "Nenhuma transação encontrada" under the alert.
3. FIX-01 AC5 "associar a mensagem ao campo" does not say whether a programmatic association (`aria-describedby`) is required. Transaction field errors are visual only, and account errors are programmatic.
4. FIX-03 AC3/4 rely on server timing. A slow but genuinely new sign-up (≥ 1 s) is misclassified. This is accepted in the design and should be confirmed on the hosted project.
5. FIX-05 AC1/AC3 "restaurar" / "voltar ao valor anterior" do not say whether the previous value must hold when the list cannot be reloaded (offline). This report reads it as yes (Gap 1), because the user would otherwise see an unsaved value as if saved.

---

## Isolation Proof

- Baseline `git status --porcelain` before: `?? .DS_Store`. After the sensor, probe and cleanup: `?? .DS_Store`. The only other difference is this report.
- `git worktree list` after `git worktree remove --force` and `git worktree prune`: only `/Volumes/MacOnlySSD/dev/personal/financials  ffda433 [feat/front-fixes]`.
- The `web/node_modules` symlink was unlinked before the worktree was removed. The real `web/node_modules` is intact (328 entries).
- `/Volumes/MacOnlySSD/dev/personal/.verify*` no longer exists. That includes the temporary gate log I wrote there and deleted afterwards.
- The probe test lived only in the scratch worktree, copied from the session scratchpad. It was deleted before removal.
- `pgrep -fl "vitest|mutate.py"` is empty. No ports were opened. The servers on 3001 and 8080 were not touched.
- No commits were made. `HEAD` is still `ffda433ee2b6fb71ec01a581f2ebfd2a9319d35f`.

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| FIX-01 | ⚠️ Needs test fix | ✅ Verified |
| FIX-02 | ✅ Verified | ✅ Verified |
| FIX-03 | ✅ Verified | ✅ Verified |
| FIX-04 | ✅ Verified | ✅ Verified |
| FIX-05 | ❌ Needs test fix (AC5) | ❌ Needs test fix (AC1/AC3 rollback, Gap 1) |
| FIX-06 | ✅ Verified | ✅ Verified |

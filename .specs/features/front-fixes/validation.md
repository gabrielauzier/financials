# Validation: front-fixes (web T1-T12 + F1-F4), iteration 3 - PASS

**Verdict**: PASS

The blocking gap from iteration 2 is closed. M14 (the `onError` rollback removed from `useUpdateTransaction`) is now killed by both new offline tests in `web/src/features/transactions/extratoInline.test.tsx:224` and `:247`. Two "wrong snapshot" variants are killed by the same tests. Every earlier fix (M17, M23, MN1, MN2) is still killed. Gates are green: web has 135 tests passing in 20 files, typecheck is clean, lint has 0 errors, and there are 0 skips.

Three mutants survive. None of them is equivalent, and each gets an explicit argument and a probe below:
- M14a and M14a2: the rollback restores only one of several cached list views. A probe shows the unsaved category can stay on screen. This needs two conditions together: the user has visited another filter, page or sort in the last 5 minutes, and both the PATCH and the reload fail (offline).
- M14d: the `onSettled` refetch is removed. It changes only whether the list is fresh after a successful save. No spec AC defines that.

These three do not block. The product code is correct. The behavior they touch is client-side display in an offline, multi-view state. It is not a critical path in the sense of `validate.md` (payment, auth or data integrity), because the server data is never wrong. They are listed as ranked gaps 1-2, and a one-test follow-up is suggested. The orchestrator may disagree with this severity call. If so, it can reclassify gap 1 as blocking. The facts are in the sensor section.

**Iteration**: 3 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/front-fixes/spec.md`
**Diff range**: `050949a^..HEAD` (feature). Fixes since iteration 2: `404d15a..HEAD` = commit `37b08cf` (test-only: `web/src/features/transactions/extratoInline.test.tsx` +47 lines, `tasks.md` +4 lines). `HEAD` = `37b08cfaafab27a476234574691cb0159adc48f9`, branch `feat/front-fixes`.
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations and probes ran only in the temporary worktree `/Volumes/MacOnlySSD/dev/personal/.verify-ff3`, which is now removed.

## Scope

The full feature surface:
- `web/src/lib/api/errorMessages.ts` and its test, `web/src/lib/api/types.ts`, `web/src/lib/api/mock/transactions.ts`
- the changed files in `web/src/features/{accounts,categories,transactions,auth,import}`
- `web/src/test/apiSpy.tsx`, the three `extrato*.test.tsx` files, `web/yarn.lock`

`git diff ffda433..HEAD -- web` touches only `extratoInline.test.tsx`. All other citations below were re-read at `HEAD`.

Classification key:
- (a) covered by tests
- (b) verified by a non-test artifact
- (c) deferred
- GAP: no evidence, or a test that does not discriminate

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1). There are no unchecked boxes (`grep -nE "^\s*-\s*\[\s\]"` finds nothing). T1-T12, F1-F3 (iteration 1) and F4 (iteration 2) are all ticked.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 shared module | ✅ | `aa1c07c` | - |
| T2 accounts | ✅ | `ca5dd9d`, `ffda433` | - |
| T3 categories | ✅ | `0f6a29c` | - |
| T4 transactions screens | ✅ | `7243089` | - |
| T5 null on edit | ✅ | `4587075` | - |
| T6 e-mail detection | ✅ | `fbbf475` | - |
| T7 inverted period | ✅ | `7ab7195` | - |
| T8 income green | ✅ | `ab00adc` | - |
| T9 inline/bulk/neutral tests | ✅ | `722070a`, `ffda433`, `37b08cf` | Rollback now pinned (M14 killed) |
| T10 filters tests | ✅ | `2dfd203`, `ffda433` | - |
| T11 CRUD tests | ✅ | `ce8a489` | - |
| T12 lockfile | ✅ | `6968f86` | - |
| F1 clear from page 2 | ✅ | `ffda433` | `extratoFilters.test.tsx:123-130` |
| F2 account error placement | ✅ | `ffda433` | `accounts.test.tsx:140-159` |
| F3 neutral failure text | ✅ | `ffda433` | `extratoInline.test.tsx:209-211` |
| F4 offline rollback | ✅ | `37b08cf` | `extratoInline.test.tsx:224-245`, `:247-267` |

Process notes (cosmetic, unchanged):
- The `Commit:` lines in tasks.md say `feat(front-fixes)`, but the real commits use `feat(web)`, `test(web)` and `build(web)`.
- The gate commands still say `pnpm -C web`, but the project uses `yarn --cwd web`.
- `.specs/STATE.md` (47 lines) has no front-fixes entry.

---

## Spec-Anchored Acceptance Criteria

### FIX-01: Error messages in Portuguese (P1)

| AC | Spec-defined outcome | Evidence (`file:line` + assertion) | Class | Result |
| -- | -------------------- | ---------------------------------- | ----- | ------ |
| 1. One module, never the API `message` | No API text in any result | `web/src/lib/api/errorMessages.test.ts:51-55` `expect(messageForError(api(code), "account")).not.toContain("Technical English")`. UI: `web/src/features/transactions/transactions.test.tsx:325` `queryByText("Kaboom")).not.toBeInTheDocument()`, `:342`, `:353`; `web/src/features/categories/categories.test.tsx:109-110,120,141`; `web/src/features/accounts/accounts.test.tsx:111,158`; `web/src/features/transactions/extratoInline.test.tsx:211` `not.toHaveTextContent("boom")`. Non-test: grep below | a + b | ✅ |
| 2. `duplicate_name` by context | account "Já existe uma conta com esse apelido"; category "Já existe uma categoria com esse nome" | `errorMessages.test.ts:10-17` `toBe(...)` for both contexts and generic otherwise. Screens: `accounts.test.tsx:147-150` `findByText("Já existe uma conta com esse apelido")).toHaveAttribute("id", "account-error")`; `categories.test.tsx:103` | a | ✅ |
| 3. Text for each listed code | "a mensagem definida para ele" | `errorMessages.test.ts:20-32` `it.each` over the 9 codes, `toBe(text)`. Screens: `transactions.test.tsx:287` (invalid_amount), `:299` (invalid_account), `:308` (validation_error), `:318` (unauthorized), `:340` (not_found bulk); `categories.test.tsx:108` (category_protected), `:132` (reassign dialog); `accounts.test.tsx:154` (holder_required) | a | ✅ ⚠️ spec-precision gap 1 |
| 4. Unknown / network / other → generic | "Não foi possível concluir a operação. Tente novamente." | `errorMessages.test.ts:34-39` `toBe(GENERIC_ERROR)` for an unknown code, `TypeError("Failed to fetch")`, a string and undefined. Screens: `transactions.test.tsx:324`, `categories.test.tsx:119`, `accounts.test.tsx:110`, `extratoInline.test.tsx:210`. Screen-level network error: `extratoInline.test.tsx:254-259` (`TypeError` → exact generic text) | a | ✅ |
| 5. `field` → message on that field | Shown on the matching field | `transactions.test.tsx:288` `toHaveAttribute("id", "transaction-amount-error")`, `:299-302` `transaction-account-error`, `:308-311` `transaction-date-error`; `errorMessages.test.ts:59-67`; `accounts.test.tsx:147-150` (`account-error`), `:154-157` (`holder-error`) | a | ✅ ⚠️ spec-precision gap 3 |
| 6. Map used in accounts, categories and statement (form, inline, bulk, delete, neutral) | Portuguese on every path | Form `transactions.test.tsx:280-326`; inline `extratoInline.test.tsx:95,236`; bulk `extratoInline.test.tsx:160-162`, `transactions.test.tsx:339-342`; delete `transactions.test.tsx:352-353`; neutral `extratoInline.test.tsx:209-211,257-259`; status `accounts.test.tsx:110,135-137`; categories `categories.test.tsx:97-142` | a | ✅ |

Non-test check for AC1: `grep -rnE "error\.message|reason\.message" web/src/features` finds no matches (exit 1).

### FIX-02: Editing clears notes and receipt (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Emptying notes on edit | `notes: null`, shown without notes | `transactions.test.tsx:385` `toHaveProperty("notes", null)`, `:391` stored `notes` `toBeNull()`; `web/src/features/transactions/extratoCrud.test.tsx:115-117` `toMatchObject({ notes: null, ... })`, `:129` `queryByText("Nota antiga")).not.toBeInTheDocument()` | a | ✅ |
| 2. Emptying receipt on edit | `receipt: null` | `transactions.test.tsx:400` `toHaveProperty("receipt", null)` | a | ✅ |
| 3. Create with empty notes/receipt | Fields omitted | `transactions.test.tsx:446-447` `not.toHaveProperty("notes")`, `not.toHaveProperty("receipt")` | a | ✅ |
| 4. Filled values trimmed | Trimmed text | `transactions.test.tsx:415-418` `toMatchObject({ notes: "nova nota", receipt: "https://exemplo.com/novo.pdf" })` from padded input | a | ✅ |

### FIX-03: Sign-up with an e-mail already in use (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `user_already_exists` | Registered | `web/src/features/auth/emailExists.test.ts:26-33` `.toBe(true)` | a | ✅ |
| 2. Empty `identities` | Registered | `emailExists.test.ts:5-12` `.toBe(true)`; screen `web/src/features/auth/authForms.test.tsx:57` | a | ✅ |
| 3. Gap ≥ 1000 ms | Registered | `emailExists.test.ts:34-53`: exactly 1000 ms `toBe(true)` (`:43`), 5 min `toBe(true)` (`:52`) | a | ✅ ⚠️ spec-precision gap 4 |
| 4. Gap < 1000 ms | New sign-up | `emailExists.test.ts:54-69`: 999 ms and 0 ms `toBe(false)`; `:70-85` missing or invalid timestamps `toBe(false)` | a | ✅ |
| 5. Message on the e-mail field | "E-mail já cadastrado" on the field | `authForms.test.tsx:80-83` `findByText("E-mail já cadastrado")`, `getByLabelText("E-mail")).toHaveAccessibleDescription("E-mail já cadastrado")`, no "Verifique seu e-mail" | a | ✅ |

### FIX-04: Accounts, period and appearance (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Activate/deactivate failure | Dialog stays open with a Portuguese message | `accounts.test.tsx:89-123` (both actions): `within(dialog).findByText(GENERIC_ERROR)` (`:110`), no English (`:111`), action button still in the dialog (`:112`); `:125-138` mapped `not_found` text | a | ✅ |
| 2. Inverted period | "A data inicial deve ser anterior à final" and no API call with that period | `transactions.test.tsx:461-474`: `findByText(...)`, and list requests with `from=2026-10-10&to=2026-10-01` `toEqual([])`; `:476-497` equal and valid periods query with no message | a | ✅ ⚠️ spec-precision gap 2 |
| 3. Income green, expense red with minus | `text-emerald-700` / `dark:text-emerald-400`; expense destructive with `-` | `transactions.test.tsx:516-541`, table row and mobile card: `toHaveClass("text-emerald-700", "dark:text-emerald-400")`, no leading `-`; expense `toHaveClass("text-destructive")`, `toMatch(/^-/)` | a | ✅ |

### FIX-05: Statement interface tests (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Inline category; on failure restore + text | Saves with no form; on failure restores the previous category and shows "Não foi possível salvar a categoria" | Success `extratoInline.test.tsx:68-73` exact `toEqual({ method: "PATCH", path, body: { categoryId } })`, `:74` no dialog, `:75-79` new name. Failure, server reachable: `:95` text, `:97-101` old category. **Failure, offline (new)**: `:233-234` PATCH and `GET /transactions` both fail with `TypeError`, `:236` exact text, `:237-241` combobox `toHaveTextContent(item.categoryName)`, `:242-244` `not.toHaveTextContent(target.name)`. M14 killed | a | ✅ (iteration-2 gap closed; residual multi-view gap 1, non-blocking) |
| 2. Bulk in one call; failure keeps state | One call with all ids; on failure selection and categories kept | `extratoInline.test.tsx:129-132` `toHaveLength(1)`, `body toEqual({ ids: [first.id, second.id], categoryId })`, no single PATCH; `:160-172` mapped text, one call, "2 selecionada(s)", both checked, old categories | a | ✅ |
| 3. Neutral switch persists / reverts | New value persisted; on failure reverts | `extratoInline.test.tsx:184-197` exact `{ neutral: true }`, badge, switch checked; failure `:209-219`. **Offline (new)**: `:254-255` both calls fail, `:257-259` exact generic text, `:260-266` switch `not.toBeChecked()` and no "Neutra" badge. M14 killed | a | ✅ |
| 4. Search once after 300 ms, page 1 | One request with `q`, page 1 | `web/src/features/transactions/extratoFilters.test.tsx:64` no request while typing; `:68-70` exactly `["/transactions?sort=date&order=desc&page=1&q=Supermercado"]` | a | ✅ |
| 5. Filter param + page 1; "Limpar filtros" restores the default | Each param with page 1; default restored | `extratoFilters.test.tsx:96-103` six filters starting from page 2: `toContain(param)`, `toContain("page=1")`, `not.toContain("page=2")`; `:114-120` `lastList()).toBe(DEFAULT_QUERY)` and controls reset; `:123-130` from page 2 with no pending search | a | ✅ |
| 6. Valor twice → asc then desc | Ordered requests | `extratoFilters.test.tsx:156-163` `toEqual([...asc, ...desc])`; first row matches each order (`:142-155`) | a | ✅ |
| 7. Empty state; pagination | "Nenhuma transação encontrada"; Próxima/Anterior | `extratoFilters.test.tsx:171-174`; `:177-198` pages 1 → 2 → 3 → 1 with exact page params, end buttons disabled | a | ✅ |
| 8. Delete confirm / cancel | Confirm removes; cancel keeps | `extratoCrud.test.tsx:44-65`: cancel gives 0 DELETE calls (`:54`) and the row stays (`:55`); confirm gives exactly one DELETE for that id (`:61-63`) and the row is gone (`:60`) | a | ✅ |
| 9. Create/edit payload; "1.234,56" → "1234.56" | Exact payload | `extratoCrud.test.tsx:83-92` `toMatchObject({ amount: "1234.56", accountId, occurredAt, categoryId, ... })`; edit `:115-127`; inactive account not offered `:149-150` | a | ✅ |

### FIX-06: Lockfile (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `yarn install --frozen-lockfile` in `web/` | Finishes with no lockfile change | Iteration 1 ran it on a clean copy (exit 0, no diff). I did not re-run the install, because disk is tight and it would mean a second `node_modules`. I re-confirmed that the evidence still applies: `git diff --stat 6968f86..HEAD -- web/yarn.lock web/package.json` is empty. Changed line: `web/yarn.lock:1718` | b | ✅ |

**Summary**: 28 ACs. (a) 27, (b) 1 (FIX-06; FIX-01 AC1 has both a and b), (c) 0, GAP 0. Spec-precision gaps: 5.

---

## Edge Cases

- [x] Unknown code → generic, never the API text: `errorMessages.test.ts:35`, `categories.test.tsx:119-120`, `transactions.test.tsx:324-325`.
- [x] Edit without touching notes/receipt keeps the values: `transactions.test.tsx:386` (`receipt` unchanged), `:401` (`notes: "Manter"`), `extratoCrud.test.tsx:118`.
- [x] Network failure (no response) → generic: unit `errorMessages.test.ts:36`. Screen level (new): `extratoInline.test.tsx:254-259`, where a `TypeError("Failed to fetch")` shows exactly the generic text.

---

## Gate Check

Run once from the real tree at `HEAD` `37b08cf`:

- `yarn --cwd web typecheck`: exit 0.
- `yarn --cwd web lint`: exit 0, `✖ 7 problems (0 errors, 7 warnings)`. These are the same pre-existing `react-refresh/only-export-components` warnings.
- `yarn --cwd web test`: **Test Files 20 passed (20), Tests 135 passed (135)**, exit 0 (28.0 s). This matches the author's 135. Iteration 2 had 133, so the delta is +2: the two offline tests. No test was removed or weakened (`git diff 404d15a..HEAD -- web` is additions only).
- `VITE_MOCK_AREAS=none yarn --cwd web test`: 20 files, 135 passed. The vitest config pins `VITE_MOCK_AREAS: "*"`.
- Skips: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- web/src` finds no matches (exit 1).
- Flakiness:
  - `extratoFilters.test.tsx` ran 1 extra time: 7/7.
  - `extratoInline.test.tsx` ran 3 extra times: 8/8 each time.
  - The scratch worktree also ran the transactions directory at HEAD: 40/40.
  - The new tests use only `waitFor`/`findBy`, with no real sleeps.

---

## Discrimination Sensor

Scratch setup:
- `git worktree add --detach /Volumes/MacOnlySSD/dev/personal/.verify-ff3 HEAD`, with `web/node_modules` symlinked to the real one.
- Each mutation was a single exact-string replacement. The script checked that each anchor matched exactly once.
- The covering tests ran in the scratch. Then `git checkout -- web/src` restored it.
- Worktree porcelain after the run: empty.
- Depth: P1, expanded (29 mutations plus 3 probes).

| # | File:line | Mutation | Covering run | Result | Killing test(s) |
| - | --------- | -------- | ------------ | ------ | --------------- |
| M14 | `web/src/features/transactions/hooks.ts:56-57` | `onError` rollback removed | transactions dir (40) | ✅ Killed, 2 failed (**was ❌ in iteration 2**) | `extratoInline.test.tsx:224`, `:247` |
| M14b | `hooks.ts:50-53` | Wrong snapshot: `previous` read after the optimistic `setQueriesData` | transactions dir | ✅ Killed, 2 failed | `extratoInline.test.tsx:224`, `:247` |
| M14b2 | `hooks.ts:57` | Rollback writes `undefined` instead of the snapshot | transactions dir | ✅ Killed, 2 failed | `extratoInline.test.tsx:224`, `:247` |
| M14a | `hooks.ts:57` | Rollback restores only the first cached query (`previous.slice(0, 1)`) | transactions dir | ❌ Survived. Not equivalent (probe P1) | - |
| M14a2 | `hooks.ts:57` | Rollback restores only the last cached query (`previous.slice(-1)`) | transactions dir | ❌ Survived. Not equivalent (probe P2) | - |
| M14d | `hooks.ts:58` | `onSettled` refetch removed, rollback kept | transactions dir | ❌ Survived. Equivalent on every spec AC; differs on success-path freshness (probe P3) | - |
| M17 | `web/src/features/transactions/TransactionsPage.tsx:218` | "Limpar filtros" keeps the current page | extratoFilters | ✅ Killed | `extratoFilters.test.tsx:123` |
| M23 | `web/src/features/accounts/AccountForm.tsx:113` | `holder_required` shown under the nickname | accounts | ✅ Killed | `accounts.test.tsx:140` |
| MN1 | `TransactionsPage.tsx:113` | Neutral failure shows the API message | transactions dir | ✅ Killed, 2 failed | `extratoInline.test.tsx:200`, `:247` |
| MN2 | `TransactionsPage.tsx:113` | Neutral failure shows the category text | transactions dir | ✅ Killed, 2 failed | `extratoInline.test.tsx:200`, `:247` |
| F1 | `web/src/lib/api/errorMessages.ts:35` | Unknown codes return the API `message` | lib/api + features | ✅ Killed, 9 failed | `accounts.test.tsx:89,125`, `categories.test.tsx:113`, `transactions.test.tsx:345`, `errorMessages.test.ts:51` and others |
| F2 | `errorMessages.ts:33` | `duplicate_name` ignores context | lib/api, accounts, categories | ✅ Killed, 2 failed | `errorMessages.test.ts:9`, `categories.test.tsx:97` |
| F3 | `web/src/features/accounts/AccountsPage.tsx:41` | Status failure also closes the dialog | accounts | ✅ Killed, 3 failed | `accounts.test.tsx:89` (both cases), `:125` |
| F4 | `web/src/features/transactions/TransactionForm.tsx:132` | Edit sends `notes: undefined` when cleared | transactions dir | ✅ Killed, 2 failed | `transactions.test.tsx:379`, `extratoCrud.test.tsx:99` |
| F4b | `TransactionForm.tsx:132` | Edit sends `receipt: undefined` when cleared | transactions dir | ✅ Killed | `transactions.test.tsx:394` |
| F5 | `TransactionForm.tsx:124` | Create always sends `notes` (empty) | transactions dir | ✅ Killed | `transactions.test.tsx:421` |
| F16 | `TransactionForm.tsx:113` | `notes` not trimmed | transactions dir | ✅ Killed, 3 failed | `transactions.test.tsx:379,404,421` |
| F6 | `web/src/features/auth/emailExists.ts:14` | `>=` → `>` | auth | ✅ Killed | `emailExists.test.ts:34` |
| F7 | `emailExists.ts:11` | Empty-identities criterion removed | auth | ✅ Killed, 2 failed | `emailExists.test.ts:5`, `authForms.test.tsx:43` |
| F17 | `emailExists.ts:8` | `user_already_exists` criterion removed | auth | ✅ Killed | `emailExists.test.ts:26` |
| F8 | `TransactionsPage.tsx:61` | Inverted period still queries | transactions dir | ✅ Killed | `transactions.test.tsx:461` |
| F9a | `TransactionsPage.tsx:500` | Income class removed (table row) | transactions.test | ✅ Killed | `transactions.test.tsx:516` |
| F9b | `TransactionsPage.tsx:552` | Income class → `text-primary` (mobile card) | transactions.test | ✅ Killed | `transactions.test.tsx:516` |
| F10 | `TransactionsPage.tsx:121` | Bulk sends one call per id | transactions dir | ✅ Killed | `extratoInline.test.tsx:115` |
| F11 | `TransactionsPage.tsx:76` | Debounce 300 → 0 ms | extratoFilters | ✅ Killed | `extratoFilters.test.tsx:53` |
| F12 | `TransactionsPage.tsx:92` | Sort toggle always `asc` | extratoFilters | ✅ Killed | `extratoFilters.test.tsx:132` |
| F13 | `TransactionsPage.tsx:387` | Delete "Cancelar" also deletes | extratoCrud | ✅ Killed | `extratoCrud.test.tsx:44` |
| F14 | `TransactionForm.tsx:192` | Inactive account offered in the form | extratoCrud | ✅ Killed | `extratoCrud.test.tsx:133` |
| F15 | `TransactionsPage.tsx:124` | Bulk failure drops the selection | transactions dir | ✅ Killed | `extratoInline.test.tsx:143` |

**Sensor outcome**: 29 mutations, 26 killed, 3 survived (M14a, M14a2, M14d). Every survivor from iterations 1 and 2 is now killed (M17, M23, MN1/MN2, M14).

### Survivor analysis (probes, scratch only, deleted afterwards)

- **P1 (M14a)**. A scratch test filters "Tipo: Despesa", which creates a second cached query. It then changes the category with both the PATCH and the GET failing. Result: passes at HEAD, fails with M14a, because the visible filtered row keeps the unsaved category.
- **P2 (M14a2)**. The same setup, then "Limpar filtros" returns to the first cached query before the offline change. Result: passes at HEAD, fails with M14a2.
  - **Verdict on M14a and M14a2**: not equivalent. They weaken the rollback only when several list views are cached and the network is down. The new tests cover only the single-view case.
  - **Why this is not blocking**: the product code (`forEach` over every snapshot) is correct. The fault class (restoring a subset of the snapshots) is contrived. The visible effect is a client-side display issue, and the server data stays intact. That is not one of the critical paths defined in `validate.md` (payment, auth, data integrity). This is ranked gap 1.
- **P3 (M14d)**. A scratch test sets the "Neutra: Não" filter and toggles a row to neutral, which succeeds. Result: at HEAD the row leaves the list; with M14d it stays.
  - **Verdict on M14d**: on the failure path it is equivalent, because the rollback restores the exact snapshot and the server is unchanged. On the success path it changes only list freshness: filter membership and server-computed fields. No spec AC defines that. FIX-05 AC1 and AC3 require persistence, which the exact PATCH body asserts, and the new value on screen, which the optimistic update provides. Not blocking. This is ranked gap 2.

---

## Check B / Check C

- **Payload/conjunction rule**: request bodies are asserted by value (`toEqual`, `toMatchObject`, `toHaveProperty(…, null)`) in every create, edit, inline, bulk and neutral test. The new offline tests assert:
  - the exact error text, in the correct branch (category text, or the generic text for neutral);
  - the restored value positively (`toHaveTextContent(item.categoryName)`, `not.toBeChecked()`);
  - the absence of the optimistic value (`not.toHaveTextContent(target.name)`, no "Neutra" badge).
- **Check B (new tests)**:
  - `:224` fails for M14, M14b and M14b2.
  - `:247` fails for M14, M14b, M14b2, MN1 and MN2. It also catches the opposite fault: text from the wrong branch.
  - Both pass at HEAD: 3 isolated runs plus the full suite.
- **Check C (reverse mapping)**:
  - `extratoInline.test.tsx:224` maps to FIX-05 AC1 and F4.
  - `:247` maps to FIX-05 AC3, FIX-01 AC4/AC6, the network edge case and F4.
  - All other tests map as in iteration 2. There are no unclaimed tests.

---

## Code Quality (fix commit `37b08cf`)

| Check | Status | Note |
| ----- | ------ | ---- |
| Only required files touched | ✅ | 1 test file + the F4 checklist line in tasks.md. No product code |
| Surgical, no weakened assertions | ✅ | Two tests added; nothing removed or changed |
| Matches existing patterns | ✅ | Reuses `seed`, `rowOf`, `chooseCategoryIn`, `failures`, `renderWithQuery` |
| No unnecessary abstraction | ✅ | Two flat tests; the comment at `:222-223` explains why both calls fail |
| Test names match behavior | ✅ | Both names state "server unreachable (PATCH and reload fail)" |
| No UI text from API `message` | ✅ | `grep -rnE "error\.message|reason\.message" web/src/features` → no matches |
| Documented guidelines | ✅ | `web/AGENTS.md`; otherwise strong defaults |

---

## Ranked Gaps (non-blocking)

1. **Minor**: the rollback across several cached list views is not pinned (M14a, M14a2). This affects FIX-05 AC1/AC3 in the offline, multi-view state; probes P1 and P2 show it.
   - **Suggested follow-up**: in `extratoInline.test.tsx`, add one test that applies "Tipo: Despesa" before the offline category change and asserts the old category. Optionally, a second test returns to the default view first.
   - Not required for this feature.
2. **Minor**: list freshness after a successful inline save is not pinned (M14d). An example: a row marked neutral stays under "Neutra: Não" if the refetch is removed. The spec does not define this behavior, so it is a candidate for a spec note rather than a test.
3. **Cosmetic or process**:
   - Real 350-400 ms sleeps in `extratoFilters.test.tsx` and `transactions.test.tsx` give a moderate flake risk on slow CI.
   - The tasks.md gate commands are stale (`pnpm`), and the `Commit:` prefixes do not match the real commits.
   - There is no STATE.md entry for the feature.
   - "Selecione uma conta ativa" reads slightly wrong on edit, where inactive accounts are allowed.
   - In mock mode only, `AccountForm.tsx:113` routes `holder_required` to the holder field only for `instanceof ApiError`.

## Spec-Precision Gaps

1. FIX-01 AC3 says "a mensagem definida para ele", but the spec defines no text for the nine codes. The tests pin the texts in `web/src/lib/api/errorMessages.ts:5-15`, which the spec never confirmed.
2. FIX-04 AC2 does not say what the list shows while the period is inverted. The implementation shows "Nenhuma transação encontrada" under the alert.
3. FIX-01 AC5 "associar a mensagem ao campo" does not say whether a programmatic association (`aria-describedby`) is required or only visual placement. Transaction field errors are placed by `id` only; account and e-mail errors are programmatic.
4. FIX-03 AC3/4 (the 1000 ms rule) rely on server timing. A slow but genuinely new sign-up (≥ 1 s) is misclassified as already registered. Confirm on the hosted project.
5. FIX-05 AC1/AC3 "restaurar" / "voltar ao valor anterior" do not say whether the restore must hold offline, or across other cached views. This report treats the single-view offline case as required (now covered) and the multi-view case as a follow-up (gap 1).

## Isolation Proof

- Baseline `git status --porcelain` before any work: `?? .DS_Store`. After cleanup: `?? .DS_Store`, plus this report as the only modified file.
- `git worktree list` after `git worktree remove --force` and `git worktree prune` shows only `/Volumes/MacOnlySSD/dev/personal/financials  37b08cf [feat/front-fixes]`.
- The `web/node_modules` symlink was unlinked before the worktree was removed. The real `web/node_modules` is intact: 328 entries, and `vitest` is present.
- `/Volumes/MacOnlySSD/dev/personal/.verify*` no longer exists. That covers the worktree and the `.verify-ff3-tools` directory with the mutation script and its log.
- The probe files (`zzProbe*.test.tsx`) lived only in the scratch worktree and were deleted before it was removed.
- `pgrep -fl "vitest|mutate.py"` is empty. No ports were opened, and the servers on 3001 and 8080 were not touched.
- No `git stash` was used and no commits were made. `HEAD` is still `37b08cfaafab27a476234574691cb0159adc48f9`.

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| FIX-01 | ✅ Verified | ✅ Verified |
| FIX-02 | ✅ Verified | ✅ Verified |
| FIX-03 | ✅ Verified | ✅ Verified |
| FIX-04 | ✅ Verified | ✅ Verified |
| FIX-05 | ❌ Needs test fix (AC1/AC3 rollback) | ✅ Verified (follow-up gap 1 is optional) |
| FIX-06 | ✅ Verified | ✅ Verified |

**Result**: PASS

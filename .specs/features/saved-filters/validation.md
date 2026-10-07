# Validation: saved-filters (T1-T10), iteration 1 - FAIL (no functional defect; three test gaps and two spec-precision notes)

**Verdict**: FAIL. The implementation matches the spec on every acceptance criterion and edge case I checked, all gates are green, the browser probe repeated the author's painted numbers exactly, and the diff touches neither the API nor the database. The verdict is FAIL because the discrimination sensor left three non-equivalent surviving mutants (a quick month saved through the controls is not asserted, the order "name rules before the limit" is not asserted, and a stale name error after reopening the save dialog is not asserted). All three are test-only fix tasks. Still pending, as in the author's report: the owner's logged-in, app-level browser steps.

**Date**: 2026-10-07
**Iteration**: 1 (independent Verifier; the author's self-report is in `tasks.md` and the commit bodies)
**Spec**: `.specs/features/saved-filters/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md` AD-006, `.specs/LESSONS.md` L-004, L-013, L-020, L-021, L-027, L-039, L-040, L-041, L-043), `docs/v1/plano-melhoria-transacoes.md` (owner decisions).
**Diff range**: `c1c8dad^..HEAD` (docs commit `c1c8dad`, T1 `1e758bc`, T2 `1d947bc`, T3 `d7b2f9b`, T4 `fbfbd03`, T5 `3e1c096`, T6 `27d06b2`, T7 `7f336d1`, T8 `9e7ec26`, T9 `21ac67a`, T10 `37393d7`, plus `0ff71c6` (tasks.md restore) and `300ba21` (page-size test lightening)), branch `feat/saved-filters`, HEAD `300ba21`.
**Verifier**: fresh agent (author != verifier), no sub-agents. Read-only on the real tree. The 113 mutants and the browser probe ran only in temporary git worktrees on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-sf` and `.verify-sf-probe`), both removed with `git worktree remove --force` and `git worktree prune` (`git worktree list` shows the real tree and the pre-existing `.fix-ci` only). `git status --porcelain` of the real tree is identical before and after (five untracked paths: `.DS_Store`, `docs/v1/ajustes-pontuais.md`, `docs/v1/plano-ajustes-pontuais.md`, `docs/v2/`, `references/nubank_extrato_setembro.csv`). No `db:reset`, no hosted Supabase or Vercel, no `git stash`, no credentials read, printed or created (the probe used the app's mock API, a stub user id and dummy Supabase variables).

Test file legend: all web tests are in `web/src/features/transactions/` unless a full path is shown.

---

## Task completion and the two author incidents

- `tasks.md` has exactly one `## Task Breakdown` heading (`grep -c` gives 1), 10 tasks, 97 ticked boxes and 0 unticked, one commit per task and each subject matches its `Commit:` line (T1 to T10 in the diff range, in order). The cumulative test counts in the Done-when boxes (877 existing, then 923, 963, 966, 973, 974, 987, 997, 1013, 1040, 1050) end at 1050, and I measured 1050 tests, 284 files, 0 failed, 0 skipped in each run. The owner's browser check is not a ticked box (L-039 respected): the status line says it stays open.
- `web/src/lib/notify.test.tsx`: `main` is an older base and has no such file, so I compared against the base of this feature. `git show c1c8dad^:web/src/lib/notify.test.tsx | diff - web/src/lib/notify.test.tsx` is empty, the file is not in `git diff c1c8dad^..HEAD`, and it still has its 6 tests (the feature added only `web/src/lib/notifyErrorMessage.test.tsx`, 1 test, against the real Toaster).
- `TransactionsPage.tsx` is 739 lines (740 before), under the 25-line budget; the month names moved to `savedFilterState.ts`.
- No API or database file is in the diff (`git diff --stat c1c8dad^..HEAD -- api supabase` is empty); `pnpm -C api typecheck` passes.

## Gates (run by the Verifier)

| Gate | Result |
| ---- | ------ |
| `yarn --cwd web typecheck` | exit 0 |
| `yarn --cwd web lint` | exit 0, 0 errors, 7 warnings (the same 7 as before the feature) |
| `pnpm -C api typecheck` | exit 0 |
| Full web suite, run 1 / 2 / 3 (alone, files in parallel) | 1050 passed, 0 failed each; wall time 28.7 s, 28.6 s, 28.8 s |
| Slowest tests alone | 2.03 s, 1.96 s and 1.87 s (`extratoSummary` "Despesas aplica type=Expense..." and `extratoClearFilters`, both older files); slowest new test 1.52 s (`extratoSavedFilters` first test). L-027 budget (under 7.5 s alone): met |
| Two full suites started together | 1050 passed, 0 failed in both; wall time 89.6 s and 89.3 s; slowest test 9.0 s (`extratoClearFilters`, an older file); slowest new test 7.0 s and 6.4 s (`extratoSavedFilters` "a busca do filtro aparece na hora..."); 0 failures in the new files (the previous baseline in `.specs/features/transactions-list/validation.md` addendum: slowest 4.78 s, 0 failures; this run was heavier on the shared machine, still far from the 15 s timeout) |

## Spec-anchored acceptance criteria (evidence-or-zero)

Test file legend for the storage rows: `savedFilters.test.ts` (SF), `savedFilterState.test.ts` (SS), `useSavedFilters.test.ts` (UH), `SaveFilterDialog.test.tsx` (SD), `SavedFiltersMenu.test.tsx` (SM), `ManageFiltersDialog.test.tsx` (MD), `SavedFiltersControls.test.tsx` (SC), `extratoSavedFilters.test.tsx` (EX).

### SFILT-01 State module (`savedFilterState.ts`)

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | exactly the ten fields, no `page`, no `pageSize`, no empty fields | SS:44-49 `expect(toSavedState(FULL)).toEqual(FULL_SAVED)` and the sorted key list; mutants M15, M16 (page and pageSize kept) killed | OK |
| 2 | `q` trimmed, blank `q` absent | SS:51 (`apara a busca`); mutants M01, M03, M20 killed | OK |
| 3 | complete quick month stored with `monthRange` days, incomplete not stored | SS:59-76; mutants M10, M25 killed (M09 is equivalent) | OK |
| 4 | back to page 1, `date`/`desc` when absent | SS:79, SS:87; mutants M21, M22, M23 killed | OK |
| 5 | quick with the stored year and month and the month's days; empty quick otherwise | SS:95, SS:107; M25 killed | OK |
| 6 | `isDefaultState` true for the initial state and a lone incomplete month, false for each field or sort change | SS:119, SS:124 (`it.each`); mutant M27 killed | OK |
| 7 | `sameSavedState` ignores page, size, incomplete month, key order, blank `q`; differs in any of the ten fields (neutral false vs absent) | SS:141, SS:159, SS:165 (`it.each`), SS:179; mutants M28, M29, M30, M31 killed | OK |
| 8 | `withoutMissingRefs` drops and reports, keeps when the list is unknown | SS:199-231; mutants M32, M33 killed | OK |
| 9 | Portuguese summary lines, dates without `Date`, quick in place of De and Até | SS:235-277; mutants M34, M35, M36 killed | OK |

### SFILT-02 Tolerant storage (`savedFilters.ts`)

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | literal key `financials:transactions:saved-filters:<id>`; JSON `{version:1, filters:[{id,name,state}]}` and nothing more | SF:34 `expect(savedFiltersKey("u-1")).toBe("financials:transactions:saved-filters:u-1")`, SF:36 reads the literal key; SF:43-48 key lists; also literal keys in SC:27 and EX:30 (L-043); mutants S01, S02, S03 killed | OK |
| 2 | bad JSON, non-object, `filters` not a list, `version` not 1: empty list, `available` true | SF:53-66 (`it.each` of nine inputs) `toEqual({ available: true, filters: [] })`; mutants S04, S29 killed | OK |
| 3 | a bad entry (no object, no id, id over 64, bad name) is dropped, the rest stay | SF:72-88; mutants S05, S06 killed | OK |
| 4 | duplicate id or name keeps the first; over 20 keeps the first 20 | SF:91-105, SF:107-110; mutants S18, S19, S20, S07 killed | OK |
| 5 | unknown fields dropped; invalid field absent (`sort`/`order` defaults); entry kept | SF:112-137; mutant S21 killed | OK |
| 6 | few fields: the others empty | SF:139-148 | OK |
| 7 | `getItem` or `localStorage` throwing: empty, `available` false, no throw | SF:150-165; mutants S27 killed | OK |
| 8 | users isolated, actions of one do not touch the other | SF:169-186 (`renameSavedFilter("B", idA, ...)` gives `not-found`); mutant S02 killed | OK |
| 9 | empty user id: empty, unavailable, actions fail with `storage`, storage untouched | SF:188-198 (`get`/`set` spies `not.toHaveBeenCalled`); mutant S22 killed | OK |

### SFILT-03 and SFILT-04 Names, cap, save, rename, delete

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 03.1 | trimmed before validating and stored trimmed | SF:203 `namesOf` is `["Mês atual"]`; mutant S26 killed | OK |
| 03.2 | empty: `invalid-name`, "Informe um nome para o filtro" | SF:207-216 exact `toEqual` | OK |
| 03.3 | 41 fails, 1 and 40 pass (code points) | SF:218-231; mutants S09, S10 killed | OK |
| 03.4 | duplicate ignoring case, accent, spaces: `duplicate-name` | SF:233-243 (four spellings); mutants S11, S12, S13 killed | OK |
| 03.5 | rename to a spelling of its own name succeeds | SF:245-256; mutant S15 killed | OK |
| 03.6 | the 21st fails with `limit` and the message; after a delete it saves | SF:260-271, SF:273 (20th saves); mutants S08, S07 killed | OK |
| 04.7 | save appends the trimmed name and the state without page, others intact | SF:280-291 `JSON.stringify(stored("u1"))` has no `page` | OK |
| 04.8 | rename changes only that id's name | SF:293-306 `toEqual` of the whole stored list | OK |
| 04.9 | delete removes only that id | SF:308-312 | OK |
| 04.10 | unknown id: `not-found`, nothing written | SF:314-326 (`setItem` spy not called) exact `toEqual`; mutants S23, S24 killed | OK |
| 04.11 | re-read before write (other tab counts for duplicate and cap, nothing lost) | SF:328-343 | OK |
| 04.12 | `setItem` throwing: `storage`, message, list as before | SF:347-359 exact `toEqual({ ok: false, reason: "storage", message })`, stored text unchanged; mutants S17, S28 killed | OK |
| 04.13 | `getItem` throwing in an action: `storage`, nothing written | SF:362-373; mutant S16 (unreadable storage overwritten) killed | OK |
| order of checks (spec assumption row "Ordem das checagens do nome") | empty, length, duplicate, and only on add the limit | no test with 20 filters and an invalid or duplicate name; mutant S14 survives | Gap (fix task 2) |

### SFILT-05 Hook and session user id

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | `useSessionUserId` gives the id, `null` without session or provider, no throw; `useSession` still throws | `auth/useSessionUserId.test.tsx:22`, `:32`, `:37`; mutant U01 killed | OK |
| 2 | alphabetical list, `available`, `atLimit` at 20, actions return the storage result | UH:22, UH:29 (20 vs 19), UH:45; mutants H01, H04 killed | OK |
| 3 | re-read after a mutation and after `not-found` | UH:45, UH:82; mutant H03 killed | OK |
| 4 | new user gives the new list; `null` gives empty, unavailable, failing actions | UH:95, UH:120; mutant H02 killed | OK |

### SFILT-06 Save filter (`SaveFilterDialog`, `SavedFiltersControls`)

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1, 2 | disabled with the initial state or an inverted period, enabled otherwise | SC:157-175 (`it.each` with `toBeEnabled`/`toBeDisabled`); EX:289-298 inverted period then corrected; mutants C01, C02, P02 killed | OK |
| 3 | dialog with empty focused field, summary list, Cancelar and Salvar | SD:53-66 `expect(field()).toHaveFocus()`, `toHaveAccessibleDescription`; D08 survives (redundant guard, see sensor) | OK |
| 4 | summary lines without page or page size | SC:179-200, SC:203-219 exact line lists; SS:272 | OK |
| 5 | confirm by button or Enter: stored, closed, success toast `Filtro "<nome>" salvo`, focus back on the opener | SD:69-76, SD:79-88; SC:230 `toHaveBeenCalledExactlyOnceWith('Filtro "Receitas por valor" salvo')`; mutant C13 survives on the stored `quick` (see gaps) | OK with the C13 gap |
| 6 | saved filter shows as applied; nothing else changes | SC:238-240 `onApply` not called, `appliedNames()` is the new filter | OK |
| 7 | invalid name keeps the dialog, `role="alert"`, `aria-invalid`, focus on the field, nothing stored | SD:91-114 (`it.each`: empty, 41, duplicate); mutants D04, D07 killed | OK |
| 8 | typing clears the error | SD:117-124; mutant D05 killed | OK |
| 9 | Cancelar or Esc: closed, focus back, reopened field empty | SD:127-136, SD:139-146; mutant D06 killed | OK (stale error after reopen is untested, D09) |
| 10 | 20 filters: limit alert and Salvar disabled | SD:149-163 `toBeDisabled`; SC:466-473; mutants D01, D02 killed | OK |
| 11 | storage failure: error toast with the storage message, dialog kept with the typed name, nothing stored | SD:175-187 (no alert in the field); SC:251-254 `toast.error` called once with the exact storage text; mutants D03, C03 killed | OK |

### SFILT-07 Menu and applied marker

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | opens by click, Enter, Space, ArrowDown; alphabetical items and "Gerenciar filtros" last | SM:44-50 `toEqual(["Mensal","Receitas","Viagem","Gerenciar filtros"])` for Enter, Space, ArrowDown; the mouse click was driven in real Chromium (see Browser) | OK |
| 2 | empty state text and disabled manage | SM:53-60; mutant N03 killed | OK |
| 3 | `aria-current="true"` and "(aplicado)" only on the applied item; check icon, `font-medium` | SM:64-76; SC:361-377; mutants N01, N02, N04, N05, N06 killed | OK |
| 4 | marker leaves when a control changes and returns when equal; page change does not move it | SC:361-377 (`appliedNames()` after type change, back, and `ir para a página 2`); EX:211-222 (real page, Tipo change) ; a page-size change is not asserted (see gaps, low) | OK |
| 5 | click or Enter applies and closes; Esc closes without applying and returns the focus | SM:90-97, SM:99-106 | OK |
| 6 | "Gerenciar filtros" opens the dialog | SM:113-120; SC:452-463 | OK |

### SFILT-08 Apply

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | replaces all ten fields; absent ones empty; absent sort is `date`/`desc` | SC:257-299 `toEqual` of the whole `FilterState`; SC:301-309; EX:182 absent fields; mutants M22, M23, M24, M25, M26 killed | OK |
| 2 | from page 2: page 1, page size kept (none when 50), selection emptied | EX:127-142 starts on page 2 and ends on `page: "1"` exact; EX:239-254 `pageSize: "25"` kept; the selection part is not asserted for a saved filter (the existing effect `useEffect(() => setSelected(new Set()), [filters, pageSize])` covers it, no test names it) | OK except the selection clause (low gap) |
| 3 | request params exactly the saved ones plus `page=1`, nothing from the old state | EX:131-142 `expect(lastListParams()).toEqual({ q, type, accountId, categoryId, neutral: "false", from, to, sort, order, page: "1" })` via the apiSpy log | OK |
| 4 | controls show the values and the sort indicator | EX:143-151 (`toHaveValue("farm")`, Tipo, Conta, Categoria, Neutra "Não", De, Até, `.lucide-arrow-up`) | OK |
| 5 | quick month: Mês, Ano, De and Até disabled with the month's dates; a filter without it clears the month and enables De and Até | EX:157-188 `toBeDisabled`, `toHaveTextContent("01/06/2026")`, then "Selecione o mês" and `toBeEnabled` | OK |
| 6 | search text shows now and the query does not repeat 300 ms later; a filter without search empties the field; a typed text inside the debounce is discarded | EX:154 `listPaths()).toHaveLength(before + 1)` after `advance(300)`; EX:190-209; mutant P01 killed | OK |
| 7 | applied right after | EX:211-217; SC:361 | OK |
| 8 | vanished account or category: rest applied, info toast text, saved filter unchanged | SC:311-337 (`it.each` account, category, both) `toast.info` called once with the exact text, `stored()[0].state` still has `accountId`; mutants C06, C07, C10 killed | OK |
| 9 | list not loaded or failed: whole filter, no notice | SC:348-358; mutants C04, C05 killed | OK |

### SFILT-09 Manage filters

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | one row per filter, alphabetical, `Renomear <nome>` and `Excluir <nome>` native buttons | MD:66-75 `rowNames()` and `tagName` is BUTTON | OK |
| 2 | rename field with the current name selected and focused, Salvar nome and Cancelar | MD:77-88 `selectionStart, selectionEnd` is `[0, 8]`; mutants G06, G10 killed | OK |
| 3 | valid name by button or Enter: toast, read mode, new name in the menu | MD:91-104; SC:380-391 `toast.success` exact `Filtro renomeado para "Entradas"` | OK |
| 4 | invalid name: alert under the field, `aria-invalid`, edit kept, nothing changes; own name in another spelling accepted | MD:106-123 (`it.each`), MD:136-143 | OK |
| 5 | Cancelar or Esc end only the edit; dialog stays | MD:145-158; mutant G01 killed | OK |
| 6, 7 | delete confirmation `Excluir o filtro "<nome>"?`, "Essa ação não pode ser desfeita.", nothing deleted yet; Excluir removes only that filter with the toast; Cancelar keeps | MD:167-183; SC:393-409 `toast.success` `Filtro "Mensal" excluído` | OK |
| 8 | storage failure on rename or delete: error toast with the storage message, edit or confirmation kept, list as it was | MD:185-206; SC:412-430 (`toast.error` last called with the exact storage text, alertdialog still present); mutants G03, G04, C08, C12 killed | OK |
| 9 | filter gone in another tab: toast "Esse filtro não existe mais" and the list refreshes | SC:432-450 exact text twice; MD:208-223; mutants G05, C08 killed | OK |
| 10 | empty state text | MD:235-239, MD:241-249 | OK |
| 11 | rename keeps the marker; delete leaves filters and page untouched and marks nothing | SC:380-391, SC:393-409 (`onApply` not called, `appliedNames()` is empty) | OK |
| 12 | closing returns the focus to "Filtros salvos" | MD:160-165, SC:452-463; mutant G07 killed | OK |
| 13 | typing clears the edit error | MD:125-134; mutant G09 killed | OK |

### SFILT-10 Mount in the extrato

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1, 2 | both buttons after the quick-month group inside "Filtros do extrato"; none without a user id | EX:90-105 `compareDocumentPosition(...)`, `closest("section")` named "Filtros do extrato", then `queryByRole` null with `user.id = null`; SC:147-155; mutant C09 killed | OK |
| 3 | no API request beyond list and summary | EX:256-287 `new Set(sent)` equals the four list, summary, accounts, categories paths; SC:476-484 `expect(requests.slice(before)).toEqual([])` | OK |
| 4 | "Limpar filtros" keeps the saved filters | EX:301-310 | OK |
| 5 | page size 25: saved state has no `pageSize`; applied query keeps `pageSize=25` | EX:224-237 `entry.state` is `{ q, sort, order }`; EX:239-254 | OK |

### SFILT-11 Appearance and accessibility (P2)

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| 1 | dialogs have accessible name and description; field labeled "Nome do filtro" | SD:56 `toHaveAccessibleDescription`, SD:53; MD:68; `getByLabelText("Nome do filtro")` in SC and EX | OK |
| 2 | marker not only color: check icon and `font-medium` | SM:68-75 (`toHaveClass("font-medium")`, svg not `invisible`) | OK |
| 3 | contrast at least 4.5:1 painted, both themes | re-measured in Chromium, see Browser | OK |
| 4 | rename and delete buttons native with the filter name in the accessible name | MD:66-75 | OK |

### Edge cases

| Edge case | `file:line` + assertion | Result |
| --------- | ----------------------- | ------ |
| `null`, a number or empty text in the key gives the empty state | SF:53-66 (`null`, `7`, empty text); menu empty text SM:53 | OK |
| `neutral: false` applies "Neutra: Não" and sends `neutral=false`; absent neutral leaves "Todas" | EX:136 and EX:147 (false); the absent case is asserted in the params only (EX:182 has no `neutral`), not in the control text | OK, low note |
| two filters with the same state are both marked | SM:79-88, SC:369 `["Gêmeo","Receitas"]` | OK |
| `"  Mês  "` stored as `"Mês"` | SF:202-205 | OK |
| 40 characters accepted, 41 rejected | SF:218-226 | OK |
| Enter twice stores once | SD:79-88 `storedNames()` is `["Despesas"]` | OK |
| search typed inside the 300 ms is discarded | EX:196-203 | OK |
| an inactive account is kept | SC:339-346 `filters.accountId` is `inactive.id`, no info toast | OK |
| user A leaves, user B enters: only B's filters | UH:95; SF:169-181 | OK |

## Discrimination sensor

113 mutants (plus one identity control, which survived as it must) in a temporary worktree; each ran the ten new test files (173 tests, about 6.5 s). Result: 108 killed, 5 survived (1 equivalent, 1 redundant guard, 3 real gaps). Mutants cover: storage key and user isolation (S01, S02, S22, H02, C09, U01), version and shape validation (S03, S04, S05, S06, S18-S21, S29), quota, blocked and never-overwrite-on-unreadable paths (S16, S17, S27, S28, D03, G03, G04, C03, C12), cap and name rules (S07-S15, S26, M02, M03), state serialization (each field saved or excluded, page and pageSize: M01-M20), equality for the applied marker (M28-M31), apply (M21-M26, C10, P01, P03), vanished ids and the info toast (M32, M33, C04-C07, C10), save dialog validation and focus (D01-D09), manage dialog (G01-G11), menu marker and disabled conditions (N01-N06, C01, C02, P02), toasts (C03, C08, C12, X01), and the no-user-id fallback (H02, C09, U01). The runner treated any failing test as a kill; I checked the control (identity) and M16 by hand.

| ID | Mutation | Outcome | Killed by (first failing test) |
| -- | -------- | ------- | ------------------------------ |
| M01 | q not trimmed | killed | savedFilterState: não guarda campos vazios e apara a busca; busca em bran |
| M02 | text max 201 | killed | savedFilterState: texto acima de 200 caracteres ou em branco é ausente, e |
| M03 | empty text kept | killed | savedFilterState: não guarda campos vazios e apara a busca; busca em bran |
| M04 | day overflow accepted | killed | savedFilterState: um campo inválido vira ausente e sort e order caem no p |
| M05 | quick year>=1899 | killed | savedFilterState: rejeita ano e mês fora de 1900 a 2100 e de 1 a 12, e nú |
| M06 | quick year<=2101 | killed | savedFilterState: rejeita ano e mês fora de 1900 a 2100 e de 1 a 12, e nú |
| M07 | quick month 0 ok | killed | savedFilterState: rejeita ano e mês fora de 1900 a 2100 e de 1 a 12, e nú |
| M08 | quick month 13 ok | killed | savedFilterState: um campo inválido vira ausente e sort e order caem no p |
| M09 | quick complete uses OR | survived | equivalent: `sanitizeSavedState` drops a quick month without both parts anyway |
| M10 | stored from/to win over quick | killed | extratoSavedFilters: um filtro com mês rápido mostra mês e ano com De e Até  |
| M11 | sort default name | killed | savedFilters: descarta campos desconhecidos da entrada e do estado, e |
| M12 | order default asc | killed | savedFilterState: a ordenação ausente do estado guardado vale data decres |
| M13 | neutral any defined | killed | savedFilterState: um campo inválido vira ausente e sort e order caem no p |
| M14 | type Expense dropped | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M15 | page kept in state | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M16 | pageSize kept in state | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o tamanho da página (rerun alone) |
| M17 | categoryId not saved | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M18 | neutral not saved | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M19 | to not saved | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M20 | q not saved | killed | savedFilterState: guarda os dez campos e deixa de fora a página e o taman |
| M21 | toFilterState page 2 | killed | savedFilterState: volta à página 1 com a ordenação guardada, sem pageSize |
| M22 | toFilterState sort fixed | killed | savedFilterState: volta à página 1 com a ordenação guardada, sem pageSize |
| M23 | toFilterState order fixed | killed | savedFilterState: volta à página 1 com a ordenação guardada, sem pageSize |
| M24 | toFilterState neutral false dropped | killed | savedFilterState: volta à página 1 com a ordenação guardada, sem pageSize |
| M25 | toFilterState quick empty | killed | savedFilterState: o mês rápido guardado dá quick e os dias do mês, mesmo  |
| M26 | toFilterState categoryId dropped | killed | savedFilterState: volta à página 1 com a ordenação guardada, sem pageSize |
| M27 | isDefault ignores order | killed | savedFilterState: é falso quando só order difere do inicial |
| M28 | same: neutral false == absent | killed | savedFilterState: o mês rápido faz diferença e neutra falsa difere de neu |
| M29 | same: order ignored | killed | savedFilterState: é falso quando só order difere |
| M30 | same: accountId ignored | killed | savedFilterState: é falso quando só accountId difere |
| M31 | same: quick ignored | killed | savedFilterState: o mês rápido faz diferença e neutra falsa difere de neu |
| M32 | missing: category reported as account | killed | savedFilterState: tira a categoria e as duas, nessa ordem de aviso |
| M33 | missing: unknown list drops category | killed | savedFilterState: mantém o campo quando a lista não é conhecida (não carr |
| M34 | describe type swapped | killed | savedFilterState: descreve cada campo aplicado em português e a ordenação |
| M35 | describe quick plus De/Até | killed | savedFilterState: o mês rápido aparece no lugar de De e Até |
| M36 | formatDay not reversed | killed | savedFilterState: descreve cada campo aplicado em português e a ordenação |
| S01 | key prefix changed | killed | savedFilters: a chave é financials:transactions:saved-filters:<id do  |
| S02 | key ignores user | killed | savedFilters: a chave é financials:transactions:saved-filters:<id do  |
| S03 | version 2 written | killed | savedFilters: guarda { version: 1, filters: [{ id, name, state }] } s |
| S04 | version unchecked | killed | savedFilters: versão 2 dá lista vazia, disponível e sem lançar |
| S05 | id max 65 | killed | savedFilters: descarta só a entrada inválida e mantém as demais |
| S06 | empty id accepted | killed | savedFilters: descarta só a entrada inválida e mantém as demais |
| S07 | cap 21 | killed | savedFilters: com 25 entradas mantém as 20 primeiras |
| S08 | add limit off by one | killed | savedFilters: o 21º falha com limit e a mensagem, e depois de excluir |
| S09 | name max 41 | killed | savedFilters: descarta só a entrada inválida e mantém as demais |
| S10 | name length in UTF-16 | killed | savedFilters: conta os caracteres de um emoji como um só, e o tamanho |
| S11 | accents kept in compare | killed | savedFilters: mantém só a primeira com o mesmo id ou o mesmo nome (se |
| S12 | case kept in compare | killed | savedFilters: mantém só a primeira com o mesmo id ou o mesmo nome (se |
| S13 | inner spaces kept in compare | killed | savedFilters: nome igual sem diferenciar caixa, acento e espaços repe |
| S14 | limit checked before name | SURVIVED | none (fix task 2) |
| S15 | rename counts itself as duplicate | killed | savedFilters: renomear para o nome de outro filtro falha, e para o pr |
| S16 | unreadable storage overwritten | killed | savedFilters: um id de usuário vazio lê vazio e indisponível e toda a |
| S17 | write failure reported ok | killed | savedFilters: a chave é financials:transactions:saved-filters:<id do  |
| S18 | dup id kept on read | killed | savedFilters: mantém só a primeira com o mesmo id ou o mesmo nome (se |
| S19 | dup name kept on read | killed | savedFilters: mantém só a primeira com o mesmo id ou o mesmo nome (se |
| S20 | read cap removed | killed | savedFilters: com 25 entradas mantém as 20 primeiras |
| S21 | stored state unsanitized | killed | savedFilters: descarta campos desconhecidos da entrada e do estado, e |
| S22 | empty user id reads storage | killed | savedFilters: um id de usuário vazio lê vazio e indisponível e toda a |
| S23 | delete not-found removed | killed | savedFilters: os filtros do usuário A não aparecem para o B, e as açõ |
| S24 | rename not-found removed | killed | savedFilters: os filtros do usuário A não aparecem para o B, e as açõ |
| S25 | sort sensitivity variant | killed | savedFilters: nomes iguais na comparação ficam na ordem guardada e a  |
| S26 | name stored untrimmed | killed | savedFilters: guarda { version: 1, filters: [{ id, name, state }] } s |
| S27 | read swallow removed (getItem throws) | killed | savedFilters: getItem lançando dá lista vazia e indisponível, sem lan |
| S28 | save catch rethrows | killed | savedFilters: setItem lançando (cota cheia ou bloqueado) falha com st |
| S29 | JSON.parse not guarded | killed | savedFilters: texto que não é JSON dá lista vazia, disponível e sem l |
| H01 | atLimit > | killed | useSavedFilters: atLimit é verdadeiro com 20 filtros e falso com 19 |
| H02 | no-user owner | killed | useSavedFilters: sem usuário a lista é vazia, indisponível e as ações fa |
| H03 | no reread after action | killed | extratoSavedFilters: salvar, aplicar, renomear e excluir não enviam nenhuma  |
| H04 | list unsorted | killed | useSavedFilters: devolve os filtros do usuário em ordem alfabética sem d |
| U01 | userId fallback empty string | killed | useSessionUserId: devolve o id do usuário da sessão e volta a null quando |
| D01 | Enter at limit saves | killed | SaveFilterDialog: com 20 filtros salvos mostra a mensagem de limite como  |
| D02 | Salvar not disabled at limit | killed | SaveFilterDialog: com 20 filtros salvos mostra a mensagem de limite como  |
| D03 | storage failure also shows field error | killed | SaveFilterDialog: com o armazenamento falhando o diálogo fica aberto com  |
| D04 | focus not returned to field on error | killed | SaveFilterDialog: o nome vazio mantém o diálogo aberto, mostra a mensagem |
| D05 | typing keeps error | killed | SaveFilterDialog: digitar depois de um erro apaga a mensagem |
| D06 | reopen keeps name | killed | SaveFilterDialog: 'Cancelar' fecha sem guardar, devolve o foco ao botão e |
| D07 | aria-invalid dropped | killed | SaveFilterDialog: o nome vazio mantém o diálogo aberto, mostra a mensagem |
| D08 | autofocus on name dropped | survived | redundant guard: Radix focuses the first tabbable, which is the field (equivalent in practice, low) |
| D09 | reopen keeps error | SURVIVED | none (fix task 3) |
| G01 | Esc never closes dialog | killed | ManageFiltersDialog: Esc sem edição fecha o diálogo e devolve o foco ao botã |
| G02 | rename ok keeps editing | killed | ManageFiltersDialog: um nome válido (botão ou Enter) renomeia só aquele filt |
| G03 | storage failure also shows row error | killed | ManageFiltersDialog: com o armazenamento falhando, renomear mantém a edição  |
| G04 | delete confirmation closes on any outcome | killed | ManageFiltersDialog: com o armazenamento falhando, renomear mantém a edição  |
| G05 | delete confirmation stays on not-found | killed | ManageFiltersDialog: um filtro apagado em outra aba some da lista ao renomea |
| G06 | name not selected on edit | killed | ManageFiltersDialog: Renomear mostra o campo com o nome atual selecionado e  |
| G07 | focus not returned on close | killed | ManageFiltersDialog: Esc sem edição fecha o diálogo e devolve o foco ao botã |
| G08 | reopen keeps editing | killed | ManageFiltersDialog: fechar no meio da edição e reabrir mostra a lista sem e |
| G09 | typing keeps row error | killed | ManageFiltersDialog: digitar depois de um erro apaga a mensagem |
| G10 | draft starts empty | killed | ManageFiltersDialog: Renomear mostra o campo com o nome atual selecionado e  |
| G11 | delete action does not prevent default | killed | ManageFiltersDialog: com o armazenamento falhando, renomear mantém a edição  |
| N01 | aria-current always | killed | SavedFiltersControls: o marcador acompanha o estado: igual marca, diferente t |
| N02 | aria-current never | killed | SavedFiltersMenu: só o item do filtro aplicado tem aria-current e o nome  |
| N03 | manage enabled when empty | killed | SavedFiltersMenu: sem filtros mostra 'Nenhum filtro salvo ainda' e deixa  |
| N04 | no (aplicado) text | killed | SavedFiltersMenu: só o item do filtro aplicado tem aria-current e o nome  |
| N05 | no font-medium highlight | killed | SavedFiltersMenu: só o item do filtro aplicado tem aria-current e o nome  |
| N06 | check always visible | killed | SavedFiltersMenu: só o item do filtro aplicado tem aria-current e o nome  |
| C01 | save enabled with inverted period | killed | SavedFiltersControls: o botão Salvar filtro com um período invertido: habilit |
| C02 | save enabled with default state | killed | SavedFiltersControls: o botão Salvar filtro com o estado inicial: habilitado  |
| C03 | no error toast on save storage failure | killed | SavedFiltersControls: uma falha do armazenamento ao salvar mostra o toast de  |
| C04 | accounts always checked even if not ready | killed | SavedFiltersControls: com as listas ainda não carregadas ou com erro aplica o |
| C05 | categories always checked even if not ready | killed | SavedFiltersControls: com as listas ainda não carregadas ou com erro aplica o |
| C06 | missing both message | killed | SavedFiltersControls: quando as duas não existe mais, aplica o resto e avisa |
| C07 | no info toast | killed | SavedFiltersControls: quando só a conta não existe mais, aplica o resto e avi |
| C08 | rename not-found no toast | killed | SavedFiltersControls: um filtro apagado em outra aba mostra 'Esse filtro não  |
| C09 | renders without user | killed | SavedFiltersControls: sem id de usuário não renderiza nada |
| C10 | apply ignores missing refs | killed | SavedFiltersControls: quando só a conta não existe mais, aplica o resto e avi |
| C11 | summary account name dropped | killed | SavedFiltersControls: o resumo do diálogo traz o apelido da conta e o nome da |
| C12 | remove error not toasted | killed | SavedFiltersControls: uma falha do armazenamento ao renomear ou excluir mostr |
| C13 | controls save `state.filters` instead of the converted state (a quick month would be lost) | SURVIVED | none (fix task 1) |
| P01 | apply keeps old search text | killed | extratoSavedFilters: aplicar a partir da página 2 troca todos os filtros por |
| P02 | inverted period not passed | killed | extratoSavedFilters: com o período invertido o botão Salvar filtro fica desa |
| P03 | apply does not set state | killed | extratoSavedFilters: aplicar a partir da página 2 troca todos os filtros por |
| X01 | notifyErrorMessage as plain toast | killed | notifyErrorMessage: mostra um toast de erro com exatamente o texto dado e a |

## Browser (L-040)

The Browser pane had no logged-in session and I did not read or print credentials. I built a throwaway Vite page in a temporary worktree (not in the repo) that mounts the real `TransactionsPage` with the app `styles.css`, the Tailwind plugin, the app's own `Toaster`, the mock API (`VITE_MOCK_AREAS=*`), dummy Supabase variables and a stub `useSessionUserId` (user id `probe-user`), then measured the browser's painted `getComputedStyle` colors (WCAG ratio against the composited background; both themes by toggling the `dark` class). My numbers equal the author's table in `tasks.md` to two decimals.

| What | Light | Dark |
| ---- | ----- | ---- |
| Save dialog title, label, Cancelar, field text | 17.62:1 on `rgb(251,250,247)` | 19.27:1 on `rgb(2,6,24)` |
| Save dialog description and summary list (muted) | 4.56:1 | 7.66:1 |
| Save dialog name error text (`role="alert"`) | 4.57:1 | 6.98:1 (Manage dialog, editing with an empty name) |
| Invalid field border | `oklch(0.577 0.245 27.325)`, 4.57:1 against the dialog background, settled after the `transition-colors` (the first read, mid-transition, still showed the neutral border) | `oklch(0.704 0.191 22.216)`, red |
| Save button text | 12.21:1 on `rgb(0,59,33)` | not re-measured |
| Menu item text | 20.16:1 on `rgb(255,255,255)` | 17.04:1 on `rgb(15,23,43)` |
| Menu applied item (`aria-current="true"`, weight 500, check icon visible) | 18.40:1 on `rgb(241,245,249)` | 13.97:1 on `rgb(29,41,61)` |
| Manage dialog title, name, icon buttons | not re-measured | 19.27:1; muted description 7.66:1 |
| Delete confirmation title, Cancelar, Excluir | not re-measured | 19.27:1, 19.27:1, 14.46:1; description 7.66:1 |
| Success toast "Filtro "Despesas" excluído" | not measured | 13.36:1 on `rgb(0,44,34)` |

Real mouse path (desktop): picked Tipo "Despesa", clicked "Salvar filtro" (dialog opened with the field focused and "Tipo: Despesa" and "Ordenação: Data (decrescente)" in the summary), clicked "Salvar" with an empty name (error text, red border, focus kept in the field), typed a name and pressed Enter (dialog closed, focus back on "Salvar filtro", the key `financials:transactions:saved-filters:probe-user` holds `{"version":1,"filters":[...]}` with `type`, `sort`, `order` only), clicked "Filtros salvos" (item marked applied), clicked "Gerenciar filtros", cleared a name in the rename field and pressed Enter (error), clicked Cancelar, clicked the delete icon, then "Excluir" (toast, list empty, storage `filters: []`). Seeding two filters and reloading, a click on the "Receitas" item applied it (Tipo "Receita", 9 transactions). A seeded filter whose name had 59 characters was dropped on read (validated read, as the spec says).

375 px: the saved controls fit on one row (right edges 149 px and 326 px of 375), the menu is 153 px wide with no truncation; the only horizontal overflow is the older table's money column (not this feature). Limit of this check: under the tool's mobile emulation a mouse click did not open the Radix menu twice (it opened with Enter), and on desktop the first click after an Escape and a theme toggle was also swallowed once; I read this as the emulation and not as a defect, since a real mouse click opened the menu in every other desktop attempt. The owner's logged-in steps on the real app (save, apply, rename, delete in both themes and on a phone) remain pending.

## Code quality

Only files named by tasks were touched (the `useSession.tsx` change only moves the context to `sessionContext.ts`; `notify.ts` gains `notifyErrorMessage`). No abstraction beyond the seven modules the spec names. `TransactionsPage.tsx` shrinks by one line. Tests map to ACs and edge cases (every test in the ten new files appears in a table above or is a field-level case of SFILT-02). L-043 literal key asserted (SF:34-36, SC:27, EX:30); L-041 page 2 start asserted for apply (EX:107-142); L-020 fake clock and no fixed sleeps (`fakeClock`, `advance`); L-027 respected (the page tests use `lightList`).

## Spec-precision notes

1. Spec assumption row "Marcador do filtro aplicado" says the highlight is `bg-accent`; the code and `tasks.md` use `bg-muted` (`SavedFiltersMenu.tsx:48`). The AC (SFILT-11.2) only says "destaque de fundo", and the painted contrast is fine, so this is documentation drift, not a defect.
2. The spec does not say whether the name error of the save dialog survives a close and reopen (AC 9 only asks for an empty field). The code resets it on open, and nothing pins it (D09).

## Ranked gaps and fix tasks

1. **Fix task 1 (medium): saved quick month through the controls.** Mutant C13 (`SavedFiltersControls.tsx:66` saves `state.filters` instead of the converted state) survives. Add a test in `SavedFiltersControls.test.tsx` that starts from a state with a complete quick month (`quick: { year: 2026, month: 6 }` plus the month's `from` and `to`), saves, and asserts the stored state has `quick` and no duplicated meaning lost (and that applying it later shows Mês and Ano). Without it, a regression silently saves the month as plain dates and applying shows De and Até enabled and Mês empty (SFILT-01.3, SFILT-06.5, owner decision "quick month").
2. **Fix task 2 (low-medium): order of the name checks.** Mutant S14. Add to `savedFilters.test.ts` a test with 20 saved filters where an empty name and a duplicate name (of a stored one) are each refused with `invalid-name` and `duplicate-name`, not `limit`; rename at 20 filters stays unaffected.
3. **Fix task 3 (low): stale error on reopen.** Mutant D09. In `SaveFilterDialog.test.tsx` trigger an error, press Cancelar, reopen and assert no `role="alert"` and no `aria-invalid`; also note in the spec that the dialog resets the error on open (spec-precision note 2).
4. **Low (optional):** assert in `extratoSavedFilters.test.tsx` that applying a saved filter empties a row selection (SFILT-08.2 clause), that a page-size change leaves the marker where it is (SFILT-07.4), and that an absent `neutral` leaves "Neutra" at "Todas" (edge case).
5. **Doc only:** change `bg-accent` to `bg-muted` in the spec row (spec-precision note 1).
6. D08 (explicit autofocus of the name field) is a redundant guard behind Radix's own first-tabbable focus; no action unless the field stops being the first focusable element.
7. M09 is equivalent (`sanitizeSavedState` already drops a quick month with a missing part); no action.

Baseline and final `git status --porcelain` of the real tree: the same five untracked paths. Only this file and the lessons files are committed by the Verifier.

## Fixes after independent validation

The top-line verdict above stays FAIL as the independent Verifier wrote it: no fresh independent agent has re-verified these fixes, so this report is not turned into a PASS. The fixes were written by the author of the fix commits, each new guard test was proved by a quick mutation in a temporary git worktree on the external volume (`.fix-sf`, removed with `git worktree remove --force` and `git worktree prune`; the real tree was never mutated, no `git stash`), and the evidence is in the commit bodies.

| Gap | Fix | Mutation proof |
| --- | --- | -------------- |
| Fix task 1, C13 (quick month saved through the controls) | `SavedFiltersControls.test.tsx`: saves a complete quick month, asserts the stored `quick` and the month's days (`from`, `to` come from `monthRange`; the stored form keeps the days next to `quick`, so the test pins `quick`, not the absence of dates), then applies it again and expects the month | saving `state.filters` instead of the converted state fails it (1 failed, 27 passed) |
| Fix task 2, S14 (order of the name checks) | `savedFilters.test.ts`: with 20 stored filters, empty and 41-character names give `invalid-name`, a duplicate gives `duplicate-name`, a fresh name gives `limit` | limit check above `checkName` fails it (1 failed, 40 passed) |
| Fix task 3, D09 (stale error on reopen) | `SaveFilterDialog.test.tsx`: error, Cancelar, reopen, no alert and no `aria-invalid`; `spec.md` now says the dialog clears the name error on open | removing `setError(undefined)` from the open effect fails it (1 failed, 13 passed) |
| Low, selection (SFILT-08.2) | `extratoSavedFilters.test.tsx`: applying a saved filter empties a row selection | reset effect of `TransactionsPage` no longer depends on `filters` fails it |
| Low, page size marker (SFILT-07.4) | same file: a page size change keeps the applied marker | passing a different state to the controls when the page size is not the default fails it (and the older "25 por página não guarda o tamanho" test) |
| Low, absent `neutral` | same file: after a filter without `neutral`, "Neutra" shows "Todas" | applying an absent `neutral` as `false` fails it (plus three older tests) |
| Doc, spec note 1 | `spec.md`: applied-marker class is `bg-muted`, as in `SavedFiltersMenu.tsx` | not applicable |

Not changed: D08 (redundant guard behind Radix focus) and M09 (equivalent) stay as the Verifier described them.

Gates after the fixes: `yarn --cwd web test` three times, 1055 passed, 0 failed each (1050 plus the five new tests; 93 files by the run's own count); `yarn --cwd web typecheck` exit 0; `yarn --cwd web lint` 0 errors and the same 7 warnings as before. The traceability table of `spec.md` now reads Verified for SFILT-01 to SFILT-11 on the strength of the Verifier's evidence tables plus these fixes. Still open: a fresh independent re-verification of the fixes, and the owner's logged-in browser steps (save, apply, rename, delete in both themes and on a phone).

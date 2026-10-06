# Validation: transactions-ux-v2 (T1-T8) - PASS

**Verdict**: PASS, by the author's own check. This is NOT the independent Verifier the skill asks for: the run forbade sub-agents, so no fresh agent re-derived coverage and no separate sensor run was made. The discrimination sensor below is the author's mutation proofs, run per task in a temporary worktree and recorded in each commit body. The browser steps are listed at the end for the owner; the agents have no logged-in session.

**Date**: 2026-10-06
**Spec**: `.specs/features/transactions-ux-v2/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md` AD-001..AD-005, confirmed lessons L-004, L-006, L-013, L-027)
**Diff range**: `caea21a..HEAD` (docs commit `caea21a`, then 8 task commits T1 `0ed87a8` to T8 `0b4ec1e`), branch `feat/transactions-ux-v2`.

## Gates

- `pnpm -C api typecheck` and `pnpm -C api lint`: clean. `pnpm -C api test`: 382 unit + 625 integration pass (615 before, 10 new).
- `yarn --cwd web typecheck`, `lint` (0 errors, the same 7 warnings as `main`, none new) and `test`: run three times in a row, each 75 files and 697 tests pass (617 before, 80 new).
- `validate_spec.py` and `validate_tasks.py`: exit 0. `tasks.md` has one `## Task Breakdown` and no unticked box.

## Spec-anchored acceptance criteria

API tests are in `api/test/`; web tests are in `web/src/`.

| AC | `file:line` + assertion | Spec-defined outcome | Covered |
| -- | ----------------------- | -------------------- | ------- |
| TUXV2-01 `identifier` in list, POST 201 and PATCH 200 as string or null | `api/test/transactions.int.test.ts:76` `identifier: null` in the 201 body (`toEqual`); `:311` key set lists `identifier`; `:1261` `expect((await find('Importada lista'))?.identifier).toBe('a1b2c3d4-0000-4000-8000-000000000001')` | field present, stored text unchanged | Yes |
| TUXV2-01 stored value untrimmed in GET and PATCH | `api/test/transactions.int.test.ts:1266` `toBe('  ID-COM-ESPACOS  ')`; `:1283` PATCH `toBe('ID-ORIGINAL')` | no trim, no change | Yes |
| TUXV2-02 POST ignores `identifier` (string, number, object, null) | `api/test/transactions.int.test.ts:1271` `expect(res.json<Txn>().identifier).toBeNull()` and `storedIdentifier` null | 201 and null | Yes |
| TUXV2-02 PATCH ignores it, alone and with `name` | `api/test/transactions.int.test.ts:1283` `toMatchObject({ name: 'Renomeada id', identifier: 'ID-ORIGINAL' })`; `:1294` manual row stays null | 200, value unchanged | Yes |
| TUXV2-02 RLS isolation | `api/test/transactions.int.test.ts:1301` `expect(JSON.stringify(theirs)).not.toContain('ID-PRIVADO')` and PATCH 404 | other user sees nothing | Yes |
| TUXV2-03 OpenAPI shape and up-to-date file | `api/test/swagger.int.test.ts:92` `toMatchObject({ type: 'string', nullable: true })` in 3 responses, `not.toHaveProperty('identifier')` in POST and PATCH bodies; existing up-to-date test in the same file | in `Transaction`, not in bodies | Yes |
| TUXV2-04 web type and mock | `web/src/lib/api/mock/transactions.test.ts:115` some seeded filled and some null; `:125` created `toBeNull()`; `:135` PATCH keeps the stored value; `:153` two `@ts-expect-error` lines | type and mock like the API | Yes |
| TUXV2-05 modal shows "ID" and "Identificador externo" | `web/src/features/transactions/transactionIdentifiers.test.tsx:59` `getByTestId("transaction-id").textContent).toBe(item.id)` and the identifier | exact text | Yes |
| TUXV2-05 "—" and no copy button when null | `transactionIdentifiers.test.tsx:69` `toHaveTextContent(/^—$/)` and `queryByRole("button", { name: "Copiar identificador externo" })` absent | dash, no button | Yes |
| TUXV2-05 read-only and PATCH body | `transactionIdentifiers.test.tsx:83` `queryByDisplayValue(item.id)` absent, no `textbox`, PATCH body keys lack `id` and `identifier` | no editable field | Yes |
| TUXV2-05 create form has no block; reopening shows the new values | `transactionIdentifiers.test.tsx:95` `queryByRole("group", { name: GROUP })` absent; `:102` second transaction's id and identifier | as spec | Yes |
| TUXV2-06 copy ID and external identifier | `transactionIdentifiers.test.tsx:118` `writeText` called once with `item.id`, `toast.success` "ID copiado"; `:129` identifier and "Identificador externo copiado" | exact value and text | Yes |
| TUXV2-06 clipboard refused or missing | `transactionIdentifiers.test.tsx:141` and `:151` `toast.error` called once with `GENERIC_ERROR`, dialog still present | generic Portuguese message, modal open | Yes |
| TUXV2-07 `notifyInfo` emits `toast.info` | `web/src/lib/notify.test.tsx:38` `toast.info` called once with "Dica para você" | exact text | Yes |
| TUXV2-07 green, red, neutral per type and theme | `web/src/components/ui/toast-styles.test.ts:58` success hue 110-180; `:66` error hue 0-40; `:74` info equals `--background` and `--foreground`; `:80` distinct backgrounds; `:95` dark tones | by hue and tokens, light and dark | Yes |
| TUXV2-07 a real toast carries its own type's classes | `web/src/components/ui/toaster.test.tsx:18` `data-type` and `toHaveClass` per type, and `not.toHaveClass` for the others | wiring | Yes |
| TUXV2-08 contrast at least 4.5:1 | `toast-styles.test.ts:90` `contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5)` for 3 types x 2 themes (measured 9.19 to 19.27) | AA | Yes |
| TUXV2-08 one Toaster | `notify.test.tsx:72` one "Notifications" region | one | Yes |
| TUXV2-09 busca, Tipo, Conta, Categoria, Neutra: x shown only with a value; clears only it, keeps others and sort, page 1 | `web/src/features/transactions/extratoClearFilters.test.tsx:75`, `:104`, `:119`, `:135`, `:153` `expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" })`; `:227` and `:234` visibility | full parameter set equality | Yes |
| TUXV2-10 De and Até clear one date; no x with the quick month | `extratoClearFilters.test.tsx:168` `toEqual({ ...SORT, to: "2026-06-30" })`; `:184`; `:265` `queryClearButton("De")` absent | one date only | Yes |
| TUXV2-11 quick month x: shown with both, clears from/to, frees De/Até | `extratoClearFilters.test.tsx:200` `toEqual({ ...SORT, type: "Expense" })`, De and Até `toBeEnabled()`; `:255` not shown with one part | as spec | Yes |
| Edge cases: last filter, inverted period, page 2, search no second query | `extratoClearFilters.test.tsx:276` base query and no x; `:285` alert gone; `:300` `page: "1"`; `:89` `listPaths()).toHaveLength(after)` after 1000 ms | as spec | Yes |
| TUXV2-12 weekday of the local day, 23:30 in two zones, boundaries, leap year, invalid | `web/src/features/transactions/utils.test.ts:98` seven days; `:111` Seg and "05/10/2026"; `:119` Ter in UTC; `:132` `2026-03-01T00:00Z` Sáb and Dom; `:140`, `:147` month and year turn; leap year and invalid right after | by hardcoded known weekdays | Yes |
| TUXV2-13 weekday under the date in the table and the card, smaller and lighter | `web/src/features/transactions/extratoWeekday.test.tsx:60` `date.nextElementSibling).toBe(weekday)` and cell contains it; `:72` card and `· <nickname>`; `:93` `toHaveClass("text-xs", "text-muted-foreground")`; `:105` invalid has none | as spec | Yes |

## Discrimination sensor (author's mutations)

Each task's commit body lists its mutations. In total 45 behavior-level mutants were run in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.mut-v2`, removed at the end); every one is killed by at least one test. Two survived the first test set and led to new tests: `success` without the `dark:` classes (a dark-tones test was added) and the seed that fills every identifier hiding behind rows created by other tests (a seeded-rows-only helper was added). A third finding was a test-order dependence: the mount-time search debounce reset the page to 1, so the page-2 clear test passed under a mutation depending on machine speed; the file now fakes the timers and moves the debounce by hand.

## Process notes

- `TransactionsPage.tsx` is 741 lines (717 before); the new UI is in `FilterField.tsx`, `TransactionDate.tsx` and `TransactionIdentifiers.tsx`.
- Spec changes made during Execute (recorded in the commit bodies): the neutral toast is defined by `--background`/`--foreground` (the dark background has chroma 0.042, so a chroma limit would fail), and the card date uses `text-foreground` so the weekday is lighter there too.

## Manual browser check for the owner (needs a logged-in session)

1. Edit a transaction imported from a bank file: "ID" and "Identificador externo" show as text; "Copiar ID" and "Copiar identificador externo" put the exact values on the clipboard and show a toast. Edit a manual one: the external identifier shows "—" with no copy button. On a plain-HTTP address the copy button shows the generic error toast.
2. Trigger a success toast (save a category) and an error toast (stop the API and save): green and red, in the light and the dark theme (the `dark` class on the root); text readable in both.
3. Apply search, Tipo, Conta, Categoria, Neutra, De, Até and the quick month one by one and clear each with its "x": only that filter goes, the others and the column sort stay, the list returns to page 1.
4. Look at the weekday under the date in the table and in the narrow (mobile) card; check a transaction near midnight.

# Validation: transactions-ux-v2 (T1-T8), iteration 2, independent Verifier - FAIL

**Verdict**: FAIL (independent Verifier, iteration 2). All 13 requirements have `file:line` evidence and every gate is green, but the headline deliverable of the toast story does not work in a real browser: the per-type colors never reach the screen (gap 1 below, reproduced in Chromium in the Browser pane). jsdom tests cannot see it, so every test, the contrast test and the author's 45 mutants passed over it. Nine further mutants survive (gaps 2 to 5), none on a data or authorization path. The author's iteration 1 section is kept at the end, reworded so the single-verdict parser reads this verdict only.

**Date**: 2026-10-06
**Iteration**: 2 (iteration 1 = the author's self-report)
**Spec**: `.specs/features/transactions-ux-v2/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md` AD-001..AD-005, `.specs/LESSONS.md` L-004, L-006, L-013, L-027)
**Diff range**: `caea21a^..HEAD` (T1 `0ed87a8` to T8 `0b4ec1e`, plus the author's report commit `c9b1424`), branch `feat/transactions-ux-v2`.
**Verifier**: fresh independent sub-agent (author != verifier). Read-only on the real tree. Mutations and the browser probe ran only in temporary git worktrees on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-v2` at HEAD and `.verify-v2-base` at `caea21a^` = origin/main code), both removed (`git worktree list` shows the real tree and the pre-existing `.fix-ci` only). `git status --porcelain` of the real tree is identical before and after (five untracked paths: `.DS_Store`, `docs/v1/ajustes-pontuais.md`, `docs/v1/plano-ajustes-pontuais.md`, `docs/v2/`, `references/nubank_extrato_setembro.csv`). No `db:reset`, no hosted Supabase or Vercel, no `git stash`, no credentials read.

Test file legend: API tests are in `api/test/`; web tests are in `web/src/` (paths shown from there).

---

## Task completion

`tasks.md` has one `## Task Breakdown`, status Done, 0 unticked boxes; one commit per task and subjects match the `Commit:` lines (T1 `0ed87a8`, T2 `a69bf0b`, T3 `2e0f5cf`, T4 `aa38ecd`, T5 `4cf765f`, T6 `1011a00`, T7 `5232c2b`, T8 `0b4ec1e`). All 8 tasks Done. The task T4 "Done when" line about the Tailwind compilation is true (I confirmed the `dark` rule with the `group-[.toaster]` prefix is emitted, see gap 1), but compilation is not the same as winning the cascade.

## Spec-anchored acceptance criteria (evidence-or-zero)

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| TUXV2-01 list/POST/PATCH carry `identifier`; stored text unchanged | string or null; untouched | `api/test/transactions.int.test.ts:76` `identifier: null` in 201; `:311` key set lists `identifier`; `:1261` `.identifier).toBe('a1b2c3d4-0000-4000-8000-000000000001')`; `:1268` `toBe('  ID-COM-ESPACOS  ')`; `:1287`/`:1290` PATCH keeps `'ID-ORIGINAL'` | PASS (mutants A3, A4, A5 killed) |
| TUXV2-02 POST ignores (string, number, object, null), PATCH ignores alone and with `name`, RLS | 201 + null; 200 + stored; other user sees nothing | `transactions.int.test.ts:1279` `expect(res.json<Txn>().identifier).toBeNull()`; `:1287`, `:1290`; `:1298` manual row stays null; `:1301` block (`not.toContain('ID-PRIVADO')`, PATCH 404) | PASS (A1, A2 killed) |
| TUXV2-03 openapi has it in `Transaction`, not in POST/PATCH bodies | nullable string, required in responses | `swagger.int.test.ts:92` block: `toMatchObject({ type: 'string', nullable: true })`, `required toContain('identifier')`, `not.toHaveProperty('identifier')` for both bodies; file-is-current test in the same file | PASS (A6 to A10 killed) |
| TUXV2-04 web type and mock | `string \| null`; mock null on create, ignores on PATCH | `lib/api/mock/transactions.test.ts:121-122` some filled, some null; `:127` `toBeNull()`; `:144` and `:150` PATCH keeps stored; `:161` `@ts-expect-error` (typecheck gate) | PASS (K1 to K4 killed) |
| TUXV2-05 modal shows ID, external id (exact), "—" + no button when null, read-only, PATCH body, no block on create, reopen | exact text, no editable control | `features/transactions/transactionIdentifiers.test.tsx:59`, `:69`, `:79`, `:95`, `:102` | PASS (I3, I4, I9, I12 killed) |
| TUXV2-06 copy ID / external id: exact value, toasts, failure toast with modal open | `writeText(id)`, "ID copiado"; same for identifier; generic error text | `transactionIdentifiers.test.tsx:124-125` `toast.success ... "ID copiado"` and `writeText ... item.id`; `:129` identifier; `:141`, `:151` `toast.error` generic + dialog present | PASS with a precision gap: exact value is checked only for values without edge whitespace (I2 survives, gap 4) |
| TUXV2-07 `notifyInfo` is `toast.info`; success green, error red, info neutral, both themes | by hue / `--background` / `--foreground`; classes per type on a real toast | `lib/notify.test.tsx:40` `toast.info ... "Dica para você"`; `components/ui/toast-styles.test.ts:58`, `:66`, `:74`, `:80`; `components/ui/toaster.test.tsx:18` `data-type` + `toHaveClass` per type | GAP: the tests prove the class names and their theme values, not that the browser applies them. In Chromium none of the colors apply (gap 1) |
| TUXV2-08 contrast at least 4.5:1 per type and theme; one Toaster | WCAG AA from theme values | `toast-styles.test.ts:92` `contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5)` (3 types x 2 themes); `lib/notify.test.tsx:77` one region | GAP for the same reason: the ratio is computed on colors that are not the ones painted (the painted toast is white background, rgb(23,23,23) text) |
| TUXV2-09 search, Tipo, Conta, Categoria, Neutra: x only with value; clears only it, keeps others and sort, page 1 | exact parameter set | `extratoClearFilters.test.tsx:75`, `:104-113` `expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" })`, `:119`, `:135`, `:153`; visibility `:227`, `:234`, `:246` | PASS for value and keep-others; precision gap for "page 1": these tests start on page 1 (`SORT` has `page: "1"`), so the reset is not observed for 5 of the 6 filters (gap 2) |
| TUXV2-10 De / Até x; absent with quick month | drops only its date | `extratoClearFilters.test.tsx:168-181`, `:184`, `:265` `queryClearButton("De")` absent | PASS (De page reset covered by `:300`; Até page reset not, gap 2) |
| TUXV2-11 quick month x only with month and year; clears from/to, frees De/Até, keeps others | as spec | `extratoClearFilters.test.tsx:200-224`, `:255` | PASS (F-Q-keepquick, F-Q-keep-to, F-Q-partial killed; page reset killed by the older `extratoQuickMonth.test.tsx` test for "Limpar mês") |
| Edge cases: last filter, inverted period, search no second query, page 2 | as spec | `extratoClearFilters.test.tsx:276`, `:285`, `:89`, `:300` | PASS, `:300` uses De only (gap 2) |
| TUXV2-12 weekday of the local day; 23:30 SP vs UTC; month/year turn; leap day; midnight UTC; invalid | Seg/Ter, Sáb/Dom, Qui/Sex, Ter/Qua, "" | `features/transactions/utils.test.ts:108` seven days; `:115-116` Seg at 23:30 SP; `:123` Ter in UTC; `:135`/`:137` `2026-03-01T00:00Z` Sáb in SP, Dom in UTC; `:142-144`, `:149-151`, `:156-160`; `:165-166` `toBe("")` | PASS (D1 to D8 killed) |
| TUXV2-13 weekday in a second line under the date in table and card; `text-xs text-muted-foreground`, date without them | as spec | `features/transactions/extratoWeekday.test.tsx:68` `date.nextElementSibling).toBe(weekday)`; `:80` card; `:99-101` classes; `:109` invalid absent | PASS in the DOM; "below" is a layout fact jsdom cannot see (D16 survives, accepted, owner browser check) |

**Weekday logic vs the extrato's timezone code**: `weekdayAbbrev` (`utils.ts`) uses `new Date(iso).getDay()` and `formatDateLocal` (`lib/format.ts:15`) formats `new Date(iso)` with `Intl.DateTimeFormat("pt-BR", ...)` and no `timeZone`, so both read the browser zone; `utils.test.ts:114` and `:122` assert the date and the weekday together for the same instant in both zones. America/Sao_Paulo has no DST since 2019, so 23:30 local cannot straddle a transition. No divergence found.

## Edge cases

All spec edge cases are covered (see the rows above); the dark-theme toast case is covered only at the class level (gap 1).

## Gates (run by the Verifier)

| Gate | Result |
| ---- | ------ |
| `pnpm -C api typecheck`, `pnpm -C api lint` | clean |
| `pnpm -C api test` | 382 unit + 625 integration pass (615 integration before the feature, 10 new), 147 s |
| `yarn --cwd web typecheck` | clean |
| `yarn --cwd web lint` | 0 errors, 7 warnings, all `react-refresh/only-export-components` in files the feature did not touch (same as main), none new |
| `yarn --cwd web test` x3, sequential | 75 files, 697 tests, 0 failed in each run (66.6 s, 63.2 s, 62.1 s); 617 tests before the feature, 80 new, no test removed |
| Under CPU load: HEAD and `caea21a^` (main's code) full suites started at the same time | HEAD 32 failed of 697; main 31 failed of 617 (timeouts, single tests up to 150 s of wall time because the machine was saturated). Older files fail on both sides (extratoCrud, extratoFilters, extratoInline, extratoQuickMonth, extratoAccountLabel, extratoDescriptionForm, paymentMethodOther, transactions.test): pre-existing, L-027, not findings. Failures only on HEAD and in the new file `extratoClearFilters.test.tsx`: "Limpar filtro De" and "Limpar filtro Até" (the two DatePicker tests, 2.0 to 2.6 s alone): a finding of the same class as L-027 (gap 6). One more HEAD-only failure in an older file (`CreditExpenseForm.test.tsx`) is load noise on a file the feature did not touch |

Slowest tests alone (3 runs): older files `extratoDescriptionForm` 8.3 to 10.5 s, `extratoFilters` 7.7 to 10.2 s, `extratoQuickMonth` 7.5 to 9.9 s, `extratoCrud` 8.4 s (pre-existing, above half of the 15 s timeout per L-027); new files: `extratoClearFilters` De/Até/Busca 1.6 to 2.6 s, nothing else above 1 s.

## Discrimination sensor

84 behavior-level mutants (one is a control) in `.verify-v2`, each run against the tests of its area, original restored with `git checkout -- <file>` after every run. 74 killed by the feature tests, 1 more (F-Q-page) killed only by an older test, 9 survive. Killed ones include: identifier written by POST (A1) or PATCH (A2), omitted from the select (A3), forced null (A4), trimmed (A5), dropped or optional or non-nullable in the schema (A6, A7), documented in the POST or PATCH body (A8, A9), stale `openapi.json` (A10); copy button value altered (I1), "ID" and external-id toast text swapped (I5, I6), clipboard failure swallowed or not awaited (I7, I8), "—" lost (I3), button for null (I4), block in the create form (I9), accessible name (I10), value inside an input (I12); mock POST/PATCH/seed (K1 to K4); toast success/error colors swapped (T1, T2), dark variants removed (T3, T4), info uses success (T5), low-contrast text (T6, T7, T8, T13), `Toaster` ignores classes (T9), `notifyInfo` emits success (T10), contrast formula (T11); per filter "clears the others" (Tipo, Conta, Categoria, Neutra, Busca, De, Até, Mês rápido), "drops sort" (Tipo, Conta, Busca), x always visible (selects, Busca), De/Até x with the quick month, quick x with one part, quick clear keeps `to`, leaves pickers disabled, wrong name, search clear leaves the text or waits for the debounce; weekday names, order, accent, `getUTCDay`, date-only parse, off by one, invalid text, classes on the wrong element, card and table both reverted (D1 to D15).

| ID | Mutation | Result | Why it matters |
| -- | -------- | ------ | -------------- |
| I2 | copy button writes `value.trim()` | SURVIVED | spec says the exact value; the tests use values with no edge whitespace and the API keeps spaces |
| T12 | base `toast` key also carries `group-[.toaster]:bg-background` | SURVIVED | the module comment says colors live only in the per-type keys because two background classes make the winner depend on CSS order; nothing asserts it |
| F-Tipo-page, F-Conta-page, F-Categoria-page, F-Neutra-page | the select's x deletes the key without resetting `page` | SURVIVED (also against `extratoFilters` and `extratoQuickMonth`) | AC "voltar à página 1" untested per filter |
| F-Busca-page | search x keeps `page` | SURVIVED (also against `extratoFilters`) | same |
| F-Ate-page | Até x keeps `page` | SURVIVED (also against `extratoFilters`) | same; only De is tested from page 2 (`:300`) |
| F-Q-page | quick x keeps `page` | killed only by the older `extratoQuickMonth.test.tsx` ("Limpar mês" on page 2) | covered through the shared handler, not through the new x |
| D16 | weekday above the date by CSS (`flex-col-reverse`) | SURVIVED | layout, not provable in jsdom; accepted, covered by the owner's browser step |

## Browser check

The Browser pane had no session and no app tab, and the front's `.env` points at hosted Supabase, so the logged-in flows (modal copy, filters, weekday under the date on real data) stay pending for the owner; steps are in the author's section below. I did run one credential-free probe: a throwaway Vite page (in the removed worktree, not in the repo) that mounts the app's own `Toaster` with the app's `styles.css` and emits success, error and info through `notify`.

| Probe | Computed style in Chromium |
| ----- | -------------------------- |
| success, error and info toast, light theme | background `rgb(255, 255, 255)`, text `rgb(23, 23, 23)`, border `rgb(237, 237, 237)` for all three: sonner's own default |
| same with the `dark` class on `<html>` | identical (white); `data-sonner-theme` stays light |
| same, with `!` appended to the success background class only | success background `oklch(0.979 0.021 166.113)` (emerald-50) applied, the other two unchanged |

Cause: Tailwind v4 emits utilities inside `@layer utilities`, while sonner injects an unlayered rule `[data-sonner-toast][data-styled=true]{background:var(--normal-bg);border:...;color:var(--normal-text)}`; unlayered CSS beats layered CSS whatever the specificity, so the `group-[.toaster]:bg-*` and `dark:group-[.toaster]:*` classes lose. The same compiled CSS also shows the classes are emitted with the `:is(.dark *)` rule (the T4 compilation check passed), which is why it looked fine on paper.

## Code quality

No feature beyond the ask; `TransactionsPage.tsx` grew by 24 lines net (741 vs 717) and the new UI is in three new files as the spec requires; `Filter` removed in favor of `FilterField`; no unrelated file touched. Tests map to ACs; the weakness is in precision and in the cascade (gaps below), not in volume. Guidelines: none beyond the test configs and lessons (strong defaults applied).

## Fix plans (ranked)

1. **Toast colors do not apply (TUXV2-07, TUXV2-08, spec Success Criteria bullet 3)** - blocks done. Make the per-type classes beat sonner's unlayered rule: append the Tailwind important suffix `!` to every color class of `success`, `error`, and (for consistency) `neutral` in `web/src/components/ui/toast-styles.ts`, including the `dark:` ones, and set the description class the same way if it should follow the toast text. Re-prove in a real browser both themes. Add a regression guard that fails without a browser: assert every color class in `toastClassNames` ends with `!` (or a Playwright or vitest-browser check of `getComputedStyle`), and keep the contrast test. Also decide whether sonner's `theme` should follow the app's `.dark` (not required for the colors once `!` is used). Re-verify with the same probe.
2. **Page reset per clear x (TUXV2-09, TUXV2-10, edge case "página 2")** - parametrize the page-2 test in `web/src/features/transactions/extratoClearFilters.test.tsx` over Busca, Tipo, Conta, Categoria, Neutra, De, Até and Mês rápido: go to page 2, click the x, assert `lastParams()["page"]` is "1" and the key is gone. Kills F-Tipo/Conta/Categoria/Neutra/Busca/Ate-page.
3. **`toast` base key must carry no color class (T12)** - add to `toast-styles.test.ts` (or `toaster.test.tsx`) an assertion that `toastClassNames.toast` has no `bg-`, `text-` or `border-` color class.
4. **Exact copy of an identifier with edge whitespace (I2, TUXV2-06)** - in `transactionIdentifiers.test.tsx` add a transaction whose `identifier` is `"  ID-X  "` and assert `writeText` receives it unchanged.
5. **L-027 for the new file** - `extratoClearFilters.test.tsx` De/Até tests time out when two suites share the machine; reduce their DatePicker work the same way the file already does for the list (one picker interaction, fake timers) or share the helper's calendar open; measure with two suites in parallel. Older files fail the same way (pre-existing, separate backlog).
6. (Owner) Browser steps 1, 3 and 4 of the author's list, and step 2 after fix 1.

## Spec-precision gaps

- TUXV2-07 and TUXV2-08 say "aplicar fundo e texto de matiz verde" and "contraste calculado a partir dos valores do tema", but only fix the class-level contract; the spec does not say the colors must be observed on the rendered toast. Add "the computed background and text color of the rendered toast" to the AC or to the Independent Test.
- TUXV2-09 criteria 2 to 6 say "voltar à página 1" without saying from which page the test must start; made explicit in fix 2.
- TUXV2-13 "abaixo" is only checkable by DOM order in jsdom.

## Requirement traceability (suggested; spec.md not edited by the Verifier)

TUXV2-01 to TUXV2-06, TUXV2-09 to TUXV2-13: evidence present (TUXV2-09/10 with the precision gap above). TUXV2-07 and TUXV2-08: not Verified, the rendered colors fail in a browser; `spec.md` currently marks them Verified and ticks Success Criteria bullet 3, which should be reverted until fix 1 lands.

## Isolation proof

Baseline and final `git status --porcelain` of the real tree: the same five untracked paths. Mutants and the Vite probe lived only in `/Volumes/MacOnlySSD/dev/personal/.verify-v2` and `.verify-v2-base` (removed with `git worktree remove --force` and `git worktree prune`). The `node_modules` of the real tree were only symlinked into those worktrees and are intact. Only this file and the lessons files are committed by the Verifier.

## Summary

Verdict FAIL by one critical functional gap (toast colors) plus four test gaps. Ranked: 1 toast colors not applied in Chromium (critical), 2 page reset per clear x untested for 6 filters, 3 base toast key unguarded, 4 trimmed copy value untested, 5 L-027 timeouts of the new file's De/Até tests under load. Max 3 fix and re-verify iterations apply.

---

## Iteration 1 (author self-report, not independent)

**Status of this section**: the author's own check, kept as written. It is not independent and its conclusion is superseded by iteration 2 above (the real-browser toast defect was invisible to every test in it). This is NOT the independent Verifier the skill asks for: the run forbade sub-agents, so no fresh agent re-derived coverage and no separate sensor run was made. The discrimination sensor below is the author's mutation proofs, run per task in a temporary worktree and recorded in each commit body. The browser steps are listed at the end for the owner.

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

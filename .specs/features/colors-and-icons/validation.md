# Validation: colors-and-icons (T1-T13), iteration 1 - CONDITIONAL PASS

**Verdict**: CONDITIONAL PASS. Code and automated tests are sound: every gate is green when run alone, 14 of 14 requirement IDs have a cited assertion, and 128 of 135 injected faults were killed (2 of the 7 survivors are provably equivalent, 5 are real gaps and become fix tasks). The feature is NOT done until: (1) the browser check of T10 and T13 is performed by the owner (no valid session was available to the Verifier either; the spec success criteria that need a browser are pending, not passed); (2) fix task FT1 below, because tasks.md has those two browser boxes TICKED while the commit bodies say the check was not done; (3) fix task FT2, because a new test file fails under CPU load. `validate_state.py` has no notion of "conditional" and only reads the verdict word, so it will report 0 errors; that exit code must not be read as "browser check done".

**Iteration**: 1
**Date**: 2026-10-06
**Spec**: `.specs/features/colors-and-icons/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md`, `.specs/LESSONS.md`; reference format `.specs/features/import-improvements/validation.md`)
**Diff range**: `2047359..HEAD`, 13 commits on `feat/colors-and-icons`, `HEAD` = `97a0ee9`: `d4596dc` T1, `8dc7c96` T2, `f543b49` T3, `2c087ef` T4, `7427f8f` T5, `240603e` T6, `da178e9` T7, `780cd2a` T8, `1b8e3be` T9, `96f10e3` T10, `43dc851` T11, `3ca0eaa` T12, `97a0ee9` T13.
**Verifier**: independent sub-agent (author != verifier). Mutants ran only in a temporary git worktree on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-ci`, removed; a second worktree at `2047359` for a baseline load run, also removed; `git worktree list` shows only the real tree). `node_modules` and the API `.env` files were symlinked into the worktree (nothing copied, nothing printed). No `git stash`, no `db:reset`, no hosted Supabase or Vercel, no source or test file changed in the real tree. Migration mutants were probed against the local database only through a rolled-back transaction (see Sensor). Real-tree `git status --porcelain` before and after: identical (`?? .DS_Store`, `?? docs/v2/`, `?? references/nubank_extrato_setembro.csv`).

---

## Task Completion

`tasks.md`: 89 of 89 `- [x]` boxes are ticked, none open. That is itself a finding: two of the ticked boxes are not true.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 palette, migration 0008, seed | Done | `d4596dc` | - |
| T2 account color API | Done | `8dc7c96` | - |
| T3 category color API | Done | `f543b49` | - |
| T4 web palette, class map, contract test | Done | `2c087ef` | - |
| T5 web types, clients, mocks | Done | `7427f8f` | - |
| T6 ColorPicker | Done | `240603e` | - |
| T7 CategoryBadge in the selects | Done | `da178e9` | - |
| T8 bank SVGs, NOTICE, BankIcon | Done | `780cd2a` | the "viewed in the browser" box is ticked; the commit body says the icons were checked on a standalone HTML page, not in the app |
| T9 AccountLabel, AccountSelect | Done | `1b8e3be` | - |
| T10 account form and accounts list | Partial: code and tests done, browser box ticked but NOT done | `96f10e3` | `tasks.md:389` is `[x]`; the commit body says "Browser check against the local API: pending for the owner ... the box stays unchecked in tasks.md". The box and the commit disagree. Treated as an explicit pending item |
| T11 category forms and list | Done | `43dc851` | - |
| T12 extrato account cell | Done | `3ca0eaa` | - |
| T13 import preview badges and final browser check | Partial: code and tests done, browser box ticked but NOT done | `97a0ee9` | `tasks.md:478` is `[x]`; the commit body says "Browser verification against the local API is pending for the owner ... that box stays unchecked". Same disagreement. Treated as an explicit pending item |

Cosmetic, not blocking: `tasks.md` still says `**Status**: Draft` and the `spec.md` traceability table still says Pending for the 14 IDs.

---

## Gates (run by the Verifier on `HEAD`)

| Gate | Command | Outcome |
| ---- | ------- | ------- |
| API unit | `pnpm -C api test:unit` (inside `pnpm -C api test`) | 19 files, 380 tests passed (was 368 at `2047359`, +12) |
| API integration | `pnpm -C api test:int` (inside `pnpm -C api test`) | 42 files, 611 tests passed, 141.6 s (was 567, +44) |
| API typecheck, lint | `pnpm -C api typecheck`, `pnpm -C api lint` | exit 0 both, no warnings |
| Web typecheck, lint | `yarn --cwd web typecheck`, `yarn --cwd web lint` | exit 0; 7 warnings (`react-refresh/only-export-components`) in `ui/badge`, `ui/button`, `ui/form`, `ui/navigation-menu`, `ui/sidebar`, `ui/toggle`, `auth/useSession`: none in a file touched by the diff, same list as before the feature |
| Web suite, alone, run 1 / 2 / 3 | `yarn --cwd web test` | 67 files, 597 tests passed each time (53.8 s, about 54 s, 58.7 s); was 54 files and 480 tests at `2047359` (+117) |
| `api/openapi.json` | `pnpm -C api openapi:export` in the worktree | no diff against the committed file |
| Web suite, two in parallel (load) | two `yarn --cwd web test` at once on `HEAD` | NOT robust: 39 and 38 failures out of 597 (timeouts at the 15 s `testTimeout`) |
| Same load run on the pre-feature commit | two `yarn --cwd web test` at once on `2047359` | 17 and 11 failures out of 480, all in the pre-existing extrato files |

Test integrity: no test file deleted. Removed assertion lines: three API whole-response `toEqual`s that now include `color` (the contract changed on purpose) and one web `{ selector: "td" }` argument dropped because the category name now sits in a badge inside the cell (declared in the `97a0ee9` body; the assertion still targets the name text, slightly looser).

Load judgment (lesson L-027): the fragility of the old extrato files is pre-existing (17 and 11 failures on `2047359`), but on `HEAD` it is clearly worse and now reaches new code. Failures by file under load, `HEAD` run A / run B: `extratoAccountLabel.test.tsx` (NEW FILE) 5 / 4, `extratoCrud` 5 / 5, `extratoDescriptionForm` 3 / 3, `extratoFilters` 6 / 7, `extratoInline` 5 / 4, `extratoQuickMonth` 7 / 7, `transactions.test.tsx` 6 / 6, `paymentMethodOther` 1 / 1, plus one test each in `creditExpenses/CreditExpensesPage.test.tsx` (A) and `dashboard/InvestmentReturns.test.tsx` (B), two older files that were not in the baseline list. Baseline `2047359` run A / run B: `extratoCrud` 2 / 2, `extratoDescriptionForm` 2 / 2, `extratoFilters` 3 / 3, `extratoInline` 1 / 1, `extratoQuickMonth` 8 / 2, `transactions.test.tsx` 1 / 1. Reading: the icon and badge rendering made every page that renders the account or category select heavier, which pushes the already slow extrato tests over the limit; the new `extratoAccountLabel.test.tsx` is a finding (failures in a new file). Alone, its slowest test takes 4.2 to 4.8 s ("the filter, the row and the bulk-apply category selects show badges...", `extratoAccountLabel.test.tsx:154`), which is above half of `testTimeout` budget once load multiplies it (passing tests of that file took 10.9 s and 12.2 s under load). Slowest tests alone (all runs, whole suite): `extratoQuickMonth.test.tsx` 8.3 s, 7.5 s, 6.9 s (pre-existing; the spec's 7.5 s ceiling is for the feature's own tests). Slowest of this feature alone: `extratoAccountLabel.test.tsx:154` 4.8 s, then `extratoAccountLabel.test.tsx:52` 2.4 s; all other new files stay below 1.5 s (`ColorPicker.test.tsx` about 1.1 s).

---

## Spec-Anchored Acceptance Criteria

Legend: `A/` = `api/test/`, `AL/` = `api/src/lib/`, `W/` = `web/src/features/`, `WL/` = `web/src/lib/api/`. Web citations are the `it(` line of the test whose body the Verifier read for the quoted assertion. Mutant ids refer to the Sensor section.

### COLOR-01: palette of 66 keys, same list on three sides

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. 66 keys, 22 families x 400, 600, 900, no repeat | 66 distinct keys `<family>-<shade>` | `AL/palette.test.ts:10` (66 distinct, form `family-shade`), `:5` (22 and 3), `:16` (order); `W/colors/palette.test.ts:55` (66 distinct, family by family); `:71` `isColorKey` rejects case, whitespace, unknown | PASS (P01, P03, P04, P05, W01, W06, W11 killed) |
| 2. Same list in API, database and web; a test of each side fails on divergence | SQL domain = `COLOR_KEYS` = `openapi.json` enum = web `COLOR_KEYS` | `A/colors-schema.int.test.ts:73` `expect([...keys].sort()).toEqual([...COLOR_KEYS].sort())` read from `pg_constraint`; `A/swagger.int.test.ts:210` `toEqual([...COLOR_KEYS])` on 5 account and 3 category responses; `W/colors/paletteContract.test.ts:39` (set equality with `openapi.json`) and `:50` (difference text "only in the API: red-400; only in the web: mauve-600"). Independent check by the Verifier: migration 66 keys, `api/src/lib/palette.ts` 66, web 66, equal in order, and all 8 response `enum`s in `openapi.json` equal them | PASS with a caveat: the database side reads the live database, not the file, so drift in the file is hidden until `db:reset` (M01, M02: killed only by the Verifier's replay probe). See FT3 |

### COLOR-02: color columns, check, backfill

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 3. Both columns `palette_color`, not null, default `slate-600` | `is_nullable` NO, `domain_name` `palette_color`, default contains `'slate-600'` | `A/colors-schema.int.test.ts:86` (it.each over the two tables); `:110` defaults on insert | PASS against the live database; M03 and M04 (file edited) killed only by the replay probe. See FT3 |
| 4. Value outside the 66 keys: SQLSTATE 23514 in both tables, insert and update | `code` `23514` | `A/colors-schema.int.test.ts:96` `rejects.toMatchObject({ code: '23514' })` for `blue-500` in categories, accounts and an update to `Blue-600` | PASS against the live database (M02 killed by the probe) |
| 5. Existing categories with a known `key` get the design color, 17 distinct | `SEEDED_COLORS` equality and `Set` size 17 | `A/colors-schema.int.test.ts:121` runs the `-- backfill` block read from the file; `:146` runs the whole file over existing rows and asserts Food `orange-600` and no data lost | PASS (M05, M07 killed by the real tests; M12 too) |
| 6. User categories `slate-600`; accounts by bank | `purple-600`, `teal-600`, `sky-600`, `zinc-900`, `slate-600` | `A/colors-schema.int.test.ts:121` `toEqual(BANK_COLORS)` and `Minha` stays `slate-600`; `:146` Nubank `purple-600` | PASS (M06, M12 killed) |

### COLOR-03: seed and RLS

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 7. New user gets the 17 categories with the design colors; rest of `seed_categories` unchanged | colors, names, `is_system`, idempotent, execute revoked | `A/colors-schema.int.test.ts:179` `toEqual(SEEDED_COLORS)`, system keys `['Investments','Reversal','Uncategorized']`, `Help` name; `:193` seed twice stays 17 and `has_function_privilege` false for `authenticated` and `anon` | PASS against the live function; M08, M09, M10 (file edits of the seed) killed only by the replay probe. M11 (the `revoke` line) is equivalent: `create or replace` keeps the ACL set by 0002, see Sensor |
| 8. RLS unchanged | B cannot read or update A's colors; system category update affects 0 rows | `A/colors-schema.int.test.ts:207` `expect(upAccount.count).toBe(0)`, `expect(upCategory.count).toBe(0)`, `expect(system.count).toBe(0)`, regular category `count` 1 | PASS |

### COLOR-04: account color in the API

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. POST with valid color: 201 with that color | `teal-400` echoed and stored | `A/accounts.int.test.ts:280` | PASS (R01 killed) |
| 2. POST without color: `slate-600` | stored and returned | `A/accounts.int.test.ts:288` | PASS (R02 killed) |
| 3. String outside the list on POST and PATCH: 422 `validation_error`, `field: "color"`, nothing written | six listed strings | `A/accounts.int.test.ts:296` it.each over `INVALID_STRING_COLORS`; `:304` PATCH loop and stored color unchanged | PASS (P03, P04, V02, V03, R05, R06 killed) |
| 4. `null`, number, object: 400 `validation_error` | 400 on POST and PATCH | `A/accounts.int.test.ts:315` | PASS (V01 killed) |
| 5. PATCH only color: changes color, keeps the rest, 200 with the full account | bank, nickname, holders kept; invalid nickname with color changes nothing | `A/accounts.int.test.ts:330`, `:347` | PASS (R03 killed) |
| 6. GET, activate, deactivate return `color` | `color` on each | `A/accounts.int.test.ts:358`; `A/swagger.int.test.ts:210` | PASS (R04 killed) |
| 7. User B PATCH on A's account: 404 `not_found`, color kept | 404 and stored color equal | `A/accounts.int.test.ts:369` | PASS |

### COLOR-05: category color in the API

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. GET returns `color`; the 17 seeded carry the design colors | table equality, 17 distinct | `A/categories.int.test.ts:424` | PASS (R12 killed) |
| 2. POST with name and color: 201 | `rose-900` | `A/categories.int.test.ts:431` `toMatchObject({ name: 'Viagens', color: 'rose-900' })` and the stored rows | PASS (R07 killed) |
| 3. POST without color: `slate-600` | `slate-600` | `A/categories.int.test.ts:431` | PASS |
| 4. Invalid string on POST or PATCH: 422, `field: "color"`, nothing written | 422 | `A/categories.int.test.ts:447` (POST loop), `:503` (PATCH, name unchanged) | PASS |
| 5. PATCH only color: color changes, name kept | 200 | `A/categories.int.test.ts:470` | PASS (R09 killed) |
| 6. PATCH name and color: both in one operation; neither written on invalid or on 409 | both changed; 409 leaves color; 422 leaves name | `A/categories.int.test.ts:481`, `:492` (409 `duplicate_name`, color unchanged), `:503` | PASS (R11 killed) |
| 7. PATCH with an empty body: 200 unchanged | row equal | `A/categories.int.test.ts:516` | PASS (R08 killed) |
| 8. PATCH of a system category (name or color): 403 `category_protected`, color kept | 403 | `A/categories.int.test.ts:536` | PASS (R10 killed) |
| 9. User B PATCH on A's category: 404 | 404, color kept | `A/categories.int.test.ts:548` | PASS |

### COLOR-06: OpenAPI, types, mocks

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. `openapi.json` regenerated, `color` with the 66-key `enum` in the schemas and in the POST and PATCH bodies | enum on responses; key list on bodies | `A/swagger.int.test.ts:210`: responses `enum` `toEqual([...COLOR_KEYS])` and `required` contains `color`; bodies `type` `string` and `description` `One of: <66 keys>`; export in the worktree has no diff | Spec-precision gap: the AC says the bodies carry an `enum`, but Assumption row 58 chose `Type.String` with the list in the description, and the test and the document follow the assumption (no `enum` on the 4 request bodies). Reconcile the text (SPG-1). The response side is exact (V04, V05 killed) |
| 2. Web contract test compares `COLOR_KEYS` with the `openapi.json` enum, fails with the difference | equal as sets of 66 | `W/colors/paletteContract.test.ts:39`, `:50` | PASS (W11 killed) |
| 3. `Account` and `Category` have `color: ColorKey` required; inputs accept `color` | typecheck | `yarn --cwd web typecheck` exit 0 with `color` in `web/src/lib/api/types.ts`; `W/colors/colorClients.test.ts:12`, `:20`, `:28`, `:42` assert the request bodies of `createCategory`, `updateCategory`, `createAccount`, `updateAccount` | PASS (Z08 killed) |
| 4. Mocks store and return a valid color; invalid gives 422 `validation_error` on `color` | exact | `WL/mock/colors.test.ts:49`, `:72` (it.each `""`, `blue-500`, `Blue-600`), `:92`, `:107`, `:127`, `:145` (system `category_protected`) | PASS (Z01, Z02, Z04, Z05, Z06 killed) |
| 5. Mocks seed the 17 categories and the two accounts | table; `purple-600` | `WL/mock/colors.test.ts:31`, `:39` | PASS (Z03, Z07 killed) |

### COLOR-07: ColorPicker

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. `radiogroup` "Paleta de cores", 66 radios named `<Família> <tom>`, unique | 66 names equal `COLOR_KEYS.map(colorLabel)` | `W/colors/ColorPicker.test.tsx:29` | PASS (K01, K18, K23 killed) |
| 2. Only the selected radio `aria-checked="true"` with a check mark; trigger shows swatch name | `["Azul 600"]`, one `svg` | `W/colors/ColorPicker.test.tsx:41` | PASS (K12, K13, K21 killed) |
| 3. Click: `onChange` once with the exact key, closes, focus back to the trigger | `rose-900`, once, trigger focused | `W/colors/ColorPicker.test.tsx:51` | PASS (K10, K11, K20 killed) |
| 4. Arrows: 1 sideways, 6 vertical, no leaving the grid | indexes 0, 1, 7, 1, 0; at 65 stays; up from 65 goes to 59 | `W/colors/ColorPicker.test.tsx:61`, `:79` | Spec-precision gap on the edge: "sem sair da grade" does not say whether Down on a bottom-row cell that is not the last one stays or clamps to the last cell, nor Up on a top-row cell; the tests only try the corner cells. K02 and K03 (clamp instead of stay) survive the whole suite. The code stays; the spec should say it (SPG-2). PASS for the stated cases (K04, K05 killed) |
| 5. Home and End; Enter and Space choose | first, last; `red-400`, `blue-600` once | `W/colors/ColorPicker.test.tsx:93`, `:107` | PASS (K06, K07, K08, K09 killed) |
| 6. Esc closes without `onChange` | not called | `W/colors/ColorPicker.test.tsx:118` | PASS (K19 killed) |
| 7. Disabled does not open | trigger disabled, no radiogroup | `W/colors/ColorPicker.test.tsx:127` | PASS (K16 killed) |
| 8. Unknown `value`: `Ardósia 600`, no radio checked | 0 checked, 66 `false` | `W/colors/ColorPicker.test.tsx:134` | PASS (K15 killed) |
| 9. One `tabIndex=0` (selected or first); `id` on the trigger | `["Azul 600"]`; first for unknown | `W/colors/ColorPicker.test.tsx:144` | PASS for a first opening (K14, K17 killed). K22 survives: the roving index is not reset on reopen, so after clicking another color and reopening, the `tabIndex=0` radio can be a stale one, not the selected: FT4 |

### COLOR-08: color in the forms

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. New account form shows `Ardósia 600`; edit shows the account color | trigger text | `W/accounts/accountColor.test.tsx:41` | PASS (F02 killed) |
| 2. Save sends `color` in POST and PATCH with the other fields | spied body | `W/accounts/accountColor.test.tsx:52`, `:69` | PASS (F01 killed) |
| 3. Category create sends `name` and `color` (default `slate-600`); name clears and color resets | body, reset | `W/categories/categoryColor.test.tsx:38`, `:48` | PASS (F06, F07 killed) |
| 4. Edit shows name and picker; "Salvar categoria" sends one PATCH with `name` and `color` | one call, both fields, new badge | `W/categories/categoryColor.test.tsx:82`, `:88` | PASS (F08, F09, F12, Z08 killed) |
| 5. 422 on `color`: "Escolha uma cor da paleta." and what was typed is kept | exact text | `W/accounts/accountColor.test.tsx:85`; `W/categories/categoryColor.test.tsx:64`, `:102` | PASS (F03, F04, F10, F13 killed) |
| 6. Other failure: `messageForError` text, dialog or edit stays open | mapped Portuguese text | `W/accounts/accountColor.test.tsx:98`; `W/categories/categoryColor.test.tsx:111` | PASS |
| 7. System category: badge with fixed color, no color control | badge `bg-slate-400`, 3 locks, no rename or delete, only the create picker | `W/categories/categoryColor.test.tsx:130` | PASS |

### COLOR-09: badge and class map

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. 66 entries, literal `bg-<family>-<shade>`, none by template | exact strings, no `${` or backtick in the block | `W/colors/palette.test.ts:102` (bg exactly `bg-<family>-<shade>` for every key), `:119` (`block.not.toContain("${")`, 66 `bg:` literals) | PASS (W08, W10 killed) |
| 2. Text rule: 400 `text-<family>-950`, 900 `text-white`, 600 white or black by family | per key | `W/colors/palette.test.ts:102` | PASS (W03, W04 killed) |
| 3. Contrast at least 4.5:1 for the 66 entries, from `tailwindcss/theme.css` | `>= 4.5` | `W/colors/palette.test.ts:180` (the math is sanity-checked at `:175`, white on black is 21) | PASS (W03 killed through it and the rule test) |
| 4. `CategoryBadge`: `bg`, `text` and `ring-1 ring-inset ring-black/10 dark:ring-white/25` | `toHaveClass(bg, text, ...RING)` for all 66 | `W/categories/CategoryBadge.test.tsx:34` | PASS (B01, B04, B05 killed) |
| 5. Color outside the map: `slate-600` classes | `banana`, `""`, `undefined`, `Blue-600` | `W/categories/CategoryBadge.test.tsx:43`; `W/colors/palette.test.ts:131` | PASS (W05, W09 killed) |
| 6. Long name truncates, `title` has the full name | `truncate`, `max-w-full`, `title` | `W/categories/CategoryBadge.test.tsx:54` | PASS (B02, B03 killed) |

### COLOR-10: badges in selects, extrato, import

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Opened `CategorySelect`: each item a badge, option name stays the category name | 17 options, badge classes by category | `W/categories/CategoryBadge.test.tsx:74` | PASS (B06, B07 killed) |
| 2. With a value the trigger shows the badge | badge with the category `bg` | `W/categories/CategoryBadge.test.tsx:92` | PASS |
| 3. Extrato row (table and card), filter, bulk apply, form and modal show badges | `bg-orange-600` in the filter options, row select, bulk select and value | `W/transactions/extratoAccountLabel.test.tsx:154` | Partial: filter, table row and bulk apply are asserted; the mobile card select and the transaction form and modal are not asserted individually (they use the same `CategorySelect`, so B06 and B07 reach them, but no test opens them). Low (SPG-3) |
| 4. Reassign-destination select and card-expense category select: badges | items are badges | `W/categories/categoryColor.test.tsx:142` (reassign); the credit-expense form is covered only through the shared select | PASS for the reassign select; credit-expense form not asserted individually (low, SPG-3) |
| 5. Import preview: selectable row select shows the badge; `ignored` and `invalid` rows show the `CategoryBadge` with the preview name and the user's category color when the list loaded | badge on trigger and options; name from the preview, color from the lookup | `W/import/ImportPreviewBadges.test.tsx:64`, `:74`, `:86` (id not in the list falls back to text) | PASS (Y01 to Y04, H01 killed) |
| 6. List fails: `categoryName` text, no badge | text only, no `combobox` | `W/import/ImportPreviewBadges.test.tsx:108` | PASS |
| 7. Categories page rows are badges; button names stay | "Renomear <nome>", "Excluir <nome>" | `W/categories/categoryColor.test.tsx:121` | PASS (F11 killed) |
| 8. Loading: "Carregando categorias…", disabled | exact text | `W/categories/CategoryBadge.test.tsx:103`; `W/import/ImportPreviewBadges.test.tsx:98` | PASS |

### ICON-01: bank SVGs and NOTICE

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Four files, no other bank SVG | exactly `neon`, `nubank`, `sofisa-direto`, `xp` | `web/src/assets/banks/banks.test.ts:34` `expect(svgs.sort()).toEqual([...FILES].sort())` | PASS |
| 2. NOTICE: repository URL, files copied, owner confirmation, edits, non-personal warning | all present | `web/src/assets/banks/banks.test.ts:73`, `:79`. The Verifier read the NOTICE: URL `https://github.com/Tgentil/Bancos-em-SVG`, commit `fe1d43f0cf379135bd01c987bc147a04fdf48c6d`, the four source-to-vendored mappings, "The project owner confirmed that using these files is acceptable for the personal use of this project", the edits (declaration, comments, editor metadata removed; Neon `viewBox` to `0 988.26 2500 543.48`), and the beyond-personal-use warning | PASS (S03, S04 killed). The commit hash is not asserted (S05 survives, low: FT6) |
| 3. Sanity test fails on missing `viewBox`, over 12 KB or 40 KB, script, foreignObject, image, iframe, `on*`, external href, external `url(`, `@import` | predicate with negative cases | `web/src/assets/banks/banks.test.ts:39` (12 KB and predicate on the four files), `:45` (40 KB), `:50` (13 negative cases) | PASS (S01, S02, S06, S07 killed) |
| 4. Fails if one file is missing or NOTICE misses one | names | `web/src/assets/banks/banks.test.ts:34`, `:73` | PASS |

Independent asset audit by the Verifier (not through the author's test): `web/src/assets/banks/*.svg` sizes 4324 (nubank), 1378 (sofisa-direto), 2471 (neon), 1141 (xp) bytes, total 9314 bytes, far below 12 KB each and 40 KB total. Each root `<svg>` has a `viewBox`. Grep over the four files for `<script`, `foreignObject`, `<image`, `<iframe`, `<use`, `@import`, `on*=` attributes, `href`, `data:`, `javascript:`, `<!ENTITY`, `<!DOCTYPE`, `<?xml`, `sodipodi`, `inkscape`, `rdf`, `cc:` and `dc:` returns nothing; the only `url(` is the internal `url(#clippath)` in `neon.svg`; the only `<style>` blocks (neon, sofisa) hold plain `fill` and `clip-rule` rules; the only `xmlns` declarations are SVG and XLink namespaces. Vite inlines the three small files as `data:image/svg+xml` URIs and serves the 4.3 KB one as a file; both are rendered only through `<img>` (`BankIcon.tsx`), which never runs script. No Content-Security-Policy exists in `web/index.html` or the Vercel configuration, so the `data:` URIs are not blocked.

### ICON-02: BankIcon

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Four banks render their own `<img>` in a 20 px frame, 32 px with `size="lg"` | one `img`, `src` equal to the imported file, `size-5`; `size-8` | `W/accounts/BankIcon.test.tsx:16` (it.each over four banks, 4 distinct sources), `:25` | PASS (I01, I04, I09 killed) |
| 2. `Other` or unknown: generic icon, no throw | no `img`, `svg.lucide-landmark` for `Other`, `Itau`, `""` | `W/accounts/BankIcon.test.tsx:31` | PASS (I02, I10 killed) |
| 3. Decorative by default: `aria-hidden`, `alt=""`, not in the accessibility tree | exact | `W/accounts/BankIcon.test.tsx:41` | PASS (I03, I08 killed) |
| 4. `decorative={false}`: `role="img"` named `Banco <rótulo>` | five labels plus unknown to `Banco Outro` | `W/accounts/BankIcon.test.tsx:48` | PASS (I06, I07 killed) |
| 5. Image error: generic icon, frame size kept | no `img`, landmark, `size-8` | `W/accounts/BankIcon.test.tsx:70` | PASS (I05 killed) |

### ICON-03 and ICON-04: account label, extrato, accounts list

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-03.1 `AccountSelect` items and trigger show `AccountLabel` (icon, nickname, dot, ` (inativa)`) | icon `src`, dot class, suffix | `W/accounts/AccountLabel.test.tsx:49`, `:68`, `:80`, `:95`; `W/transactions/extratoAccountLabel.test.tsx:129` (filter options with icon and dot, `XP filtro (inativa)`) | PASS (L01, L02, L03, L05, L06 killed) |
| ICON-03.2 Option accessible name stays the nickname | `getByRole("option", { name })` | `W/accounts/AccountLabel.test.tsx:80`; `W/transactions/extratoAccountLabel.test.tsx:129` | PASS |
| ICON-03.3 Extrato row and card show `AccountLabel` resolved by `accountId` | `xp` icon, `bg-orange-400`, nickname text in cell and card | `W/transactions/extratoAccountLabel.test.tsx:52`, `:67` | PASS (X01, X05, X06 killed) |
| ICON-03.4 List loading or failing: only the nickname, no icon, no dot, rest of the row intact | no `img`, no dot, category select text | `W/transactions/extratoAccountLabel.test.tsx:74`, `:102` | PASS (X03 killed; X04 equivalent) |
| ICON-03.5 Accounts page: 32 px icon, nickname, bank label, 6 px bar, buttons | `src`, `size-8`, `bg-purple-600 w-1.5`, "Editar", "Desativar" | `W/accounts/accountColor.test.tsx:113` | PASS (F14, F15 killed) |
| ICON-03.6 Filter, transaction form, credit-expense form, investment return and import selects use the same `AccountSelect` | label in the options | `W/transactions/extratoAccountLabel.test.tsx:129` (filter); the other four are covered only through the unchanged existing tests passing | Partial, low (SPG-3) |
| ICON-04.7 Color shown as decorative dot or bar, never the only information | dot and icon `aria-hidden`, nickname text | `W/accounts/AccountLabel.test.tsx:56` | PASS (L04, F17 killed) |
| ICON-04.8 After a PATCH of the color the bar shows the new color | refetch, `bg-orange-400` | `W/accounts/accountColor.test.tsx:150` | PASS |
| ICON-04.9 Inactive: `opacity-55`, icon and bar stay | classes and `img` | `W/accounts/accountColor.test.tsx:138` | PASS (F16 killed) |

### Edge cases

| Edge case | `file:line` | Result |
| --------- | ----------- | ------ |
| API returns a color outside the 66: badge, `AccountLabel`, bar use `slate-600`; picker opens with none selected | `W/categories/CategoryBadge.test.tsx:43`; `W/accounts/AccountLabel.test.tsx:63`; `W/colors/ColorPicker.test.tsx:134` (the account bar fallback is the same `colorClasses`, no dedicated test) | PASS |
| Very long name: truncate with ellipsis and `title` | `W/categories/CategoryBadge.test.tsx:54` | PASS |
| Two categories with the same color look equal, differ by name | `W/categories/CategoryBadge.test.tsx:62` | PASS |
| Inactive account of a transaction: icon and dot, no suffix in the extrato | `W/transactions/extratoAccountLabel.test.tsx:116` | PASS (X02 killed) |
| POST category with valid color and conflicting name: 409, nothing created | the 409 test `A/categories.int.test.ts:141` has no color; the PATCH variant is `:492` | Partial: the POST variant with a color is not asserted (low; the insert fails on the unique name the same way) |
| Migration over a user who deleted seeded categories fills only existing rows, recreates nothing | `A/colors-schema.int.test.ts:146` shows no row is added or lost, but starts from the full 17 | Partial: no test deletes a seeded category first. The Verifier's probe did delete and seed separately, but not the "backfill leaves the gap" case (low) |
| `ColorPicker` fits 320 px without horizontal scroll | none (jsdom cannot lay out); by arithmetic 6 x 32 px + 5 x 4 px + 24 px padding = 236 px | Not asserted by a test; pending for the browser check |
| Dark theme: badge text stays as the map says, ring `dark:ring-white/25` | `W/categories/CategoryBadge.test.tsx:34` (class present) | PASS for the classes; the visual result is pending for the browser check |
| `BankIcon` with a 2500-unit SVG at 20 px fits (`object-contain`) | none: no test asserts the `object-contain` class | Partial, low; the class is in `BankIcon.tsx` and the T8 commit body records a standalone visual check at 20, 32 and 96 px |
| Account list loads after the extrato: the cell goes from text to `AccountLabel` | `W/transactions/extratoAccountLabel.test.tsx:74` (swap after release) | PASS; "no column jump beyond the icon width" is not measurable in jsdom |

Success criteria of the spec that need a browser (picker changes an account and a category color and every screen reflects it; selects show badges in light and dark; the right icon for Nubank, Sofisa Direto, Neon, XP and the generic one for Outro in the account select and the extrato): proven only by jsdom tests, NOT by a browser run. They stay pending (see Browser Check).

---

## Discrimination Sensor

135 behaviour-level mutants in the temporary worktree `/Volumes/MacOnlySSD/dev/personal/.verify-ci` (34 API and migration, 101 web), more than the 35 to 45 requested because every checklist item of the brief got at least one mutant. API mutants ran `api` unit plus the related integration files against the real local Supabase; web mutants ran only the test files of the touched area (`src/features/colors`, `categories`, `accounts`, `import`, `transactions/extratoAccountLabel`, `lib/api/mock`, `assets`). Harness and raw output: `/private/tmp/claude-501/c/mut.py` and `res.jsonl`. Totals: 128 killed, 7 survived, 0 patches failed to apply, 0 kills by timeout or compile error (every kill names a failing assertion).

Migration mutants (M01 to M12) were probed through a rolled-back transaction only: the Verifier wrote an extra test, kept in the worktree and removed with it (`api/test/zz-probe.int.test.ts`; copy at `/private/tmp/claude-501/c/zz-probe.int.test.ts`), that in one transaction drops the two color columns and the domain, replays the migration file, then checks the domain keys against `COLOR_KEYS`, nullability and defaults, SQLSTATE 23514 on `blue-500` and `Blue-600`, the backfill of existing rows of two users (seeded categories, user categories, accounts by bank, 17 distinct), `seed_categories` for a user with no categories (17 colors, system flags, idempotence) and the revoked execute privilege, and rolls back. It passes on the unmutated file. Database never reset.

| Area | Mutants | Killed | Survived |
| ---- | ------- | ------ | -------- |
| migration: domain list, check, defaults, nullability, backfill (category, bank, `is_system` filter), seed color, seed distinctness, seed `is_system`, revoke | M01 to M12 | 11 | 1 (M11, equivalent) |
| API palette (shades, default, trim, case, family dropped) | P01 to P05 | 5 | 0 |
| API validation (400 vs 422, field name, response enum, input description) | V01 to V05 | 5 | 0 |
| API account routes (POST and PATCH ignore color, default, response, no validation) | R01 to R06 | 6 | 0 |
| API category routes (POST ignore, empty body, PATCH ignore, system check, name validation, response) | R07 to R12 | 6 | 0 |
| web palette (shade order, label accent, text rule, contrast, fallback, trim, label order, bg literal, template class, family dropped, default) | W01 to W11 | 10 | 1 (W02) |
| ColorPicker (columns, arrows, wrap, Home, End, Enter, Space, close, `onChange`, checked, check mark, tabIndex, unknown, disabled, id, group name, Esc, focus return, trigger name, reopen index, radio names) | K01 to K23 | 20 | 3 (K02, K03, K22) |
| CategoryBadge and option label (ring, truncate, title, text class, color, plain text) | B01 to B07 | 7 | 0 |
| BankIcon (mapping, Other, decorative, size, error, labels, alt, fallback) | I01 to I10 | 10 | 0 |
| AccountLabel, AccountSelect (dot color, suffix, icon, aria-hidden) | L01 to L06 | 6 | 0 |
| forms and pages (color sent, initial color, 422 text, associations, reset, label, badge, icon size, bar color, opacity, aria-hidden) | F01 to F17 | 17 | 0 |
| extrato cell (lookup by id, suffix, fallback text, mobile card, table cell, ready check) | X01 to X06 | 5 | 1 (X04, equivalent) |
| import preview badge (any id, color, ignored text, name source) | Y01 to Y04 | 4 | 0 |
| lookups and mocks (`ready` flags, validation, PATCH, seeds, client body) | H01, H02, Z01 to Z08 | 10 | 0 |
| assets (script, external url, NOTICE confirmation, source line, commit hash, `onload`, external href) | S01 to S07 | 6 | 1 (S05) |
| **Total** | **135** | **128** | **7** |

Attribution for the migration mutants: 4 of the 11 non-equivalent ones (M05, M06, M07, M12) are killed by the author's own tests (`colors-schema.int.test.ts`, which reads the `-- backfill` block and the whole file); the other 7 (M01, M02, M03, M04, M08, M09, M10: domain list, check, defaults, nullability and the seed function text) pass the author's tests when only the file changes, because those tests read the live database, and are killed only by the replay probe. After a `db:reset` they would be killed, but the sensor is not allowed to reset, and a stale database would hide a file regression. See FT3.

Survivors:

| Mutant | Fault | Verdict |
| ------ | ----- | ------- |
| M11 | the `revoke execute on function public.seed_categories` line removed from 0008 | Equivalent: `create or replace function` keeps the ACL that 0002 already revoked, and the probe (privileges checked) still passes. The line is redundant, not wrong |
| X04 | extrato `TransactionAccount` drops the `ready ?` guard | Equivalent: `byId` is empty while the list loads or fails, so the lookup returns `undefined` either way |
| W02 | label of `amber` changed to `Ambar` (accent dropped) | NOT equivalent: spec row 74 fixes `Âmbar`; the tests assert distinctness and three sample names only. FT5 |
| K02 | `ArrowDown` clamps to the last cell instead of staying | Not equivalent in code, spec is silent on bottom-row cells that are not the last (SPG-2). FT4 |
| K03 | `ArrowUp` clamps to the first cell instead of staying | Same as K02 |
| K22 | `ColorPicker` no longer resets the roving index when it opens | NOT equivalent: after choosing a different color and reopening, the radio with `tabIndex=0` can differ from the selected one (COLOR-07 AC 9). FT4 |
| S05 | NOTICE loses the "Commit consulted" line | NOT equivalent: spec Assumption row 89 requires the commit in the NOTICE, no test asserts it. FT6 (low) |

Isolation: real-tree `git status --porcelain` before the sensor, after it, and after both worktrees were removed: identical to the baseline.

---

## Code Quality Check

| Check | Pass? |
| ----- | ----- |
| No features beyond what was asked | Yes |
| No abstractions for single-use code | Yes: `color-field.ts`, `palette.ts`, `bankLabels.ts` are each used by more than one caller or were required by the spec |
| Only touched files required for task | Yes: 54 files, all inside the declared scope (`bankLabels.ts` was extracted to avoid a lint warning, declared in the T8 commit) |
| Matches existing patterns | Yes (`withUser`, `AppError`, TypeBox, react-query, shadcn, `Badge`, `Popover`) |
| Tests map to ACs and are non-shallow (spot-check COLOR-05 and COLOR-07) | Yes: exact status codes, bodies and stored rows; mutant kill rate 95 percent |
| Spec-anchored outcomes | Yes, gaps flagged (COLOR-06.1, COLOR-07.4, COLOR-07.9, COLOR-10.3 and .4, ICON-03.6) |
| Per-layer coverage expectation | Yes: every changed route has happy, 400, 422, 403, 404 and 409 paths |
| Tests deterministic (spec row 80) | Yes: no sleep or raised timeout in the new files (`testTimeout` still 15 000 ms); but the heaviest new extrato test is not load-robust (FT2) |
| Project guidelines | none beyond test configs and package scripts; strong defaults applied |

Privacy note: `references/nubank_extrato_setembro.csv` is untracked and was not read or touched; the diff adds no fixture file.

---

## Browser Check

NOT performed; remains PENDING for the owner. The Verifier used only the existing Browser pane. A new tab at `http://localhost:8080/contas` was redirected to `/login` ("Entre na sua conta"): there is no valid session, so the check could not be done. The Verifier did not read, print or create credentials and did not create a user; the tab was closed.

Manual steps for the owner (local stack up, `pnpm -C api dev` on 3001, `yarn --cwd web dev` on 8080 against the real API, own local user), also in the T10 and T13 commit bodies:

1. "Contas", new account: the "Cor" field opens with "Ardósia 600"; open the picker (66 swatches in 6 columns, names like "Azul 600"), pick "Laranja 400" by mouse; save. The card shows the 32 px bank icon, the nickname, the bank label and a 6 px orange bar on the left. Edit it, change the color with the keyboard only (arrows, Home, End, Enter, Esc closes without change) and save; the bar changes without reloading. Deactivate it: the card is faded but icon and bar stay.
2. One account per bank (Nubank, Sofisa Direto, Neon, XP, Outro): the icon of each, the generic building for Outro; check Neon at 20 px in the account select and the extrato (the mark is a wide wordmark).
3. "Categorias": create "Mercado" in "Verde 600"; the list shows a green badge. Edit it ("Salvar categoria") changing name and color together. System categories show the badge and the lock only. The reassign-destination select (delete a category in use) shows badges.
4. "Extrato": the Conta column and the mobile card show icon, nickname and a dot; the row category select, the category filter, the bulk-apply select and the transaction modal show badges in the options and in the value; the account filter and the form select show icon, nickname, dot and "(inativa)" for an inactive account.
5. "Importar": with a statement, the row selects show badges and the ignored or invalid rows show the colored badge (text only if the categories request fails).
6. Light and dark theme: badges of 400, 600 and 900 families legible (text color from the map, ring visible on both backgrounds); the XP and Neon icons visible on the dark theme (white frame).
7. Narrow screen (320 px): the picker grid fits without horizontal scroll of the page.
8. Optional: `pnpm -C api openapi:export` leaves `api/openapi.json` unchanged (the Verifier already confirmed this in the worktree).

---

## Ranked Gaps and Fix Tasks

| Rank | Id | Gap | Severity | Fix |
| ---- | -- | --- | -------- | --- |
| 1 | FT0 | The T10 and T13 browser checks were not performed; the spec's browser-only success criteria are unproven | Blocking for "done" (pending, not a code defect) | Owner runs the manual steps above and records the outcome |
| 2 | FT1 | `tasks.md:389` (T10) and `tasks.md:478` (T13) are ticked `[x]` although the commit bodies of `96f10e3` and `97a0ee9` say the browser check was not done; the T8 box says "in the browser" but the check was on a standalone page | Medium: the task ledger claims a verification that did not happen | Untick the two boxes (and amend the T8 line to say "standalone page") until the owner records the browser outcome |
| 3 | FT2 | `web/src/features/transactions/extratoAccountLabel.test.tsx` fails under two-suite CPU load (5 and 4 failures, 15 s timeouts) and its heaviest test takes 4.2 to 4.8 s alone; the old extrato files also got worse under load against the pre-feature baseline (39 and 38 failures against 17 and 11); `CreditExpensesPage.test.tsx` and `InvestmentReturns.test.tsx` each lost one test under load | Medium (lesson L-027, failure in a new file) | Cut the full-page renders in that file (one `TransactionsPage` render per concern, share the seed, avoid opening three selects in one test: split `:154` into one test per select and keep each under about 2 s alone); re-measure with two suites in parallel and compare with the 17 and 11 baseline |
| 4 | FT3 | The schema tests read the live database, not the migration file, for the domain list, the defaults, nullability, the check and the seed function: 7 of 11 migration mutants (M01 to M04, M08 to M10) survive them and are caught only by a replay in a rolled-back transaction | Medium-low: a stale local database hides a file regression until the next `db:reset` | In `api/test/colors-schema.int.test.ts` replay the file inside `inRolledBackTransaction` (as `:146` already does) and run the domain, defaults, check and seed assertions after it; see the Verifier's probe for the checks |
| 5 | FT4 | `ColorPicker`: K22 (roving `tabIndex` not reset on open) and K02, K03 (edge behavior of Down and Up on non-corner edge cells) survive | Low-medium: AC 9 can break after a choose-and-reopen | Test: open with `blue-600`, click `Rosê 900`, rerender with the new value, reopen and assert the only `tabIndex=0` radio is `Rosê 900`; decide and state in the spec whether Down on a bottom-row cell stays or clamps, then assert it from a non-corner cell |
| 6 | FT5 | W02: the 22 Portuguese family names are not asserted one by one | Low | In `palette.test.ts` assert the full list of the 22 family names from spec row 74 |
| 7 | FT6 | S05: the NOTICE commit hash is not asserted | Low | In `banks.test.ts` assert `fe1d43f0cf379135bd01c987bc147a04fdf48c6d` |
| 8 | FT7 | Partial coverage: mobile card category select, transaction form and modal, credit-expense form, investment-return and import start `AccountSelect`, `object-contain`, POST category with color and a conflicting name, backfill with a deleted seeded category | Low (shared components, no mutant escaped through them) | Optional tests, or accept as covered by the shared components |

Spec-precision gaps (SPG) to settle in `spec.md`:

- SPG-1: COLOR-06 AC 1 says the POST and PATCH bodies carry the `enum` of 66 keys; Assumption row 58 and the tests use `type: string` with the list in the description. Pick one and align the text.
- SPG-2: COLOR-07 AC 4 "sem sair da grade" does not define Down or Up on a non-corner edge cell (stay or clamp to the nearest edge cell).
- SPG-3: COLOR-10 AC 3 and 4 and ICON-03 AC 6 list many select locations; the spec does not say which must have their own test when they share one component.

Lessons distilled with `lessons.py` (see `.specs/LESSONS.md`): L-027 recurs with this feature (load failure in a new file); the surviving mutants and spec-precision gaps above are recorded as candidates.

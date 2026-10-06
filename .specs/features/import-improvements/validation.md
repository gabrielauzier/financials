# Validation: import-improvements (T1-T5, T7-T13; T6 dropped), iteration 1 - CONDITIONAL PASS

**Verdict**: CONDITIONAL PASS. Code and automated tests are sound: every gate is green, 15 of 15 requirement IDs have a cited assertion, and 113 of 120 injected faults were killed. The feature is NOT done until two things are cleared: (1) the T13 browser check, which was not performed (its box in `tasks.md` is open and the spec success criteria that need a browser are unproven, so they count as pending, not as a pass); (2) fix task FT1 below, a real survivor on "Reimportar uses the account of the batch" (IMPIMP-13 AC 8). `validate_state.py` has no notion of "conditional" and only reads the verdict word, so it will report 0 errors; that exit code must not be read as "browser check done".

**Iteration**: 1
**Date**: 2026-10-05
**Spec**: `.specs/features/import-improvements/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md`, `.specs/LESSONS.md`; reference format `.specs/features/import-fixes/validation.md`)
**Diff range**: `ba3bd99..HEAD`, 12 commits on `feat/import-improvements`, `HEAD` = `cdb5065`: `987c35c` docs scope change (T6 dropped), `4dc8cca` T1, `412fa2d` T2, `965ec02` T3, `ec9b22f` T4, `7f81ba7` T5, `70f41dc` T7, `012e4f0` T8, `a9026ba` T9, `62b00c2` T10, `cdc5350` T11, `ddb7f48` T12, `cdb5065` T13.
**Verifier**: independent sub-agent (author != verifier). Mutants ran only in a temporary git worktree on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-impimp`, removed; a second worktree at `ba3bd99` for a baseline load run, also removed; `git worktree list` shows only the real tree). No `git stash`, no `db:reset`, no hosted Supabase or Vercel, no source or test file changed in the real tree. The local Supabase stack was used by the integration tests exactly as the author's gate does; the Verifier wrote no database row outside those tests. Real-tree `git status --porcelain` before and after the sensor: identical (only the three pre-existing untracked entries `.DS_Store`, `docs/v2/`, `references/nubank_extrato_setembro.csv`).

---

## Task Completion

`tasks.md`: 12 of 13 Done-when groups are ticked. One box is open on purpose and is reported as pending, not as passed.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 move preview analysis to `preview.ts` | Done | `4dc8cca` | commit body: responses unchanged, `openapi.json` no diff |
| T2 `categoryId` per row (confirm and preview) | Done | `412fa2d` | - |
| T3 Storage download helper | Done | `965ec02` | - |
| T4 `GET /imports` | Done | `ec9b22f` | - |
| T5 `GET /imports/:id/file` | Done | `7f81ba7` | - |
| T6 stored-batch preview endpoint | Dropped | `987c35c` | intentional; spec, design and tasks reworded in the same commit; IMPIMP-09 verified as reworded (AC 1 single `analyze`/`toPreview`, AC 2 download then normal preview) |
| T7 select all | Done | `70f41dc` | - |
| T8 colored Valor, no Tipo column | Done | `012e4f0` | - |
| T9 category select per row | Done | `a9026ba` | - |
| T10 duplicate dialog | Done | `62b00c2` | - |
| T11 web data layer | Done | `cdc5350` | - |
| T12 mocks | Done | `ddb7f48` | - |
| T13 files list, Baixar, Reimportar | Partial: code and tests done, browser box OPEN | `cdb5065` | `tasks.md` open box: "Browser check against the local API recorded in the commit body". The commit body states the check was NOT performed (sign-in with a throwaway local user was blocked). Confirmed open; treated as an explicit pending item |

Cosmetic, not blocking: `tasks.md` still says `**Status**: Draft` and the `spec.md` traceability table still says Pending for all 15 IDs.

---

## Gates (run by the Verifier on `HEAD`)

| Gate | Command | Outcome |
| ---- | ------- | ------- |
| API unit | `pnpm -C api test:unit` (inside `pnpm -C api test`) | 18 files, 368 tests passed |
| API integration | `pnpm -C api test:int` (inside `pnpm -C api test`) | 41 files, 567 tests passed, 140 s |
| API typecheck, lint | `pnpm -C api typecheck && pnpm -C api lint` | exit 0, no warnings |
| Web typecheck, lint | `yarn --cwd web typecheck && yarn --cwd web lint` | exit 0; 7 warnings (`react-refresh/only-export-components`) all in files not touched by the diff (`ui/badge`, `ui/button`, `ui/form`, `ui/navigation-menu`, `ui/sidebar`, `ui/toggle`, `auth/useSession`), pre-existing |
| Web suite, alone, run 1 / 2 / 3 | `yarn --cwd web test` | 53 files, 475 tests passed each time (56.6 s, 54.2 s, 53.5 s) |
| Web suite, two in parallel (load) | two `yarn --cwd web test` at once | NOT robust: 23 and 21 failures out of 475, all timeouts in the pre-existing extrato files (`extratoCrud`, `extratoDescriptionForm`, `extratoFilters`, `extratoInline`, `extratoQuickMonth`, `paymentMethodOther`, `transactions.test.tsx`); zero failures in any file of this feature |

Test integrity: web tests went from 359 at `ba3bd99` to 475 (+116); API unit plus integration is 935 now. No test file was deleted (diff shows only additions and modifications).

Load judgment: the same two-suite run on `ba3bd99` (before this feature) already fails 13 tests in the same seven extrato files, so the fragility is pre-existing (it is lesson L-027, `transactions-ux`); this feature's own files stayed green under load. Slowest tests under load: `extratoCrud.test.tsx` "o formulário de criação abre com hoje no fuso local" 59.5 s; `extratoQuickMonth.test.tsx` 26.2 s, 25.6 s, 25.4 s; `extratoCrud.test.tsx` 23.2 s, 22.7 s; `transactions.test.tsx` 19.6 s. Slowest of this feature under load: `ImportPreviewTable.test.tsx` "a categoria escolhida sobrevive a desmarcar e marcar de novo a linha" 1.97 s; `ImportPage.test.tsx` "Voltar e Esc fecham o diálogo..." 1.94 s; `ImportPreviewTable.test.tsx` "escolher outra categoria muda só essa linha..." 1.89 s; all far below the 15 s `testTimeout`, so the new tests satisfy the half-of-timeout budget of L-027.

---

## Spec-Anchored Acceptance Criteria

Legend: `A/` = `api/test/`, `S/` = `api/src/modules/import/`, `W/` = `web/src/features/import/`, `WL/` = `web/src/lib/api/`. Web assertion citations are the `it(` line of the test whose body the Verifier read for the quoted assertion.

### IMPIMP-01 and IMPIMP-02: categoria por linha na API

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1 (02). Preview rows carry `categoryId` equal to the id behind `categoryName`, incl. ignored and invalid | `categoryId` UUID of the user's category of the key | `A/import-preview.int.test.ts:318` `expect(row.categoryId).toBe(ids.get(row.categoryName))` for every row; `:329` ignored invoice row; `:335` invalid row | PASS (A15, A16 killed) |
| 2 (01). `categoryId` of a user category is stored instead of the parser's | each transaction has the chosen category | `A/import-confirm.int.test.ts:378` `expect(stored.get(ROW0)).toBe(food)` and `expect(stored.get(ROW1)).toBe(fun)`, read back by `GET /transactions` | PASS (A08, A13 killed) |
| 3 (01). Absent `categoryId` keeps the parser category | parser category | `A/import-confirm.int.test.ts:403` `toBe(uncategorized)`, `toBe(investments)` next to a row with `food` | PASS |
| 4 (01). Unknown or foreign uuid: 422 `invalid_category`, field `selections`, row index in message, nothing written (no batch, transaction, object) | exact body | `A/import-confirm.int.test.ts:445` `toEqual({ error: { code: 'invalid_category', message: 'Row 5 has a category that does not exist', field: 'selections' } })` and `importState` equals `EMPTY` (transactions, batches, attachments, Storage objects all 0); `:460` same for another user's category, other user's state also empty | PASS (A07, A09 "validated after upload", A10, A11, A12, A17 killed) |
| 5 (01). Non-UUID, `null`, number, object, `""`: 422 `validation_error` field `selections`, nothing written | exact | `A/import-confirm.int.test.ts:473` loop over `[null, 7, {}, '', 'abc']` `toBe(422)` and `toMatchObject({ error: { code: 'validation_error', field: 'selections' } })`; `S/selections.test.ts:38` and `:51` it.each shapes | PASS (A01, A02, A03 killed) |
| 6 (01). Neutral row keeps `neutral = true` and the chosen category | `{ neutral: true, category_id: food }` | `A/import-confirm.int.test.ts:427` `expect(row).toEqual({ neutral: true, category_id: food })` | PASS (A14 killed) |
| 7 (01). Two rows, two categories | each row its own | `A/import-confirm.int.test.ts:378` (same assertion as AC 2: `food` on ROW0, `fun` on ROW1) | PASS |

### IMPIMP-03: categoria por linha no preview

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Select with the user's category names, pre-selected on `categoryId`, for new, duplicate, unrecognized | `combobox` shows the category name | `W/ImportPreviewTable.test.tsx:322` (preselected per row); `:331` lists exactly the user's categories | PASS |
| 2. Ignored and invalid rows: text only | no select | `W/ImportPreviewTable.test.tsx:342` | PASS (W21 killed) |
| 3. Choosing a category changes only that row | other rows, selection and Neutra unchanged | `W/ImportPreviewTable.test.tsx:355` `expect(onChange).toHaveBeenLastCalledWith([{ index: 0, ..., categoryId: FOOD }, { index: 3, ..., TRANSPORT }, { index: 5, neutral: true, categoryId: TRANSPORT }])` plus unchanged selects and checkboxes; `:386` Neutra edit keeps preview `categoryId` | PASS (W23, W24 killed) |
| 4. Confirm sends `{ index, neutral, categoryId }` effective per selected row | exact payload | `W/ImportPage.test.tsx:342` posts the chosen id for the altered row and the preview id for the others; `W/previewSelection.test.ts:137`, `:144` payload with default and chosen category | PASS (W12, W13, W14 killed) |
| 5. While loading: select disabled, "Carregando categorias…" | exact text | `W/ImportPreviewTable.test.tsx:401`; `web/src/features/categories/CategorySelect.test.tsx:40` | PASS (W26 killed) |
| 6. Categories request fails: name as text, confirm uses preview ids | text and payload | `W/ImportPreviewTable.test.tsx:409` | PASS (W22 killed) |
| 7. One `CategoryOptionLabel` renders every item | single component | `web/src/features/categories/CategorySelect.test.tsx:27` asserts the displayed value and the option name equal `category.name` and renders `CategoryOptionLabel` alone | Spec-precision gap: structural criterion, the test cannot tell that the select items go through the component (mutant W27, which inlines `{category.name}` in the items, survives; behaviourally identical) |

### IMPIMP-04: selecionar todas

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Header checkbox labeled "Selecionar todas as linhas" | present | `W/ImportPreviewTable.test.tsx:210` `getByRole("checkbox", { name: "Selecionar todas as linhas" })` used by every test of the block | PASS |
| 2. Marking selects new, duplicate, unrecognized; never ignored or invalid | indexes `[0, 1, 3, 5]`, counter "4 linhas selecionadas" | `W/ImportPreviewTable.test.tsx:215` `expect(indexes).toEqual([0, 1, 3, 5])`; `W/previewSelection.test.ts:83` | PASS (W03, W04 killed) |
| 3. Checked, indeterminate, unchecked | `aria-checked` `"true"`, `"mixed"`, `"false"` | `W/ImportPreviewTable.test.tsx:227`; `W/previewSelection.test.ts:52`, `:56`, `:63`, `:74` | PASS (W02, W07 killed) |
| 4. Click on checked clears all selectable | `"false"`, "0 linhas selecionadas" | `W/ImportPreviewTable.test.tsx:237` | PASS (W06 killed) |
| 5. Click on indeterminate selects all | `"true"` and `rowBox(1)` checked | `W/ImportPreviewTable.test.tsx:237` | PASS |
| 6. Neutra and category untouched, counter follows | switches keep their value | `W/ImportPreviewTable.test.tsx:249`; `W/previewSelection.test.ts:94` (neutral), `:108`, `:113` | PASS (W05 killed) |
| 7. Initial selection: new and unrecognized on, duplicate off | as today | `W/ImportPreviewTable.test.tsx:278`; `W/previewSelection.test.ts:45` | PASS (W11 killed) |
| 8. No selectable rows: disabled and unchecked | `toBeDisabled()` and `aria-checked="false"` | `W/ImportPreviewTable.test.tsx:262`; `W/previewSelection.test.ts:68` | PASS (W01, W08 killed) |

### IMPIMP-05: Valor colorido, sem coluna Tipo

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. No "Tipo" header or cells | none; 8 headers | `W/ImportPreviewTable.test.tsx:185` `queryByRole("columnheader", { name: "Tipo" })` absent, `getAllByRole("columnheader")).toHaveLength(8)` | PASS (W15 killed) |
| 2. Income green, no sign, extrato classes | `R$ 99,90` with `text-emerald-700`, `dark:text-emerald-400`, `font-semibold` | `W/ImportPreviewTable.test.tsx:193` | PASS (W16, W17, W20 killed) |
| 3. Expense red with a single "-" with or without sign in the amount | `-R$ 1.234,56`, `text-destructive`, for `"1234.56"` and `"-1234.56"` | `W/ImportPreviewTable.test.tsx:200`; `web/src/features/transactions/utils.test.ts:73` | PASS (W18, W19 killed) |
| 4. Extrato (table and card) and preview use the same function, no visual change | helpers `amountClassName`, `formatSignedAmount`; extrato tests unchanged | `web/src/features/transactions/utils.test.ts:46`, `:59`, `:69`, `:78`; the existing extrato suites ran green with mutants W17 to W20 killed through them | PASS |

### IMPIMP-06: confirmação de duplicadas

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Confirm with a duplicate selected opens the dialog with the count, sends nothing | title "Importar linhas duplicadas?", "1 linha selecionada já foi importada antes", 0 confirm calls | `W/ImportPage.test.tsx:219` `expect(callsTo("/imports/confirm")).toHaveLength(0)` | PASS (W09, W10, W31 killed) |
| 2. No selected duplicate: direct confirm, no dialog | one POST | `W/ImportPage.test.tsx:250` | PASS |
| 3. "Importar mesmo assim": one confirm, same selections, same key | one call, same key as a retry | `W/ImportPage.test.tsx:259` | PASS (W34 killed) |
| 4. "Voltar" and Esc close the dialog, keep selection, categories and Neutra, send nothing | unchanged state | `W/ImportPage.test.tsx:274`; `W/DuplicateConfirmDialog.test.tsx:29`, `:38` | PASS (W35, W36 killed) |
| 5. While confirming: button disabled, dialog does not open | disabled, no second request | `W/ImportPage.test.tsx:303`; `W/DuplicateConfirmDialog.test.tsx:45` | PASS (W29, W38 killed; W32 survives as equivalent: the disabled button cannot be clicked) |
| 6. Singular and plural sentence | "1 linha selecionada já foi importada antes" / "3 linhas selecionadas já foram importadas antes" | `W/DuplicateConfirmDialog.test.tsx:17`, `:24`; `W/ImportPage.test.tsx:229` | PASS (W28 killed) |
| 7. "Tentar novamente" re-sends with the same key, no dialog | same key, no dialog | `W/ImportPage.test.tsx:321` (also `:150`) | PASS (W37 killed) |

Spec-precision gap on the dialog text: spec Assumption row 43 gives the description as "... Importar mesmo assim cria transações repetidas." while `DuplicateConfirmDialog.tsx:38` renders "... cria transações repetidas no extrato." and every test matches only the first sentence by regex (`W/DuplicateConfirmDialog.test.tsx:21`). The AC itself (count sentence, button labels) is met; the full text is neither asserted nor equal to the spec. See FT4.

### IMPIMP-07: GET /imports

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. 200, newest first, fields `id, filename, mimeType, sizeBytes, bank, account{id,nickname}, createdAt, rowCount, importedCount, skippedCount` | exact object | `A/imports-list.int.test.ts:102` `expect(items[0]).toEqual({ id, filename: 'fatura.csv', mimeType: 'text/csv', sizeBytes, bank: 'Nubank', account: {...}, createdAt: stringMatching(ISO), rowCount: 19, importedCount: 2, skippedCount: 17 })` and order `[second, first]` | PASS (A18, A24 to A28 killed) |
| 2. No batches: 200 `[]` | `[]` | `A/imports-list.int.test.ts:136` `toEqual([])` | PASS |
| 3. Default at most 50; `limit` 1 to 100 | 50 of 52; 7; 100 accepted; `limit=1` returns the newest only | `A/imports-list.int.test.ts:143` `toHaveLength(50)`, `toHaveLength(7)`, `toHaveLength(52)`; `:155` `toEqual([newest])` | PASS (A20, A23 killed) |
| 4. `limit` below 1, above 100, non-integer: 400 `validation_error` | 400 for `0, 101, 1.5, abc, -3` | `A/imports-list.int.test.ts:164` `toBe(400)`, `toMatchObject({ error: { code: 'validation_error' } })` | PASS (A21, A22 killed) |
| 5. No `storage_path`, `user_id`, `idempotency_key` | raw JSON lacks them; exact key set | `A/imports-list.int.test.ts:171` `expect(raw).not.toContain(stored?.storage_path)` and `Object.keys(...).sort()` `toEqual([...10 keys])` | PASS |
| 6. Equal `created_at`: `id` descending, stable | same order on two calls | `A/imports-list.int.test.ts:191` `toEqual(expected)` twice | PASS (A19 killed) |

Edge cases of the list: inactive account still listed with nickname `A/imports-list.int.test.ts:201` (A30 killed); earliest attachment `:212` (A24, A25 killed); batch without attachment not listed `:223` (A26 killed).

### IMPIMP-08: GET /imports/:id/file

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. 200, identical bytes, stored `Content-Type`, `attachment` with the original name | bytes equal, `text/csv`, exact header, `private, no-store`, `nosniff` | `A/imports-file.int.test.ts:144` `expect(res.rawPayload.equals(content)).toBe(true)`; `:151` `toBe("attachment; filename=\"extrato julho.csv\"; filename*=UTF-8''extrato%20julho.csv")`; `:154` cache-control; `:155` nosniff | PASS (A34, A35, A36, A50 killed; A37 survives as equivalent: Fastify sets `content-length` for a Buffer by itself) |
| 2. Accents, quotes, line breaks: ASCII `filename` without quote, slash, control; `filename*` percent-encoded; valid response | no injected header | `A/imports-file.int.test.ts:160` `expect(fallback).not.toMatch(/["\\/;\r\n]/)`, `expect(res.headers['x-evil']).toBeUndefined()`; `S/contentDisposition.test.ts:17`, `:29`, `:35`, `:43`, `:47`, `:55` | PASS (A47, A48, A49 killed) |
| 3. Non-UUID, unknown, foreign: same 404 `not_found`, Storage never called | same body, 0 Storage requests | `A/imports-file.int.test.ts:188` `expect(new Set(responses.map((r) => r.body)).size).toBe(1)` and `expect(proxy.storageRequests.length).toBe(before)` | PASS (A31, A32, A54 killed) |
| 4. Object gone from Storage: 404 `not_found` | 404 | `A/imports-file.int.test.ts:208` `toEqual(NOT_FOUND)`; `S/storage.test.ts:72` null on 400 and 404 | PASS (A33, A41, A43 killed) |
| 5. Storage error: 502 `storage_error` with no URL, token, path | 502 for HTTP 500 and unreachable | `A/imports-file.int.test.ts:225` `toBe(502)` and none of `[proxy.url, token, publishableKey, path, user id]` in body or headers; `S/storage.test.ts:77` (401, 403, 500, 502, 503), `:85` network, `:90` timeout | PASS (A42, A44, A45, A46 killed) |
| 6. No `publishableKey`: 503 `storage_not_configured` | 503, checked before the id | `A/imports-file.int.test.ts:247` `toBe(503)` for a real, a random and a non-UUID id | PASS (A38, A39 killed) |
| 7. No path, Storage URL or project key in body or header | absent | `A/imports-file.int.test.ts:257` loop over `[path, '/storage/v1', apiUrl, publishableKey, serviceRoleKey, token]` | PASS |

Edge case: stored `mime_type` not `type/subtype` answers `application/octet-stream`: `A/imports-file.int.test.ts:176` it.each `['not a mime', 'text/csv; charset=utf-8', 'x']` (A34 killed).

### IMPIMP-09: preview único (as reworded; T6 dropped)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. One `analyze` and `toPreview` in their own module, no change in response or OpenAPI | `preview.ts` defines them; `routes.ts` has no copy | `S/preview.ts:59` `analyze`, `:86` `toPreview` (only definitions; `grep` shows `routes.ts` imports them); commit `4dc8cca` body "openapi.json has no diff"; existing preview tests unchanged `A/import-preview.int.test.ts:79` and `A/swagger.int.test.ts:209` (committed `openapi.json` equals the export) | PASS with a weak anchor: "no change" is shown by the green unchanged tests and the commit body, not by a test comparing before and after |
| 2. Downloaded file posted to `/imports/preview` on the batch account: every confirmed row `duplicate`, row count of the file | all `duplicate` | `A/imports-file.int.test.ts:321` previews every confirmed row as duplicate with the row count; `:342` a row skipped originally stays `new`; `A/import-confirm.int.test.ts:336` 96 of 96 `duplicate` for the sanitized statement | PASS |

### IMPIMP-10: isolamento e autenticação

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. No or invalid token: 401 `unauthorized` on both routes | 401 | `A/imports-list.int.test.ts:246`; `A/imports-file.int.test.ts:304` (also asserts Storage not asked) | PASS |
| 2. B's list holds nothing of A | A sees its batches, B none | `A/imports-list.int.test.ts:233` | PASS (A53 RLS bypass killed) |
| 3. B downloads A's id: 404 equal to unknown id, no bytes | same 404 | `A/imports-file.int.test.ts:276`; `:188` | PASS (A54 killed) |
| 4. Database only via `withUser`, Storage only with the user's token, never the service key | request headers `apikey` and user bearer only | `S/storage.test.ts:109`; `A/imports-isolation.int.test.ts:119` B cannot read A's file through Storage; mutants A53 and A54 (RLS bypassed with `reset role`) killed | PASS |
| 5. A downloads its own bytes even if B has the same filename | A's bytes | `A/imports-file.int.test.ts:293` | PASS |

### IMPIMP-11, IMPIMP-12, IMPIMP-13: arquivos importados na tela

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 11.1 Section "Arquivos importados" with name, nickname, date `dd/mm/aaaa`, "N importadas · M ignoradas", two buttons, in the start step only | "Nubank pessoal · 05/03/2026", "3 importadas · 1 ignorada", "1 importada · 1 ignorada" | `W/ImportedFilesList.test.tsx:58`; `W/ImportPage.test.tsx:476` heading absent after the preview step | PASS for the cited cases; zero counts are not asserted: mutant W48 (`count <= 1`, so "0 importada") survives, see FT2 (W53, W50, W52 killed) |
| 11.2 Loading: 3 skeleton rows | 3 | `W/ImportedFilesList.test.tsx:83` | PASS (W50 killed) |
| 11.3 Empty: "Nenhum arquivo importado ainda.", no buttons | text, no buttons | `W/ImportedFilesList.test.tsx:90` | PASS (W52 killed) |
| 11.4 List error: Portuguese message and "Tentar novamente" refetches | storage and generic cases | `W/ImportedFilesList.test.tsx:98`, `:113` | PASS (W51 killed) |
| 11.12 Confirm success invalidates the list, new batch shown at the start step | new batch visible | `W/ImportPage.test.tsx:570`; `W/importedFilesApi.test.tsx:92` invalidates `["imports"]` and `["transactions"]`, `:109` not on failure | PASS (W54 killed) |
| 12.5 "Baixar": authenticated request, saved with the original name, no token in URL, no navigation | `download` equals the filename, URL revoked | `W/ImportedFilesList.test.tsx:127` `expect(clicked).toEqual([{ download: "extrato-marco.csv", href: "blob:mock-url" }])`, `revokeObjectURL` called; `:143` path has no token or Storage; `W/importedFilesApi.test.tsx:68`; `WL/client.test.ts:103` | PASS (W44, W45, W55, W57 killed; "does not navigate away" only asserted as the anchor removal at `:127`, a jsdom limit) |
| 12.6 Row buttons disabled while downloading | both disabled, other row enabled | `W/ImportedFilesList.test.tsx:154` | PASS |
| 12.7 Download failure: Portuguese alert, no API text | exact text, not "S3 exploded" | `W/ImportedFilesList.test.tsx:173`, `:186` | PASS (W46 killed) |
| 13.8 "Reimportar": download, `File` with original name and type, batch account selected, preview via the normal route, "Prévia" step | `File` name `extrato-marco.csv`, type `text/csv`, `accountId` `acc-1`, step "2. Prévia" | `W/ImportPage.test.tsx:485` `expect(body.get("accountId")).toBe("acc-1")` | Spec-precision gap: the test starts with no account selected, so it cannot tell the batch account from the form's current account. Mutant W39 (`accountId ?? item.account.id` in the preview call) survives; with another account preselected the preview would go to the wrong account while the confirm uses the batch account. Code is correct today; the guard is missing. See FT1 (W42, W55, W56 killed) |
| 13.9 Preview of the reimport: rows `duplicate`, usual initial selection, confirm with the same `File` and a new key | duplicates unselected, new key | `W/ImportPage.test.tsx:485` (checkbox states), `:508` `expect(second).not.toBe(first)` | PASS (W40 killed) |
| 13.10 Download failure keeps the start step with the list alert, no preview | no `/imports/preview` call | `W/ImportPage.test.tsx:539` `expect(callsTo("/imports/preview")).toHaveLength(0)` | PASS (W41, W47 killed) |
| 13.11 Preview failure keeps the start step with account and file filled and the Portuguese message | "Selecione uma conta ativa" | `W/ImportPage.test.tsx:554` | PASS |

### IMPIMP-14 and IMPIMP-15: contrato, tipos, mocks, mensagens

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 14.1 `openapi.json` documents `categoryId`, `GET /imports`, `GET /imports/{id}/file` and is regenerated | document equals the export | `A/swagger.int.test.ts:139`, `:161`, `:189`, `:209` (committed `api/openapi.json` up to date) | PASS (A51 killed) |
| 14.2 Web types include the new fields | typecheck | `yarn --cwd web typecheck` exit 0 with `PreviewRow.categoryId`, `ImportSelection.categoryId`, `ImportedFile` in `web/src/lib/api/types.ts` | PASS (by typecheck, no runtime test) |
| 14.3 Mocks serve the four routes; area key matches `/imports/...` | key `imports`; list newest first; unknown id 404; duplicates; confirm adds a batch | `WL/mock/import.test.ts:55`, `:61`, `:70`, `:103`, `:123`, `:142`, `:179`, `:233`, `:258` | PASS (W61 to W66 killed) |
| 15.4 502 `storage_error` and 503 `storage_not_configured` in Portuguese in every import point | "Não foi possível acessar o arquivo guardado. Tente novamente." / "O armazenamento de arquivos não está disponível no momento." | `WL/errorMessages.test.ts:125` it.each; `W/ImportSummary.test.tsx:32`; `W/ImportedFilesList.test.tsx:98`, `:173` | PASS (W58, W59 killed) |
| 15.5 422 `invalid_category`: "Há linhas com categoria inválida. Gere a prévia de novo." | exact | `W/ImportSummary.test.tsx:43` | PASS (W60 killed) |

### Edge cases

| Edge case | `file:line` | Result |
| --------- | ----------- | ------ |
| Reimport of a file name without `.csv` is accepted | `W/ImportPage.test.tsx:530` `expect(sent.name).toBe("extrato-sem-extensao")` | PASS |
| Reimport twice without confirming renews the key, nothing written | `W/ImportPage.test.tsx:167` (new preview session, other key) and `:508` (key differs after confirm); no test runs two reimports back to back without confirming | Partial (W40 killed through `:167`) |
| Reimport with all duplicates marked shows the dialog with the count, then a new batch with repeated transactions | dialog count with select all of 3 duplicates `W/ImportPage.test.tsx:229`; the reimport path and the dialog are not exercised together | Partial |
| Category deleted between preview and confirm: 422 `invalid_category` and the regenerate message | `A/import-confirm.int.test.ts:445`; `W/ImportSummary.test.tsx:43` | PASS |
| Select all keeps the chosen categories | `W/previewSelection.test.ts:94`, `:108` (choices kept via `choiceOf`); `W/ImportPreviewTable.test.tsx:375` category survives a deselect and reselect | PASS (W05 killed) |
| Upper-case `categoryId` accepted | `A/import-confirm.int.test.ts:437` `expect((await categoryOf(o.user.id)).get(ROW0)).toBe(food)`; `S/selections.test.ts:29` | PASS (A04, A06 killed) |
| `limit=1` with two batches returns the newest | `A/imports-list.int.test.ts:155` | PASS |
| Account inactivated: still listed, "Reimportar" fails with "Selecione uma conta ativa" | `A/imports-list.int.test.ts:201`; `W/ImportPage.test.tsx:554` | PASS |
| More than one attachment: the earliest | `A/imports-list.int.test.ts:212` (list); the download query orders the same way and has no dedicated test | PASS for the list, download unproven |
| `mime_type` not `type/subtype` answers `application/octet-stream` | `A/imports-file.int.test.ts:176` | PASS |
| Expense `amount` with "-" shows a single "-" | `W/ImportPreviewTable.test.tsx:200`; `web/src/features/transactions/utils.test.ts:73` | PASS |

Success criteria of the spec that need a browser (select changes the stored category, indeterminate on partial selection, colors without the Tipo column, duplicates dialog with "Voltar" keeping the selection, list shows the new file, "Baixar" saves an identical CSV, "Reimportar" opens the preview in the right account with "Duplicada" rows): proven only by jsdom tests, NOT by a browser run. They stay pending (see Browser Check).

---

## Discrimination Sensor

120 behaviour-level mutants in the temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-impimp`, 54 API in `A01..A54`, 66 web in `W01..W66`). API mutants ran the API unit suite and the related integration files against the real local Supabase; web mutants ran `src/features/import`, `src/lib/api`, `src/features/categories` and `src/features/transactions` (for the shared amount helpers). Harness: `/private/tmp/claude-501/v/mut.py`, raw output `res-A.jsonl`, `res-W.jsonl` in the same folder. Totals: 113 killed, 7 survived, 0 patches failed to apply, none of the kills was a timeout (the word "timeout" in the logs came from test titles).

| Area | Mutants | Killed | Survived |
| ---- | ------- | ------ | -------- |
| categoryId validation (UUID format, null, empty string, case, ownership, 422 code, field, status, message index, before-upload order A09) | A01 to A12, A17 | 13 | 0 |
| parser fallback, neutral independence, preview `categoryId` | A13, A14, A15, A16 | 4 | 0 |
| GET /imports (order, tie-break, limit default, bounds, earliest attachment, attachment join, left join, field mapping, inactive account, RLS bypass) | A18 to A30, A53 | 14 | 0 |
| download route and headers (404 paths, 200 on missing, mime, cache-control, nosniff, inline, 503, token) | A31 to A40, A50, A52, A54 | 11 | 2 (A37, A52) |
| Storage helper (400 and 404 mapping, 500 as missing, network error, timeout, URL leak) | A41 to A46 | 6 | 0 |
| content-disposition (CR/LF, semicolon, quote encoding) and OpenAPI drift | A47, A48, A49, A51 | 4 | 0 |
| select all (state, ignored and invalid, click semantics, neutral kept, disabled) | W01 to W08 | 8 | 0 |
| duplicate count, initial selection, payload | W09 to W14 | 6 | 0 |
| colored Valor, Tipo column, shared helpers | W15 to W20 | 6 | 0 |
| category select (rows without select, always select, payload, other rows, label, CategoryOptionLabel) | W21 to W27 | 6 | 1 (W27) |
| duplicate dialog and confirm flow (singular, disabled, title, threshold, pending guard, close, key, cancel, retry, button) | W28 to W38 | 9 | 2 (W32, W33) |
| Reimportar (account, key renewal, row busy, file set, list only at start) | W39 to W43 | 4 | 1 (W39) |
| list, Baixar, states (filename, revoke, alerts, plural, busy, skeleton, retry, empty, date) | W44 to W53 | 9 | 1 (W48) |
| data layer, blob flow, messages | W54 to W60 | 7 | 0 |
| mocks and area key | W61 to W66 | 6 | 0 |
| **Total** | **120** | **113** | **7** |

Survivors:

| Mutant | Fault | Verdict |
| ------ | ----- | ------- |
| A37 | download: `content-length` header dropped | Equivalent. Fastify sets `content-length` for a Buffer payload itself; `A/imports-file.int.test.ts:155` asserts it and still passes |
| W32 | `requestConfirm` pending guard removed | Equivalent through the UI: `ImportPage.tsx` disables the "Confirmar importação" button while pending, so the handler cannot run twice (the guard is defence in depth; `W/ImportPage.test.tsx:303` still holds) |
| W33 | `confirmDuplicates` no longer calls `setDuplicatesOpen(false)` | Equivalent: Radix `AlertDialogAction` closes the dialog on click and `onOpenChange(false)` calls `onCancel`, which closes it |
| W39 | reimport posts the preview with `accountId ?? item.account.id` | NOT equivalent: real test gap, FT1 |
| W48 | plural helper `count <= 1` (0 shown as "0 importada") | NOT equivalent: FT2 |
| W27 | select items render `{category.name}` instead of `CategoryOptionLabel` | Behaviourally identical, structural AC 7 of IMPIMP-03 is unproven: FT3 |
| A52 | Storage token strip `/^Bearer /` made case-sensitive | NOT proven equivalent: a lowercase `bearer` scheme reaches Storage with the prefix intact; unspecified by the spec and the same pattern already exists in the confirm route: FT3 |

Isolation: real-tree `git status --porcelain` before and after the sensor and after both worktrees were removed: identical (`?? .DS_Store`, `?? docs/v2/`, `?? references/nubank_extrato_setembro.csv`).

---

## Code Quality Check

| Check | Pass? |
| ----- | ----- |
| No features beyond what was asked | Yes: T6 endpoint removed from scope instead of built as dead code |
| No abstractions for single-use code | Yes (`CategoryOptionLabel` is a spec requirement, AC 7) |
| Only touched files required for task | Yes: 49 files, all inside the declared scope plus `README.md` area-key update |
| Matches existing patterns | Yes (`withUser`, `AppError`, TypeBox, react-query, shadcn) |
| Tests map to ACs and are non-shallow (spot-check: IMPIMP-01 and IMPIMP-08) | Yes: exact bodies, state checks of Storage and database, mutant kill rate above 94 percent |
| Spec-anchored outcomes | Yes, gaps flagged above (IMPIMP-03.7, IMPIMP-11.1 zero, IMPIMP-13.8, dialog text, IMPIMP-09.1) |
| Per-layer coverage expectation | Yes: every new route has happy, 401, 404, 422 or 400, 502, 503 paths |
| Project guidelines | none beyond test configs and package scripts; strong defaults applied |

Privacy note: the real CSV `references/nubank_extrato_setembro.csv` is untracked and was not touched; the diff adds no fixture file (`git diff --stat ba3bd99..HEAD -- api/test/fixtures` is empty), and the new tests reuse the sanitized fixture and in-test CSV strings.

---

## Browser Check

NOT performed; remains PENDING for the owner. The Verifier used only the existing Browser pane. Its tab `tab-1` (`http://localhost:8080/login`) shows the "Entre na sua conta" form, so there is no valid session; the other tab is the hosted app, which was left alone. The Verifier did not read, print or create credentials and did not create a user.

Manual steps for the owner (local stack up, `pnpm -C api dev`, `yarn --cwd web dev` with the real API, i.e. `VITE_MOCK_AREAS` empty; sign in with the owner's own local user; use the sanitized fixture `api/test/fixtures/nubank_statement_sanitized.csv`, 96 rows, on a Nubank account):

1. Open "Importar", choose the Nubank account and the fixture, "Gerar prévia". Expect: no "Tipo" column; Valor green without sign for the 13 incomes and red with "-" for expenses, same colors as the extrato.
2. In the table, change the category of one row with its select ("Categoria de <nome>"). Expect: only that row changes; the "Selecionar" checkbox and "Neutra" switch of that row and the others stay.
3. Header checkbox "Selecionar todas as linhas": with the initial selection it is indeterminate when some row is off (after unchecking one row) and all 96 selectable rows become selected on click; click again clears all; the counter follows.
4. "Confirmar importação" with no duplicate selected: confirm goes straight through. Open "Extrato" and check that the changed row has the category chosen in step 2.
5. Back at "Importar" (or "Importar outro arquivo"): "Arquivos importados" lists the file with account nickname, `dd/mm/aaaa` date and "96 importadas · 0 ignoradas" (or the real counts). During loading three skeleton rows show.
6. "Baixar": the browser saves a file named like the original; compare it byte for byte with the upload (`cmp` or `shasum`).
7. "Reimportar" (first with a different account preselected in the form to cover FT1): expect the "Prévia" step on the batch's account, all rows "Duplicada" and unselected; "Selecionar todas as linhas" then "Confirmar importação" shows "Importar linhas duplicadas?" with "96 linhas selecionadas já foram importadas antes"; "Voltar" (and Esc) closes it, keeps the selection and sends nothing; "Importar mesmo assim" imports once and creates a new batch (a new row in the list when you return).
8. Inactivate the account in "Contas" and press "Reimportar": expect "Selecione uma conta ativa" in the form with the step unchanged.
9. Check that no screen, network response or header shows the Storage object path (DevTools, Network tab on `/imports` and `/imports/:id/file`).

---

## Ranked Gaps and Fix Tasks

| Rank | Id | Gap | Severity | Fix |
| ---- | -- | --- | -------- | --- |
| 1 | FT0 | T13 browser check not performed; the browser-only success criteria of the spec are unproven | Blocking for "done" (pending, not a code defect) | Owner runs the manual steps above and records the outcome in the T13 box or a new commit body |
| 2 | FT1 | W39: no test starts a reimport with a different account already selected in the form (IMPIMP-13 AC 8) | Medium: a regression sends the preview to the wrong account and the confirm to the right one | Add a page test in `web/src/features/import/ImportPage.test.tsx`: select account B in the form, press "Reimportar" on a batch of account A, assert `bodyOf("/imports/preview").get("accountId")` equals A and the confirm uses A |
| 3 | FT2 | W48: zero counts never asserted (IMPIMP-11 AC 1) | Low | Add a list test row with `importedCount: 0, skippedCount: 0` expecting "0 importadas · 0 ignoradas" |
| 4 | FT4 | Dialog description differs from the spec text ("... no extrato." extra) and only its first sentence is tested | Low (spec-precision) | Align the text with spec row 43 or update the spec, and assert the full description in `DuplicateConfirmDialog.test.tsx` |
| 5 | FT3 | W27: no check that select items go through `CategoryOptionLabel` (IMPIMP-03 AC 7); A52: lowercase `bearer` scheme not handled or tested | Low | Spy or `vi.mock` `CategoryOptionLabel` and assert it renders for each option; accept `bearer` case-insensitively in the Storage token strip or assert the intended behaviour |
| 6 | FT5 | Two partial edge cases: two reimports back to back without confirming; reimport with all duplicates through to the dialog; download query with two attachments untested | Low | Add the two page tests and one integration case (second attachment, download returns the earliest) |
| 7 | FT6 | `tasks.md` Status Draft and `spec.md` traceability Pending | Cosmetic | Update on closing |

Loads: the web suite is fragile when a second suite shares the machine (pre-existing extrato files, 13 failures at `ba3bd99` against 21 to 23 now); not caused by this feature (L-027), but any CI job running two suites at once would be red.

---

## Gaps closed

Date: 2026-10-05. Fix tasks FT1 to FT5 are closed by commits `f4c9eb4` (`test(api)`) and `fff63be` (`test(web)`); FT6 (spec traceability and tasks Status) by the docs commit that carries this addendum. The verdict above is unchanged and stays CONDITIONAL PASS: the T13 browser check (FT0) was NOT performed, its box in `tasks.md` is still open, `tasks.md` Status is "Pending browser check", and the browser-only success criteria remain pending for the owner. A `validate_state.py` exit 0 does not mean the browser check is done.

| Id | Closed by | Proof (temporary git worktree on the external volume, removed; real tree untouched, no stash) |
| -- | --------- | ------ |
| FT1 | `ImportPage.test.tsx` "Reimportar com outra conta escolhida no formulário usa a conta do lote no preview e no confirm": account B selected, Reimportar on a batch of A, preview and confirm bodies carry A | W39 (`accountId ?? item.account.id`) now fails it |
| FT2 | `ImportedFilesList.test.tsx` "mostra zero no plural": "0 importadas · 0 ignoradas" | W48 (`count <= 1`) now fails it |
| FT4 | Code changed to the spec text (the spec wording was the requested one; "no extrato" added nothing): "... Importar mesmo assim cria transações repetidas."; `DuplicateConfirmDialog.test.tsx` asserts the full accessible description for singular and plural | restoring "no extrato." fails both tests |
| FT3 (web) | `CategoryOptionLabel` moved to its own module (`CategoryOptionLabel.tsx`, behaviour unchanged); `CategorySelect.test.tsx` mocks it and asserts every option and the displayed value render through it | W27 (inline `{category.name}`) now fails it |
| FT3 (api) | The code already strips the scheme case-insensitively (`/^Bearer /i`, as in the confirm route); `imports-file.int.test.ts` "accepts a lowercase bearer scheme" downloads with `bearer <jwt>` and expects the bytes | A52 (case-sensitive strip) now fails it |
| FT5 | `ImportPage.test.tsx`: two reimports in a row without confirming give two previews and a new idempotency key; reimport with all duplicates selected opens the dialog ("3 linhas selecionadas já foram importadas antes") and "Importar mesmo assim" creates a new batch on the batch account. `imports-file.int.test.ts`: download of a batch with two attachments serves the earliest | renew() removed fails the two-reimports test; skipping the dialog on a reimported file fails the reimport-to-dialog test; ordering `created_at desc` on the download query fails the attachments test |

Gates after the fixes: `yarn --cwd web test` 54 files, 480 tests, three runs green; web typecheck exit 0, lint 0 errors (7 pre-existing warnings); `pnpm -C api test` 368 unit and 569 integration green; api typecheck and lint exit 0. Mutants of this round were run on the touched suites only (web: `src/features/import`, `src/features/categories`; api: `imports-file.int.test.ts`).

Remaining: FT0 only (owner browser check, step 7 should start with a different account preselected to exercise FT1 in a real browser).


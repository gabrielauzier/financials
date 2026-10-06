# Validation: transactions-ux (T1-T11), iteration 1 - FAIL

**Verdict**: FAIL

All ten requirements (TUX-01..TUX-10) and all seven spec edge cases have `file:line` evidence, the implementation was not found wrong in any probe (browser, API and database), and the discrimination sensor killed 72 of 81 behavior-level mutants/probes. The verdict is FAIL for one reason that blocks "done": the Build gate `yarn --cwd web test` is not reliably green. It failed in 3 of 5 full-suite runs (and once in a clean worktree baseline with no mutation), always on tests that exercise the new `DatePicker` through the shared helper `pickDate`. That is a measurable performance-under-parallelism problem in the tests (about 1.5 s per calendar dropdown change in jsdom), not a code defect. A second, smaller race (real 300 ms search debounce against fixed sleeps and 1 s `waitFor` windows) makes a neighbouring test fail under machine load. Both have deterministic fixes below (no timeout increase). The 8 surviving mutants (plus one probe that cannot be tested by design) are weak assertions or an untested AC (OpenAPI), listed as fix tasks 4-8.

**Iteration**: 1
**Date**: 2026-10-05
**Spec**: `.specs/features/transactions-ux/spec.md` (also `design.md`, `tasks.md`, `.specs/STATE.md` AD-001..AD-005, `.specs/LESSONS.md` L-001..L-018)
**Diff range**: `8b124b3..HEAD`, 11 feature commits (T1 `a1fffc7` .. T11 `ef0e76b`), branch `feat/transactions-ux`, `HEAD` = `ef0e76b`.
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in temporary git worktrees on the external volume (`/Volumes/MacOnlySSD/dev/personal/.verify-tux`, `.verify-tux-w1`, `.verify-tux-w2`, all removed; `git worktree list` shows only the real tree). Database probes ran inside rolled-back psql transactions on the local stack. No `db:reset`, no hosted Supabase, no Vercel, no `git stash`.

## Scope

- API: `supabase/migrations/0007_transactions_description.sql`, `api/src/modules/transactions/{routes,schema}.ts`, `api/src/plugins/swagger.ts`, `api/src/app.ts`, `api/openapi.json`, tests `api/test/transactions.int.test.ts` and `api/test/transactions-schema.int.test.ts`.
- Web: `web/src/lib/notify.ts`, `web/src/routes/__root.tsx`, `web/src/components/ui/date-picker{,-utils}.ts(x)`, `web/src/features/transactions/{TransactionsPage,TransactionForm,utils}.ts(x)`, `web/src/lib/api/{types.ts,mock/transactions.ts}`, `web/src/test/datePicker.ts` and the transaction/notify/date-picker/mock tests.

Test file legend (basenames in the evidence tables): API tests are in `api/test/`; web tests are in `web/src/features/transactions/` unless a path is shown (`notify.test.tsx` is `web/src/lib/`, `date-picker.test.tsx` is `web/src/components/ui/`, `mock/transactions.test.ts` is `web/src/lib/api/`).

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1). 64 boxes are ticked and 0 are unticked (`grep -c "^- \[ \]"` returns 0). One commit per task, subjects match the `Commit:` lines.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 notify helper and Toaster | ✅ Done | `a1fffc7` | - |
| T2 DatePicker | ✅ Done | `0281f91` | - |
| T3 filters use DatePicker, Tipo column removed | ✅ Done | `35f7213` | - |
| T4 quick month and year filter | ✅ Done | `a6deb24` | - |
| T5 toasts replace the action alert | ✅ Done | `f006ac0` | - |
| T6 form uses DatePicker and toasts | ✅ Done | `35b2131` | - |
| T7 migration 0007 | ✅ Done | `c783f7a` | - |
| T8 API description | ✅ Done | `53e9f57` | - |
| T9 web types and mock | ✅ Done | `649b515` | - |
| T10 description in the extrato | ✅ Done | `7c07284` | - |
| T11 description in the edit modal | ✅ Done | `ef0e76b` | - |

Process notes (cosmetic, non-blocking): `tasks.md` line 12 still says `**Status**: Draft`; `spec.md` traceability still shows TUX-01..TUX-10 "Pending" (see the traceability table at the end).

---

## Spec-Anchored Acceptance Criteria

### P1: Feedback por toast nas ações do extrato (TUX-03, TUX-04)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. `<Toaster />` mounted once in the root layout | exactly one Notifications region | `notify.test.tsx:69` `expect(screen.getAllByRole("region", { name: /Notifications/ })).toHaveLength(1)` | ✅ PASS (mutants W25 removed it, W26 doubled it: both killed) |
| 2. Toasts only through `notify`, success fixed text, error from `messageForError` | `toast.success("Transação criada")`; error text from the code map | `notify.test.tsx:33` `toHaveBeenCalledExactlyOnceWith("Transação criada")`; `:39` mapped `not_found` text; `:47` context `account` | ✅ PASS |
| 3. Unknown code / network / non-ApiError shows the generic text | "Não foi possível concluir a operação. Tente novamente." | `notify.test.tsx:56` `toEqual([[GENERIC_ERROR] x4])` (unknown code, `TypeError`, string, `undefined`) and `:51` `GENERIC_ERROR` literal | ✅ PASS |
| 4. Bulk apply: singular for 1, plural for N | "Categoria aplicada a 1 transação" / "... a N transações" | `extratoInline.test.tsx:177` `"Categoria aplicada a 1 transação"`; `:156` `"Categoria aplicada a 2 transações"` | ✅ PASS |
| 5. Bulk failure: error toast, selection and categories kept | mapped error toast; `2 selecionada(s)` still shown; old categories | `extratoInline.test.tsx:200` `toHaveBeenCalledExactlyOnceWith("Registro não encontrado. Atualize a página e tente de novo")`; `:208` `getByText("2 selecionada(s)")`; `:214` `toHaveTextContent(item.categoryName)` | ✅ PASS |
| 6. Row category saved: "Categoria atualizada" | exact text, no error | `extratoInline.test.tsx:89` `toHaveBeenCalledExactlyOnceWith("Categoria atualizada")` | ✅ PASS |
| 7. Row category failure: restore category and error toast | previous category back; error toast | `extratoInline.test.tsx:107` `toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR)`; `:112-116` category text restored; `:281` also when refetch fails | ✅ PASS (only the generic text is exercised for the row: survivor W12, fix task 4) |
| 8. Neutral switch failure: revert and error toast | switch back, error toast, no success toast on success | `extratoInline.test.tsx:254` `GENERIC_ERROR`; `:241` `expect(toast.success).not.toHaveBeenCalled()` on neutral success | ✅ PASS |
| 9. Edit concludes: dialog closes, "Transação atualizada" | exact text | `extratoCrud.test.tsx:150` and `:262` `toHaveBeenCalledExactlyOnceWith("Transação atualizada")` after `queryByRole("dialog")` is gone (`:149`, `:261`) | ✅ PASS |
| 10. Create concludes: dialog closes, "Transação criada" | exact text | `extratoCrud.test.tsx:113` `toHaveBeenCalledExactlyOnceWith("Transação criada")` after `:112` dialog gone | ✅ PASS |
| 11. Edit/create failure: dialog stays open, inline field error kept, error toast | dialog present, `field` error with id, toast | `extratoCrud.test.tsx:276-282` (`"Valor inválido"` toast, `#transaction-amount-error`, dialog present), `:293-296` (network, `role="alert"` form error), `:315-321` (edit, `#transaction-name-error`) | ✅ PASS |
| 12. Delete concludes: "Transação excluída" | exact text | `extratoCrud.test.tsx:77` `toHaveBeenCalledExactlyOnceWith("Transação excluída")` | ✅ PASS |
| 13. Delete failure: transaction kept, error toast | row still listed, toast | `transactions.test.tsx:367` `toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR)`; `:373` `getAllByText(deletedName).length > 0` | ✅ PASS |
| 14. No fixed `role="alert"` action banner | no alert in any flow | `extratoInline.test.tsx:92,109,205,256,303`; `transactions.test.tsx:353,370` `queryByRole("alert")` is absent | ✅ PASS |

### P1: DatePicker nos filtros e no formulário (TUX-01, TUX-05, TUX-06)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. DatePicker: `YYYY-MM-DD`/`""`, pt-BR popover, "Limpar" when value | value shown `dd/MM/yyyy`; Limpar only with a value | `date-picker.test.tsx:70` `getByRole("button", { name: "29/02/2028" })`; `:49` no Limpar when empty; `:53` Limpar with value | ✅ PASS |
| 2. Choosing a day: exact string, no time-zone shift | `onChange("2026-12-31")` | `date-picker.test.tsx:28` `toHaveBeenCalledExactlyOnceWith("2026-12-31")` in `America/Sao_Paulo` and `Pacific/Kiritimati` | ✅ PASS (W27 `toISOString` killed) |
| 3. Last day of month / first day of year | `2026-12-31`, `2027-01-01` | `date-picker.test.tsx:28`, `:40` `toHaveBeenCalledExactlyOnceWith("2027-01-01")`; `:112-113` `formatLocalDate` | ✅ PASS |
| 4. Limpar | `onChange("")` | `date-picker.test.tsx:54` `toHaveBeenCalledExactlyOnceWith("")` | ✅ PASS (W29 killed) |
| 5. Disabled: does not open, shows the value | no grid, `05/10/2026` | `date-picker.test.tsx:59-62` `toBeDisabled()`, `queryByRole("grid")` absent | ✅ PASS (W30 killed) |
| 6. Empty value shows "Selecione a data" | placeholder | `date-picker.test.tsx:68` `getByRole("button", { name: "Selecione a data" })` | ✅ PASS (W31 killed) |
| 7. First open: query without `from`/`to`, De/Até "Selecione a data" | first request `/transactions?sort=date&order=desc&page=1` | `extratoFilters.test.tsx:127` `expect(listPaths()[0]).toBe(DEFAULT_QUERY)`, `:128` no `from|to`, `:129-130` placeholders | ✅ PASS (W1 killed) |
| 8. "Limpar filtros": query without `from`/`to`, De/Até empty | back to default query | `extratoFilters.test.tsx:141` `toBe(DEFAULT_QUERY)`, `:142-143` placeholders | ✅ PASS |
| 9. Choosing De/Até: `from`/`to` equal to the string, page 1 | `from=2026-04-01`, `to=2026-12-31`, `page=1` after page 2 | `extratoFilters.test.tsx:85-86,92-94` | ✅ PASS (test is slow and flaky, fix task 1) |
| 10. Form: DatePicker in Data, `occurredAt` at local noon | `2026-12-31T15:00:00.000Z` in São Paulo | `extratoCrud.test.tsx:228` `expect(body.occurredAt).toBe("2026-12-31T15:00:00.000Z")`; `:107` | ✅ PASS (W23 noon to midnight killed) |
| 11. Create form opens with local today | `05/10/2026` at 23:30 São Paulo; recomputed on reopen | `extratoCrud.test.tsx:210` `toHaveTextContent("05/10/2026")`; `:218` `"06/10/2026"` after the clock moves | ✅ PASS (W21 `toISOString` and W22 frozen-at-load both killed) |
| 12. Submit without date: "Informe a data" | message in the field, no API call | `extratoCrud.test.tsx:241` `findByText("Informe a data")` with id `transaction-date-error`; `:245` no POST | ✅ PASS |

### P1: Extrato sem coluna Tipo e com filtro rápido (TUX-02, TUX-07)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. No Tipo header/cell, no Tipo field on the card | no header "Tipo", no Receita/Despesa cell, no `Tipo` in the card | `extratoFilters.test.tsx:149` `headers.some(/Tipo/)` false, `:153` cells; `:161` `within(card).queryByText("Tipo")` absent | ✅ PASS (W2, W3, W4 killed) |
| 2. Tipo filter queries `type`, page 1 | `type=Income` and `page=1` | `extratoFilters.test.tsx:81,92-94` | ✅ PASS (W5 killed) |
| 3. Quick month: `from` first day, `to` last day, page 1 | `from=2028-02-01&to=2028-02-29` | `extratoQuickMonth.test.tsx:109` `toBe(`${DEFAULT_QUERY}&from=2028-02-01&to=2028-02-29`)` | ✅ PASS for the range; ⚠️ "voltar à página 1" never exercised from page 2 (W38, fix task 5) |
| 4. February leap / common | `2028-02-29`, `2027-02-28` | `extratoQuickMonth.test.tsx:58-60` (also 2000, 2100), `:124` `from=2027-02-01&to=2027-02-28`, `:125-128` boundary rows in and out | ✅ PASS (W34 Feb always 28, W35, W36 killed) |
| 5. Pickers disabled and show the month | `01/02/2028`, `29/02/2028`, disabled | `extratoQuickMonth.test.tsx:110-113` | ✅ PASS (W42 killed) |
| 6. Only month or only year: no query, no change | no new list request, pickers enabled | `extratoQuickMonth.test.tsx:136,142` `toHaveLength(before)`; `:137-138,143-144` | ✅ PASS (W37 killed) |
| 7. "Limpar mês": off, `from`/`to` removed, page 1 | default query, pickers enabled, selects reset | `extratoQuickMonth.test.tsx:153` `toBe(DEFAULT_QUERY)`; `:154-157` | ✅ PASS for removal (W39 killed); ⚠️ page reset from page 2 not exercised (W40, fix task 5) |
| 8. "Limpar filtros" clears the quick filter and the rest | default query, selects reset | `extratoQuickMonth.test.tsx:168-172` | ✅ PASS (W41 killed) |
| 9. Date set while quick is active deactivates quick, keeps the date | `quick: {}`, new `to` kept | `extratoQuickMonth.test.tsx:80-86` on the pure `applyDateFilter`; the component wiring (`setQuick(next.quick)`) has no test | ⚠️ Spec-precision gap (SPG-3): unreachable in the UI because the pickers are disabled while quick is active; wiring mutant W43 survives |

### P1: Campo `description` somente leitura (TUX-08, TUX-09, TUX-10)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| 1. Migration adds nullable `description text`; check recreated with `Other` in a separate command | `is_nullable YES`, no default, type text | `transactions-schema.int.test.ts:128` `toMatchObject({ data_type: 'text', is_nullable: 'YES', column_default: null })`; migration lines 3 and 7-10 are separate statements | ✅ PASS (probe P1 killed) |
| 2. `Other` accepted, bogus value rejected | insert `Other` ok; `Bitcoin` fails on the named check | `transactions-schema.int.test.ts:139-141` `rejects.toThrow(/transactions_payment_method_check/)` after a successful `Other` insert | ✅ PASS (probes P2, P3 killed) |
| 3. `description` in every Transaction (list, create, edit) | `string | null` | `transactions.int.test.ts:75` create body `description: null`; `:288` list keys include `description`; `:1166` PATCH response | ✅ PASS (A12, A13, A19 killed) |
| 4. POST stores trimmed; blank/spaces/null stores null | `'PIX ENVIADO MARIA'` and `null` | `transactions.int.test.ts:1113-1117` (response, row in DB, list), `:1120-1131` it.each null/empty/spaces | ✅ PASS (A1, A2, A11 killed) |
| 5. POST omits description: null | null in response and row | `transactions.int.test.ts:1121` case `omitted` | ✅ PASS (A15, A16 killed) |
| 6. > 500 after trim: 422 on `description`, nothing created | `{ error: { code: 'validation_error', field: 'description' } }` | `transactions.int.test.ts:1143` `toEqual(...)`, `:1144` no row; `:1133-1138` 500 accepted with padding | ✅ PASS (A3..A8 killed) |
| 7. Non-text, non-null: 400 `validation_error` | 400 for number, object, boolean, array | `transactions.int.test.ts:1147-1156` it.each, `:1154` `toBe(400)` | ✅ PASS (A9, A10 killed) |
| 8. PATCH ignores description: 200, stored value kept, also with other fields | original text | `transactions.int.test.ts:1161-1167`, `:1168` stored value; `:1170-1175` null row | ✅ PASS (A14 killed) |
| 9. RLS isolation of description | other user sees nothing | `transactions.int.test.ts:1177-1185` (list empty, PATCH 404, text not leaked); `transactions-schema.int.test.ts:145-152` | ✅ PASS |
| 10. `openapi.json`: description in `Transaction` and POST body, not in PATCH body | document content | only `swagger.int.test.ts:51-52` `expect(committed).toEqual(exported)` (freshness); the document content is checked by hand: POST body, create/list/edit responses have `description`, PATCH body does not (`git diff api/openapi.json`) | ⚠️ NOT asserted: A17 (PATCH body gains `description`, document regenerated) and A18 survive (fix task 6) |
| 11. Extrato shows description below name, small, muted; nothing when null | `text-xs text-muted-foreground truncate`, same cell, after the name | `extratoDescription.test.tsx:35-40` (title attribute, classes, `closest("td")`, DOM order); `:55-57` no element and `nameCell.children` length 1 | ✅ PASS (W47, W48, W49, W58 killed) |
| 12. Modal: read-only subtitle under the title; no field; create shows nothing | `data-testid=transaction-description` in edit only | `extratoDescriptionForm.test.tsx:62` `toHaveTextContent(ORIGINAL)`, `:63-65` no field and no default subtitle, `:67` DOM order; `:73-74,80-82` default subtitle and no element when null and in create | ✅ PASS (W50 killed) |
| 13. `TransactionUpdate` and form body without `description` | key absent in PATCH and POST bodies | `extratoDescriptionForm.test.tsx:93,106` `not.toHaveProperty("description")`; type check (`web/src/lib/api/types.ts:53-54` only on `Transaction`) | ✅ PASS (W51 killed) |
| 14. Mock stores on create, returns on read, ignores on PATCH | trimmed, null for blank, original after PATCH | `mock/transactions.test.ts:481,493-495,505,511` | ✅ PASS (W52, W53, W54, W55 killed) |

**Status**: ⚠️ All ACs have evidence; AC TUX-09-10 is covered only by a freshness check (gap), TUX-07-3/7 do not prove the page reset, TUX-07-9 is only covered by a pure function. Four spec-precision gaps flagged (see below).

---

## Edge Cases

- [x] DatePicker with the browser time zone west or east of UTC returns the same day: `date-picker.test.tsx:21-43` (`America/Sao_Paulo`, `Pacific/Kiritimati`); W27 killed.
- [x] Invalid string treated as empty: `date-picker.test.tsx:75-81` (`abc`, `2026-13-01`, `2027-02-29`, `2026-1-5`, `05/10/2026`); W28 killed.
- [x] Quick filter active and page change keeps `from`/`to`: `extratoQuickMonth.test.tsx:185-189` `page=2&from=2028-02-01&to=2028-02-29`.
- [x] Network error or unknown code in any toast flow shows the generic text: `notify.test.tsx:56`, `extratoCrud.test.tsx:293`, `extratoInline.test.tsx:107,254,281,302`, `transactions.test.tsx:367` (helper-level proof covers all flows because every flow goes through `notifyError`).
- [x] Long description truncated to one line with the full text in `title`: `extratoDescription.test.tsx:35-36` (`truncate` class, `title`). jsdom cannot check the rendered clipping; checked in the browser (class `max-w-xs truncate text-xs text-muted-foreground`, `title` equal to the text).
- [x] Description with spaces in POST returned trimmed: `transactions.int.test.ts:1113`.
- [x] Exactly 500 characters after trimming accepted: `transactions.int.test.ts:1133-1138`.

---

## Gate Check

- **Gate commands** (Build level, tasks.md): `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`.
- **API**: typecheck clean (exit 0), lint clean (0 problems), unit 266 passed (15 files), integration 497 passed (38 files, 124 s) = 763 passed, 0 failed, 0 skipped. `swagger.int.test.ts` confirms `api/openapi.json` is up to date.
- **Web typecheck**: clean. **Web lint**: 0 errors, 7 warnings (`react-refresh/only-export-components` style warnings in files outside this diff).
- **Web test, full suite, default workers, 337 tests in 46 files**: 5 runs measured.

| Run | Result | Detail |
| --- | ------ | ------ |
| Real tree 1 | ❌ 1 failed / 336 passed | `extratoCrud.test.tsx:83` "cria pelo formulário..." 16392 ms (testTimeout 15 s), duration 55.1 s |
| Real tree 2 | ✅ 337 passed | 53.1 s |
| Real tree 3 | ✅ 337 passed | 52.0 s |
| Real tree 4 (verbose) | ❌ 1 failed / 336 passed | same test, 15691 ms; `extratoFilters.test.tsx:74` "cada filtro envia..." passed in 24765 ms of its own 30 s timeout |
| Clean worktree at HEAD (no mutation) | ❌ 1 failed / 336 passed | same test, 16730 ms |

Failure rate of the Build gate: 3 of 5 runs. No skipped tests.

**Flakiness judgement (measured, not guessed)**

1. `extratoCrud.test.tsx:83` "cria pelo formulário..." and `extratoCrud.test.tsx:220` "escolher um dia envia occurredAt...": 5.2 s and 4.6 s run alone. Profiling inside a scratch copy: `pickDate` (`web/src/test/datePicker.ts:19-33`) takes about 3.1-3.2 s of the 5.0 s, almost all in the two `fireEvent.change` calls on the year and month `<select>` (about 1.5 s each, a full re-render of the shadcn Calendar in jsdom); the day click is about 85 ms and the account select 145 ms. Under 8-way suite parallelism the same test takes 16-17 s and crosses the 15 s `testTimeout` set in `web/vitest.config.ts`. This is a real performance race between the helper and the timeout, not a logic defect, and it is the failure the author reported.
2. `extratoFilters.test.tsx:74` "cada filtro envia...": two `pickDate` calls plus four selects, 24.8 s unloaded-suite, 30.5-35 s under load against its explicit `30_000` (which also ignores a global `--testTimeout`). It failed on every one of the first 29 mutation runs executed at machine load 17-26, so it is the same root cause with less margin.
3. `extratoFilters.test.tsx:99` "'Limpar filtros' restaura a consulta padrão": a different race. Real 300 ms search debounce against `waitFor(() => expect(lastList()).toContain("q=Farm"))` (`:104`, default 1000 ms window) and a trailing `await sleep(400)` (`:112`). It failed alone, after about 5 s, in unrelated mutants (W9, W10, W12, W14, W21) at load 26 and passes in every quiet run. Same family: fixed real sleeps for the debounce at `extratoFilters.test.tsx:34` (`sleep(350)`), `extratoInline.test.tsx:123,170` and `transactions.test.tsx:339` (`setTimeout(resolve, 800)`), whose only purpose is to wait until the mount-time debounce has fired its `setFilters` (`TransactionsPage.tsx:83-94`), which in turn clears the selection (`TransactionsPage.tsx:95`). The code makes the race worse: the debounce effect runs on mount with an unchanged `q`, builds a new `filters` object, and therefore wipes any selection made in the first 300 ms.
4. `transactions.test.tsx:336` "emite o toast not_found...": same debounce family; it failed at 14 s in several loaded mutant runs.

Two deterministic fixes (no larger timeouts) are in Fix 1 and Fix 2.

**Test integrity**: test count before the feature (`8b124b3`, via `vitest list` in a throwaway worktree): web 287; API integration 395 listed (480 expanded) and API unit 266. After: web 337, API integration 497, unit 266. Delta: web +50, API +17, unit 0. No test was deleted. Assertions were changed, not weakened: every former alert/"Não foi possível salvar a categoria" assertion became an exact `toHaveBeenCalledExactlyOnceWith` on the toast plus `queryByRole("alert")` absent.

---

## Discrimination Sensor

**Sensor depth**: expanded (UI behavior plus a data-integrity column and constraint): 81 mutants/probes. All ran in throwaway worktrees (web 58 in two worktrees, API 19 in one) with symlinked `node_modules`, plus 4 rolled-back database probes. First-pass web results were re-verified: because the machine was at load 17-26 and the flaky tests above fail under load, a kill was accepted only when a non-flaky test failed; 10 kills that rested solely on flaky tests (W2, W12, W14, W19, W22, W38, W40, W41, W43, W45) were re-run in targeted, quiet runs (results below are the verified ones). Baseline of the real tree: `git status --porcelain` listed `?? .DS_Store`, `?? docs/v2/`, `?? references/nubank_extrato_setembro.csv`; identical at the end.

### API (19 mutants, 17 killed)

| ID | File | Mutation | Result |
| -- | ---- | -------- | ------ |
| A1 | `routes.ts` validDescription | no trim, blank kept | ✅ Killed (`transactions.int.test.ts:1110`, `:1120`) |
| A2 | `routes.ts` | blank stored as empty string | ✅ Killed (null cases `:1120`) |
| A3 | `routes.ts` | limit 500 to 501 | ✅ Killed (`:1140`) |
| A4 | `routes.ts` | limit 500 to 499 | ✅ Killed (`:1133`) |
| A5 | `routes.ts` | `>` to `>=` on the length | ✅ Killed (`:1133`) |
| A6 | `routes.ts` | limit applied to the untrimmed length | ✅ Killed (`:1133` padded 500) |
| A7 | `routes.ts` | over-limit status 422 to 400 | ✅ Killed (`:1140`) |
| A8 | `routes.ts` | over-limit `field` wrong | ✅ Killed (`:1143`) |
| A9 | `routes.ts` | type check removed (numbers coerced to text) | ✅ Killed (`:1147`) |
| A10 | `routes.ts` | type error status 400 to 422 | ✅ Killed (`:1147`) |
| A11 | `routes.ts` | INSERT writes `null` instead of the description | ✅ Killed (`:1110`) |
| A12 | `schema.ts` | SELECT returns `null as description` | ✅ Killed (`:1110`) |
| A13 | `schema.ts` | `toTransaction` returns `description: null` | ✅ Killed (`:1110`) |
| A14 | `routes.ts` | PATCH applies `description` | ✅ Killed (`:1159`, `:1170`) |
| A15 | `routes.ts` | omitted description becomes a default text | ✅ Killed (`:75`, `:1120`) |
| A16 | `routes.ts` | omitted description rejected | ✅ Killed (create tests) |
| A17 | `routes.ts` UpdateBody | PATCH body documents `description` (openapi regenerated) | ❌ Survived, fix task 6 |
| A18 | `routes.ts` CreateBody | description loses `nullable` in the document (openapi regenerated) | ❌ Survived, fix task 6 |
| A19 | `schema.ts` | `Transaction.description` non-null in the response schema | ✅ Killed (serialization of `null`, `:75`) |

### DB objects (4 probes, rolled-back psql transactions on the local stack)

| ID | Probe | Result |
| -- | ----- | ------ |
| P1 | column recreated as `text not null default ''`: information_schema shows `NO`, `''::text` against the test's `is_nullable 'YES'`, `column_default null` | ✅ Killed (`transactions-schema.int.test.ts:128`) |
| P2 | check without `'Other'`: inserting `Other` fails with `transactions_payment_method_check` | ✅ Killed (`:139`) |
| P3 | check dropped: `Bitcoin` is accepted | ✅ Killed (`:140` expects the rejection) |
| P6 | migration backfills `description = name` for existing rows; a freshly inserted row is still null | ❌ Survived by design: tests run after the migration, so "existing rows stay null" cannot be asserted post hoc. Not a fix task; the spec does not state it as an AC (note only) |

### Web (58 mutants, 52 killed, 6 survived)

| ID | File | Mutation | Result |
| -- | ---- | -------- | ------ |
| W1 | `TransactionsPage.tsx` | initial filters include `from` | ✅ Killed |
| W2 | `TransactionsPage.tsx` | Tipo header back (re-run quiet) | ✅ Killed (`extratoFilters.test.tsx:149`) |
| W3 | `TransactionsPage.tsx` | Tipo cell back | ✅ Killed |
| W4 | `TransactionsPage.tsx` | mobile card Tipo field back | ✅ Killed |
| W5 | `TransactionsPage.tsx` | Tipo filter no-op | ✅ Killed |
| W6 | `TransactionsPage.tsx` | bulk singular/plural swapped | ✅ Killed |
| W7 | `TransactionsPage.tsx` | bulk plural text misspelled | ✅ Killed |
| W8 | `TransactionsPage.tsx` | bulk error toast removed | ✅ Killed |
| W9 | `TransactionsPage.tsx` | selection cleared even on bulk failure | ✅ Killed (`extratoInline.test.tsx:182`) |
| W10 | `TransactionsPage.tsx` | success toast also on neutral change | ✅ Killed (`:241`) |
| W11 | `TransactionsPage.tsx` | no success toast on category change | ✅ Killed |
| W12 | `TransactionsPage.tsx` | row category failure toast loses the real error (`notifyError("x")`) | ❌ Survived (re-run quiet): fix task 4 |
| W13 | `TransactionsPage.tsx` | no delete success toast | ✅ Killed |
| W14 | `TransactionsPage.tsx` | delete failure closes the confirm dialog | ❌ Survived (re-run quiet): fix task 7 |
| W15 | `TransactionsPage.tsx` | no delete error toast | ✅ Killed |
| W16 | `TransactionsPage.tsx` | delete success text changed | ✅ Killed |
| W17 | `TransactionForm.tsx` | no error toast (re-run after fixing the patch) | ✅ Killed (`extratoCrud.test.tsx:276,293,315`) |
| W18 | `TransactionForm.tsx` | dialog not closed on success | ✅ Killed |
| W19 | `TransactionForm.tsx` | dialog closes on failure (re-run quiet) | ✅ Killed (`extratoCrud.test.tsx:266,286,299`) |
| W20 | `TransactionForm.tsx` | inline field error dropped | ✅ Killed |
| W21 | `TransactionForm.tsx` | default date via `toISOString` | ✅ Killed (`extratoCrud.test.tsx:205`) |
| W22 | `TransactionForm.tsx` | default date frozen at module load (verified manually) | ✅ Killed (`extratoCrud.test.tsx:218`) |
| W23 | `TransactionForm.tsx` | local noon to midnight | ✅ Killed |
| W24 | `TransactionForm.tsx` | edit/create toast text swapped | ✅ Killed |
| W25 | `__root.tsx` | Toaster removed | ✅ Killed |
| W26 | `__root.tsx` | Toaster mounted twice | ✅ Killed |
| W27 | `date-picker-utils.ts` | `formatLocalDate` via `toISOString` | ✅ Killed (Kiritimati zone) |
| W28 | `date-picker-utils.ts` | no rollover check in `parseLocalDate` | ✅ Killed |
| W29 | `date-picker.tsx` | Limpar does not call `onChange` | ✅ Killed |
| W30 | `date-picker.tsx` | `disabled` ignored | ✅ Killed |
| W31 | `date-picker.tsx` | placeholder text changed | ✅ Killed |
| W32 | `date-picker.tsx` | popover stays open after a pick | ✅ Killed |
| W33 | `date-picker.tsx` | Limpar shown without a value | ✅ Killed |
| W34 | `utils.ts` | February always 28 | ✅ Killed |
| W35 | `utils.ts` | `from` day 02 | ✅ Killed |
| W36 | `utils.ts` | 31-day months capped to 30 | ✅ Killed |
| W37 | `TransactionsPage.tsx` | quick filter queries with only one part chosen | ✅ Killed |
| W38 | `TransactionsPage.tsx` | quick filter does not reset the page | ❌ Survived (re-run quiet): fix task 5 |
| W39 | `TransactionsPage.tsx` | "Limpar mês" keeps `to` | ✅ Killed |
| W40 | `TransactionsPage.tsx` | "Limpar mês" does not reset the page | ❌ Survived (re-run quiet): fix task 5 |
| W41 | `TransactionsPage.tsx` | "Limpar filtros" keeps the quick filter (re-run quiet) | ✅ Killed (`extratoQuickMonth.test.tsx:160`) |
| W42 | `TransactionsPage.tsx` | pickers never disabled | ✅ Killed |
| W43 | `TransactionsPage.tsx` | `changeDate` does not turn quick off | ❌ Survived (re-run quiet): unreachable in the UI, fix task 8 |
| W44 | `utils.ts` | `applyDateFilter` keeps the page | ✅ Killed |
| W45 | `TransactionsPage.tsx` | year options start at current - 4 (re-run quiet) | ❌ Survived: fix task 5 |
| W46 | `TransactionsPage.tsx` | year options end at current (length 6) | ✅ Killed (2028 chosen with the clock at 2027) |
| W47 | `TransactionsPage.tsx` | description element rendered for `null` | ✅ Killed |
| W48 | `TransactionsPage.tsx` | description `title` removed | ✅ Killed |
| W49 | `TransactionsPage.tsx` | description not truncated | ✅ Killed |
| W50 | `TransactionForm.tsx` | modal subtitle element also when description is `null` | ✅ Killed |
| W51 | `TransactionForm.tsx` | form sends `description` | ✅ Killed |
| W52 | `mock/transactions.ts` | mock PATCH applies description | ✅ Killed |
| W53 | `mock/transactions.ts` | mock create does not trim | ✅ Killed |
| W54 | `mock/transactions.ts` | mock create drops description | ✅ Killed |
| W55 | `mock/transactions.ts` | mock seed without descriptions | ✅ Killed |
| W56 | `notify.ts` | error toast uses the API `message` | ✅ Killed |
| W57 | `notify.ts` | `toast.message` instead of `toast.success` | ✅ Killed |
| W58 | `TransactionsPage.tsx` | mobile card description removed | ✅ Killed |

**Result**: 72/81 killed (17/19 API, 3/4 DB, 52/58 web). Survivors: A17, A18 (OpenAPI document not asserted), P6 (not testable, by design), W12, W14, W38, W40, W43 and W45 (weak assertions). None is on a data-integrity or authorization path; every API validation branch, every money/data column rule and the PATCH-ignores-description rule are killed. Verdict impact: FAIL is driven by the gate, not by the survivors.

---

## Browser Check (local stack, dev front `http://localhost:8080`, API `:3001`)

Done in the already authenticated Browser pane (session `Teste`); no credential was typed or read by the Verifier. All facts below come from DOM inspection and the browser network log; I created two rows through the UI/API and deleted both through the UI at the end.

- **Empty initial De/Até**: on first load of `/extrato` both triggers read "Selecione a data"; no `input[type=date]` exists; first request is `.../transactions?sort=date&order=desc&page=1`. No Tipo column (headers: Data, Nome, Conta, Categoria, Método de pagamento, Valor, Neutra, Observações, Ações) and no Tipo field; the Tipo filter remains.
- **DatePicker inside the transaction dialog**: popover is portaled outside the dialog, both at `z-index: 50` but later in the DOM, so it paints on top: `elementFromPoint` at a day button returns that button. Focus moves into the popover (first focus: the previous-month button), picking a day sets `15/10/2026`, closes the popover and returns focus to the trigger (`#transaction-date`), the dialog stays open. A real Escape closes the popover only; the dialog stays open and focus returns to the trigger. Editing a row opens the calendar on the stored month (`fevereiro 2028`).
- **Toasts**: create "Transação criada" (success), row category change "Categoria atualizada", edit "Transação atualizada", delete "Transação excluída" (twice). Forced delete failure (page `fetch` rejected for `DELETE`): error toast "Não foi possível concluir a operação. Tente novamente.", the confirm dialog stays open, the row stays, no `role="alert"` banner.
- **Quick month filter**: month "Fevereiro" + year "2024" (a leap year) issued `from=2024-02-01&to=2024-02-29` (network log), pickers disabled showing `01/02/2024` and `29/02/2024`; "Limpar mês" re-enabled the pickers and reset both selects. The year list offered 2021..2027 (see SPG-1: February 2028 from the spec cannot be chosen with the real clock).
- **Description (real API)**: POST with `"  PIX ENVIADO ... "` returned the trimmed text; PATCH with another `description` plus the same name returned 200 and the original text. The extrato shows it under the name (`max-w-xs truncate text-xs text-muted-foreground`, `title` equal to the full text); the edit modal shows it as the subtitle with no input for it; a row without description keeps "Preencha os dados do lançamento.".
- **Finding (minor, no test)**: the calendar navigation buttons still carry English accessible names ("Go to the Previous Month"), although the month/year dropdown labels are pt-BR (SPG-4).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ one helper, one component, pure functions only where tested |
| Surgical changes | ✅ only transactions, shared date picker/notify, root layout, swagger keyword and the migration touched |
| No scope creep | ✅ `description` is read-only; import and colors left out as specified |
| Matches patterns | ✅ `AppError` 422/400 split, `optionalText`, `messageForError` path reused |
| Spec-anchored outcome check (asserted values match spec) | ✅ exact toast texts and `YYYY-MM-DD` strings asserted; gaps in the table above |
| Per-layer Coverage Expectation (domain 1:1 ACs; routes happy+edge+error) | ⚠️ web and API met; OpenAPI content AC (TUX-09-10) has no assertion |
| Every test maps to a spec requirement - no unclaimed tests | ✅ |
| Documented guidelines followed | ✅ none beyond configs (tasks.md); L-013 (assert the Portuguese text on failure paths) followed |
| Tests deterministic under parallel load | ❌ see Gate Check and Fix 1, Fix 2 |

---

## Fix Plans (ranked)

### Fix 1 (Major, blocks the gate): `pickDate` is too slow and the DatePicker tests flake

- **Root cause**: `web/src/test/datePicker.ts:22-25` navigates with two `fireEvent.change` calls on the Calendar year/month dropdowns; each re-renders the Calendar and costs about 1.5 s in jsdom (measured: 3.2 s of 5.0 s in `extratoCrud.test.tsx:83`). With 8 workers the test takes 16-17 s against the 15 s `testTimeout`; `extratoFilters.test.tsx:74` (30 s own timeout) takes 24-35 s.
- **Fix task**: make `pickDate` need zero dropdown changes. Pick the day in the month the calendar already shows: pass the month under test through the clock (`vi.useFakeTimers({ shouldAdvanceTime: true, now })` with `now` in the target month, as `extratoQuickMonth.test.tsx:17` already does) or render the picker from a value in that month, and use only the day click. Keep one dedicated test (in `date-picker.test.tsx`) that exercises the year/month dropdowns, so the dropdown path is still covered. Do not raise any timeout.
- **Where**: `web/src/test/datePicker.ts`, `web/src/features/transactions/extratoCrud.test.tsx:83,220`, `web/src/features/transactions/extratoFilters.test.tsx:74-97,133-144`, `web/src/features/transactions/transactions.test.tsx` (`setPeriod`).
- **Verify**: `yarn --cwd web test` five times in a row, all green; each `pickDate` call under 500 ms; the slowest test in the verbose report under 8 s.
- **Priority**: Major (Build gate).

### Fix 2 (Major): remove the debounce race (fake timers, and stop the mount-time selection reset)

- **Root cause**: real 300 ms debounce against fixed sleeps and `waitFor` windows (`extratoFilters.test.tsx:34,104,112`; `extratoInline.test.tsx:123,170`; `transactions.test.tsx:339`). The debounce also runs on mount and rewrites `filters` even when `q` did not change, which clears the selection (`TransactionsPage.tsx:83-95`).
- **Fix task**: (a) code: in the debounce `setFilters`, return `current` unchanged when `(current.q ?? "") === query` and the page is already 1 (no new object, so no selection reset and no wasted render); (b) tests: replace every `sleep(350)`/`setTimeout(resolve, 800)`/`sleep(400)` with fake timers (`vi.useFakeTimers({ shouldAdvanceTime: true })` and `await act(() => vi.advanceTimersByTimeAsync(350))`, the pattern of `extratoFilters.test.tsx:54-72`) or by awaiting the request through `apiSpy` (`requests`), and make the "Farm" and "Limpar filtros" test (`extratoFilters.test.tsx:99-114`) advance the debounce explicitly instead of `waitFor` over real time. With (a) the 800 ms sleeps in the bulk-apply tests become unnecessary.
- **Verify**: `yarn --cwd web test` five times green, run once more with another CPU-bound process running; add a test that a selection made right after load survives the debounce.
- **Priority**: Major (flaky gate, plus a small user-visible defect: rows selected in the first 300 ms lose their selection).

### Fix 4 (Minor): assert the mapped error text on the row category and neutral failures (W12)

- **Root cause**: `extratoInline.test.tsx:95-118,245-262` only force a generic `new Error("boom")`, so a regression that stops passing the real error to `messageForError` is invisible.
- **Fix task**: add a row-category failure with `new ApiError("not_found", "x", 404)` and assert `toast.error` called with "Registro não encontrado. Atualize a página e tente de novo"; same for the neutral switch.
- **Priority**: Minor.

### Fix 5 (Minor): quick-filter assertions (W38, W40, W45)

- **Root cause**: every quick-filter test starts on page 1 (`extratoQuickMonth.test.tsx:105-201`), so "volta à página 1" is not proven for the quick filter or for "Limpar mês"; the year option list is never asserted.
- **Fix task**: go to page 2 first (`Próxima`), then choose month and year, and assert `page=1` and no `page=2` in the last query; repeat for "Limpar mês"; open the Ano select with the clock at 2027 and assert the options are exactly 2022..2028.
- **Priority**: Minor.

### Fix 6 (Minor, spec AC TUX-09-10): assert the OpenAPI document content (A17, A18)

- **Root cause**: `swagger.int.test.ts:51-52` only compares the committed file with a fresh export, so a regenerated document that adds `description` to the PATCH body, or drops its type, passes.
- **Fix task**: in `api/test/swagger.int.test.ts` read `GET /docs/json` and assert: `description` is `{ type: 'string', nullable: true }` in the POST request body schema and is listed in `required` of the `Transaction` response; the PATCH request body schema has no `description` property.
- **Priority**: Minor (spec-defined outcome without a test).

### Fix 7 (Minor, needs a spec decision): delete failure dialog state (W14)

- **Root cause**: the spec only says the transaction stays in the list and an error toast is emitted; it is silent on the confirm dialog (it stays open today, as observed in the browser) and no test pins it.
- **Fix task**: decide and state it in the spec (recommended: "the confirm dialog stays open so the user can retry"), then add `expect(screen.getByRole("alertdialog")).toBeInTheDocument()` to `transactions.test.tsx:357-375`.
- **Priority**: Minor.

### Fix 8 (Low): wiring of "date chosen turns quick off" (W43)

- **Root cause**: `changeDate` (`TransactionsPage.tsx:107-111`) must call both `setFilters` and `setQuick`; the pure function is tested, the wiring is not, and the UI cannot reach it (pickers are disabled while quick is active).
- **Fix task**: hold `{ filters, quick }` in one `useState` and let `applyDateFilter`, `changeQuick` and `clearQuick` return the whole next state, so the two cannot diverge; or add a component test that renders with the pickers enabled through an exported handler.
- **Priority**: Low.

---

## Spec-Precision Gaps

| ID | Where | Gap |
| -- | ----- | --- |
| SPG-1 | Assumptions "Filtro rápido: ativação", Independent Test and Success Criteria | The year list is "ano atual menos 5 até ano atual mais 1" but the example and the success criterion use February 2028. With the real clock (2026) the list ends at 2027, so "Fevereiro e 2028" cannot be chosen; the unit tests hide this with a fake clock at 2027. Use a leap year inside the range (2024) in the criterion, or state the test clock. |
| SPG-2 | TUX-04-13 | Silent on whether the delete confirm dialog stays open on failure (see Fix 7). |
| SPG-3 | TUX-07-9 | Observable only through a pure function because the pickers are disabled while quick is active (see Fix 8). |
| SPG-4 | Assumptions "Exibição do DatePicker" | "Calendar em pt-BR" does not say whether the navigation button names are localized; they remain English in the browser ("Go to the Previous Month"). Specify `labelPrevious`/`labelNext` in pt-BR or exclude them. |
| SPG-5 | TUX-04-9/10 and Assumptions "Toast de sucesso do formulário" | "Emitido depois que o diálogo fecha" is an ordering that no test (and no observable effect) distinguishes. |

---

## Isolation Proof

Baseline `git status --porcelain` before the sensor: `?? .DS_Store`, `?? docs/v2/`, `?? references/nubank_extrato_setembro.csv`. After removing the three worktrees (`git worktree remove --force`, `git worktree prune`), the output is identical (`diff` of the two files reports no difference), `git worktree list` shows only `/Volumes/MacOnlySSD/dev/personal/financials`, `/Volumes/MacOnlySSD/dev/personal/` contains only `financials`, and `api/node_modules` and `web/node_modules` are intact. Database probes were rolled back (`after` count of probe rows 0).

---

## Requirement Traceability Update (suggested; spec.md not edited by the Verifier)

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| TUX-01 | Pending | ✅ Verified (De/Até empty, first query without dates; browser confirmed) |
| TUX-02 | Pending | ✅ Verified |
| TUX-03 | Pending | ✅ Verified |
| TUX-04 | Pending | ✅ Verified (Fix 4 and Fix 7 are strengthening only) |
| TUX-05 | Pending | ✅ Verified |
| TUX-06 | Pending | ✅ Verified |
| TUX-07 | Pending | ⚠️ Verified with gaps (page reset, year range, wiring: Fix 5, Fix 8) |
| TUX-08 | Pending | ✅ Verified |
| TUX-09 | Pending | ⚠️ Verified with a gap (OpenAPI content: Fix 6) |
| TUX-10 | Pending | ✅ Verified |

---

## Summary

**Overall**: ❌ Not Ready (gate unreliable); functionally complete.

**Spec-anchored check**: 10/10 requirements with evidence; 4 spec-precision gaps plus 1 minor (SPG-1..SPG-5); TUX-09-10 asserted only by a freshness check.
**Sensor**: 72/81 killed (A17, A18, W12, W14, W38, W40, W43, W45 survived; P6 not testable by design).
**Gate**: API 763 passed, 0 failed; web typecheck and lint clean; web test 337 tests, failed 3 of 5 full runs on a timeout in `extratoCrud.test.tsx:83`.

**What works**: all five toast flows with exact texts and error fallbacks, DatePicker string/time-zone behavior, empty initial filters, Tipo column removal, month ranges, form default date at 23:30, migration 0007, API description rules (trim, blank, 500/501, type, PATCH ignored), description in extrato and modal, RLS isolation. Confirmed in the browser against the local API.

**Issues found**: gate flakiness from `pickDate` cost and the debounce race (Fix 1, Fix 2); six weak or missing assertions (Fix 4-8); five spec-precision gaps.

**Next steps**: implement Fix 1 and Fix 2 (Fix 3 intentionally unused), then Fix 4-6 (cheap), decide Fix 7 and Fix 8, re-run the Verifier (iteration 2).

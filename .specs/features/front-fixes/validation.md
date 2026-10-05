# Validation: front-fixes (web T1-T12), iteration 1 - FAIL

**Verdict**: FAIL

The product code meets every spec AC and the gates are green: web 132 passed in 20 files (77 in 16 files before the feature, +55), typecheck clean, lint 0 errors, 0 skips. The FAIL comes from the discrimination sensor: 29 mutations, 26 killed, 3 survived. One survivor is equivalent (M14). Two are real holes in tests the spec asks for:

1. **M17** - "Limpar filtros" that keeps the current page survives. FIX-05 AC5 says "Limpar filtros SHALL restaurar o padrão", but every clear in the suite starts from page 1, or from a search whose debounce resets the page anyway.
2. **M23** - routing `holder_required` to the nickname error instead of the holder field survives. The test checks only that the text appears somewhere (FIX-01 AC5 field association, T2 Done-when).

Both fixes only add assertions to existing tests. No product code changes are needed.

**Iteration**: 1 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/front-fixes/spec.md`
**Diff range**: `050949a^..HEAD` (docs commit `050949a`, then T1-T12 as `aa1c07c`..`6968f86`). `HEAD` = `6968f86bef23c05b98671e56361bf959e5443d8b`, branch `feat/front-fixes`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-ff`, with `web/node_modules` symlinked). That worktree is now removed and pruned.

## Scope

In scope: `web/src/lib/api/errorMessages.ts` (+test), `web/src/lib/api/types.ts`, `web/src/lib/api/mock/transactions.ts`, `web/src/features/{accounts,categories,transactions,auth,import}` changed files, `web/src/test/apiSpy.tsx`, the three `extrato*.test.tsx` files, `web/yarn.lock`.

Classification key: (a) covered by tests in this diff; (b) verified by a non-test artifact; (c) deferred; GAP = no evidence.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown`, 12 task headings and 0 unchecked boxes.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 shared module | ✅ | `aa1c07c` | - |
| T2 accounts | ✅ | `ca5dd9d` | Holder-field routing is not discriminated (M23) |
| T3 categories | ✅ | `0f6a29c` | - |
| T4 transactions screens | ✅ | `7243089` | - |
| T5 null on edit | ✅ | `4587075` | - |
| T6 e-mail detection | ✅ | `fbbf475` | - |
| T7 inverted period | ✅ | `7ab7195` | - |
| T8 income green | ✅ | `ab00adc` | - |
| T9 inline/bulk/neutral tests | ✅ | `722070a` | The neutral failure test asserts only `role="alert"`, not the text |
| T10 filters tests | ✅ | `2dfd203` | Clear filters from page 2 is not tested (M17) |
| T11 CRUD tests | ✅ | `ce8a489` | - |
| T12 lockfile | ✅ | `6968f86` | - |

Process notes:
- Commit subjects are 39-67 chars, all ≤ 72.
- The `Commit:` lines in tasks.md say `feat(front-fixes): ...`. The real commits use `feat(web)`, `test(web)` and `build(web)`. This is cosmetic.
- The Gate Check Commands and Test Coverage Matrix in tasks.md still say `pnpm -C web ...`. The project uses yarn (`yarn --cwd web ...`). This is a stale template.
- The Phase 2 execution graph lists `T7 → T8` and omits T6. T7 "Depends on: T5" crosses phases. Both are cosmetic.
- `.specs/STATE.md` has no entry for this feature. The scope decisions in "Code quality" below are not recorded as decisions.

---

## Spec-Anchored Acceptance Criteria

### FIX-01: Error messages in Portuguese (P1)

| AC | Spec-defined outcome | Evidence (`file:line` + assertion) | Class | Result |
| -- | -------------------- | ---------------------------------- | ----- | ------ |
| 1. One module, never the API `message` | No API text in any result | `web/src/lib/api/errorMessages.test.ts:51` - `expect(messageForError(api(code), "account")).not.toContain("Technical English")` for known, unknown and `internal_error` codes. UI level: `web/src/features/transactions/transactions.test.tsx:325` `expect(screen.queryByText("Kaboom")).not.toBeInTheDocument()`, `:342` (`Missing ids`), `:353` (`DB down`), `web/src/features/categories/categories.test.tsx:109-110,120,141`, `web/src/features/accounts/accounts.test.tsx:111`. Non-test: the grep below finds no UI read of `.message` | a + b | ✅ |
| 2. `duplicate_name` by context | account "Já existe uma conta com esse apelido"; category "Já existe uma categoria com esse nome" | `web/src/lib/api/errorMessages.test.ts:10-15` `toBe(...)` for both contexts. Screens: `web/src/features/accounts/accounts.test.tsx:146` `findByText("Já existe uma conta com esse apelido")`, `web/src/features/categories/categories.test.tsx:103` `findByText("Já existe uma categoria com esse nome")` | a | ✅ |
| 3. Text for each listed code | "a mensagem definida para ele" (texts not fixed in spec) | `web/src/lib/api/errorMessages.test.ts:20-32` `it.each` over the 9 codes, `toBe(text)`. Screens: `transactions.test.tsx:287` (invalid_amount), `:299` (invalid_account), `:308` (validation_error), `:318` (unauthorized), `:339` (not_found bulk); `categories.test.tsx:108` (category_protected), `:133` reassign dialog opens; `accounts.test.tsx:149` (holder_required) | a | ✅ ⚠️ spec-precision gap 1 |
| 4. Unknown / network / other → generic | "Não foi possível concluir a operação. Tente novamente." | `web/src/lib/api/errorMessages.test.ts:34-38` `toBe(GENERIC_ERROR)` for unknown code, `TypeError("Failed to fetch")`, string, undefined. Screens: `transactions.test.tsx:324`, `:352`; `categories.test.tsx:119`; `accounts.test.tsx:110` | a | ✅ |
| 5. `field` → message on that field | Shown on the matching field when the form has it | `web/src/features/transactions/transactions.test.tsx:288` `toHaveAttribute("id", "transaction-amount-error")`, `:299-302` `transaction-account-error`, `:308-311` `transaction-date-error` (occurredAt → date). `web/src/lib/api/errorMessages.test.ts:59-67` for `fieldForError`. **Accounts**: `accounts.test.tsx:149` asserts only the text, not the holder field (M23 survived) | a (partial) | ⚠️ weak for accounts (Gap 2) |
| 6. Map used in accounts, categories, statement (form, inline, bulk, delete, neutral) | Every path shows Portuguese | Form `transactions.test.tsx:280-326`; inline category `web/src/features/transactions/extratoInline.test.tsx:95` `findByText("Não foi possível salvar a categoria")`; bulk `extratoInline.test.tsx:160-162` and `transactions.test.tsx:339`; delete `transactions.test.tsx:352`; neutral `extratoInline.test.tsx:209` `findByRole("alert")` (**text not asserted**); accounts `accounts.test.tsx:110`; categories `categories.test.tsx:97-143` | a | ✅ (neutral text weak, Gap 3) |

Non-test check for AC1 (`grep -rnE "error\.message|reason\.message|\.message" web/src/features web/src/lib --include='*.ts' --include='*.tsx'`, non-test files). It finds 4 hits, and none of them puts API text on screen:
- `web/src/lib/api/client.ts:26` checks the payload shape. `:69` stores the API message inside `ApiError`. Nothing in the UI reads it now.
- `web/src/lib/lovable-error-reporting.ts:51` sends telemetry to the editor hook. It is not UI.
- `web/src/lib/error-capture.ts:28` builds a diagnostic string from the stack. It is not UI.

### FIX-02: Editing clears notes and receipt (P1)

API contract check: `api/src/modules/transactions/routes.ts:59-60` uses `notes`/`receipt: Type.Optional(nullableString)`, where `nullableString = Union[String, Null]` (`:33`). `optionalText` (`:137-140`) turns blank text into `null`. So the API accepts `null`, and blank text also clears.

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Emptying notes on edit | Body `notes: null`; transaction shown without notes | `web/src/features/transactions/transactions.test.tsx:385` `toHaveProperty("notes", null)` and `:391` stored `notes` `toBeNull()`. Screen: `web/src/features/transactions/extratoCrud.test.tsx:115-118` `toMatchObject({ notes: null, ... })`, `:129` `queryByText("Nota antiga")).not.toBeInTheDocument()` | a | ✅ |
| 2. Emptying receipt on edit | `receipt: null` | `transactions.test.tsx:400` `toHaveProperty("receipt", null)` | a | ✅ |
| 3. Create with empty notes/receipt | Fields omitted | `transactions.test.tsx:446-447` `not.toHaveProperty("notes")`, `not.toHaveProperty("receipt")` (notes typed as spaces) | a | ✅ |
| 4. Filled values trimmed | Trimmed text | `transactions.test.tsx:415-418` `toMatchObject({ notes: "nova nota", receipt: "https://exemplo.com/novo.pdf" })` from padded input | a | ✅ |

### FIX-03: Sign-up with an e-mail already in use (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `user_already_exists` | Registered | `web/src/features/auth/emailExists.test.ts:26-32` `.toBe(true)` | a | ✅ |
| 2. Empty `identities` | Registered | `web/src/features/auth/emailExists.test.ts:5-11` `.toBe(true)` (pre-existing test, still green) | a | ✅ |
| 3. Gap ≥ 1000 ms | Registered | `emailExists.test.ts:34-52`: exactly 1000 ms → `true`, 5 min → `true` | a | ✅ |
| 4. Gap < 1000 ms | New sign-up | `emailExists.test.ts:54-68`: 999 ms → `false`, 0 ms → `false`; `:70-85` missing or unparseable timestamps → `false` (NaN comparison) | a | ✅ |
| 5. Message on the e-mail field | "E-mail já cadastrado" on the field | `web/src/features/auth/authForms.test.tsx:81-83` `findByText("E-mail já cadastrado")` and `toHaveAccessibleDescription("E-mail já cadastrado")` on the E-mail input, and no "Verifique seu e-mail" | a | ✅ |

This matches the backend finding in `.specs/features/auth/design.md:129`. GoTrue returns 200 with the existing user and a fresh `confirmation_sent_at` for an unconfirmed duplicate, and the rule given there is the same three criteria with `>= 1000`. Robustness:
- Both timestamps are server-side, so client clock skew is irrelevant.
- For a brand-new user the gap is the time between the insert and the confirmation send in the same request, normally a few ms.
- A resend can only happen after `max_frequency` (1 s local, 60 s hosted), so 1000 ms is a safe floor.
- Residual risk: a new user whose sign-up takes ≥ 1 s server-side (slow SMTP or DB) would be told "E-mail já cadastrado". The account would still exist and a confirmation e-mail would be sent. The design accepts this, and it is noted as a pre-launch check on the hosted project.

### FIX-04: Accounts, period and appearance (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Activate/deactivate failure | Dialog stays open with a Portuguese message | `web/src/features/accounts/accounts.test.tsx:89-123` (both actions): `within(dialog).findByText(GENERIC_ERROR)`, the dialog action button still present, no English text. `:125-138` known code `not_found` text | a | ✅ |
| 2. Inverted period | "A data inicial deve ser anterior à final" and no API call with that period | `web/src/features/transactions/transactions.test.tsx:461-474`: `findByText("A data inicial deve ser anterior à final")`, then after 400 ms `listPaths().filter(from=2026-10-10 && to=2026-10-01)).toEqual([])`. `:476-499`: equal dates and a valid period do query and show no message | a | ✅ |
| 3. Income green, expense red with minus | `text-emerald-700` / `text-emerald-400` (dark); expense destructive with `-` | `transactions.test.tsx:529-540`, for table row **and** mobile card: `toHaveClass("text-emerald-700", "dark:text-emerald-400")`, `not.toHaveClass("text-destructive")`, no leading `-`; expense `toHaveClass("text-destructive")` and `toMatch(/^-/)` | a | ✅ |

On AC2, this is what the user sees meanwhile. `useTransactions(filters, false)` uses a new query key with `enabled: false`, so `data` is `undefined` and `isLoading` is `false`. The page shows the alert plus "Nenhuma transação encontrada", and no request goes out. That matches what the API would return (an empty list) and is acceptable. The spec does not say what the list should show.

### FIX-05: Statement interface tests (P1)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Inline category, rollback | Saves with no form; on failure restores and shows "Não foi possível salvar a categoria" | `web/src/features/transactions/extratoInline.test.tsx:69-73` exact request `toEqual({ method: "PATCH", path, body: { categoryId } })`, `:74` no dialog, `:75-79` row shows the new name; `:95` text, `:97-101` row back to the old category | a | ✅ |
| 2. Bulk in one call; failure keeps the state | One `PATCH /transactions/category` with all ids; on failure selection and categories kept | `extratoInline.test.tsx:129-132` `toHaveLength(1)`, `body toEqual({ ids: [first.id, second.id], categoryId })`, no single PATCH; `:163-172` one call, "2 selecionada(s)", both checkboxes checked, old category names | a | ✅ |
| 3. Neutral switch persists / reverts | New value persisted; on failure reverts | `extratoInline.test.tsx:185-197` exact `{ neutral: true }`, badge "Neutra", switch checked; `:210-217` reverted switch and no badge | a | ✅ |
| 4. Search once after 300 ms, page 1 | One request with `q`, page 1 | `web/src/features/transactions/extratoFilters.test.tsx:64` no request at 400 ms of typing; `:68-70` exactly `["/transactions?sort=date&order=desc&page=1&q=Supermercado"]` | a | ✅ |
| 5. Filter param + page 1; "Limpar filtros" restores the default | Each param sent with page 1; default restored | `extratoFilters.test.tsx:96-103` for six filters: from page 2, `toContain(param)`, `toContain("page=1")`, `not.toContain("page=2")`; `:115-120` `lastList()).toBe(DEFAULT_QUERY)` and controls reset. **Clearing from page 2 is never exercised** (M17 survived) | a (partial) | ❌ GAP 1 |
| 6. Valor twice → asc then desc | Ordered requests | `extratoFilters.test.tsx:147-154` `toEqual(["...sort=amount&order=asc&page=1", "...sort=amount&order=desc&page=1"])` plus the first row matches each order | a | ✅ |
| 7. Empty state, pagination | "Nenhuma transação encontrada"; Próxima/Anterior | `extratoFilters.test.tsx:162-165` text, no footer, no table; `:168-188` "Página 1 de 3" → 2 → 3 → back to 1, exact page params, buttons disabled at the ends | a | ✅ |
| 8. Delete confirm / cancel | Confirm removes; cancel keeps | `web/src/features/transactions/extratoCrud.test.tsx:52-55` cancel: 0 DELETE, row kept; `:59-64` confirm: exactly one DELETE `/transactions/${drop.id}`, row gone, other kept | a | ✅ |
| 9. Create/edit send correct data, "1.234,56" → "1234.56" | Exact payload | `extratoCrud.test.tsx:83-92` `toMatchObject({ amount: "1234.56", accountId, occurredAt, categoryId, ... })` and `typeof amount === "string"`; edit `:115-127` full payload with `notes: null`; `:133-161` inactive account not offered (T11 Done-when) | a | ✅ |

### FIX-06: Lockfile (P2)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. `yarn install --frozen-lockfile` in `web/` | Finishes with no lockfile change | Command on a clean rsync copy at `/Volumes/MacOnlySSD/dev/personal/.lockcheck.qrTCcc` with `YARN_CACHE_FOLDER` inside it: `Done in 22.74s`, `EXIT=0`. `git diff --no-index web/yarn.lock <copy>/yarn.lock` printed nothing (exit 0). Copy removed. Note: run with `--ignore-scripts` to skip postinstall hooks. This does not affect the frozen-lockfile check, which happens before linking. Change: `web/yarn.lock:1718` `@testing-library/dom@^10.4.2` → `^10.4.1` (matches `package.json`) | b | ✅ |

**Summary**: 28 ACs. (a) 27, (b) 1 (FIX-06; FIX-01 AC1 also has b), (c) 0. GAP 1 (FIX-05 AC5 partial). Weak: FIX-01 AC5 for accounts and the neutral error text in FIX-01 AC6.

---

## Edge Cases

- [x] Unknown code → generic text, never API text: `web/src/lib/api/errorMessages.test.ts:35`, `web/src/features/categories/categories.test.tsx:119-120`, `web/src/features/transactions/transactions.test.tsx:324-325`.
- [x] Edit without touching notes/receipt keeps the values: `transactions.test.tsx:386` (`receipt` sent unchanged), `:401` (`notes: "Manter"`), `web/src/features/transactions/extratoCrud.test.tsx:118`. The form re-sends the current value, which the spec's assumptions table explicitly allows.
- [x] Network failure → generic: `errorMessages.test.ts:36` `new TypeError("Failed to fetch")` → `GENERIC_ERROR`. There is no screen-level test with a `TypeError`. Screens go through the same function, so this is acceptable.

---

## Gate Check

Run once from the real tree at `HEAD`:

- `yarn --cwd web typecheck`: exit 0.
- `yarn --cwd web lint`: exit 0. It reports 0 errors and 7 warnings (`react-refresh/only-export-components` in `components/ui/*` and `features/auth/useSession.tsx`). These files are untouched and the warnings predate the feature.
- `yarn --cwd web test`: **20 files, 132 passed, 0 failed, 0 skipped** (24.9 s).
- `VITE_MOCK_AREAS=none yarn --cwd web test`: 20 files, 132 passed. `web/vitest.config.ts:13` pins `VITE_MOCK_AREAS: "*"`, so tests ignore the environment.
- Skips: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- web/src` → no matches.
- **Test count before the feature** (`050949a`, same command in the scratch worktree): 16 files, 77 passed. **After**: 20 files, 132. **Delta +55**. No test was deleted, and the import tests (`web/src/features/import/*.test.tsx`) are unchanged.
- **Flakiness**: `extratoFilters.test.tsx` ran 3 times: 6/6 passed each time (20.35 s, 20.61 s, 20.69 s). All transaction test files also ran shuffled (`--sequence.shuffle --sequence.seed=4242`): 4 files, 37 passed.
  - Per-test times are 1.5 s, 9.1 s (30 s budget), 2.6 s, 2.1 s, 1.6 s and 2.9 s. Four tests use real 350-400 ms sleeps to outlast the 300 ms debounce, and the default timeout is 5 s.
  - Risk: low locally, moderate on a slow CI runner. The 2.6-2.9 s tests use about 55% of the 5 s budget. This is not blocking.

---

## Discrimination Sensor

Scratch: `git worktree add --detach /Volumes/MacOnlySSD/dev/personal/.verify-ff HEAD`, with `web/node_modules` symlinked. Each mutation was a single exact-string replacement (anchor count checked = 1). The covering tests ran in the scratch, then `git checkout -- web/src` restored it. Depth: P1 / critical paths, so the run is expanded.

| # | File:line | Mutation | Covering run | Killed? | Killing test |
| - | --------- | -------- | ------------ | ------- | ------------ |
| M1 | `web/src/lib/api/errorMessages.ts:35` | Unknown code returns `error.message` | errorMessages + categories + transactions | ✅ 6 failed | `errorMessages.test.ts:51` "never includes the API message", `categories.test.tsx:113`, `transactions.test.tsx:314,345` |
| M2 | `errorMessages.ts:33` | `duplicate_name` ignores context (always account text) | errorMessages + categories + accounts | ✅ 2 failed | `errorMessages.test.ts:9`, `categories.test.tsx:97` |
| M3 | `errorMessages.ts:35` | Unknown code → `""` | same as M1 | ✅ 5 failed | `errorMessages.test.ts:34`, `categories.test.tsx:113` |
| M4 | `web/src/features/accounts/AccountsPage.tsx:41` | Status failure also closes the dialog | accounts | ✅ 3 failed | `accounts.test.tsx:89` (both), `:125` |
| M5 | `web/src/features/categories/CategoriesPage.tsx:89` | `reassign_required` flow broken | categories | ✅ 2 failed | `categories.test.tsx:59`, `:123` |
| M6 | `web/src/features/transactions/TransactionForm.tsx:140` | Form shows `reason.message` | transactions + crud | ✅ 3 failed | `transactions.test.tsx:280,292,314` |
| M7 | `TransactionForm.tsx:132` | Edit sends `notes: undefined` when cleared | transactions dir | ✅ 2 failed | `transactions.test.tsx:379`, `extratoCrud.test.tsx:99` |
| M8 | `TransactionForm.tsx:124` | Create always sends `notes` (empty string) | transactions dir | ✅ 1 failed | `transactions.test.tsx:421` |
| M9 | `web/src/features/auth/emailExists.ts:5` | Threshold 1000 → 100 ms | auth | ✅ | `emailExists.test.ts:54` |
| M10 | `emailExists.ts:14` | `>=` → `>` | auth | ✅ | `emailExists.test.ts:34` |
| M11 | `emailExists.ts:11` | Empty-identities criterion removed | auth | ✅ 2 failed | `emailExists.test.ts:5`, `authForms.test.tsx:43` |
| M11b | `emailExists.ts:8` | `user_already_exists` criterion removed | auth | ✅ | `emailExists.test.ts:26` |
| M12 | `web/src/features/transactions/TransactionsPage.tsx:61` | Inverted period still queries (`enabled` always true) | transactions dir | ✅ | `transactions.test.tsx:461` |
| M12b | `TransactionsPage.tsx:60` | `from > to` → `from >= to` (equal dates blocked) | transactions dir | ✅ | `transactions.test.tsx:476` |
| M13a | `TransactionsPage.tsx:500` | Income class in table row back to `text-primary` | transactions.test | ✅ | `transactions.test.tsx:516` |
| M13b | `TransactionsPage.tsx:552` | Income/expense classes swapped in mobile card | transactions.test | ✅ | `transactions.test.tsx:516` |
| M14 | `web/src/features/transactions/hooks.ts:57` | Optimistic rollback (`onError`) removed | transactions dir | ❌ survived (equivalent) | - |
| M14b | `TransactionsPage.tsx:112` | Inline category failure shows the generic text instead of "Não foi possível salvar a categoria" | transactions dir | ✅ | `extratoInline.test.tsx:83` |
| M15 | `TransactionsPage.tsx:121` | Bulk sends one call per id | transactions dir | ✅ | `extratoInline.test.tsx:115` |
| M16 | `TransactionsPage.tsx:76` | Debounce 300 → 0 ms | extratoFilters | ✅ | `extratoFilters.test.tsx:53` |
| M17 | `TransactionsPage.tsx:218` | "Limpar filtros" keeps the current page | extratoFilters | ❌ **survived** | - |
| M18 | `TransactionsPage.tsx:92` | Sort toggle always `asc` | extratoFilters | ✅ | `extratoFilters.test.tsx:123` |
| M19 | `TransactionsPage.tsx:387` | Cancel also deletes | extratoCrud | ✅ | `extratoCrud.test.tsx:44` |
| M20 | `TransactionForm.tsx:119` | Amount sent as a number | transactions dir | ✅ 8 failed | `extratoCrud.test.tsx:67`, ... |
| M21 | `TransactionForm.tsx:192` | Inactive accounts offered in the form (`includeInactive`) | extratoCrud | ✅ | `extratoCrud.test.tsx:133` |
| M22 | `TransactionForm.tsx:140` | API `field` ignored (always the form alert) | transactions.test | ✅ 2 failed | `transactions.test.tsx:280,292` |
| M23 | `web/src/features/accounts/AccountForm.tsx:113` | `holder_required` shown in the nickname error, not the holder field | accounts | ❌ **survived** | - |
| M24 | `web/src/features/import/errorMessages.ts:15` | Import stops delegating `invalid_account` | import | ✅ | `useImport.test.tsx:103` (pre-existing, unchanged) |
| M25 | `TransactionForm.tsx:132` | Edit sends `receipt: undefined` when cleared | transactions dir | ✅ | `transactions.test.tsx:394` |
| M26 | `TransactionForm.tsx:113` | Notes not trimmed | transactions dir | ✅ 3 failed | `transactions.test.tsx:379,404,421` |
| M27 | `TransactionForm.tsx:137` | `occurredAt` not mapped to the date field | transactions.test | ✅ | `transactions.test.tsx:292` |

**Sensor outcome**: 29 mutations, 26 killed, 3 survived. Fail: two non-equivalent survivors.

- **M14 (equivalent)**: `useUpdateTransaction` has `onSettled: invalidateQueries`. After a failed PATCH the list is refetched from the unchanged server, so the row ends with the previous value even without the `onError` rollback. The visible end state that FIX-05 AC1/AC3 require ("restaurar", "voltar ao valor anterior") holds either way. Without the rollback, the wrong value would show only until the refetch. Not critical.
- **M17**: a real hole in FIX-05 AC5. Both clears in the suite start from page 1. `extratoFilters.test.tsx:102` runs `resetToDefault` after the filter has already reset the page. In `:106` the search change makes the debounce set `page: 1` on its own.
- **M23**: a real hole in FIX-01 AC5 and the T2 Done-when. `accounts.test.tsx:149` uses `findByText("Informe ao menos um titular")` anywhere on screen.

Check B by reasoning (no mutation run): if `saveInline` showed `reason.message` for the neutral path, `extratoInline.test.tsx:209` (`findByRole("alert")` only) would still pass. The neutral error text is not pinned (Gap 3).

---

## Check C (reverse mapping)

Every new test maps to an AC, an edge case or a Done-when:
- `errorMessages.test.ts` → FIX-01.1-5.
- `accounts.test.tsx:89-151` → FIX-04.1 and FIX-01.2/6.
- `categories.test.tsx:97-143` → FIX-01.2-4/6.
- `transactions.test.tsx:280-354` → FIX-01.3-6; `:379-448` → FIX-02; `:461-499` → FIX-04.2; `:516` → FIX-04.3.
- `emailExists.test.ts:26-85`, `authForms.test.tsx:59` → FIX-03.
- `extratoInline` → FIX-05.1-3; `extratoFilters` → FIX-05.4-7; `extratoCrud` → FIX-05.8-9 and the T11 inactive-account Done-when.

The "mock errors that carry a code" test (`errorMessages.test.ts:41`) documents the duck-typing choice and has no spec AC. It is acceptable as a design-level test.

---

## Code Quality

| Check | Status | Note |
| ----- | ------ | ---- |
| No features beyond what was asked | ✅ | See the scope review below |
| No abstractions for single-use code | ✅ | `apiSpy.tsx` is shared by 3 test files |
| Surgical changes | ✅ | |
| Matches existing patterns | ✅ | |
| Tests map to ACs and are non-shallow | ⚠️ | Exact request bodies and rendered state throughout. Three weak spots: Gaps 1-3 |
| Spec-anchored outcome check | ⚠️ | See spec-precision gaps |
| Documented guidelines followed | ✅ | `web/AGENTS.md`; otherwise strong defaults |

Scope review of the behavior changes the author reported:
- **`invalid_account` text "Conta inválida" → "Selecione uma conta ativa" in the transaction form.** Justified. One map means one text, and it was already the import text. For create, the API rejects inactive accounts, so the text is accurate. On edit, inactive accounts are allowed, so the code would only mean a missing account and the text is slightly off. Minor.
- **Unknown `field` falls back to the form alert.** Justified, and needed: without it, an error for a field the form lacks would be invisible.
- **The Categoria field can now show an error (`categoryId`).** Justified by FIX-01 AC5. It adds one prop.
- **`useTransactions(filters, enabled = true)`.** Justified. It is the least invasive way to meet "não consultar a API com esse período", and the default keeps other callers unchanged.
- **`TransactionUpdate` and the mock widened to accept `null`.** Justified. It matches the real API contract (`api/src/modules/transactions/routes.ts:59-60`), and the edit payload could not be typed otherwise.

Duck typing in `messageForError`: it reads `code` from any object whose `code` is a string. That is needed because the in-memory mock throws plain `Error`s with a code.
- `DOMException.code` is a number, so it is ignored.
- Node or fetch errors (`ECONNREFUSED`) and Supabase/PostgREST codes (`PGRST116`, `user_already_exists`, `validation_failed`, ...) do not match map keys, so they get the generic text.
- The worst case is a foreign error whose code equals a map key, such as `unauthorized`. That shows a wrong but Portuguese text and never API text.

This is acceptable. There is one inconsistency: `AccountForm.tsx:113` routes `holder_required` to the holder field only for `instanceof ApiError`. In mock mode the error is a plain `Error`, so the message lands under the nickname. This is cosmetic and limited to mock mode.

Accessibility:
- New messages use `role="alert"`: the account status dialog (`AccountsPage.tsx:154`), the inverted period (`TransactionsPage.tsx:240`), transaction field errors (`TransactionForm.tsx:287`) and the form alert (`:255`).
- The sign-up error is linked to the e-mail input (asserted with `toHaveAccessibleDescription`).
- Transaction form field errors have `id="<field>-error"`, but the inputs have no `aria-describedby`/`aria-invalid`. The association is visual only. This is a pre-existing pattern; the feature did not introduce it.
- The account form uses `aria-describedby` for both errors.

---

## Ranked Gaps (fix tasks)

### Fix 1 (Major): "Limpar filtros" from page 2 is untested (FIX-05 AC5, M17)
- **Root cause**: every clear in `web/src/features/transactions/extratoFilters.test.tsx` starts at page 1, or uses search, whose debounce resets the page anyway.
- **Fix task**: add a test (or extend `:106`) that changes only a non-search filter, goes to page 2 with "Próxima", clicks "Limpar filtros", and asserts `lastList()).toBe(DEFAULT_QUERY)` and "Página 1 de 3".
- **Done when**: mutant M17 (`setFilters((c) => ({ ...baseFilters, page: c.page }))`) fails that test.

### Fix 2 (Minor): `holder_required` is not pinned to the holder field (FIX-01 AC5, T2, M23)
- **Fix task**: in `web/src/features/accounts/accounts.test.tsx:140`, assert that "Informe ao menos um titular" is `#holder-error`, or `toHaveAccessibleDescription` on the Titulares input. Also assert that the duplicate nickname message is `#account-error`.
- **Done when**: mutant M23 fails.

### Fix 3 (Minor): the neutral error text is not asserted (FIX-01 AC6)
- **Fix task**: in `web/src/features/transactions/extratoInline.test.tsx:209`, assert the exact Portuguese text: `GENERIC_ERROR` for `new Error("boom")`, or a coded error's mapped text. Also assert that "boom" is absent.

Not blocking, listed for the record:
- Flaky-risk timings in `extratoFilters.test.tsx`.
- The `invalid_account` text on edit.
- Stale `pnpm` gate commands in tasks.md and the `Commit:` prefixes.
- No STATE.md entry.

---

## Spec-Precision Gaps

1. FIX-01 AC3 says "a mensagem definida para ele" but the spec does not define the texts for the nine codes. Only `duplicate_name` and the generic text are fixed in the assumptions table. The tests pin the texts chosen in `web/src/lib/api/errorMessages.ts:5-15`, which were never confirmed in the spec.
2. FIX-04 AC2 does not say what the list shows while the period is invalid. The implementation shows "Nenhuma transação encontrada" under the alert.
3. FIX-01 AC5 "associar a mensagem ao campo" does not say whether a programmatic association (`aria-describedby`) is required or only visual placement.
4. FIX-03 AC3/4 rely on server timing: a slow but genuinely new sign-up (≥ 1 s) is misclassified. Accepted in the design; to confirm on the hosted project.

---

## Security / Privacy

- No API `message` reaches the UI in the changed screens. This is proven by the M1/M6 kills and the grep above. `ApiError.message` is still stored and goes to the telemetry/diagnostic helpers. That is not shown to the user, and `lovable-error-reporting` only runs inside the editor preview.
- Tests contain no tokens, keys or real credentials. Fixtures use `ana@example.com`, `exemplo.com` URLs, and a password string only in `authForms.test.tsx` with mocked `signUp`.
- `web/.env.local` is git-ignored and unused by the tests (env pinned in `vitest.config.ts`).

---

## Isolation Proof

- Baseline `git status --porcelain` before: `?? .DS_Store`. After the sensor: `?? .DS_Store`. The only other difference is this report, created at the end.
- `git worktree list` after removal and prune: only `/Volumes/MacOnlySSD/dev/personal/financials 6968f86 [feat/front-fixes]`.
- The `node_modules` symlink was removed before `git worktree remove --force`. `web/node_modules` in the real tree is intact.
- `/Volumes/MacOnlySSD/dev/personal/.verify-ff` and `.lockcheck.*` are gone (`ls` shows no matches).
- No `vitest` or `mutate.py` processes are left (`pgrep` empty). No ports were opened. The servers on 3001 and 8080 were not touched.
- No commits were made. `HEAD` is still `6968f86bef23c05b98671e56361bf959e5443d8b`.

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| FIX-01 | Implementing | ⚠️ Needs test fix (Gaps 2, 3) |
| FIX-02 | Implementing | ✅ Verified |
| FIX-03 | Implementing | ✅ Verified |
| FIX-04 | Implementing | ✅ Verified |
| FIX-05 | Implementing | ❌ Needs test fix (Gap 1) |
| FIX-06 | Implementing | ✅ Verified |

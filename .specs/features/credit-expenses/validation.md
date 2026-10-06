# Validation: credit-expenses (backend T1-T7 + web T13, T8-T12), iteration 1 - PASS

**Verdict**: PASS

Every in-scope AC and edge case has `file:line` evidence that targets the spec outcome. Gates are green: api 209 unit + 365 integration, web 196, typecheck clean, lint 0 errors, 0 skips. The sensor ran 39 code mutations (21 backend, 18 web) plus 5 DB-object probes. 33 code mutants were killed and 6 survived. Two survivors are equivalent (argued and probed below). The other four are non-blocking test gaps on UI text and display, or on concurrency where the database check already protects the data. None of them sits on a critical path (money, authorization, data integrity). CARD-05 (credit expenses kept out of dashboard totals) is deferred to the `dashboards` feature.

**Iteration**: 1
**Date**: 2026-10-05
**Spec**: `.specs/features/credit-expenses/spec.md` (also `design.md`, `tasks.md`, `lovable.md`, `.specs/STATE.md` AD-001..AD-005)
**Diff range**: `4a0cdef^..HEAD`, 14 commits (1 docs, T1-T7, T13, T8-T12). `HEAD` = `fd07bb1458ffefa39dd14000d9bb0bae174f300c`, branch `feat/credit-expenses`.
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in the temporary worktree `/Volumes/MacOnlySSD/dev/personal/.verify-ce`, which is now removed. DB-object probes ran inside one rolled-back psql transaction.

## Scope

- Backend: `supabase/migrations/0005_credit_expenses.sql`, `api/src/modules/creditExpenses/{routes,schema,validation}.ts`, `api/src/app.ts` (registration), `api/openapi.json`, and the tests `api/src/modules/creditExpenses/validation.test.ts`, `api/test/credit-expenses{,-schema,-isolation}.int.test.ts`.
- Web: `web/src/features/creditExpenses/*`, `web/src/lib/api/{errorMessages,types}.ts`, `web/src/lib/api/mock/creditExpenses.ts`, `web/src/routes/cartao.tsx`, `web/src/test/apiSpy.tsx`, and their tests.

Classification key: (a) covered by tests, (b) verified by a non-test artifact, (c) deferred, GAP = no evidence or a test that does not discriminate.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown` (grep count 1). No box is unchecked (`grep -nE "^\s*-\s*\[\s\]"` finds nothing).

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 migration 0005 | ✅ | `3965ace` | - |
| T2 POST | ✅ | `bb2d43d` | - |
| T3 GET + filter | ✅ | `0bf9a81` | - |
| T4 PATCH | ✅ | `bcb2ce8` | - |
| T5 DELETE | ✅ | `de8203d` | - |
| T6 category registry | ✅ | `44d2f2f` | Registered in `routes.ts:21` when the module loads (the registry's documented pattern), not in `registry.ts` as the task's Where says |
| T7 isolation test | ✅ | `fcbbe5f` | 4 tests (task said 2) |
| T13 error messages | ✅ | `237001d` | - |
| T8 hooks | ✅ | `8179a40` | - |
| T9 table | ✅ | `7ad2952` | - |
| T10 form | ✅ | `56f25cc` | - |
| T11 status select | ✅ | `8861a74` | - |
| T12 page + route | ✅ | `fd07bb1` | - |

Process notes (cosmetic, non-blocking):
- The docs commit `4a0cdef` has a 79-character subject, over the 72 limit. The other 13 subjects are 40-61 characters.
- The web commits use `feat(web): ...`, but tasks.md `Commit:` lines say `feat(credit-expenses): ...`. T11 also differs in wording ("build the credit expense status select").
- `lovable.md` still says it replaces T8-T12 as Lovable work. The web part was built directly in `web/`.
- `spec.md` traceability still shows CARD-01..04 "Implementing", and the Coverage line still says "0 mapped".

---

## Spec-Anchored Acceptance Criteria

Test paths below are short forms: `ce.int` = `api/test/credit-expenses.int.test.ts`, `schema.int` = `api/test/credit-expenses-schema.int.test.ts`, `iso.int` = `api/test/credit-expenses-isolation.int.test.ts`, `val.test` = `api/src/modules/creditExpenses/validation.test.ts`. Web files are under `web/src/features/creditExpenses/` unless a full path is given.

### P1: CRUD (CARD-01, CARD-02)

| AC | Spec-defined outcome | Evidence (`file:line` + assertion) | Class | Result |
| -- | -------------------- | ---------------------------------- | ----- | ------ |
| 1. Valid create; paid 0 when omitted | Row created, `paidAmount` 0 | `api/test/credit-expenses.int.test.ts:65-84` `statusCode toBe(201)`, `json() toEqual({... paidAmount: '0.00', remainingAmount: '600.00', categoryName: 'Sem categoria' ...})`, stored row `toEqual({ paid: '0.00', ... })`. Paid in other spellings at `:93-98`. Web: `CreditExpenseForm.test.tsx:131-146` `not.toHaveProperty("paidAmount")` when the field is empty; `:148-155` `"0,00"` sends `paidAmount: "0.00"` | a | ✅ |
| 2. Total ≤ 0 → invalid-value message | Rejected with the invalid-value message | API `ce.int:141-151`: `'0','0.00','-1.00','10.001',...` each `toEqual({ error: { code: 'invalid_amount', field: 'totalAmount' } })`, 422, nothing stored. No coercion: `ce.int:153-164` (600, 600.5, true, null, {}, [], ['600.00']), `:166-178` (raw long JSON number). Unit `val.test:22-31`. DB `schema.int:53-68` `/credit_expenses_total_amount_check/`. Web `CreditExpenseForm.test.tsx:64-74` `errorOf(dialog,"total") toBe("Valor total inválido")`, 0 POST. API code mapped: `web/src/lib/api/errorMessages.test.ts:42-46`, `CreditExpenseForm.test.tsx:168-188` | a | ✅ ⚠️ SPG-1 |
| 3. Paid < 0 or > total → invalid-paid message | Rejected with the invalid-paid message | API `ce.int:180-190` (`'-0.01','600.01',...`) `toEqual({ error: { code: 'invalid_paid_amount', field: 'paidAmount' } })`. Non-string `ce.int:159-161`. Unit `val.test:40-64` (BigInt cents, 999999999999.99 vs .98). DB `schema.int:70-83`. Web `CreditExpenseForm.test.tsx:76-86` (`-5`, `1,234`, `abc`, `600,01`) `toBe("Valor pago inválido")`; `:157-166` paid = total accepted | a | ✅ ⚠️ SPG-1 |
| 4. Day not an integer 1-31 → invalid-day message | Rejected with the invalid-day message | API `ce.int:192-202` (`0, 32, -1, 5.5, 100, '5', '', null, true, {}, 1e21`) `toEqual({ error: { code: 'invalid_day', field: 'recurrencyDay' } })`; limits 1 and 31 accepted `:102-104`. Unit `val.test:67-81`. DB `schema.int:85-94`. Web `CreditExpenseForm.test.tsx:88-98` `toBe("Dia inválido (use de 1 a 31)")`; day sent as a number `:126` `typeof body["recurrencyDay"] toBe("number")` | a | ✅ ⚠️ SPG-1 |
| 5. Edit any field without changing the others | Only that field changes | `ce.int:417-433` it.each over name, totalAmount, paidAmount, occurredAt, recurrencyDay, notes: `json() toEqual({ ...item, ...expected })` and re-read `toEqual`. Multi-field `:435-439`; category `:450-457`; empty body `:459-465` `toEqual(item)`; notes cleared `:441-448`. Web: the edit sends `notes: null` (`CreditExpenseForm.test.tsx:230-247`), page edit flow (`CreditExpensesPage.test.tsx:119-139`) | a | ✅ |
| 6. Confirmed delete removes definitively | Row gone | `ce.int:627-637` 204, empty body, `storedIds()` (admin, bypassing RLS) `not.toContain(target)`, other row kept. Web `CreditExpensesPage.test.tsx:160-185`: cancel → 0 DELETE and the row stays; confirm → exactly one DELETE for that id and the row disappears | a | ✅ |
| 7. `uuid` id, `user_id`, RLS | uuid PK; per-user rows; RLS | `ce.int:68` `id: expect.stringMatching(UUID_SHAPE)`, `:84` stored `user_id: user.id`. RLS `schema.int:173-202` (select hidden, update/delete count 0 for another user, forged insert `/row-level security/`). Composite FKs `schema.int:118-138`. API `iso.int:78-162`. Non-test: catalog snapshot (policy `credit_expenses_all` for `authenticated`, `using/with check user_id = (select auth.uid())`, both composite FKs) | a + b | ✅ |
| 8. Remaining = total − paid on every read | `total_amount − paid_amount` | `ce.int:303-306` 600.00/200.00 → `remainingAmount: '400.00'`; `:308-316` `'0.20'`, `'0.00'`, `'999999999999.98'`; recomputed after edits `:419-420`, `:483`. Computed in SQL `schema.ts:48`. Web shows the API value `CreditExpensesTable.test.tsx:66-76`, `CreditExpensesPage.test.tsx:56-66` (`R$ 400,00`) | a | ✅ |

### P1: Status and filter (CARD-03, CARD-04)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Only Once, Active, Inactive, Canceled, ToCancel | Only these 5 | Each accepted `ce.int:105-109`; others rejected `ce.int:204-214` (`'Paused','active','ACTIVE','',' Active'`). DB `schema.int:96-106` `/credit_expenses_status_check/`. Web options `StatusSelect.test.tsx:69-81`, `CreditExpensesTable.test.tsx:80-96` (exact list) | a | ✅ |
| 2. Status change persists without touching paid or other fields | Only status changes | `ce.int:405-415` 5×5 transitions: `json() toEqual({ ...item, status: to })` and re-read `toEqual`. Web `StatusSelect.test.tsx:83-97` exact `body: { status: "ToCancel" }` and paid `200.00`; `CreditExpensesPage.test.tsx:141-158` | a | ✅ |
| 3. Filter by status lists only that status | Only that status | `ce.int:347-356` it.each over the 5: every row has that status, the seeded id is present, count equals the full-list count for that status, and the full list is larger. Isolation `iso.int:108-111`. Web: `hooks.test.tsx:54-69` path `/credit-expenses?status=ToCancel`; `CreditExpensesPage.test.tsx:68-86` request plus rows, then `Todos` returns to `/credit-expenses` | a | ✅ |
| 4. No automatic change of status or paid | Never changed by the system | `ce.int:598-604` (sequence of 5 edits keeps `ToCancel`/`600.00`), `ce.int:260-263` (Canceled with full payment stored as sent), `ce.int:430-432`. Non-test: migration 0005 has no trigger or function (catalog: no `credit_expenses` trigger), and no job exists | a + b | ✅ |
| 5. Status outside the list → validation error | Validation error | 422 `invalid_status` on POST `ce.int:204-214`, PATCH `ce.int:527-529`, GET filter `ce.int:358-364`. Web text `errorMessages.test.ts:38-40` `"Status inválido"`, rollback with text `StatusSelect.test.tsx:112-130` | a | ✅ |

### P2: Totals isolation (CARD-05)

| AC | Spec-defined outcome | Evidence | Class | Result |
| -- | -------------------- | -------- | ----- | ------ |
| 1. Not in income/expense/trend/category/net worth | Totals unchanged | No dashboard module exists yet. `git grep -n credit_expenses -- api/src web/src` matches only `api/src/modules/creditExpenses/` (verified). The page notice is tested in `CreditExpensesPage.test.tsx:43-53` | c (deferred to `dashboards`) | ⏭️ |
| 2. Shown only in the card view | Card view only | Belongs to the `dashboards` spec | c | ⏭️ |

**Status**: 13 ACs covered (a, three of them also b), 2 deferred (c), 0 gaps. Spec-precision gaps are listed below.

---

## Edge Cases

- [x] **Lowering the total below the paid amount is rejected.** API `ce.int:467-477`: `'199.99'`, `'0.01'` → 422 `invalid_paid_amount` on `paidAmount`, and the row is unchanged. Equality is allowed (`:479-484`), and both fields are checked together (`:498-509`). The check runs under `select ... for update` in the same `withUser` transaction (`routes.ts:230-238`). DB backstop at `schema.int:80-82`. Web: client-side at `CreditExpenseForm.test.tsx:262-269`, and the API code mapped to the paid field at `:168-188`.
- [x] **A category deleted with reassignment shows the destination category.** `ce.int:728-743` shows `categoryName: 'Saúde'` for the moved rows, and other rows stay put. `reassignTo` is required at `:714-726`. Rollback when a later table fails at `:745-793`. Web shows `categoryName` from the API (`CreditExpensesTable.tsx:117`).
- [x] **Rows of a deactivated account stay visible and editable.** API `ce.int:554-573`: edit works, the row stays listed, and it can move to an inactive account. Delete works at `:667-671`. ⚠️ Web side not tested: mutants W9a and W9b survive (ranked gap 3).

---

## Gate Check

- **Commands** (Build gate in tasks.md): `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` → exit 0. `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` → exit 0.
- **api**: unit 12 files, 209 passed. Integration 29 files, 365 passed. Of these, the feature adds 42 unit tests (`validation.test.ts`) and 74 integration tests (`credit-expenses.int` 59, `-schema.int` 11, `-isolation.int` 4). The tests passed against the local stack, which still held the orchestrator's UAT data. No `db:reset` was needed.
- **web**: 26 files, 196 passed. The feature adds 61 tests: Form 28, Page 9, StatusSelect 8, Table 6, hooks 4, route 1, errorMessages +5. Before the feature: 135, which matches the front-fixes count. Lint: 0 errors and 7 warnings, all `react-refresh/only-export-components` in pre-existing files (`components/ui/*`, `auth/useSession.tsx`). None is in the feature.
- **Mock pin**: `VITE_MOCK_AREAS=none yarn --cwd web test` → 26 files, 196 passed (`web/vitest.config.ts` forces `VITE_MOCK_AREAS: "*"`).
- **Flakiness**: `CreditExpensesPage.test.tsx` ran 2 more times (9/9 each) and `CreditExpenseForm.test.tsx` ran 1 more time (28/28).
- **Skips**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api web/src` finds 0 matches (after excluding `process.exit(`).
- **OpenAPI in sync**: `pnpm openapi:export` in the scratch worktree left `git status` clean. `totalAmount` is published as `type: string` and `recurrencyDay` as `type: integer`, through `x-openapi-type`.

---

## Discrimination Sensor

**Depth**: P0 (money, authorization, data integrity). **Scratch**: worktree `/Volumes/MacOnlySSD/dev/personal/.verify-ce` at `HEAD`, with symlinked `node_modules`. Control runs passed first: api `test/credit-expenses*` 74/74, web feature + errorMessages 76/76. Each mutant was restored with `git checkout -- <file>` before the next one. Covering tests: `vitest --config vitest.int.config.ts test/credit-expenses` (api), and `vitest src/features/creditExpenses src/lib/api/errorMessages.test.ts` (web).

### Backend (21 mutants)

| # | File | Mutation | Result | Killing test(s) |
| - | ---- | -------- | ------ | --------------- |
| B1 | `routes.ts:170` | Create accepts an inactive account (`and active` removed) | ✅ Killed | `ce.int:222` |
| B2 | `routes.ts:177` | Default category `Uncategorized` → `Food` | ✅ Killed | `ce.int:64`, `:318` |
| B3 | `routes.ts:160` | Create skips paid ≤ total | ✅ Killed (the DB check gives a 500, test expects 422) | `ce.int:180` |
| B4 | `routes.ts:237` | PATCH skips paid ≤ total (lowering the total accepted) | ✅ Killed | `ce.int:467`, `:486`, `:498` |
| B5 | `validation.ts:40` | `>` → `>=` (paid = total rejected) | ✅ Killed | `ce.int:93`, `:260`, `:308` + 4 |
| B6 | `routes.ts:145` | PATCH always writes `notes` (overwrites an unspecified field) | ✅ Killed | `ce.int:405`, `:417` (10 tests) |
| B7 | `routes.ts:257` | Empty PATCH → 404 | ✅ Killed | `ce.int:459`, `:598` |
| B8 | `routes.ts:144` | Transition to `Once` refused | ✅ Killed | `ce.int:405` |
| B9a | `schema.ts:48` | Remaining with the wrong sign (`paid − total`) | ✅ Killed | 8 tests incl. `ce.int:303` |
| B9b | `schema.ts:48` | Remaining computed in `float8` | ✅ Killed | 11 tests (`"400"` ≠ `"400.00"`) |
| B10 | `routes.ts:27-28` | Amounts typed `Type.String` (Ajv coercion back on) | ✅ Killed | `ce.int:153`, `:166`, `:511`, `:541` |
| B11 | `routes.ts:31` | Day typed `Type.Integer` (Ajv coerces `"5"`) | ✅ Killed | `ce.int:192`, `:511` |
| B12 | `validation.ts:49` | Day upper limit 31 → 32 | ✅ Killed | `ce.int:192`, `:511` |
| B13 | `routes.ts:85` | Any status accepted | ✅ Killed | `ce.int:204`, `:358`, `:511` |
| B14 | `routes.ts:275` | DELETE of an unknown id → 204 | ✅ Killed | `ce.int:639`, `:651`, `:659` + 1 |
| B15 | `routes.ts:21` | Registry registration removed | ✅ Killed | `ce.int:714`, `:728` |
| B16 | `routes.ts:145` | `notes !== undefined` → `notes != null` (null ignored) | ⚪ Survived, **equivalent** | see below |
| B17 | `routes.ts:244` | PATCH requires an active account | ✅ Killed | `ce.int:554` |
| B18 | `routes.ts:94` | Offset/Z requirement dropped | ✅ Killed | `ce.int:129`, `:511` |
| B19 | `routes.ts:232` | `for update` removed | ⚠️ Survived, not equivalent, non-blocking | see below |
| B20 | `routes.ts:159` | Default paid `'0.00'` → `'1.00'` | ✅ Killed | `ce.int:64`, `:318` |
| B21 | `validation.ts:25` | Zero paid no longer accepted | ✅ Killed | `ce.int:93`, `iso.int:78` |

Not mutated, by reasoning only: moving a query outside `request.withUser` would run as `postgres`, which bypasses RLS, against the live DB. All four handlers call `request.withUser` (`routes.ts:166`, `:210`, `:227`, `:274`). Foreign ids answer 404 on PATCH and DELETE (`iso.int:78-98`, `ce.int:659-665`). A missing auth hook would be caught by the 401 matrix at `iso.int:141-162`.

### DB objects (5 probes, one transaction, `ROLLBACK` at the end)

Integration tests open their own connections, so they cannot run against an uncommitted schema change. Each probe runs the same statement the schema test asserts on, first unmutated (control) and then mutated. Script: `BEGIN; SAVEPOINT ...; ROLLBACK TO ...; ...; ROLLBACK`.

| # | Mutation | Control | Mutant | Test that asserts the control outcome |
| - | -------- | ------- | ------ | ------------------------------------- |
| DB1 | `disable row level security` | foreign user sees 0 rows | sees 1 | `schema.int:177` `toHaveLength(0)` |
| DB2 | Policy `using (true) with check (true)` | 0 rows | 1 | `schema.int:177`, `:186-187` |
| DB3 | Drop `credit_expenses_paid_range_check` | `ERROR ... violates check constraint "credit_expenses_paid_range_check"` | `UPDATE 1`, paid > total | `schema.int:73`, `:80` |
| DB4 | `grant truncate ... to authenticated` | `permission denied` | `TRUNCATE` ok | `schema.int:158` |
| DB5 | Drop `credit_expenses_recurrency_day_check` | check violation | day 32 stored | `schema.int:88` |

After `ROLLBACK`, the UAT row is unchanged (1 row, paid 400.00, day 10, status ToCancel).

### Web (18 mutants)

| # | File | Mutation | Result | Killing test(s) |
| - | ---- | -------- | ------ | --------------- |
| W1 | `web/src/lib/api/errorMessages.ts:42` | `invalid_amount` not contextual | ✅ Killed | `web/src/lib/api/errorMessages.test.ts:42`, `CreditExpenseForm.test.tsx:168` |
| W2a | `CreditExpenseForm.tsx:153` | Form shows the API `message` | ✅ Killed | `CreditExpenseForm.test.tsx:168-198` (6 tests) |
| W2b | `StatusSelect.tsx:22` | Status select shows the API `message` | ✅ Killed | `StatusSelect.test.tsx:112` |
| W2c | `CreditExpensesPage.tsx:96` | Delete failure shows the API `message` | ⚠️ Survived, not equivalent, non-blocking | none (gap 1) |
| W3a | `CreditExpenseForm.tsx:134` | `"1.234,56"` sent untouched | ✅ Killed | `CreditExpenseForm.test.tsx:102` + 4 |
| W3b | `CreditExpenseForm.tsx:134` | Total sent as a JS number | ✅ Killed | `CreditExpenseForm.test.tsx:102` + 4 |
| W4 | `CreditExpenseForm.tsx:136` | `recurrencyDay` sent as a string | ✅ Killed | `CreditExpenseForm.test.tsx:102`, `:230` + 2 |
| W5 | `CreditExpenseForm.tsx:146` | Cleared notes sent as `undefined` | ✅ Killed | `CreditExpenseForm.test.tsx:230` |
| W6 | `StatusSelect.tsx:32` | No transitions out of Canceled | ✅ Killed | `StatusSelect.test.tsx:69` (Canceled case) |
| W7 | `hooks.ts:52-53` | Optimistic rollback removed | ✅ Killed | `StatusSelect.test.tsx:112` (PATCH **and** refetch fail, L-011) |
| W8 | `CreditExpensesPage.tsx:87` | Cancel also deletes | ✅ Killed | `CreditExpensesPage.test.tsx:160` |
| W9a | `CreditExpenseForm.tsx:230` | Create offers inactive accounts | ⚠️ Survived, not equivalent, non-blocking | none (gap 3) |
| W9b | `CreditExpenseForm.tsx:230` | Edit hides inactive accounts | ⚠️ Survived, not equivalent, non-blocking | none (gap 3) |
| W10 | `hooks.ts:13` | Status filter not sent | ✅ Killed | `hooks.test.tsx:54`, `CreditExpensesPage.test.tsx:68` + 1 |
| W11a | `CreditExpensesTable.tsx:125,159` | Remaining recomputed in the front (`Number` − `Number`, `toFixed(2)`) | ⚪ Survived, **equivalent** | see below |
| W11b | `CreditExpensesTable.tsx:125,159` | Remaining column shows the paid amount | ✅ Killed | `CreditExpensesTable.test.tsx:34`, `CreditExpensesPage.test.tsx:56` + 2 |
| W12 | `CreditExpenseForm.tsx:66` | Zero paid rejected | ✅ Killed | `CreditExpenseForm.test.tsx:148` |
| W13 | `CreditExpenseForm.tsx:116` | Total not normalized to 2 decimals | ✅ Killed | `CreditExpenseForm.test.tsx:131` |
| W14 | `CreditExpenseForm.tsx:120` | Paid > total allowed in the form | ✅ Killed | `CreditExpenseForm.test.tsx:76` (`600,01`), `:262` |
| W15 | `hooks.ts:24` | Create does not invalidate the list | ✅ Killed | `hooks.test.tsx:71`, `CreditExpensesPage.test.tsx:88` |
| W16 | `CreditExpenseForm.tsx:153` | Form error without the `creditExpense` context | ✅ Killed | `CreditExpenseForm.test.tsx:168` |
| W17 | `CreditExpenseForm.tsx:139` | Paid always sent on create | ✅ Killed | `CreditExpenseForm.test.tsx:131` |
| W18 | `StatusSelect.tsx:21` | Status PATCH also resets paid | ✅ Killed | `StatusSelect.test.tsx:83`, `CreditExpensesPage.test.tsx:141` |

### Survivors: equivalence arguments

- **B16 (equivalent, probed).** Fastify's Ajv coerces `null` to `""` in the first `anyOf` branch (`Type.String()`) of `notes: Union[String, Null]`, so the handler never receives `null`. Probe P16 replaced `null` with the sentinel `'WAS_NULL'` in both create and PATCH, and `ce.int:441` ("clears notes with null") and `ce.int:119` still passed. So `notes: null` clears the field through `""` → `optionalText` → NULL. The contract holds, but it depends on Ajv coercion. A later `coerceTypes: false` would send real `null` to `optionalText`, which handles it too.
- **W11a (equivalent within the domain).** For 2-decimal values up to 12 integer digits, the doubles carry at most ~1.8e-4 of absolute error after subtraction (ulp at 1e12 ≈ 1.2e-4). The exact result is a whole number of cents, so `toFixed(2)` always returns the same string as the API's `remainingAmount`. The only way to observe it would be inconsistent data from the server.
- **B19 (not equivalent, non-blocking).** Without the row lock, two concurrent PATCHes can each pass the API's paid ≤ total check: one raises paid, the other lowers the total. Under READ COMMITTED the second `UPDATE` re-reads the committed row, and `credit_expenses_paid_range_check` rejects it (probe DB3 proves the check fires). Data integrity holds. The only difference is a 500 instead of 422 in a race. No test exercises concurrency.
- **W2c, W9a, W9b (not equivalent, non-blocking).** These are UI-only paths, and the backend already guards the data (inactive account on create → 422 `invalid_account`, tested at `ce.int:222`). Listed as gaps 1 and 3.

**Result**: 39 code mutants, 33 killed, 2 equivalent, 4 non-equivalent non-blocking survivors. Every DB probe confirmed. No survivor touches a critical behavior → sensor PASS.

---

## Isolation Proof

- Real tree: `git status --porcelain` showed `?? .DS_Store` before and after. The only new file is this report. `HEAD` is still `fd07bb1`.
- `git worktree list` shows only the main worktree. The `node_modules` symlinks were unlinked before `git worktree remove --force`, then `git worktree prune` ran. `/Volumes/MacOnlySSD/dev/personal/.verify-ce` no longer exists.
- Real `api/node_modules` and `web/node_modules` are real directories, intact.
- DB structure: a snapshot (migrations, public tables, policies, constraints, public functions, `credit_expenses` grants, indexes) was taken before and after. `diff` is identical. Migrations are 0001-0005.
- Temp DB objects: 0 relations and 0 functions match `%probe%`. UAT data intact: 1 user, 1 credit expense (`Notebook parcelado`, 1200.00 / 400.00, day 10, ToCancel).
- No leftover `vitest` processes. The dev servers on 3001 and 8080 are still listening. The user stack `web` was not touched. The scratch notes dir on the external volume was deleted.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / no scope creep | ✅ (2 nits below) |
| Surgical changes | ✅ `app.ts` +2 lines; `apiSpy.tsx` adds one route-key rule; `errorMessages.ts` adds one context branch; existing codes unchanged (`errorMessages.test.ts:48-55`) |
| Matches patterns | ✅ Same structure as the transactions module (validation order, 404/422 choice, `withUser`, the registry, the no-coercion `x-openapi-type` technique) |
| Money as strings (AD-004) | ✅ SQL `numeric(14,2)::text`, remaining computed in SQL, BigInt cents in the API, the form and the mock; no float arithmetic on money |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage (unit 1:1 parsers; routes happy + edge + error) | ✅ Every route has happy, edge and error tests; RLS and constraints are tested directly |
| Every test maps to a requirement | ✅ Check C below |
| Guidelines | none in repo; tasks.md matrix and `.specs/LESSONS.md` applied (L-001, L-005, L-009, L-011 visible in tests) |

Nits (non-blocking):
- `web/src/features/creditExpenses/hooks.ts:58` exports `UpdateCreditExpenseVariables`, which nothing uses (dead export).
- `web/src/lib/api/mock/creditExpenses.ts:39` `build(input, id, requireActiveAccount)` has one caller, which always passes `true`, so the flag adds unused flexibility.
- The optimistic update in `hooks.ts:43-48` merges `totalAmount`/`paidAmount` from a form edit without recomputing `remainingAmount`. The cached remaining value is stale until the `onSettled` refetch (a short display lag, no data impact).
- Inherited from `TransactionForm`: the default date `new Date().toISOString().slice(0, 10)` (`CreditExpenseForm.tsx:34`) is the UTC date, so after 21:00 in São Paulo it defaults to tomorrow.
- File sizes are reasonable: `routes.ts` 279 lines, `CreditExpenseForm.tsx` 293. `credit-expenses.int.test.ts` has 794 lines but is grouped by route.

**Check B (shallow assertions)**: none found. Error tests use `toEqual` on the full `{ error: { code, message, field } }` shape. Edit tests compare the whole row with `toEqual({ ...item, ...expected })`, both in the response and on re-read. Delete is checked through the API and through admin SQL. Web payload tests use `toEqual` on the exact body (StatusSelect, hooks, create form). The edit form uses `toMatchObject`, which W4, W5 and W17 still discriminate.

**Check C (reverse mapping)**: every new test maps to an AC, an edge case, or a Done-when item. Supporting tests that map to design rules rather than a spec AC are: the 401 matrix (`iso.int:141`, L-001), stable tie-break ordering (`ce.int:339`), unknown/malformed category 404 and account 422 (`ce.int:232-246`, `:575-586`), missing-key 400 (`ce.int:248`), blank-name 422 (`ce.int:216`), user deletion cascade (`schema.int:140`), truncate revoked (`schema.int:156`), the reassignment rollback probe (`ce.int:745`), and the table loading/error/retry states (`CreditExpensesTable.test.tsx:119`, `CreditExpensesPage.test.tsx:187`). All map to design.md, tasks.md Done-when, or LESSONS. None is unclaimed.

---

## Ranked Gaps (all non-blocking)

1. **Delete failure text is not pinned (W2c).** `CreditExpensesPage.tsx:96` maps a delete error through `messageForError(..., "creditExpense")` correctly, but no test fails the DELETE. Showing the API's English `message` would pass the suite. Fix task: in `CreditExpensesPage.test.tsx`, set `failures.set("DELETE /credit-expenses/:id", new ApiError("not_found", "Technical English", 404))`, confirm the delete, and assert the alert text `"Registro não encontrado. Atualize a página e tente de novo"`, no "Technical English", and the row still present.
2. **The PATCH row lock is not exercised (B19).** Integrity holds through the DB check (probe DB3). Without the lock, the only failure is a 500 instead of 422 under concurrent edits. Optional fix: one integration test with two parallel PATCHes (`total 300` and `paid 500` on 600/200) that expects one 200 and one 422, never a 500.
3. **Account select rules are not tested on the web (W9a, W9b).** `CreditExpenseForm.tsx:230` `includeInactive={Boolean(expense)}` has no test. Create could offer inactive accounts (the API would answer 422 "Selecione uma conta ativa"). Edit could hide the current inactive account (the row stays editable, but the select shows a placeholder). Fix task: in `CreditExpenseForm.test.tsx`, deactivate a mock account, then assert it is absent from the create options and present as "<nickname> (inativa)" and selected when editing a row that uses it.

## Spec-Precision Gaps

- **SPG-1**: AC2-AC4 say "mensagem de valor inválido / valor pago inválido / dia inválido" but give no exact text, HTTP status or code. The texts come from tasks.md T13 and lovable.md, and the codes and 422 from design.md. Tests pin those values.
- **SPG-2**: The assumption for `date` says "meia-noite no fuso local". The form sends **local noon** (`CreditExpenseForm.tsx:135`, the same as `TransactionForm.tsx:118`), and the API accepts any instant that has an offset. This matches Transactions, as the assumption requires, but not the literal "midnight". The spec or the code should be aligned.
- **SPG-3**: Missing vs blank required fields: a missing key answers 400 (Ajv) and a blank name answers 422 `validation_error`. The spec defines neither (recurring lesson L-006).
- **SPG-4**: The spec does not define the error for an invalid `status` query on GET (implemented as 422 `invalid_status`), the list order (implemented as `occurredAt` desc, then id desc), an empty PATCH (implemented as 200 no-op), or an unknown category (implemented as 404 `not_found` on `categoryId`).
- **SPG-5**: Name and notes have no length limits, and "nome" being required is implied but not stated (blank → 422).
- **SPG-6**: The spec does not define UI behavior when a delete or a status change fails. The implementation shows Portuguese text and, for status, rolls back.

## Security Notes

- **Authorization**: all four routes run their queries inside `request.withUser` (`authenticated` role + JWT claims → RLS). A foreign id answers 404 on PATCH and DELETE with no change (`iso.int:78-98`). Foreign accounts and categories are refused on create and edit (`iso.int:116-138`). No token, or a malformed one, gets 401 on every route (`iso.int:141-162`). PATCH validates the body before the lookup, the same as transactions. A 422 reveals nothing about whether a row exists, because it depends only on the body. The cross-field check runs after the lookup, so a foreign id always gets 404.
- **DB**: RLS is enabled, and the policy is limited to `authenticated` with `(select auth.uid())`. The composite FKs block cross-user references even for the admin role (`schema.int:126-137`). FKs are `no action`, so user deletion cascades (`schema.int:140-154`). `truncate` is revoked from anon and authenticated.
- **No API text in the UI**: `grep -rnE "error\.message|reason\.message" web/src/features` finds nothing (exit 1). Every UI error goes through `messageForError(..., "creditExpense")`. The untested delete path is gap 1.
- **Logging**: no `console`/`log` calls in the feature (`grep` exit 1). Unexpected errors go through the existing error plugin, which this feature does not change.
- **Money**: no coercion. JSON numbers, booleans, null, objects and arrays are rejected for `totalAmount`/`paidAmount`, and `"5"`, `5.5`, `0`, `32` and `1e21` for `recurrencyDay` (`ce.int:153-202`, mutants B10 and B11 killed).
- **Defense in depth**: a CHECK constraint backs each API rule (total, paid range, day, status, name).

## Requirement Traceability Update (suggested; spec.md not edited by the Verifier)

| Requirement | Previous | New |
| ----------- | -------- | --- |
| CARD-01 | Implementing | ✅ Verified |
| CARD-02 | Implementing | ✅ Verified |
| CARD-03 | Implementing | ✅ Verified |
| CARD-04 | Implementing | ✅ Verified |
| CARD-05 | Pending | ⏭️ Deferred to `dashboards` |

## Addendum (after the Verifier's PASS)

- Ranked gaps 1 and 3 closed by the orchestrator with test-only changes: `CreditExpensesPage.test.tsx` ("a failed delete shows the Portuguese message, never the API text, and keeps the row") and `CreditExpenseForm.test.tsx` ("does not offer an inactive account when creating" and "keeps the current inactive account visible, marked (inativa), when editing"). Both account tests were proven by mutation: `includeInactive` always on fails the create test, always off fails the edit test. Web suite: 199 tests in 26 files, typecheck clean, lint 0 errors.
- Ranked gap 2 (parallel PATCH test for the `for update` lock, B19) stays open: the database check keeps the data valid and a race would answer 500 instead of 422.


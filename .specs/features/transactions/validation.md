# Validation: transactions (backend T1-T12), iteration 1 - PASS

**Verdict**: PASS

Every AC the backend owns has a test that asserts the spec-defined outcome on persisted state or on the exact response. The build gate is green: 245 passed (70 unit, 175 integration), 0 failed, 0 skipped. The feature adds 125 tests (28 unit, 97 integration). Sensor: 27 code mutations, 27 killed; 7 SQL mutations in one rolled-back transaction, 6 flagged, 1 equivalent under the current constraint order (S5). Nothing blocks.

The top gap is a contract leniency, not a storage defect: Fastify's Ajv `coerceTypes` turns a JSON number sent as `amount` into a string before `parseAmount` runs. Measured: the JSON number `12345678901.239999999` is accepted and stored as `12345678901.24`. That input has more than 2 decimals, so on this off-contract path AC CRUD-3 is not enforced. No float reaches the database (the column gets a decimal string), and the documented contract (`amount: string`) is not affected.

**Iteration**: 1 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/transactions/spec.md`
**Diff range**: `16243c8..HEAD`. `HEAD` = `83e956be4fc9b85809c71137c81f2e441b22fdf9`, branch `feat/backend-transactions`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-tx`, now removed) and in one rolled-back psql transaction.

## Scope

In scope: backend tasks T1-T12 (`api/`, `supabase/migrations/0003_transactions.sql`, `.specs/features/transactions/`).
Out of scope: T13-T21 (web). The Lovable front end replaces them (`lovable.md`), so their unchecked boxes are expected and not graded. ACs the front owns are classified (c) and name the web file.

Classification key: (a) covered by API/DB tests in this diff; (b) delegated to an external service and recorded by a test; (c) front/Lovable responsibility; (d) deferred to a later feature.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown`, 21 task headings, no duplicated task blocks. T1-T12 boxes are all ticked; T13-T21 unchecked (expected).

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 migration | ✅ Done | `e7724e4` | - |
| T2 validators | ✅ Done | `f352f33` | - |
| T3 POST /transactions | ✅ Done | `20b8472` | Also wires the module in `app.ts` and `openapi.json` |
| T4 GET list + pagination | ✅ Done | `03e8bbd` | - |
| T5 filters | ✅ Done | `c226a91` | - |
| T6 search `q` | ✅ Done | `445cabe` | - |
| T7 sorting | ✅ Done | `76b9138` | - |
| T8 PATCH /transactions/:id | ✅ Done | `ea54346` | - |
| T9 DELETE /transactions/:id | ✅ Done | `583bcce` | - |
| T10 bulk category | ✅ Done | `7b83060` | Done-when reworded 422 -> 404 `not_found` by docs commit `83e956b` |
| T11 registry | ✅ Done | `a16ff99` | - |
| T12 isolation test | ✅ Done | `baaf0bc` | - |
| (docs) | - | `83e956b` | T10 wording, `on delete no action` comments in the categories module |

One commit per task, plus the final docs commit.

---

## Spec-Anchored Acceptance Criteria

Test paths: `T` = `api/test/transactions.int.test.ts`, `S` = `api/test/transactions-schema.int.test.ts`, `I` = `api/test/transactions-isolation.int.test.ts`, `U` = `api/src/modules/transactions/validation.test.ts`.

### P1: Tabela de extrato

| # | Criterion | Spec-defined outcome | Class | Evidence (`file:line` - assertion) | Status |
| - | --------- | -------------------- | ----- | ---------------------------------- | ------ |
| 1 | List all accounts' transactions, date desc, 50 per page | 50 items, date desc, rows of every account | a | `api/test/transactions.int.test.ts:262` - `toMatchObject({ total: 120, page: 1, pageSize: 50 })`; `:263` `toHaveLength(50)`; `:275` page 3 `toHaveLength(20)`; `:286` full 120-row order equals date desc with id tie-break; `:345` `type=Income` returns rows of both accounts | ✅ |
| 2 | Row shows date, name, account, category, payment method, type, amount, neutral, notes | API returns every display field | a (data) / c (render) | `api/test/transactions.int.test.ts:264` - keys equal the 15 Transaction fields; `:62` full-shape `toEqual`. Render: `web/src/features/transactions/TransactionsPage.tsx` | ✅ |
| 3 | Period, account, category, type, neutral filters combined | only rows matching all filters | a | `api/test/transactions.int.test.ts:343-347` each alone; `:356` `toEqual(['A2 food neutral'])` all four combined; `:359` period + type; `:365-368` period edges | ✅ |
| 4 | Search name contains text, ignoring case and accents | `cafe` finds `Café Central` and `CAFE` | a | `api/test/transactions.int.test.ts:478` - `toEqual(['CAFE', 'Café Central'])`; `:482-484`; `:493-497` `%`, `_`, `\` literal | ✅ |
| 5 | Sorting reorders the whole list, not the page | order holds across page 1 + page 2 | a | `api/test/transactions.int.test.ts:550-577` `expectOrdered` over 75 rows on 2 pages for name, amount (numeric, `:560-561`), category, date; killed M7-M10 | ✅ |
| 6 | Empty result shows "Nenhuma transação encontrada" | message on screen | a (data) / c (message) | `api/test/transactions.int.test.ts:305` and `:489` - `toEqual({ items: [], total: 0, page: 1, pageSize: 50 })`. Message: `web/src/features/transactions/TransactionsPage.tsx:266` | ✅ |
| 7 | BRL `R$ 1.234,56` and dates in the user's local zone | display format | c | API returns decimal strings and UTC instants (`api/test/transactions.int.test.ts:70`, `:71`). Formatting: `web/src/lib/format.ts` (`formatBRL`, `formatDateLocal`) | not graded |

### P1: CRUD manual

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Create valid; category *Sem categoria* when none given | 201, category Uncategorized | a | `api/test/transactions.int.test.ts:61` `toBe(201)`; `:66-67` `categoryId` = Uncategorized, `categoryName: 'Sem categoria'`; `:81` persisted row by value | ✅ |
| 2 | Amount <= 0 rejected with invalid-amount message | 422 `invalid_amount` | a | `api/test/transactions.int.test.ts:108-109` `toBe(422)`, `toEqual({ error: { code: 'invalid_amount', ..., field: 'amount' } })` for `0`, `0.00`, `-5.00`; `api/src/modules/transactions/validation.test.ts:31`; DB `api/test/transactions-schema.int.test.ts:47` | ✅ |
| 3 | More than 2 decimals rejected | 422 `invalid_amount` | a | `api/test/transactions.int.test.ts:102` (`1.234`) via `:109`; `api/src/modules/transactions/validation.test.ts:39-40`; PATCH `:705` | ✅ for strings. ⚠️ JSON-number path, see Gap 1 |
| 4 | Empty required field rejected, naming the field | rejection with field | a | `api/test/transactions.int.test.ts:113-115` blank name/type/occurredAt/paymentMethod `422` + `field`; `:119-121` blank accountId `invalid_account`; `:128-129` missing field `400` `validation_error` + `field: 'name'` | ✅ (status differs blank vs missing, see spec-precision) |
| 5 | Inactive or foreign account rejected on create | rejection | a | `api/test/transactions.int.test.ts:149-151` inactive `422 invalid_account` + nothing stored; `:157-160` foreign/unknown/malformed `422 invalid_account`; `api/test/transactions-isolation.int.test.ts:134` | ✅ |
| 6 | Receipt not http(s) rejected with invalid-URL message | 422 `invalid_receipt_url` | a | `api/test/transactions.int.test.ts:180-181` ftp/javascript/plain text; `api/src/modules/transactions/validation.test.ts:61` (adds `file:`, `https://`, empty) | ✅ |
| 7 | Edit any editable field persists and preserves the rest | changed field updated, others equal | a | `api/test/transactions.int.test.ts:651-652` response and listed row `toEqual({ ...original, amount: '99.90', name: 'Feira livre' })`; `:660-675` each field alone, then persisted `toEqual(expected)`; `:682-683` `{}` unchanged; `:726` rejected edits change nothing | ✅ |
| 8 | Confirmed delete removes for good | row gone | a | `api/test/transactions.int.test.ts:789-794` `204`, `exists(gone)` false, list no longer has it; `:797` second delete `404` | ✅ |
| 9 | Cancelling delete keeps the transaction | row kept | c | Confirmation dialog: `web/src/features/transactions/TransactionsPage.tsx:375` | not graded |
| 10 | Amount stored positive; direction only by type | amount > 0, type Income/Expense | a | `api/test/transactions-schema.int.test.ts:47` amount check; `:66-67` type check; `api/test/transactions.int.test.ts:81` persisted `amount: '123.45', type: 'Expense'`; `:88` `amount: '10.00', type: 'Income'` | ✅ |
| 11 | Each transaction identified by uuid | uuid id | a | `api/test/transactions.int.test.ts:63` - `stringMatching(uuid regex)` | ✅ |

### P1: Edição rápida de categoria

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Choosing a category in a row saves immediately | category persisted | a (API) / c (inline UI) | `api/test/transactions.int.test.ts:666` PATCH `categoryId` -> `categoryName: 'Contas'`, persisted `:675`; bulk with 1 id also works (`:865-873`). Inline selector: `web/src/features/transactions/TransactionsPage.tsx` | ✅ |
| 2 | Dashboards update on next read | next read reflects change | d | `dashboards` feature. The API keeps no cache; reads hit the table | deferred |
| 3 | Failed save restores the previous category with an error | rollback in the row | c | `web/src/features/transactions/hooks.ts` (optimistic update) | not graded |
| 4 | Multi-select applies category in one operation | all selected rows updated in one call | a | `api/test/transactions.int.test.ts:866` `204`; `:870-873` each of 5 rows `categoryId: food`, untouched row still Uncategorized | ✅ |
| 5 | Bulk failure keeps every row with the previous category | all or nothing | a | `api/test/transactions.int.test.ts:892-896` unknown/malformed/foreign id `404`, then `categoriesOf(mine)` all Uncategorized; `:907-910` unknown category; `api/test/transactions-isolation.int.test.ts:96`, `:106` B's own row unchanged too | ✅ |

### P1: Transferência neutra manual

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Toggling neutral persists | new value stored | a | `api/test/transactions.int.test.ts:690-691` on, persisted; `:693-694` off, admin row `[{ neutral: false }]`; create `:88` | ✅ |
| 2 | Filter by neutral returns only that value | `neutral` equals chosen value | a | `api/test/transactions.int.test.ts:351-352` - `toEqual([...])` for true and false | ✅ |
| 3 | Neutral excluded from income, expenses, trend, categories, net worth | rules in `dashboards` | d | `dashboards` feature (AD-003 `rules.ts`) | deferred |
| 4 | Neutral rows visually marked | badge | c | `web/src/features/transactions/TransactionsPage.tsx` | not graded |

**Count**: 27 ACs. a = 19 (of which 4 split with a front part), b = 0, c = 4 (Tabela-7, CRUD-9, Categoria-3, Neutra-4), d = 2 (Categoria-2, Neutra-3), GAP = 0. The JSON-number path of CRUD-3 is listed as Gap 1 (non-blocking).

---

## Edge Cases

- [x] Type or amount change applies on the next dashboard read: API part (a), PATCH persists `type` and `amount` (`api/test/transactions.int.test.ts:652`, `:661`, `:675`). Dashboard part (d).
- [x] Category deleted with reassignment shows the destination: (a) `api/test/transactions.int.test.ts:994-997` - listed rows show `{ categoryId: health, categoryName: 'Saúde' }`; failure keeps rows `:1012`, `:1048`; `reassign_required` `:976`. Killed M16.
- [x] Date near midnight shown in the local day of the stored UTC instant: storage and contract (a), offset input normalized to UTC (`api/test/transactions.int.test.ts:70`, `:662`); period filter edges (a) in `America/Sao_Paulo` `:411`, `Asia/Tokyo` `:424`, `UTC` `:433`, default zone `:420`, exclusive next-midnight `:442-447`. Display (c) `web/src/lib/format.ts`.

Design risks checked:

- [x] Deleting a user who owns accounts, categories and transactions succeeds: `api/test/transactions-schema.int.test.ts:103-107` (real GoTrue admin delete, then 0 rows in each table). FKs are `on delete no action` in `supabase/migrations/0003_transactions.sql:27-28`.
- [x] `unaccent` lives in `extensions` and is callable by `authenticated`: `api/test/transactions-schema.int.test.ts:113` - `toBe('Cafe Acao')`; migration grants `usage on schema extensions` (`0003_transactions.sql:6`).
- [x] Cross-user references blocked by composite FKs, even bypassing RLS: `api/test/transactions-schema.int.test.ts:80-91`.

---

## API contract vs `lovable.md`

| Item | Lovable contract | API | Match |
| ---- | ---------------- | --- | ----- |
| Transaction shape | 15 fields, `amount` string, `occurredAt` ISO UTC | Same (`api/test/transactions.int.test.ts:62-78`) | ✅ |
| `GET /transactions` | `{ items, total, page, pageSize: 50 }`, filters, `sort` ∈ date/name/amount/category, `order` asc/desc, default date desc | Same | ✅ |
| `POST /transactions` | body without `neutral` -> Transaction | 201 Transaction; also accepts optional `neutral` (superset) | ✅ |
| `PATCH /transactions/:id` | partial body incl. `neutral` -> Transaction | Same | ✅ |
| `DELETE /transactions/:id` | 204 | 204, empty body (`:789-790`) | ✅ |
| `PATCH /transactions/category` | `{ ids, categoryId }` -> 204, atomic | Same; unknown category 404 `not_found` on `categoryId`, as the Lovable correction message asks | ✅ |
| Error codes | `invalid_amount`, `invalid_account`, `invalid_receipt_url` (422 + field), 404 | Same; other semantic errors `validation_error` 422 + field; missing body field 400 `validation_error` | ✅ (see spec-precision 1) |

T10 deviation: the bulk route answers 404 `not_found` on `categoryId` for an unknown category, the same as POST (`:169-170`) and PATCH (`:715-716`). The test carries `// SPEC_DEVIATION` at `api/test/transactions.int.test.ts:899`. `tasks.md` T10 now says 404, so the comment's "tasks.md T10 says 422" is stale wording, not a live deviation.

---

## Check C: reverse mapping

Every new test maps to an AC, an edge case, a task Done-when or a design/lesson item. Tests outside the spec ACs, all justified:

| Test | Maps to |
| ---- | ------- |
| `api/test/transactions-schema.int.test.ts:116` truncate denied | T1 RLS hardening (same rule as accounts-categories) |
| `api/test/transactions.int.test.ts:308` invalid `page` 422 | T4 robustness |
| `api/test/transactions.int.test.ts:450` invalid `X-Timezone` 400 | AD-005 / T5 |
| `api/test/transactions.int.test.ts:913`, `:924` bulk cap 1..500 | Lesson "enforce limits server-side" |
| `api/test/transactions.int.test.ts:876` duplicates counted once, any case | Lesson "state how duplicates are compared" |
| 401 tests (`:190`, `:314`, `:758`, `:824`, `api/test/transactions-isolation.int.test.ts:154`) | Lesson L-001 (routes without their own guard) |

No test maps to nothing.

**Check B (shallow assertions)**: assertions target values and persisted state. Two are weaker than the rest: `api/test/transactions.int.test.ts:115` checks only `field` (not `code`) for blank text fields, and `api/test/transactions-isolation.int.test.ts:101` checks only `code`. Both are backed by a by-value state check right after. Not a gap.

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (Build gate, API half; the web half belongs to the superseded T13-T21)
- **Exit code**: 0. typecheck clean, lint clean
- **Unit**: 6 files, 70 passed
- **Integration**: 15 files, 175 passed
- **Total**: 245 passed, 0 failed, 0 skipped
- **Test count before feature**: 120 (42 unit, 78 integration, matches the accounts-categories report)
- **Test count after feature**: 245. **Delta**: +125 (28 unit in `validation.test.ts`; 97 integration: 85 `transactions.int`, 8 `transactions-schema.int`, 4 `transactions-isolation.int`)
- **Skip markers**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api` returns nothing
- No existing test deleted or weakened (the diff touches no pre-existing test file)

---

## Discrimination Sensor

Depth: P0-full (data integrity and authorization). Control run in the scratch worktree before mutating: `transactions.int` + `transactions-isolation.int` 89/89 passed.

### Code mutations (scratch worktree)

| # | File | Mutation | Outcome | Killing test |
| - | ---- | -------- | ------- | ------------ |
| M1 | `routes.ts:301` | create accepts inactive account (drop `and active`) | ✅ Killed | `T:145` inactive account |
| M2 | `routes.ts:308` | default category `Food` instead of `Uncategorized` | ✅ Killed | `T:59` Sem categoria default (+4) |
| M3 | `routes.ts:183` | `to` inclusive of next-day midnight (`<` -> `<=`) | ✅ Killed | `T:410`, `T:423`, `T:441` |
| M4 | `routes.ts:179` | `from` uses UTC instead of `request.tz` | ✅ Killed | `T:410`, `T:423`, `T:441` |
| M5 | `routes.ts:200` | `q` stops ignoring accents on the name | ✅ Killed | `T:477`, `T:481`, `T:500` |
| M6 | `routes.ts:172` | `q` stops escaping `%`, `_`, `\` | ✅ Killed | `T:492` |
| M7 | `routes.ts:231` | sort loses the id tie-break | ✅ Killed | `T:280`, `T:557`, `T:565` |
| M8 | `routes.ts:231` | tie-break always `asc` | ✅ Killed | `T:280`, `T:557` |
| M9 | `routes.ts:227` | amount sort lexical (`t.amount::text`) | ✅ Killed | `T:557` |
| M10 | `routes.ts:347`, `:351` | sort only the fetched page (SQL date order + JS sort after LIMIT) | ✅ Killed | `T:549`, `T:557`, `T:565`, `T:573` |
| M11 | `routes.ts:431` | bulk ignores affected-row count (non-atomic) | ✅ Killed | `T:883`, `I:82` |
| M12 | `routes.ts:418` | bulk without de-duplication | ✅ Killed | `T:876` |
| M13 | `routes.ts:271` | PATCH nulls `notes` when not provided | ✅ Killed | `T:646` (+4) |
| M14 | `routes.ts:386` | PATCH `{}` returns 404 | ✅ Killed | `T:678` |
| M15 | `routes.ts:404` | DELETE returns 204 for unknown id | ✅ Killed | `T:784`, `T:801` |
| M16 | `routes.ts:23` | `transactions` not registered in the category registry | ✅ Killed | `T:970`, `T:984` |
| M17 | `validation.ts:3` | `parseAmount` accepts 3 decimals | ✅ Killed | `U:38`, `T:106`, `T:697` |
| M18 | `validation.ts:16` | `parseAmount` accepts zero | ✅ Killed | `U:30`, `T:106` |
| M19 | `validation.ts:40` | `parseReceiptUrl` drops the protocol check (accepts `javascript:`, `ftp:`) | ✅ Killed | `U:58`, `T:174` |
| M20 | `routes.ts:375-376` | PATCH skips the account existence check | ✅ Killed | `T:697`, `I:128` |
| M21 | `routes.ts:367` | PATCH skips the row existence check | ✅ Killed | `T:729`, `I:82` |
| M22 | `routes.ts:324` | create ignores `neutral` | ✅ Killed | `T:84` |
| M23 | `routes.ts:373` | PATCH requires an active account | ✅ Killed | `T:743` |
| M24 | `routes.ts:195` | `neutral` filter inverted | ✅ Killed | `T:350`, `T:355` |
| M25 | `routes.ts:348` | page offset off by one | ✅ Killed | `T:272` (+31) |
| M26 | `routes.ts:426` | bulk skips the category existence check | ✅ Killed | `T:902`, `I:128` |
| M27 | `routes.ts:343` | `total` ignores the filters | ✅ Killed | `T:342`, `T:355`, `T:487`, `T:500` |

Auth hook on transactions routes: reasoned, not mutated (live auth untouched). The routes have no guard of their own. Removing them from the global `onRequest` hook (for example by adding them to `isPublicRoute`) would fail the five 401 assertions in `api/test/transactions-isolation.int.test.ts:166-169`, which cover every route and also check that nothing changed (`:170`).

### SQL mutations (one psql transaction, savepoints, final `ROLLBACK`; control before each)

| # | Object | Mutation | Control | Mutant | Outcome |
| - | ------ | -------- | ------- | ------ | ------- |
| S1 | `transactions_amount_check` | dropped | insert amount 0 -> ERROR check | insert succeeds; `S:47` would fail | ✅ Flagged |
| S2 | composite account FK | replaced by simple FK `account_id -> accounts(id)` | cross-user admin insert -> ERROR fk | insert succeeds; `S:87-91` would fail | ✅ Flagged |
| S3 | `transactions_all` policy | `using (true) with check (true)` | B sees 0 rows | B sees 1 row; `S:133` would fail | ✅ Flagged |
| S4 | `usage on schema extensions` | revoked from `authenticated` | `unaccent('Café')` = `Cafe` | permission denied; `S:112` and every `q` test would fail | ✅ Flagged |
| S5 | composite FKs | `on delete no action` -> `on delete restrict` | delete user -> DELETE 1 | delete user -> DELETE 1 | ⚠️ Equivalent under the current constraint order |
| S6 | `transactions_type_check` | dropped | insert `Transfer` -> ERROR check | insert succeeds; `S:66` would fail | ✅ Flagged |
| S7 | truncate privilege | granted to `authenticated` | truncate -> permission denied | truncate succeeds; `S:118` would fail | ✅ Flagged |

S5 note: `restrict` versus `no action` only differs when the FK check fires before the cascade from `auth.users` removes the referenced rows, which depends on constraint creation order (design risk table). With the FKs re-created after the cascade FKs, the delete still succeeds, so the mutant has the same behavior and no test can tell them apart in this state. The test (`S:94`) checks the outcome that matters: the user delete succeeds. Not a critical survivor.

**Sensor outcome**: 27/27 code mutations killed; 6/7 SQL mutations flagged, 1 equivalent. PASS.

---

## Isolation Proof

- Real tree `git status --porcelain`: empty before; after, only this report (`.specs/features/transactions/validation.md`).
- `HEAD` unchanged: `83e956be4fc9b85809c71137c81f2e441b22fdf9`.
- `git worktree list`: only the main worktree. `/Volumes/MacOnlySSD/dev/personal/.verify-tx` removed with `git worktree remove --force` and `git worktree prune`. The scratch `api/node_modules` was a symlink; the real `api/node_modules` is intact.
- No `git stash` used.
- DB structure: a snapshot of public tables, policies, indexes, extensions, `unaccent` function ACLs, schema ACLs (`extensions`, `public`), constraints, table ACLs and `supabase_migrations` (`0001`, `0002`, `0003`) is byte-identical before and after (`diff` empty).
- Probe objects: no relation or function matching `%probe%` (covers `category_ref_probe*` and `txn_reassign_probe*`).
- Counts: `auth.users`, `transactions`, `accounts`, `categories` = 0 before and 0 after. Test users are created and removed by `cleanupTestUsers`; the SQL sensor's two users lived only inside the rolled-back transaction.
- Probe for the coerceTypes check: a throwaway test file in the scratch worktree, using throwaway users removed by `cleanupTestUsers`; deleted before the sensor ran.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ One routes module, a schema module with the row mapping, two validators |
| Surgical changes | ✅ Outside the module: `app.ts` registration, registry comment, one comment in `categories/routes.ts` (FK wording now matches the migration) |
| No scope creep | ✅ `neutral` on create is a small superset of the Lovable body; everything else is in the spec or design |
| Single-use abstractions | ✅ `selectColumns`/`fromJoins`/`toTransaction` are used by 4 routes |
| Matches patterns | ✅ Same `AppError` + `withUser` + TypeBox style as accounts/categories |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage (validators 1:1; every route happy + edge + error) | ✅ |
| Every test maps to a requirement | ✅ (Check C) |
| Documented guidelines followed | none in the repo; strong defaults and `.specs/LESSONS.md` applied |

---

## Security Notes

- Every handler touches data only inside `request.withUser` (POST `routes.ts:297`, GET `:341`, PATCH `:364`, DELETE `:403`, bulk `:422`), so RLS applies under `authenticated`. The `postgres` role bypasses RLS, so this is the isolation boundary. It is covered by `api/test/transactions-isolation.int.test.ts` and killed M11, M20, M21, M26.
- Foreign rows answer 404 with the same body as unknown ids. PATCH checks the row before reading the body's references (`routes.ts:366-367`). Foreign accounts answer `invalid_account` and foreign categories `not_found`, the same as nonexistent ones, so nothing leaks.
- SQL: all values are bound parameters through postgres.js tagged templates. `tx(patch)` takes column names only from the code-built `TransactionPatch` keys. `tx(ids)` binds a list. The registry quotes table identifiers.
- `LIKE`: `%`, `_`, `\` escaped with `escape '\\'` (killed M6).
- Limits: page size fixed at 50; `page` limited to 9 digits; bulk 1..500 ids enforced server-side (`routes.ts:415-416`). `q`, `name` and `notes` have no length cap beyond Fastify's 1 MiB body limit and Node's header size for query strings (low risk for a personal app).
- 500 errors return a generic body (`errors.ts`); validation messages expose only schema paths.
- `receipt` is limited to absolute `http`/`https` URLs with a host (WHATWG parser), which blocks `javascript:` and `data:` at write time.
- **coerceTypes (Gap 1)**: Fastify's default Ajv runs with `coerceTypes: 'array'`. Measured on the real API (scratch inject): JSON number `10.5` -> stored `"10.50"`; `1e2` -> `"100.00"`; `0.1` -> `"0.10"`; `1e21`, `0.30000000000000004`, `1.005`, `999999999999.995`, `-0`, `100000000000000000000` -> 422 `invalid_amount`; **`12345678901.239999999` -> 201, stored `12345678901.24`**. `neutral: "true"` -> `true`; `ids: "<uuid>"` -> `[uuid]`. The database never receives a float: the coerced string goes through `parseAmount` and into `numeric(14,2)`. But a JSON number passes through IEEE-754 in `JSON.parse`, so a number with more than ~15 significant digits can be silently rounded to 2 decimals instead of rejected.
- numeric(14,2) rounding: the column rounds 3-decimal input (shown by `S:56`, `0.004` -> check violation after rounding). Every write path validates first: POST (`routes.ts:291`), PATCH (`:269`). The bulk route writes only `category_id`. No route writes `amount` without `parseAmount`.

---

## Ranked Gaps (none blocking)

1. **JSON-number `amount` is coerced, not rejected (Minor, AD-004 / CRUD-3).** `routes.ts:33`, `:47` declare `Type.String()`, and Ajv `coerceTypes` converts numbers first. Effect: off-contract number input is accepted, and a number with more than ~15 significant digits (e.g. `12345678901.239999999`) is rounded and stored instead of rejected. No float is stored. Fix task: make `amount` strictly a string (disable coercion for the transactions schemas, e.g. a route-level `validatorCompiler` with `coerceTypes: false`, or check `typeof` in a `preValidation` hook), answer 422 `invalid_amount` for a JSON number, and add an integration test sending `"amount": 12345678901.239999999` and `"amount": 10.5`. Alternatively, record the leniency as a decision in `STATE.md` and the OpenAPI description.
2. **Missing vs blank required field use different statuses (Minor, contract).** Missing field -> 400 `validation_error` (`api/test/transactions.int.test.ts:128`); blank -> 422 (`:114`). Both name the field, which satisfies CRUD-4, but the front has to handle two statuses. Same pattern as the accounts-categories gap; decide once for the whole API.
3. **Stale bookkeeping (Cosmetic).** `spec.md` traceability still says "Coverage: 8 total, 0 mapped to tasks, 8 unmapped" and statuses are "Implementing". The `SPEC_DEVIATION` comment at `api/test/transactions.int.test.ts:899` says tasks.md asks for 422; tasks.md now says 404.
4. **S5 equivalent mutant (Informative).** `restrict` and `no action` behave the same under the current constraint order; the test checks the outcome (user delete succeeds), which is the right guard.

## Spec-Precision Gaps

1. CRUD-4 does not give a status for an empty required field. The API answers 422 for blank values and 400 for absent keys; both name the field.
2. CRUD-2/3/6 say "mensagem de valor inválido / URL inválida" without the code or status; `design.md` and `lovable.md` fix them (`invalid_amount`, `invalid_receipt_url`, 422) and the tests assert those.
3. CRUD-5 does not say how an unknown or foreign *category* on create is answered; the API uses 404 `not_found` on `categoryId`, consistent across create, edit and bulk (`lovable.md` correction message).
4. Tabela-4 does not say how `%`/`_` in the search text are treated, or whether accents are folded in the typed text; the API treats them literally and folds both sides (asserted at `api/test/transactions.int.test.ts:482`, `:492-497`).
5. Tabela-5 does not define name collation; the API sorts names by the database collation, not normalized for case or accents (documented at `routes.ts:220-221`).
6. The spec does not state whether a JSON number is acceptable for `amount` (see Gap 1); AD-004 implies it is not.

---

## Requirement Traceability Update (suggested; spec.md not edited by the Verifier)

| Requirement | Previous | Suggested |
| ----------- | -------- | --------- |
| TXN-01 | Implementing | ✅ Verified (API) |
| TXN-02 | Implementing | ✅ Verified (API) |
| TXN-03 | Pending | Front (Lovable) |
| TXN-04 | Implementing | ✅ Verified (API), Gap 1 open |
| TXN-05 | Implementing | ✅ Verified (API) |
| TXN-06 | Implementing | ✅ Verified (API); inline rollback is front |
| TXN-07 | Implementing | ✅ Verified (API) |
| TXN-08 | Implementing | ✅ Verified (API); dashboard exclusion deferred |

## Summary

**Overall**: ✅ Ready (backend)

**Spec-anchored check**: 27 ACs: 19 (a) with evidence, 0 (b), 4 (c), 2 (d), 0 gaps; 6 spec-precision gaps.
**Sensor**: 27/27 code mutations killed; 6/7 SQL mutations flagged, 1 equivalent.
**Gate**: 245 passed (70 unit, 175 integration), 0 failed, 0 skipped.

**Next steps**: route Gap 1 (strict string `amount`) as an optional fix task or record it as a decision; settle the 400/422 policy for missing fields API-wide; refresh spec.md traceability.

## Addendum (after the Verifier's PASS)

- **Ranked gap 1 (JSON-number `amount` coerced) closed in `460f892`**: `amount` is no longer coerced by Ajv; a non-string `amount` answers 422 `invalid_amount` with `field: "amount"` on POST and PATCH, covered by 7 unit and 16 integration assertions. The implementer proved discrimination by mutation (removing the `typeof` check fails 2 unit tests; restoring coercion fails 12 integration tests). The orchestrator re-ran the Build gate at `460f892`: 77 unit + 193 integration passed, 0 failed, typecheck and lint clean. This change was not re-verified by a fresh Verifier; it is a hardening of an existing validation with its own mutation proof.
- Gap 2 (missing vs blank required field: 400 vs 422) remains an open API-wide decision shared with accounts-categories.
- Gap 3 (stale bookkeeping) closed in the docs commit that follows this report.

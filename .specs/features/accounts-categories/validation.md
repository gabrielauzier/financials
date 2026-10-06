# Validation: accounts-categories (backend T1-T11), iteration 1 - PASS

**Verdict**: PASS

Every AC the backend owns has a test that asserts the spec-defined outcome on persisted state. The build gate is green: 120 passed (42 unit, 78 integration), 0 failed, 0 skipped. Sensor: 20 code mutations, 19 killed, plus 5 SQL mutations, all shown to be flagged. The one survivor (M17, the `deleted.count === 0` guard in DELETE /categories) only differs under a concurrent delete of the same row, so it is not a critical survivor. Nothing blocks. The remaining gaps are minor: a contract mismatch on missing body fields (400 instead of 422), unspecified duplicate-matching rules, no 401 test on the categories routes, and stale spec bookkeeping.

**Iteration**: 1 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/accounts-categories/spec.md`
**Diff range**: `cf63635..HEAD`. `HEAD` = `43e59bd6b8f1456777ce913d882d071e4c2fb522`, branch `feat/backend-accounts-categories`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations ran only in a temporary worktree and in rolled-back psql transactions.

## Scope

In scope: backend tasks T1-T11 (`api/`, `supabase/migrations/0002_accounts_categories.sql`, `.specs/features/accounts-categories/`).
Out of scope: T12-T16 (web). The Lovable front end replaces them (`lovable.md`), so their unchecked boxes are expected and not graded. ACs the front owns are classified (c) and listed with the web file.

---

## Task Completion

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 migration | ✅ Done | `fd9be71` | - |
| T2 normalize helper | ✅ Done | `a8adc78` | Box ticked by docs commit `43e59bd` |
| T3 POST /accounts | ✅ Done | `1cf061a` | - |
| T4 GET /accounts | ✅ Done | `445d8c5` | - |
| T5 PATCH /accounts/:id | ✅ Done | `9c7d484` | - |
| T6 activate/deactivate | ✅ Done | `d8b2d0b` | - |
| T7 GET /categories | ✅ Done | `dc528e6` | - |
| T8 POST /categories | ✅ Done | `a909a02` | - |
| T9 PATCH /categories/:id | ✅ Done | `c07733e` | - |
| T10 DELETE /categories/:id | ✅ Done | `09e9709` | Subject is 77 characters (above the usual 72) |
| T11 isolation test | ✅ Done | `326e9b9` | Type is `test(...)`, tasks.md says `feat(...)`. Accepted: the commit only adds a test |

Exactly one commit per task. Extra commit: `43e59bd` (docs) removes a duplicated task-breakdown block that commit `a8adc78` added, and ticks T2. After it, `tasks.md` is well-formed: 16 `### Tn:` headings, no duplicates, all T1-T11 boxes ticked, only T12-T16 boxes unchecked.

Record anomalies (non-blocking):
- `spec.md` Requirement Traceability still says `Implementing` and "**Coverage:** 7 total, 0 mapped to tasks, 7 unmapped ⚠️". That line is stale: tasks map every ID. The Verifier does not edit `spec.md`. Suggested update: ACCT-01, ACCT-02, CAT-01..CAT-04 to Verified (backend). ACCT-03 stays Pending (deferred to import/transactions).

---

## Spec-Anchored Acceptance Criteria

Classes: **a** = covered by API/DB tests in this diff. **b** = delegated to an external service and recorded by a test (none in this feature). **c** = front (Lovable) responsibility, not graded. **d** = deferred to a later feature.

Test files: `api/test/accounts.int.test.ts` (ACC), `api/test/categories.int.test.ts` (CAT), `api/test/accounts-categories-schema.int.test.ts` (SCH), `api/test/accounts-categories-isolation.int.test.ts` (ISO), `api/src/lib/normalize.test.ts` (NRM).

### P1: Gerenciar contas

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 1 Create with bank, nickname, at least one holder: persisted as active | a | Row exists, `active = true` | `api/test/accounts.int.test.ts:36` `expect(res.statusCode).toBe(201)`; `:37-44` body `toEqual({... active: true ...})`; `:47` DB row `toEqual([{ user_id: user.id, active: true, holder_names: ['Maria Silva', 'Maria Silva LTDA'] }])` | ✅ PASS |
| 2 Duplicate nickname rejected with a duplicate-nickname message | a (+c message text) | Rejection, duplicate code | `api/test/accounts.int.test.ts:53` `toBe(409)`; `:54` `toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'nickname' } })` (case and spaces differ: `'  dUP conta '`). DB: `api/test/accounts-categories-schema.int.test.ts:104-105` `rejects.toThrow(/accounts_nickname_uq/)`. PATCH: `api/test/accounts.int.test.ts:185-186`. pt-BR text: `web/src/features/accounts/AccountForm.tsx` | ✅ PASS |
| 3 No holder rejected with a holder-required message | a (+c message text) | Rejection, holder-required code | `api/test/accounts.int.test.ts:63-64` `toBe(422)` and `toEqual({ error: { code: 'holder_required', ..., field: 'holderNames' } })` for `[]` and `['   ']`; PATCH `:188-189`. DB check `cardinality >= 1` in the migration | ✅ PASS. ⚠️ An omitted `holderNames` key answers 400 `validation_error`, not 422 `holder_required` (`api/test/accounts.int.test.ts:96-98`). See gap 1 |
| 4 Edit nickname, bank or holders: saved, transactions untouched | a (edit) + d (transactions) | Edits persist; other fields stay | `api/test/accounts.int.test.ts:158-165` body `toEqual({... nickname: 'Renomeada', holderNames: ['Ana', 'Bia'] ...})`; `:168` bank-only patch keeps nickname and holders; `:171` GET reflects it. Transactions do not exist yet; the edit only updates `accounts` | ✅ PASS (edit). Transactions part: d (transactions) |
| 5 Deactivate: inactive, transactions not changed, moved or removed | a (flag, row kept) + d (transactions) | `active = false`, row kept | `api/test/accounts.int.test.ts:224` `toMatchObject({ id: acc.id, active: false })`; `:226` DB `toEqual([{ active: false }])` | ✅ PASS (flag). Transactions part: d (transactions) |
| 6 Inactive account hidden from selection in new transactions and imports | a (API filter) + c (selector) | `active=true` list omits it | `api/test/accounts.int.test.ts:144` `expect(await ids('?active=true')).toEqual([kept.id])`; `:256` after deactivate `?active=true` is `[]`. Selector: `web/src/features/accounts/AccountSelect.tsx`. Enforcement on transaction/import create: d | ✅ PASS (API). Front: c. Server-side rejection of an inactive account on new transactions: d (transactions, import) |
| 7 Inactive account's holder names still used in neutral detection | a (holders readable) + d (detection) | Holders available for inactive accounts | `api/test/accounts.int.test.ts:253` `toEqual([expect.objectContaining({ id, active: false, holderNames: ['Maria Silva', 'Maria Silva LTDA'] })])`; `:255` same via `?active=false` | ✅ PASS (data). Detection: d (import) |
| 8 Reactivate: selectable again | a | `active = true` again | `api/test/accounts.int.test.ts:230` `toMatchObject({ id: acc.id, active: true })`; `:231` DB `toEqual([{ active: true }])`; filter `:144` lists active rows | ✅ PASS |
| 9 No account delete operation offered or exposed | a (+c) | No route; DB refuses | `api/test/accounts.int.test.ts:238` `DELETE` `toBe(404)`; `:239` row kept `toHaveLength(1)`; `api/test/accounts-categories-schema.int.test.ts:86` `rejects.toThrow(/permission denied/)`, `:88` row kept. Front: `web/src/features/accounts/AccountsPage.tsx` (no delete control) | ✅ PASS |
| 10 Inactive account's transactions included in filters, table, calculations | d | - | Deferred: transactions / dashboards | ➖ Deferred |

### P1: Categorias iniciais e de sistema

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 1 New user seeded with 17 categories with the spec identifiers | a | 17 rows, exact keys | `api/test/accounts-categories-schema.int.test.ts:50` `toHaveLength(17)`; `:51` `[key, name]` pairs `toEqual(SEEDED)` (the 17 spec pairs, `:19-37`). Via API: `api/test/categories.int.test.ts:65-66` | ✅ PASS |
| 2 Names displayed in Portuguese (exact list) | a (stored names) + c (display) | Exact pt-BR names | Same assertions: `api/test/accounts-categories-schema.int.test.ts:51`, `api/test/categories.int.test.ts:66` `toEqual(SEEDED_BY_NAME)`, including "Ajuda (a terceiros)" and "Estorno (de compras)". Display: `web/src/features/categories/CategoriesPage.tsx` | ✅ PASS |
| 3 Reversal, Uncategorized, Investments marked as system | a | Exactly those 3 `is_system` | `api/test/accounts-categories-schema.int.test.ts:52-56` `toEqual(['Investments', 'Reversal', 'Uncategorized'])`; `api/test/categories.int.test.ts:66` per-row `isSystem` | ✅ PASS |
| 4 Rename or delete of a system category rejected with 403 and protected message | a | 403 `category_protected` | Rename: `api/test/categories.int.test.ts:164-165` `toBe(403)`, `toEqual({ error: { code: 'category_protected', message: expect.any(String) } })`; `:166` row unchanged. Delete (with and without `reassignTo`): `:295-296`, `:298` still exists. DB layer: `api/test/accounts-categories-schema.int.test.ts:62,64` `count` `toBe(0)` with positive control `:73` | ✅ PASS |
| 5 System categories assignable to transactions | d (+a partial) | - | Partial: a system category is accepted as a reassignment destination, `api/test/categories.int.test.ts:376-379` `toEqual([uncategorized.id, uncategorized.id, keep.id])`. Assignment on transactions: d (transactions) | ➖ Deferred (transactions) |

### P1: Gerenciar categorias próprias

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 1 Create with non-empty name: persisted as regular | a | Row with `is_system = false` | `api/test/categories.int.test.ts:93-99` `toEqual({ ..., key: null, name: 'Mercado', isSystem: false })`; `:103` DB `toEqual([{ user_id: user.id, key: null, name: 'Mercado', is_system: false }])` (client `isSystem: true` ignored) | ✅ PASS |
| 2 Case-insensitive duplicate name rejected with duplicate message | a | Rejection, duplicate code | `api/test/categories.int.test.ts:122-123` `toBe(409)`, `toEqual({ error: { code: 'duplicate_name', ..., field: 'name' } })` for `VIAGEM`, `  viagem `, `ALIMENTAÇÃO`; `:125` count unchanged. PATCH: `:177-178`. DB: `api/test/accounts-categories-schema.int.test.ts:112,116` | ✅ PASS |
| 3 Rename a regular category: all linked transactions kept | a (structural) + d (transactions) | Same row (id, key) | `api/test/categories.int.test.ts:145` `toEqual({ id: food.id, key: 'Food', name: 'Mercado', isSystem: false })`; `:146-148` DB row. Links are by `id`, which does not change | ✅ PASS (id invariance). Real transactions: d |
| 4 Delete an unused regular category: removed | a | 204, row gone | `api/test/categories.int.test.ts:280` `toBe(204)`; `:282` `categoryExists` `toBe(false)`; `:284` list has 16 | ✅ PASS |
| 5 Delete an in-use category with destination: all rows reassigned, category removed in the same operation | a (registry probe) + d (real tables) | Rows moved; category gone | `api/test/categories.int.test.ts:377` `toBe(204)`; `:378` category gone; `:379` `toEqual([uncategorized.id, uncategorized.id, keep.id])`; `:380` another user's rows untouched. Real tables register in `api/src/modules/categories/registry.ts` later | ✅ PASS (mechanism). Registration of `transactions` / `credit_expenses`: d |
| 6 Delete in use without destination: rejected asking for destination | a | 422 `reassign_required` | `api/test/categories.int.test.ts:310-311` `toBe(422)`, `toEqual({ error: { code: 'reassign_required', ..., field: 'reassignTo' } })`; `:312-313` category and rows kept | ✅ PASS |
| 7 Reassignment fails: category and rows unchanged | a | Full rollback | `api/test/categories.int.test.ts:355` `toBe(500)`; `:359` category exists; `:360` first table's rows still `[help.id, help.id]` (updated then rolled back); `:361` failing table unchanged | ✅ PASS |

**Totals**: 22 ACs. a = 16 (fully backend), a+d split = 5 (ACCT 4, 5, 7; CAT-own 3, 5, counted as a for the backend part), d only = 2 (ACCT 10, CAT-sys 5), c only = 0 (c portions noted on ACCT 2, 3, 6, 9 and CAT-sys 2), b = 0, GAP = 0. Counted once each: a = 20, d = 2, c = 0, b = 0, gaps = 0.

### Edge cases

| Edge case | Class | `file:line` + assertion | Result |
| --------- | ----- | ----------------------- | ------ |
| Category or nickname with only spaces rejected as empty | a | Category: `api/test/categories.int.test.ts:111-112` `toBe(422)`, `toEqual({ error: { code: 'validation_error', ..., field: 'name' } })`, `:114` nothing created; PATCH `:182-183`. Nickname: `api/test/accounts.int.test.ts:70-71` `toBe(422)`, `field: 'nickname'`; PATCH `:190`. DB checks `length(btrim(...)) > 0` | ✅ PASS |
| Destination equal to the deleted category rejected | a | `api/test/categories.int.test.ts:325-326` `toBe(422)`, `toEqual({ error: { code: 'validation_error', ..., field: 'reassignTo' } })` for the same id and its uppercase form; `:339-341` nothing changed | ✅ PASS |
| Holder name trimmed and duplicates in the same account rejected | a | Trim: `api/test/accounts.int.test.ts:40,47` stored `['Maria Silva', 'Maria Silva LTDA']` from `'  Maria Silva '`; PATCH `:162`. Duplicate: `:78-79` `toBe(422)`, `field: 'holderNames'` for `'João Silva'` vs `' joao   SILVA '`; PATCH `:191` | ✅ PASS. ⚠️ "Duplicate" is matched with `normalizeName` (case, accents, inner spaces). The spec does not define it. See spec-precision gaps |

### Spec-precision gaps

1. **What counts as a duplicate holder name.** The spec says "rejeitar duplicatas" only. The API treats `João Silva` and `joao  SILVA` as duplicates (accent-, case- and space-insensitive). Reasonable, and it matches import's matching key, but it is a decision the spec should record.
2. **Category duplicate matching ignores case only, not accents.** `Alimentacao` and `Alimentação` can coexist. This matches the spec text ("sem diferenciar caixa"). The Lovable checklist (finding 7) asked to confirm this: the real API is accent-sensitive.
3. **Account nickname uniqueness is case-insensitive and trims ends.** The spec only says "único por usuário". Stricter than the text. Harmless, but not written down.
4. **Category list order is undefined in the spec.** The API sorts by `lower(name), id`, and the test asserts that order (`api/test/categories.int.test.ts:66`). `lower()` under the DB collation places "Emergência" after "Desejos", which is fine, but the order is an implementation choice.
5. **Error message text.** The spec asks for "mensagem de apelido duplicado / titular obrigatório / categoria protegida / nome duplicado / pedindo a categoria destino". The API returns stable codes plus English messages. The pt-BR text is the front's job (`lovable.md`). The spec should say "code", not "message", for the API.
6. **Name length limits.** No maximum for nickname, holder names or category names. Not in the spec. Low risk.

---

## Lovable contract check (API shapes)

| Contract item | API | Evidence | Result |
| ------------- | --- | -------- | ------ |
| `Account = { id, bank, nickname, holderNames, active, createdAt }` | Same fields, `createdAt` ISO string | `api/test/accounts.int.test.ts:37-44` exact `toEqual` | ✅ |
| `GET /accounts?active=true\|false`, all when absent | Yes | `api/test/accounts.int.test.ts:144-146` | ✅ |
| `PATCH /accounts/:id` partial | Yes, `{}` returns the row unchanged | `api/test/accounts.int.test.ts:167-175` | ✅ |
| activate/deactivate → `Account` | 200 + `Account` | `api/test/accounts.int.test.ts:223-230` | ✅ |
| No account DELETE | 404 | `api/test/accounts.int.test.ts:238` | ✅ |
| `Category = { id, key: string\|null, name, isSystem }` | Same | `api/test/categories.int.test.ts:68-73`, `:94-99` (`key: null`) | ✅ |
| `DELETE /categories/:id?reassignTo=` → 204 | 204, empty body | `api/test/categories.int.test.ts:280-281` | ✅ |
| `duplicate_name` 409 | Accounts and categories, with `field` | `api/test/accounts.int.test.ts:54`, `api/test/categories.int.test.ts:123` | ✅ |
| `holder_required` 422 | With `field: 'holderNames'` | `api/test/accounts.int.test.ts:64` | ✅ (array present). ⚠️ key omitted → 400 |
| validation 422 with `field` | `validation_error` 422 + `field` for business rules (bank, nickname, holders, name, reassignTo) | `api/test/accounts.int.test.ts:92`, `api/test/categories.int.test.ts:112,326` | ✅. ⚠️ Schema-level errors (missing key, wrong type, `active=maybe`) answer **400** `validation_error` (pre-existing errors plugin from auth): `api/test/accounts.int.test.ts:97,147,193` |
| `category_protected` 403 | PATCH and DELETE | `api/test/categories.int.test.ts:165,296` | ✅ |
| `reassign_required` 422 | With `field: 'reassignTo'` | `api/test/categories.int.test.ts:311` | ✅ |
| 404 | `not_found` for unknown/foreign ids, malformed ids, unknown destination | `api/test/accounts.int.test.ts:206-208`, `api/test/categories.int.test.ts:331-337` | ✅ |

---

## Check B litmus and payload/conjunction rule

- Every mutating test asserts persisted state through a direct admin SQL read or a follow-up GET, not just the status code: create (`api/test/accounts.int.test.ts:47`, `api/test/categories.int.test.ts:103`), edit (`api/test/accounts.int.test.ts:171`, `api/test/categories.int.test.ts:146`), deactivate/activate (`api/test/accounts.int.test.ts:226,231`), delete (`api/test/categories.int.test.ts:282,378-380`).
- Rejections also assert "nothing changed": `api/test/accounts.int.test.ts:197,213,269`, `api/test/categories.int.test.ts:166,185,201-204,312-313,339-341,359-361`, `api/test/accounts-categories-isolation.int.test.ts:88-90`.
- Error bodies are matched with exact `toEqual` on `code` and `field` for the contract codes. `toMatchObject` is used only for the secondary 422s (`api/test/accounts.int.test.ts:71,79,92`). These still pin `field`.
- RLS tests carry positive controls, so a 0-row result cannot come from a broken fixture: `api/test/accounts-categories-schema.int.test.ts:73,139-140`.
- Shallow spot: `api/test/accounts.int.test.ts:86` (holder list with a blank entry) asserts only `toBe(422)`, no code or field. Minor.
- Isolation tests (`api/test/accounts-categories-isolation.int.test.ts:74-77`) assert 404 + `not_found` per route, and the system category of user A answers 404, not 403, to user B (`:67` includes `systemA`). That is the existence-leak check.

## Check C (reverse mapping)

All 46 new tests map to an AC, an edge case or a task Done-when, except these hardening tests, which map to design risks rather than ACs:
- `api/test/accounts-categories-schema.int.test.ts:91` truncate revoked for `anon`/`authenticated` (hardening, AD-002 posture).
- `api/test/accounts-categories-schema.int.test.ts:151` `seed_categories` not executable by `authenticated`/`anon` (hardening).
- `api/test/accounts-categories-schema.int.test.ts:76` no system-category insert (maps to T1 What, "system categories blocked from insert").
- `api/test/accounts.int.test.ts:95` 400 malformed body + 401 without token (matrix error-path expectation).
- Sort order inside `api/test/categories.int.test.ts:61` (no spec AC, see spec-precision gap 4).

None of these is scope creep in product behavior. They lock down hardening the migration adds.

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (from the real tree, exit 0). The web half of the Build gate is out of scope (T12-T16 replaced by Lovable).
- **Result**: typecheck clean, lint clean. Unit: 5 files, 42 passed. Integration: 12 files, 78 passed. **Total 120 passed, 0 failed, 0 skipped.**
- **Test count before feature**: 74 (38 unit, 36 integration, per the auth report).
- **Test count after feature**: 120. **Delta**: +46 (4 unit in `normalize.test.ts`; 42 integration: schema 10, accounts 15, categories 15, isolation 2). The diff only adds test files; no existing test was edited or removed.
- **Skip scan**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api` returns nothing.
- `api/openapi.json` is up to date: guarded by `api/test/swagger.int.test.ts:42`, which passed.

---

## Discrimination Sensor

Depth: P0-full (data integrity and authorization), manual fault injection. Code mutations ran in a temporary worktree at `/Volumes/MacOnlySSD/dev/personal/.verify-acc` (detached `HEAD`, `api/node_modules` symlinked). Each mutation was applied, the covering files were run, and the file was restored with `git checkout`. The unmutated scratch was green first (32/32 on the three API files).

| # | File | Mutation | Killed? | Killed by |
| - | ---- | -------- | ------- | --------- |
| M1 | `api/src/modules/categories/routes.ts:70` | Drop the `category_protected` check (system rows editable/deletable) | ✅ Killed | `categories.int.test.ts:155` (PATCH 403), `:287` (DELETE 403) |
| M2 | `routes.ts:162` (categories) | Never raise `reassign_required` | ✅ Killed | `categories.int.test.ts:304` |
| M3 | `routes.ts:170` (categories) | Skip the reassignment update loop | ✅ Killed | `categories.int.test.ts:364` |
| M4 | `routes.ts:164` (categories) | Allow `reassignTo` equal to the source | ✅ Killed | `categories.int.test.ts:316` |
| M5 | `routes.ts:120` (categories) | POST duplicate name → 500 (drop 409 mapping) | ✅ Killed | `categories.int.test.ts:117` |
| M6 | `routes.ts:143` (categories) | PATCH duplicate name → 500 | ✅ Killed | `categories.int.test.ts:170` |
| M7 | `api/src/modules/accounts/routes.ts:196` | Add a `DELETE /accounts/:id` route answering 204 | ✅ Killed | `accounts.int.test.ts:234` |
| M8 | `accounts/routes.ts:196` | Deactivate sets `active = true` | ✅ Killed | `accounts.int.test.ts:218`, `:242` |
| M9 | `accounts/routes.ts:148` | List ignores the `active` filter | ✅ Killed | `accounts.int.test.ts:135`, `:242` |
| M10 | `accounts/routes.ts:163` | PATCH lets `holderNames: []` through | ✅ Killed | `accounts.int.test.ts:178` |
| M11 | `accounts/routes.ts:86` | Holder duplicate check without `normalizeName` | ✅ Killed | `accounts.int.test.ts:68`, `:178` |
| M12 | `accounts/routes.ts:130` | POST duplicate nickname → 500 | ✅ Killed | `accounts.int.test.ts:50` |
| M13 | `api/src/lib/normalize.ts:8` | `normalizeName` keeps diacritics | ✅ Killed | `normalize.test.ts:5`, `:12` |
| M14 | `categories/routes.ts:102` | GET /categories without `order by` | ✅ Killed | `categories.int.test.ts:61` |
| M15 | `accounts/routes.ts:79` | Holders stored untrimmed | ✅ Killed | `accounts.int.test.ts:30`, `:152` |
| M16 | `categories/routes.ts:168` | Skip the destination existence check (foreign/unknown destination) | ✅ Killed | `categories.int.test.ts:316`, `accounts-categories-isolation.int.test.ts:51` |
| M17 | `categories/routes.ts:174` | Ignore `deleted.count === 0` | ❌ Survived | - |
| M18 | `categories/routes.ts:160` | Skip `assertEditable` on DELETE (RLS turns system deletes into 0 rows → 404) | ✅ Killed | `categories.int.test.ts:287` |
| M19 | `accounts/routes.ts:73` | Nickname stored untrimmed | ✅ Killed | `accounts.int.test.ts:30`, `:152` |
| M20 | `accounts/routes.ts:81` | `holder_required` replaced by `validation_error` | ✅ Killed | `accounts.int.test.ts:60`, `:178` |

**M17 is not a critical survivor.** `assertEditable` reads the row in the same transaction just before the delete. The guard only fires if another transaction deletes the same row in between. Then the mutant answers 204 instead of 404, and the end state is the same (row gone). Equivalent in single-request semantics. M18 shows the guard is reachable when `assertEditable` is removed, so it is defensive, not dead.

**SQL mutations** (one rolled-back psql transaction against the live local DB, then a control transaction without the mutations; both ended in `ROLLBACK`, `auth.users` count 0 afterwards). A throwaway `auth.users` row inside the transaction fired the real trigger and seeded 17 categories (3 system), then the schema test's statements ran as `authenticated`:

| # | Mutation | Mutated result | Control result | Test that flags it |
| - | -------- | -------------- | -------------- | ------------------ |
| S1 | `categories_update` / `categories_delete` without `not is_system` | update and delete of system rows: 1 row each | 0 rows each | `accounts-categories-schema.int.test.ts:62,64` `count toBe(0)` |
| S2 | `accounts_nickname_uq` on `(user_id, nickname)` (case-sensitive) | `nubank pessoal` inserted next to `Nubank Pessoal` | `duplicate key ... accounts_nickname_uq` | `accounts-categories-schema.int.test.ts:104` `rejects.toThrow(/accounts_nickname_uq/)` |
| S3 | `categories_name_uq` on `(user_id, name)` | `alimentação` inserted next to `Alimentação` | `duplicate key ... categories_name_uq` | `accounts-categories-schema.int.test.ts:111-112` |
| S4 | `grant delete on accounts to authenticated` | delete removed 2 rows | `permission denied for table accounts` | `accounts-categories-schema.int.test.ts:86` |
| S5 | `grant execute on seed_categories to authenticated` | call succeeded | `permission denied for function seed_categories` | `accounts-categories-schema.int.test.ts:154-155` |

**Result**: code 19/20 killed (the survivor is equivalent and non-critical); SQL 5/5 flagged. **PASS ✅**

Not run, reasoned instead: "GET /categories queries outside `withUser`" (would read with the RLS-bypassing `postgres` role against live data). Reasoning: every handler calls `request.withUser`; `GET /categories` has no `where user_id`, so a bypass would return every user's rows. `categories.int.test.ts:77` (disjoint ids) and `accounts-categories-isolation.int.test.ts:93` (no foreign names or ids) would flag it, because both compare two users' lists.

---

## Isolation Proof

- Real tree: `git status --porcelain` empty at baseline and after the sensor. After writing this report the only change is this untracked file, `.specs/features/accounts-categories/validation.md`.
- `git worktree list` shows only the main worktree; `/Volumes/MacOnlySSD/dev/personal/.verify-acc` is removed and pruned. `api/node_modules` in the real tree is intact (only the scratch symlink was removed).
- DB structure snapshot (migration list `0001,0002`, public tables, policies with their expressions, function definitions by md5, triggers, indexes by md5, table grants for `anon`/`authenticated`, function ACLs) is identical before the gate, after the gate, after the sensor and after the FK experiment.
- Probe objects absent after the run: `to_regclass('public.category_ref_probe')`, `to_regclass('public.category_ref_probe_failing')` and `to_regprocedure('public.category_ref_probe_fail()')` are all null. The FK experiment table `public.fk_probe_restrict` is also absent.
- `auth.users`: 0 before, 0 after. The tests create users through GoTrue and `cleanupTestUsers()` deletes them; the rolled-back psql users never committed. `accounts` and `categories` are also 0 before and after.
- The user-owned `web` stack (ports 54321-54327) was not touched.

---

## Code Quality (diff `cf63635..HEAD`)

| Principle | Status | Notes |
| --------- | ------ | ----- |
| Minimum code | ✅ | Two route modules, a 9-line helper, a 28-line registry |
| No abstractions for single-use code | ✅ | The registry has one user today, but T10 and the design require it so transactions and credit-expenses can plug in. `collapseSpaces` is unused in this diff; the task asks for it for import |
| No unneeded flexibility | ✅ | - |
| Surgical changes | ✅ | `app.ts` only registers the two modules. `openapi.json` is regenerated output |
| Matches existing patterns | ✅ | `withUser`, `AppError`, TypeBox schemas as in auth |
| Spec-anchored outcome check | ✅ | See tables |
| Per-layer coverage | ✅ | Every route has happy, edge and error tests. Gap: no 401 test on the categories routes (gap 3) |
| Every test maps to a requirement | ✅ | See Check C |
| Guidelines | ✅ | None in the repo; strong defaults applied |

Minor style notes (no action needed): `setActive` in `api/src/modules/accounts/routes.ts:183` uses a hand-written request type instead of the typed route handler; `if (!row) throw notFound()` after `assertEditable` in PATCH /categories (`api/src/modules/categories/routes.ts:140`) is the same kind of defensive guard as M17.

---

## Ranked gaps (none blocking)

1. **Schema validation answers 400, not 422.** A body without `holderNames` returns 400 `validation_error` (field `holderNames`) instead of 422 `holder_required`. A missing key or wrong type on any route also gives 400, while the Lovable contract says "validação (422 com field)". The Lovable form always sends the array, so the front is not affected today. Fix: map Ajv errors on these routes to 422, or write 400 into the contract. ACCT AC3, `api/test/accounts.int.test.ts:96-98`. Minor.
2. **Spec bookkeeping stale.** `spec.md` traceability still says Implementing and "0 mapped to tasks". Update after acceptance. Cosmetic.
3. **No 401 test on `/categories` routes.** The global auth hook covers them, and `request.withUser` throws 401 without a user. Only `/accounts` POST asserts 401 (`api/test/accounts.int.test.ts:99`). A one-line test per module would follow lesson L-001. Minor.
4. **Shallow assertion.** `api/test/accounts.int.test.ts:86` checks only the status for a blank holder among valid ones. Add `code`/`field`. Minor.
5. **Spec-precision gaps 1-6 above.** Record the decisions in `spec.md`. Minor.

## Deferred items (class d, tracked for later features)

- ACCT AC4/AC5 transaction invariance, AC6 server-side rejection of inactive accounts on new transactions and imports, AC10 inactive accounts' transactions in filters/table/calculations: **transactions**, **dashboards**, **import**.
- ACCT AC7 neutral detection with inactive holder names: **import** (data already exposed, `api/test/accounts.int.test.ts:253`).
- CAT-sys AC5 system categories assignable to transactions: **transactions**.
- CAT-own AC3/AC5 on real tables: **transactions** and **credit-expenses** must call `registerCategoryReference` for their tables, with the composite FK `(category_id, user_id)`.

## Front-end items (class c, not graded)

Message texts (duplicate nickname, holder required, protected category, duplicate name, choose destination) and display: `web/src/features/accounts/AccountForm.tsx`, `web/src/features/accounts/AccountsPage.tsx`, `web/src/features/accounts/AccountSelect.tsx` (active only), `web/src/features/categories/CategoriesPage.tsx`, `web/src/features/categories/CategorySelect.tsx`. Accepted in `lovable.md` (checklist dated 2026-10-04).

---

## Security Notes

- **Authorization**: every handler runs its SQL inside `request.withUser` (role `authenticated` + JWT claims, RLS on). Input validation runs before, without DB access. The global auth hook rejects tokenless calls (`api/test/accounts.int.test.ts:99`).
- **403 vs 404**: `assertEditable` reads the row under RLS. A foreign row, system or not, is invisible, so it answers 404, not 403. Nothing leaks about another user's system rows (`api/test/categories.int.test.ts:199-200`, `api/test/accounts-categories-isolation.int.test.ts:67-77`). A foreign `reassignTo` also answers 404 (`api/test/accounts-categories-isolation.int.test.ts:82-84`).
- **Defense in depth**: RLS blocks insert/update/delete of system categories even if the API check goes (S1, M18). `delete` on `accounts` is revoked (S4). `truncate` is revoked for `anon`/`authenticated`. `seed_categories` and `handle_new_user` are not executable by `public`/`anon`/`authenticated` (S5). Policies are `to authenticated`; `anon` keeps default table grants but has no policy, so RLS denies it everything.
- **Unique-index races**: no read-then-insert. The 23505 violation is mapped by constraint name (`accounts_nickname_uq`, `categories_name_uq`) to 409, so concurrent duplicates also get 409. Other 23505s stay 500.
- **Registry identifiers**: table and column names come from code constants and are quoted with `tx(identifier)` (postgres.js splits `schema.table` and quotes each part). `reassignTo` and `id` are bound parameters, and both are checked against a UUID regex first. Values never reach identifiers.
- **Missing registered table**: `isInUse` or the update would raise `42P01` inside the transaction. The request answers 500 and rolls back, so no data is lost. This is a deploy-ordering failure, not a data risk. Registering only from the owning module after its migration avoids it.
- **Concurrent reference insert during delete**: a row added after the usage check makes the final `delete` fail on the `restrict` FK and roll back (commented at `api/src/modules/categories/routes.ts:157-158`). Safe.
- **FK `restrict` vs user deletion cascade**: tested in a rolled-back transaction with a probe table shaped like the future `transactions` (user FK `on delete cascade`, composite category FK `on delete restrict`). Deleting the user **succeeded** with `RESTRICT` and with `NO ACTION`. With `RESTRICT` this depends on cascade firing order, which follows the order the constraints were created. `NO ACTION` is checked at the end of the statement and does not depend on it. Recommendation for the transactions feature: use `on delete no action` (still blocks a direct category delete), or keep `restrict` and add a test that deletes a user with transactions.
- **Mass assignment**: `key` and `isSystem` from clients are ignored (`api/test/categories.int.test.ts:92-103`, `:143-148`). `user_id` defaults to `auth.uid()` and RLS `with check` blocks forging it (`api/test/accounts-categories-schema.int.test.ts:135-137`).

---

## Summary

**Overall**: ✅ Ready (backend)

**Spec-anchored check**: 22 ACs: a = 20 (5 with a deferred part), d = 2, c = 0, b = 0, gaps = 0. 6 spec-precision gaps flagged.
**Sensor**: code 20 injected, 19 killed, 1 equivalent survivor (M17); SQL 5/5 flagged.
**Gate**: 120 passed (42 unit, 78 integration), 0 failed, 0 skipped.

**Next steps**: optional fix tasks for gaps 1, 3 and 4; update `spec.md` traceability; carry the FK `no action` recommendation and the registry registration into the transactions and credit-expenses designs.

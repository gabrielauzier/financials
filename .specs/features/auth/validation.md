# Validation: auth (backend T1-T13 + F1-F4), iteration 2 - PASS

**Verdict**: PASS

All seven gaps from iteration 1 are closed. The two critical survivors from iteration 1, M11 (tokenless requests pass) and M11c (verification errors swallowed), are now killed by tests on a route that does not call `withUser`. AUTH-01.6 is recorded end to end through the real e-mail link. The server now enforces the 8-character password minimum. Build gate green: 74 passed, 0 failed, 0 skipped. Sensor: 16 code mutations, 15 killed. The only survivor (M20) is the redundant `withUser` guard and is equivalent while the hook stands.

**Iteration**: 2 of 3
**Date**: 2026-10-04
**Spec**: `.specs/features/auth/spec.md`
**Diff range**: `5dfa185..HEAD`, fixes `4db97ad..HEAD`. `HEAD` = `2e23d3c8c8e40ddc8e29f0878739fe692e1c3149`, branch `feat/backend-auth`
**Verifier**: independent sub-agent (author != verifier), read-only on the real tree. Everything below was re-derived from the spec and code. The iteration-1 report was not trusted.

## Scope

In scope: backend tasks T1-T13 and fix tasks F1-F4 (`api/`, `supabase/`, `.specs/features/auth/`).
Out of scope: T14-T20 (web). The Lovable front end replaces them, so their unchecked boxes in `tasks.md` are expected. ACs the front owns are classified (c) and listed. They are not graded.

---

## Task Completion

| Task | Status | Commit |
| ---- | ------ | ------ |
| T1 | ✅ Done | `8d1794f` |
| T2 | ✅ Done | `a8413c5` |
| T3 | ✅ Done | `43f1c25` |
| T4 | ✅ Done | `470139d` |
| T5 | ✅ Done | `a0a5941` |
| T6 | ✅ Done | `c3e2163` |
| T7 | ✅ Done | `bc784c4` |
| T8 | ✅ Done | `ab1a10f` |
| T9 | ✅ Done | `40ba5c6` |
| T10 | ✅ Done | `8871c2e` |
| T11 | ✅ Done | `b2eddf8` |
| T12 | ✅ Done | `065ee05` |
| T13 | ✅ Done | `dc95d5e` |
| F1 hook 401 branches on a route without withUser | ✅ Done | `3e2e6aa` |
| F2 confirmation link confirms the e-mail | ✅ Done | `c4b67e9` |
| F3 8-character minimum in GoTrue | ✅ Done | `d9790db` |
| F4 minor fixes (sub, JWKS unreachable, profiles UPDATE/DELETE, confirmation_sent_at) | ✅ Done | `2e23d3c` |

There is one commit per task. All boxes for T1-T13 and F1-F4 are checked in `tasks.md`. Other commits: `99bc411` (docs, ES256 finding) and `4db97ad` (docs, iteration-1 report).

---

## Spec-Anchored Acceptance Criteria

Classification: **a** = covered by API/DB tests. **b** = delegated to Supabase Auth (GoTrue) and recorded by tests against the local stack. **c** = front-end (Lovable) responsibility. **d** = deferred to a later feature.

### P1: Cadastro com confirmação

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 1.1 Valid sign-up (8+ chars) creates an account with the e-mail unconfirmed | b (+a) | Account exists; e-mail unconfirmed | `api/test/gotrue-behavior.int.test.ts:150`: `expect(created.status).toBe(200)`; `:154`: `expect(before[0]?.email_confirmed_at).toBeNull()`; `:155`: sign-in `toMatchObject({ error_code: 'email_not_confirmed' })`. Profile row: `api/test/profiles.int.test.ts:32`: `toEqual([{ name: 'Maria Silva', nickname: 'mari' }])`. 8 characters accepted: `api/test/gotrue-behavior.int.test.ts:189` | ✅ PASS |
| 1.2 Confirmation e-mail sent to the given address | b | E-mail delivered to that address | `api/test/gotrue-behavior.int.test.ts:132-138`: Mailpit search `to:${email}` returns a message whose body holds the `/auth/v1/verify` link, used at `:158`. `:62`: `expect(user.confirmation_sent_at).toBeDefined()`. `supabase/config.toml:227` `enable_confirmations = true` | ✅ PASS (delivery is now asserted, not only `confirmation_sent_at`) |
| 1.3 Empty field rejected, naming the field | c | Rejection naming the field | Front (`web/`). Server: GoTrue does not require name/nickname, and the trigger stores `''` (`supabase/migrations/0001_profiles.sql:33-34`) | ➖ Front. ⚠️ A direct GoTrue sign-up still accepts empty name/nickname |
| 1.4 Password < 8 rejected with a short-password message | c (+b) | Rejection; short-password message | Server enforcement: `api/test/gotrue-behavior.int.test.ts:183-184`: `expect(res.status).toBe(422)`, `toMatchObject({ code: 422, error_code: 'weak_password' })` for 7 characters. `supabase/config.toml:183` `minimum_password_length = 8`. The message text belongs to the front | ✅ Server side PASS (iteration-1 Gap 3 closed). Message: front |
| 1.5 Existing e-mail rejected with "E-mail já cadastrado" | b (+c) | That exact message | Confirmed account: `api/test/gotrue-behavior.int.test.ts:72-73`: `toEqual({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' })`. Unconfirmed account: `:90-95` (same id and created_at, metadata ignored, `resentToExistingUser` true). The rule is in `design.md` Risks. The message belongs to the front | ✅ PASS (detection rule recorded) |
| 1.6 Valid confirmation link marks the e-mail confirmed | b | `email_confirmed_at` set | `api/test/gotrue-behavior.int.test.ts:158-159`: the link from the e-mail returns `303`; `:162`: `expect(after[0]?.email_confirmed_at).toBeInstanceOf(Date)` (it was `null` at `:154`); `:170-171`: password login `200` with `access_token` | ✅ PASS (iteration-1 Gap 2 closed) |
| 1.7 Account creation seeds categories | d | Seed per `accounts-categories` | Deferred: `supabase/migrations/0001_profiles.sql:2` | ➖ Deferred (accounts-categories) |

### P1: Login e proteção da API

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 2.1 Confirmed user with valid credentials is authenticated and gets a JWT | b (+a) | JWT returned and accepted | `api/test/gotrue-behavior.int.test.ts:170-171` (login 200, `access_token` string); `api/test/helpers/db.int.test.ts:24-25` (GoTrue `/user` accepts the token, `id` matches); API accepts it: `api/test/auth.int.test.ts:138-139`: `toEqual({ userId: user.id })`, `:91-93`: `toEqual({ userId: user.id, dbUid: user.id })` | ✅ PASS |
| 2.2 Unconfirmed e-mail: login refused, pending-confirmation message | b (+c) | Refusal | `api/test/gotrue-behavior.int.test.ts:108-109`: `toEqual({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' })` | ✅ PASS (message: front) |
| 2.3 Invalid credentials: generic message | b (+c) | Same answer for wrong password and unknown e-mail | `api/test/gotrue-behavior.int.test.ts:117-122`: both `toEqual({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })` | ✅ PASS |
| 2.4 Any route except auth without a valid `Authorization: Bearer` gets 401 | a | 401 | `api/test/auth.int.test.ts:106-113` on `/test/whoami` (defined at `:28`, does not call `withUser`): no header, `Basic`, `Bearer not-a-jwt`, `Bearer ` each `expect(res.statusCode).toBe(401)` + `toEqual({ error: { code: 'unauthorized', message: any(String) } })` (`:52-55`). Public routes stay open: `api/test/app.int.test.ts:8,20`, `api/test/swagger.int.test.ts:22,35` | ✅ PASS. M11 killed (iteration-1 Gap 1 closed) |
| 2.5 Expired or bad-signature JWT gets 401 | a | 401 | HTTP: `api/test/auth.int.test.ts:115-125` (expired, 401), `:127-133` (forged ES256, 401). Unit: `api/src/plugins/auth.test.ts:44-47`, `:54-57`, `:102-108` (`toMatchObject({ code: 'unauthorized', status: 401 })`), plus missing exp `:49-52`, missing/empty/non-string sub `:59-69`, `:110-119`, alg=none `:71-77`, `:125-127`, algorithm confusion `:121-123` | ✅ PASS. M11c, M1, M3, M4a/b and M5none killed |
| 2.6 Front redirects protected routes to login | c | Redirect to `/login` | Front (`web/`) | ➖ Front |

### P1: Isolamento de dados por usuário

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 3.1 `user_id` on every user-data table | a | Column present | `api/test/rls-catalog.int.test.ts:19-31` (catalog of `user_id` tables plus `profiles`), `:52-58` | ✅ PASS for current tables. `profiles` uses `id` (design-accepted) |
| 3.2 RLS on; access only to own rows | a | RLS enabled; own rows only | `api/test/rls-catalog.int.test.ts:56-58` (`rls` true, ≥1 policy, `violations` empty), `:67` (negative probe). Read: `api/test/profiles.int.test.ts:40,43-44` (`toEqual([a.id])`, `not.toContain(a.id)`), `api/test/db.int.test.ts:51-52`. Write: `api/test/profiles.int.test.ts:60` `expect(updated.count).toBe(0)`, `:63` `expect(deleted.count).toBe(0)`, `:66` row unchanged, `:70` owner positive control `toBe(1)` | ✅ PASS (iteration-1 Gap 6 closed) |
| 3.3 User A reaching user B's record by id gets 404 | d | 404 | No by-id route exists yet. Infrastructure: `api/src/plugins/errors.ts`, `api/src/plugins/errors.test.ts` | ➖ Deferred (accounts-categories / transactions) |
| 3.4 Queries run as the authenticated user, never with the service key | a | `auth.uid()` = sub, role `authenticated`, no leakage | `api/test/db.int.test.ts:35`: `toEqual({ uid: user.id, role: 'authenticated' })`; `:45-47`, `:57-58` (no claim or role leak on one connection); `:71-74` (rollback); `api/test/auth.int.test.ts:93` (`dbUid: user.id`) | ✅ PASS (M13, M14, M15 killed) |

### Edge cases

| Edge case | Class | Evidence | Result |
| --------- | ----- | -------- | ------ |
| E1 Invalid e-mail format rejected with an invalid-e-mail message | c | Front (`web/`). GoTrue's own format check is not recorded | ➖ Front |
| E2 E-mail service failure: say so, keep the account unconfirmed | c | Front. GoTrue's behavior on SMTP failure is not recorded | ➖ Front |
| E3 Supabase Auth unavailable at login: message without technical details | c (+a API-side analog) | The login path is the front. API analog, JWKS unreachable: `api/test/auth.int.test.ts:154-156`: `toBe(500)`, `toEqual({ error: { code: 'internal_error', message: 'Internal server error' } })`, body free of `127.0.0.1\|ECONNREFUSED\|fetch failed\|jwks`; unit `api/src/plugins/auth.test.ts:156-157` (the error propagates, not an `AppError`) | ➖ Front. The API side is now tested (iteration-1 Gap 5 closed) |

**Counts**: 17 ACs: a=5 (2.4, 2.5, 3.1, 3.2, 3.4), b=7 (1.1, 1.2, 1.5, 1.6, 2.1, 2.2, 2.3), c=3 (1.3, 1.4 message, 2.6), d=2 (1.7, 3.3), **gaps=0**. AC 1.4 is counted as c because the AC requires a message. Its server-side enforcement is now recorded (b evidence at `api/test/gotrue-behavior.int.test.ts:183-184`). 3 edge cases, all c. E3 also has API-side coverage.

### Spec-precision gaps

1. **Password minimum layer**: the spec says 8 but does not say which layer enforces it. Both layers now enforce it. The hosted project must be configured by hand (Auth > Password policy), and no test can see that.
2. **Validation status**: design and T3 say "400/422". The spec defines none. The implementation uses 400.
3. **Message texts** for 1.3, 1.4, 2.2 and all edge cases are not fixed in the spec, so only "E-mail já cadastrado" can be asserted.
4. **401 body shape** is not specified. The implementation returns `{ error: { code: 'unauthorized', message } }`.
5. **JWKS unreachable**: neither spec nor design defines the API outcome (500 vs 503). The new tests pin today's 500 `internal_error` as observed behavior, not as a spec outcome.
6. **AUTH-07.1** says `user_id` on every table. `profiles` is keyed by `id` (design-accepted), and the catalog includes it by name.
7. The login Independent Test cites `GET /transactions`, which does not exist yet (deferred).
8. The traceability table and footer in `spec.md` are stale ("0 mapped to tasks, 8 unmapped"; statuses not updated).

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (Build gate, API part only; the web gate is out of scope). Run once from the real tree, exit 0, no 429.
- **Result**: typecheck OK, lint OK, unit **38 passed** (4 files), integration **36 passed** (8 files). **74 passed, 0 failed, 0 skipped.**
- **Test count**: iteration 1: 56. Now: 74. **Delta**: +18 (unit +6: four sub cases, two JWKS-unavailable cases; integration +12: seven whoami cases, JWKS unreachable, confirmation link, two password-policy cases, profiles UPDATE/DELETE). No test was removed or weakened. The only change to an existing assertion is `resentToExistingUser` (`api/test/gotrue-behavior.int.test.ts:61-64`), which got stricter.
- `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api`: no matches (exit 1).

### Check B litmus and payload/conjunction rule

- **Auth hook** (`api/test/auth.int.test.ts`): now discriminating. `/test/whoami` (`:28`) has no `withUser`, so only the hook can answer 401. Every 401 asserts status and body code (`:52-55`). The 200 case asserts the exact subject (`:139`). The message is still `any(String)`, which is acceptable because the spec fixes no text.
- **Verifier unit** (`api/src/plugins/auth.test.ts`): strong. Every rejection asserts `instanceof AppError` and `{ code, status }`. The JWKS-failure cases assert identity (`toBe(failure)`) and `not.toBeInstanceOf(AppError)`.
- **gotrue-behavior**: exact `toEqual` bodies for 1.5, 2.2 and 2.3. The confirmation test asserts the before and after state in `auth.users` plus a real login. The password policy uses `toMatchObject` on `{ code, error_code }`, and the `msg` text is not pinned (acceptable). The iteration-1 vacuous assertion is fixed (`:62`).
- **Profiles**: UPDATE/DELETE assert row counts, the unchanged row values, and a positive control (`:70`). The rolled-back probe (below) shows the write assertions only fail if the select policy also loosens, because Postgres gates UPDATE/DELETE row visibility by the SELECT policy. They are a regression net, not an independent check of the write policies.
- **db** (`api/test/db.int.test.ts`): strong. It asserts values on a single connection.
- **RLS catalog**: checks that RLS is on and policies exist, not what the policies say. Content is covered behaviorally for `profiles` only.
- **Swagger**: exact `/health` schema and the committed `openapi.json` is up to date.

---

## Discrimination Sensor

Scratch: `git worktree add --detach /Volumes/MacOnlySSD/dev/personal/.verify-auth HEAD`, with `api/node_modules` symlinked to the real one. Each mutation was applied by a script that asserts exactly one match. The covering tests ran in the scratch, then the file was restored with `git checkout`, and scratch porcelain was confirmed empty before the next mutation. Afterwards: `git worktree remove --force` + `git worktree prune`. No `git stash`.

| # | File:line | Mutation | Tests run (scratch) | Result |
| - | --------- | -------- | ------------------- | ------ |
| M11 | `api/src/plugins/auth.ts:90` | hook lets tokenless requests through (`if (!token) return;`) | `test/auth.int.test.ts -t "returns 401\|unreachable"` | ✅ **Killed** (no header, Basic, empty Bearer on `/test/whoami`). **Iteration-1 survivor, now killed** |
| M11c | `api/src/plugins/auth.ts:91` | hook swallows verification errors and continues anonymously | same | ✅ **Killed** (malformed, expired, forged, JWKS unreachable). **Iteration-1 survivor, now killed** |
| M12 | `api/src/plugins/auth.ts:88` | invert the public-route check | same | ✅ Killed (7 tests) |
| M1 | `api/src/plugins/auth.ts:43` | drop `exp` from `requiredClaims` | unit | ✅ Killed (`rejects a token without exp`) |
| M3 | `api/src/plugins/auth.ts:59` | accept missing/empty/non-string `sub` (remove the `hasSubject` check) | unit | ✅ Killed (4 tests). Iteration-1 M4 survived this; now killed |
| M4a | `api/src/plugins/auth.ts:39` | accept empty `sub` (drop the length check) | unit | ✅ Killed (`an empty sub`, both modes) |
| M4b | `api/src/plugins/auth.ts:39` | accept a non-string `sub` | unit | ✅ Killed (`a non-string sub`, both modes) |
| M5none | `api/src/plugins/auth.ts:50-52` | accept `alg: none` tokens (decode unsecured JWTs without verification) | unit | ✅ Killed (`rejects an unsigned alg=none token`, both modes) |
| M18 | `api/src/plugins/auth.ts:56` | `JWKSTimeout` becomes 401 | unit | ✅ Killed |
| M19 | `api/src/plugins/auth.ts:56-57` | every verification failure becomes 401 (JWKS outage blamed on the user) | unit | ✅ Killed (2 tests) |
| M13 | `api/src/plugins/db.ts:26` | non-local `set_config(..., false)` | `test/db.int.test.ts -t "never leaks"` | ✅ Killed |
| M14 | `api/src/plugins/db.ts:27` | drop `set local role authenticated` | `test/db.int.test.ts -t "runs with auth.uid"` | ✅ Killed |
| M15 | `api/src/plugins/db.ts:27` | `set role` (session-wide) | `test/db.int.test.ts -t "never leaks"` | ✅ Killed |
| M21 | `api/src/config.ts:12` | config: a missing required variable no longer throws | unit | ✅ Killed (2 tests). No live-DB contact |
| M22 | `api/src/app.ts:14` | wrong JWKS path | `test/auth.int.test.ts -t "real token"` | ✅ Killed (both real-token 200 tests) |
| M20 | `api/src/plugins/auth.ts:82` | drop the `request.withUser` guard (`if (!this.user) throw`) | `test/auth.int.test.ts` (full) | ❌ Survived. **Equivalent while the hook is intact**: the hook guarantees `request.user` on every non-public route, so the guard only matters if the hook regresses, and M11/M11c now catch that. Non-critical |

**DB objects** (never mutated on the live DB): one `psql` transaction with savepoints ended in `ROLLBACK`. It created two `auth.users` rows, mutated an object, and replayed the tests' exact statements:

| # | Mutation | Observed | Test that flags it |
| - | -------- | -------- | ------------------ |
| D1 | add `for delete using (true)` policy | B deletes 0 of A's rows | Equivalent (SELECT policy gates DELETE visibility) |
| D2 | `profiles_update using (true) with check (true)` | B updates 0 rows | Equivalent (same reason) |
| D3 | D2 + `profiles_select using (true)` | B sees 2 profiles, updates 1 | Killed by `api/test/profiles.int.test.ts:40,44` and `:60` |
| D4 | `disable row level security` on profiles | `relrowsecurity = f` | Killed by `api/test/rls-catalog.int.test.ts:56` |
| D5 | trigger swaps name/nickname | row `(mari, Maria Silva)` | Killed by `api/test/profiles.int.test.ts:32` |

**Sensor depth**: P0 (auth), 16 code mutations plus 5 rolled-back DB probes.
**Sensor outcome**: 15/16 code mutants killed. 1 survivor (M20), equivalent. **Both iteration-1 critical survivors (M11, M11c) are killed**, as is the iteration-1 minor survivor M4 (as M3/M4a/M4b). The iteration-1 M6 (HS384/HS512 in HS256 mode) was not re-run because it is equivalent.

---

## Isolation Proof

- Real tree `git status --porcelain` was empty before the sensor and empty after it (before this report was written). `HEAD` stayed at `2e23d3c` throughout.
- `git worktree list` after cleanup shows only `/Volumes/MacOnlySSD/dev/personal/financials`. `/Volumes/MacOnlySSD/dev/personal/.verify-auth` no longer exists. `api/node_modules` is intact (only the symlink was removed).
- `api/src/plugins/auth.ts` equals `HEAD:api/src/plugins/auth.ts` byte for byte. Its only commits are `40ba5c6` and `8871c2e`, and `git diff 5dfa185 -- api/src/plugins/auth.ts` shows only the intended implementation (the hook throws at `:90`, verifies at `:91`). The previous worker's temporary mutation left no trace.
- The DB snapshot was identical before the gate and after the sensor and probes: `profiles` RLS true; policies `profiles_select` (r) and `profiles_update` (w) with `id = (SELECT auth.uid())`; trigger `on_auth_user_created` enabled; `md5(handle_new_user.prosrc)` = `43d8c37aee20e7d8a3da50cef65787f1`, `security definer`, `search_path=public`; migrations `0001`; `auth.users` = 0, `profiles` = 0 (the tests clean up after themselves). The user-owned `web` stack (54321-54327) was not touched.

---

## Code Quality (diff `4db97ad..HEAD`)

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ The only product change is one line in `supabase/config.toml:183`. Everything else is tests |
| Surgical changes | ✅ Existing tests untouched, except `resentToExistingUser`, which is stricter |
| No scope creep | ✅ |
| Matches patterns | ✅ Minor: `asUser` (`api/test/profiles.int.test.ts:20-26`) duplicates `profilesVisibleTo` (`:11-17`). `resentToExistingUser` now asserts inside a predicate. Both are cosmetic |
| Spec-anchored outcome check | ✅ |
| Every new test maps to an AC, edge case or Done-when (Check C) | ✅ whoami cases map to AC 2.4/2.5. Sub cases map to T9 "Missing sub is rejected" and AC 2.5. Confirmation link maps to AC 1.6/1.2. Password policy maps to the spec Assumption "Mínimo 8 caracteres" and AC 1.4. Profiles UPDATE/DELETE maps to AC 3.2. JWKS unreachable maps to edge case E3 (no technical details), T3 Done-when "500 internal_error with no stack", and design Risks row 1. The status it pins (500) is not spec-defined (spec-precision gap 5) |
| Documented guidelines | none in repo; strong defaults applied |

Test-suite risk: a full integration run makes about 30 GoTrue sign-ins and sign-ups (18 `createTestUser`, plus about 13 in `gotrue-behavior`). That sits at the local limit `sign_in_sign_ups = 30` per 5 min (`supabase/config.toml` `[auth.rate_limit]`). Two full runs inside 5 minutes will hit 429. This is a flakiness risk, not a correctness defect.

---

## Previous gaps (iteration 1)

| # | Gap | Status | Evidence |
| - | --- | ------ | -------- |
| 1 | Hook 401 branches undiscriminated (M11, M11c) | ✅ Closed | `api/test/auth.int.test.ts:105-141`; M11 and M11c killed |
| 2 | AUTH-01.6 not recorded | ✅ Closed | `api/test/gotrue-behavior.int.test.ts:145-172` |
| 3 | Server password minimum 6 vs 8 | ✅ Closed | `supabase/config.toml:183`; `api/test/gotrue-behavior.int.test.ts:181-191` |
| 4 | `sub` empty/non-string unit cases | ✅ Closed | `api/src/plugins/auth.test.ts:64-69`, `:114-119`; M4a/M4b killed |
| 5 | JWKS-unreachable path untested | ✅ Closed | `api/src/plugins/auth.test.ts:134-159`; `api/test/auth.int.test.ts:143-160`; M18/M19 killed |
| 6 | Cross-user UPDATE/DELETE on profiles | ✅ Closed (regression net, see D1/D2) | `api/test/profiles.int.test.ts:55-71` |
| 7 | Vacuous `confirmation_sent_at` assertion | ✅ Closed | `api/test/gotrue-behavior.int.test.ts:62` |

---

## Remaining gaps (ranked, none blocking)

1. **[Minor] Profiles write assertions are not independent of the select policy** (D1/D2 equivalent). If a later feature adds a DELETE policy, add a cross-user test for that table. The pattern is already required by AUTH-08 404.
2. **[Minor] Hosted-project parity**: `minimum_password_length = 8`, `enable_confirmations` and the duplicate-email behavior are verified only on the local stack. Confirm them in the hosted project before launch (design Risks already says so).
3. **[Minor] Suite at the GoTrue rate limit** (~30 sign-ins per run vs 30 per 5 min). Consider raising `sign_in_sign_ups` in the local `config.toml` or reusing test users.
4. **[Cosmetic] M20 survivor**: the `withUser` guard is untested defense in depth. It is acceptable as is.
5. **[Front, non-blocking]** AC 1.3, the 1.4 message, AC 2.6 and edge cases E1-E3 belong to the Lovable front. **[Deferred]** AC 1.7 and 3.3 go to accounts-categories. A direct GoTrue sign-up still stores empty name/nickname (`supabase/migrations/0001_profiles.sql:33-34`).

---

## Security Notes

Re-assessed:

- **Issuer/audience not checked**: still true (`api/src/plugins/auth.ts:43`, no `issuer`/`audience`, `role` claim ignored). The risk is low with one project per key set. It is cheap to close: `issuer: '<SUPABASE_URL>/auth/v1'`, `audience: 'authenticated'`. Anonymous sign-ins are disabled (`supabase/config.toml:179`). Re-check `is_anonymous` if they are ever enabled. `withUser` always forces role `authenticated`, whatever the token's `role` claim says.
- **`DATABASE_URL` role bypasses RLS**: confirmed locally, `postgres` has `rolsuper = f`, `rolbypassrls = t`. Isolation depends on `set local role authenticated` (`api/src/plugins/db.ts:27`), guarded by M14/M15 (killed). Any raw use of the pool outside `withUser` would bypass RLS. Production should use a dedicated non-bypass role granted `authenticated`.
- **Prepared statements behind a transaction pooler**: still true (`api/src/plugins/db.ts:37`, no `prepare: false`). Fine on a direct connection. Supavisor transaction mode (6543) needs `prepare: false`. `set_config(..., true)` and `set local` are pooler-safe.
- **JWKS outage**: it now fails as 500 without details and is not blamed on the user (tested). jose's remote JWKS has a default timeout, so a slow JWKS adds latency to every request until the cache is warm.

New:

- **Default Supabase grants**: `anon` and `authenticated` hold `INSERT/UPDATE/DELETE/TRUNCATE` on `public.profiles`. RLS blocks row access, but **TRUNCATE ignores RLS**. PostgREST cannot issue TRUNCATE, and the API only runs fixed SQL, so there is no exposure today. Consider `revoke truncate on all tables in schema public from anon, authenticated` in a later migration.
- **Data API exposure**: `public.profiles` is reachable through PostgREST (`/rest/v1/profiles`) by an authenticated user under the same RLS: read and update own row. A user can set their own name or nickname to `''` that way, bypassing front validation (AC 1.3). This is low impact.
- **Password policy only in local config**: the hosted project must mirror it (see Remaining gap 2).

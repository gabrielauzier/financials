# Validation: auth (backend T1-T13) - FAIL

**Verdict**: FAIL

One blocking defect and one blocking evidence gap. (1) The auth hook's 401 branches are not discriminated: with the hook disabled, every protected-route test still passes, because the only test route calls `request.withUser`, whose own guard also answers 401 (mutants M11 and M11c survived). (2) AUTH-01.6 (the confirmation link marks the e-mail as confirmed) is handed to Supabase Auth but no test records it. The build gate is green, and so is everything else the backend owns: JWT verification, withUser/RLS identity, timezone, errors and swagger.

**Date**: 2026-10-04
**Spec**: `.specs/features/auth/spec.md`
**Diff range**: `5dfa185..HEAD` (`HEAD` = `dc95d5ec4ef5d4f67f058bc63570197a2e0cbc2a`, branch `feat/backend-auth`), surface `api/`, `supabase/`, `.specs/features/auth/`, `README.md`
**Verifier**: independent sub-agent (author != verifier), read-only on the real tree

## Scope

In scope: backend tasks T1-T13 (API tooling, Fastify app, errors, timezone, local Supabase, test helpers, profiles migration and trigger, withUser, JWT verification, auth hook, RLS catalog, Swagger, GoTrue behavior record).
Out of scope: T14-T20 (web). The Lovable front end replaces them, so their unchecked boxes in `tasks.md` are expected. Web files are named where the front owns an AC. They are not graded.

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
| T10 | ✅ Done (hook tests not discriminating, see Gap 1) | `8871c2e` |
| T11 | ✅ Done | `b2eddf8` |
| T12 | ✅ Done | `065ee05` |
| T13 | ✅ Done | `dc95d5e` |

Each of T1-T13 has exactly one `feat(auth)` commit. One additional `docs(auth)` commit, `99bc411`, records the ES256/JWKS finding in tasks and design. T14-T20 are out of scope.

---

## Spec-Anchored Acceptance Criteria

Classification: **a** = covered by API/DB tests in this diff; **b** = delegated to Supabase Auth and recorded by `api/test/gotrue-behavior.int.test.ts`; **c** = front-end (Lovable) responsibility; **d** = deferred to a later feature.

### P1: Cadastro com confirmação

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 1.1 Valid sign-up creates an unconfirmed account | b (+a) | Account exists, e-mail unconfirmed | `api/test/gotrue-behavior.int.test.ts:101-107`: `expect(created.status).toBe(200)`, then sign-in `expect(res.body).toEqual({ code: 400, error_code: 'email_not_confirmed', ... })` (the account exists but is unconfirmed). Profile row: `api/test/profiles.int.test.ts:22`: `expect(rows).toEqual([{ name: 'Maria Silva', nickname: 'mari' }])` | ✅ PASS. ⚠️ "8+ caracteres" is enforced only by the front; the server minimum is 6 (`supabase/config.toml:183`) |
| 1.2 Confirmation e-mail is sent | b | E-mail sent to the address | `supabase/config.toml:227` `enable_confirmations = true`; `api/test/gotrue-behavior.int.test.ts:93`: `expect(resentToExistingUser(second.body)).toBe(true)` (`confirmation_sent_at` is set and refreshed) | ✅ PASS (weak: `:79` is vacuous when `confirmation_sent_at` is missing, see Gap 7. Delivery to Inbucket is not asserted) |
| 1.3 Empty field rejected, naming the field | c | Rejection naming the field | `web/src/features/auth/SignupForm.tsx` (not graded). Server side: GoTrue never sees name/nickname as required. The trigger stores `''` (`supabase/migrations/0001_profiles.sql:33-34`) | ➖ Front. ⚠️ A direct GoTrue sign-up accepts empty name and nickname |
| 1.4 Password < 8 rejected with short-password message | c | Rejection, short-password message | `web/src/features/auth/SignupForm.tsx:34` | ➖ Front. ⚠️ Spec deviation on the server: `minimum_password_length = 6` (`supabase/config.toml:183`), so 6- and 7-character passwords are accepted by direct API calls (Gap 3) |
| 1.5 Existing e-mail rejected with "E-mail já cadastrado" | b (+c) | That exact message | Confirmed account: `api/test/gotrue-behavior.int.test.ts:70-71`: `expect(res.body).toEqual({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' })`. Unconfirmed account: `:88-93` (same id, metadata ignored, detection rule). Message: `web/src/features/auth/SignupForm.tsx:44-50`, `emailExists.ts` | ✅ PASS (detection rule recorded; the message belongs to the front) |
| 1.6 Valid confirmation link marks the e-mail confirmed | b, **not recorded** | `email_confirmed_at` set | none | ❌ GAP (Gap 2) |
| 1.7 Account creation seeds categories | d | Seed per `accounts-categories` | Deferred: accounts-categories redefines `handle_new_user` (`supabase/migrations/0001_profiles.sql:2`) | ➖ Deferred (accounts-categories) |

### P1: Login e proteção da API

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 2.1 Confirmed user with valid credentials gets a JWT | b (+a) | Authenticated, JWT returned | `api/test/helpers/db.int.test.ts:24-25`: GoTrue `/user` accepts the token from the password grant, `expect(...id).toBe(user.id)`. The API accepts it: `api/test/auth.int.test.ts:89-91`: `expect(res.json()).toEqual({ userId: user.id, dbUid: user.id })` | ✅ PASS |
| 2.2 Unconfirmed e-mail: login refused, pending-confirmation message | b (+c) | Refusal | `api/test/gotrue-behavior.int.test.ts:106-107`: `toEqual({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' })`; message `web/src/features/auth/LoginForm.tsx:12` | ✅ PASS |
| 2.3 Invalid credentials: generic message | b (+c) | Same answer for wrong password and unknown e-mail | `api/test/gotrue-behavior.int.test.ts:115-120`: both `toEqual({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })`; message `LoginForm.tsx:11` | ✅ PASS |
| 2.4 Route without `Authorization: Bearer` gets 401 | a | 401 | `api/test/auth.int.test.ts:56-59`: `expect(res.statusCode).toBe(401)` + body `{ error: { code: 'unauthorized' } }` (`:51-52`) | ❌ Not discriminating: with the hook's missing-token branch removed, the test still passes because `request.withUser` throws 401 (`api/src/plugins/auth.ts:82`). Mutant M11 survived (Gap 1) |
| 2.5 Expired or bad-signature JWT gets 401 | a | 401 | Unit: `api/src/plugins/auth.test.ts:43-46`, `:53-56`, `:94-100` (`toMatchObject({ code: 'unauthorized', status: 401 })`). HTTP: `api/test/auth.int.test.ts:66-84` | ⚠️ The verifier is discriminating (M1, M2, M5 killed). The hook is not: swallowing verify errors in the hook survives (M11c, Gap 1) |
| 2.6 Front redirects protected routes to login | c | Redirect to `/login` | `web/src/features/auth/RequireAuth.tsx:14` | ➖ Front |

### P1: Isolamento de dados por usuário

| AC | Class | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----- | -------------------- | ----------------------- | ------ |
| 3.1 `user_id` on every user-data table | a | Column present | `api/test/rls-catalog.int.test.ts:19-31` catalog (tables with `user_id`, plus `profiles` keyed by `id`) | ✅ PASS for current tables. ⚠️ `profiles` uses `id` (design-accepted deviation) |
| 3.2 RLS on, access only to own rows | a | RLS enabled, own rows only | `api/test/rls-catalog.int.test.ts:55-58` (`rls` true, ≥1 policy, no violations), `:67` (negative probe flags both kinds of table); content: `api/test/profiles.int.test.ts:30`, `:33-34` (`toEqual([a.id])`, `not.toContain(a.id)`); `api/test/db.int.test.ts:51-52` | ✅ PASS (select). Cross-user UPDATE/DELETE is not asserted. A rolled-back probe showed 0 rows affected, because the select policy gates updates too (Gap 6) |
| 3.3 User A reaching user B's record by id gets 404 | d | 404 | Deferred to accounts-categories/transactions (first by-id routes). The infrastructure exists: `api/src/plugins/errors.ts:34-36`, `api/src/plugins/errors.test.ts:39-54` | ➖ Deferred (accounts-categories) |
| 3.4 Queries run as the authenticated user, never with the service key | a | `auth.uid()` = sub, role `authenticated`, no leakage | `api/test/db.int.test.ts:35`: `toEqual({ uid: user.id, role: 'authenticated' })`; `:45-47`, `:57-58` (no claim or role leak on the same connection); `:74` (rollback); `api/test/auth.int.test.ts:91` (`dbUid: user.id`) | ✅ PASS (M13, M14, M15 killed) |

### Edge cases

| Edge case | Class | Evidence | Result |
| --------- | ----- | -------- | ------ |
| Invalid e-mail format rejected | c | `web/src/features/auth/SignupForm.tsx:12` (`emailPattern`) | ➖ Front |
| E-mail service failure: say so, keep the account unconfirmed | c | `web/src/features/auth/SignupForm.tsx:51,59` | ➖ Front. GoTrue's behavior on SMTP failure is not recorded |
| Auth unavailable at login: message without technical details | c | `web/src/features/auth/LoginForm.tsx:15` | ➖ Front. API side: an unreachable JWKS becomes a 500 without details (`api/src/plugins/auth.ts:55-57`), untested (Gap 5) |

**Counts**: 17 ACs: a=5, b=6, c=3, d=2, gaps=1 (AUTH-01.6). Two of the "a" ACs (2.4, 2.5) have surviving hook-level mutants. 3 edge cases, all c.

### Spec-precision gaps

1. Password minimum: the spec says 8 (Assumptions, AC 1.4). The server says 6 (`supabase/config.toml:183`). The spec never says which layer enforces it.
2. Validation status: design and T3 say "400/422". The spec defines no status, and the implementation always uses 400 (`api/src/plugins/errors.ts:44`).
3. Message texts for 1.3, 1.4, 2.2 and all edge cases are not fixed in the spec, so only "E-mail já cadastrado" is assertable.
4. 401 body shape is unspecified. The implementation returns `{ error: { code: 'unauthorized', message } }`.
5. AUTH-07.1 says `user_id` on every table, but `profiles` is keyed by `id` (accepted in design). The catalog adds it by name.
6. Independent Test for login references `GET /transactions`, which does not exist yet (deferred).
7. The traceability footer in spec.md is stale ("0 mapped to tasks, 8 unmapped").

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (Build gate, API part only; web gate out of scope)
- **Gate outcome**: typecheck OK, lint OK, unit 32 passed (4 files), integration 24 passed (8 files): **56 passed, 0 failed, 0 skipped**
- **Test count before feature**: 0 (greenfield). **After**: 56. **Delta**: +56
- `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api`: no matches

### Check B litmus (shallow tests)

- auth hook (`api/test/auth.int.test.ts`): shallow in one respect. `expectUnauthorized` (`:50-53`) accepts any message, and the only route calls `withUser`, so the test cannot tell the hook's 401 from the decorator's. This is the root cause of Gap 1.
- verifier (`api/src/plugins/auth.test.ts`): strong. It covers expiry, missing exp, bad signature, missing sub, alg=none, HS256-in-JWKS confusion and a foreign key.
- db (`api/test/db.int.test.ts`): strong. It asserts values (uid, role, claims empty after the transaction) on a single connection.
- RLS catalog (`api/test/rls-catalog.int.test.ts`): checks that RLS is on and that policies exist, not what the policies say (confirmed). Policy content is covered behaviorally only for `profiles` select.
- swagger (`api/test/swagger.int.test.ts:26-32`): asserts the exact `/health` response schema and that the committed `openapi.json` is up to date (`:51`). Good. `info.title` is only `any(String)` (minor).
- gotrue-behavior: exact `toEqual` bodies. Strong, except the vacuous `:79` (Gap 7).

---

## Discrimination Sensor

Scratch: `git worktree add --detach /Volumes/MacOnlySSD/dev/personal/.verify-auth HEAD` with `api/node_modules` symlinked. Each mutation was applied, the covering tests were run, and the file was restored with `git checkout`. The worktree was then removed (`git worktree remove --force` + `git worktree prune`).

| # | File:line | Mutation | Tests run | Killed? |
| - | --------- | -------- | --------- | ------- |
| M1 | `api/src/plugins/auth.ts:43` | drop `exp` from `requiredClaims` | `src/plugins/auth.test.ts` | ✅ Killed (`rejects a token without exp`) |
| M2 | `api/src/plugins/auth.ts:43` | `clockTolerance: 10**9` (expiry ignored) | unit auth | ✅ Killed (both expired tests) |
| M3 | `api/src/plugins/auth.ts:43,59` | accept a token without `sub` (drop required `sub` and `hasSubject`) | unit auth | ✅ Killed |
| M4 | `api/src/plugins/auth.ts:59` | drop `hasSubject` only | unit auth | ❌ Survived (low: only `sub: ""` or a non-string sub differs; needs a validly signed token, Gap 4) |
| M5 | `api/src/plugins/auth.ts:56` | return the payload of an expired token | unit auth | ✅ Killed |
| M6 | `api/src/plugins/auth.ts:48` | HS256 mode also allows HS384/HS512 | unit auth | ❌ Survived (equivalent: same shared secret, no security change) |
| M7 | `api/src/plugins/timezone.ts:20` | accept any zone | `src/plugins/timezone.test.ts` | ✅ Killed |
| M8 | `api/src/plugins/errors.ts:51` | leak `error.message` on 500 | `src/plugins/errors.test.ts` | ✅ Killed |
| M9 | `api/src/plugins/errors.ts:44` | validation 400 to 422 | unit errors | ✅ Killed |
| M10 | `api/src/plugins/errors.ts:30` | drop `field` for an invalid value | unit errors | ✅ Killed |
| M11 | `api/src/plugins/auth.ts:90` | hook lets requests without a token through (`if (!token) return;`) | `test/auth.int.test.ts -t "without a token"` | ❌ **Survived** (masked by the `withUser` guard at `auth.ts:82`) |
| M11b | `api/src/plugins/auth.ts:82,90` | M11 + drop the `withUser` guard | same | ✅ Killed (proves the masking) |
| M11c | `api/src/plugins/auth.ts:91` | hook swallows verification errors and continues anonymously | `test/auth.int.test.ts -t "malformed\|expired"` | ❌ **Survived** (same masking) |
| M12 | `api/src/plugins/auth.ts:88` | invert the public-route check | `test/auth.int.test.ts` + `test/app.int.test.ts` | ✅ Killed |
| M16 | `api/src/plugins/auth.ts:66` | `/docs` no longer public | `test/swagger.int.test.ts` | ✅ Killed |
| M17 | `api/src/plugins/auth.ts:66` | `/health` no longer public | `test/app.int.test.ts` | ✅ Killed |
| M13 | `api/src/plugins/db.ts:26` | `set_config(..., false)` (session-wide claims leak) | `test/db.int.test.ts -t "never leaks"` | ✅ Killed |
| M14 | `api/src/plugins/db.ts:27` | drop `set local role authenticated` | `test/db.int.test.ts -t "runs with auth.uid"` | ✅ Killed |
| M15 | `api/src/plugins/db.ts:27` | `set role` (non-local, role leak) | `test/db.int.test.ts -t "never leaks"` | ✅ Killed |

**DB objects**: none were mutated on the live database. Reasoning from the tests: `profiles_select using (true)` would be killed by `api/test/profiles.int.test.ts:30` and `api/test/db.int.test.ts:51`. A trigger that swaps name and nickname would be killed by `api/test/profiles.int.test.ts:22`. Dropping `security definer` or `search_path` would be killed by `api/test/profiles.int.test.ts:42`. One check ran inside a single rolled-back transaction: `profiles_update using (true)` still let user B update 0 rows of A's profile, because the select policy also gates UPDATE. That mutant is equivalent today, and no test exercises it.

**Sensor depth**: P0 (auth), 19 manual behavior-level mutations.
**Sensor outcome**: 15 killed, 4 survived (M11 and M11c are critical; M4 is low; M6 is equivalent).

---

## Isolation Proof

- Real tree `git status --porcelain`: empty before and after (baseline equal). `HEAD` unchanged at `dc95d5e`.
- `git worktree list` after cleanup shows only `/Volumes/MacOnlySSD/dev/personal/financials`. The `.verify-auth` directory no longer exists. `api/node_modules` is intact.
- Local DB unchanged in structure: `public.profiles` RLS on; policies `profiles_select` / `profiles_update` with `id = (select auth.uid())`; trigger `on_auth_user_created` present; `md5(handle_new_user.prosrc)` = `43d8c37a...` before and after; `auth.users` count 0 before and after. The user-owned `web` stack was not touched.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Small, direct plugins; no single-use abstractions of note |
| Surgical changes | ✅ |
| No scope creep | ✅ Minor extras: `db:stop`/`db:status` scripts, `config.ts` (needed by `buildApp`), the generic 4xx passthrough and the not-found handler in errors. All justified |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ⚠️ 2.4/2.5 assert 401 but cannot attribute it to the hook (Gap 1) |
| Per-layer coverage expectation | ⚠️ JWKS-unreachable path untested (Gap 5) |
| Every test maps to a spec requirement | ✅ `config.test.ts` maps to T10 wiring |
| Documented guidelines | none in repo; strong defaults applied |

---

## Ranked Gaps (fix tasks)

1. **[Blocker] Auth hook 401 branches not discriminated** (AUTH-06; AC 2.4, 2.5; `api/test/auth.int.test.ts:19-29`, `api/src/plugins/auth.ts:86-93`). Mutants M11 and M11c survive because the test route calls `request.withUser`, which throws 401 itself. A future route that does not call `withUser` would be open, and no test would notice. **Fix**: in `auth.int.test.ts` add a protected sample route that does not touch the DB (for example it returns `{ userId: request.user?.id }`). Assert 401 for a missing, non-Bearer, malformed, expired and forged token, and assert 200 with the subject for a real token. Optionally assert the hook's message (`'Missing bearer token'`).
2. **[Major] AUTH-01.6 not recorded** (confirmation link marks the e-mail confirmed; no evidence). **Fix**: extend `api/test/gotrue-behavior.int.test.ts`. Sign up, get the confirmation link (Inbucket API on 55324, or admin `POST /auth/v1/admin/generate_link` with type `signup`), call `/auth/v1/verify`, then assert `auth.users.email_confirmed_at is not null` and that password sign-in now succeeds.
3. **[Major, non-blocking: front-owned AC] Server password minimum 6 vs spec 8** (`supabase/config.toml:183`). **Fix**: set `minimum_password_length = 8`, and record in gotrue-behavior that a 7-character sign-up gets 422 `weak_password`. Apply the same setting in the hosted project.
4. **[Minor] `hasSubject` unguarded** (M4; `api/src/plugins/auth.ts:59`). Add unit cases for `sub: ''` and `sub: 123`.
5. **[Minor] JWKS-unreachable path untested** (`api/src/plugins/auth.ts:55-57`; edge case E3 API side). Add a unit test where `getKey` throws a non-JOSE error and `JWKSTimeout`. Expect a rethrow (500 `internal_error` without details), not 401.
6. **[Minor] No cross-user UPDATE/DELETE assertion on `profiles`** (AC 3.2). Behavior is correct today (rolled-back probe). Add one assertion so a later change to the select policy cannot open writes silently.
7. **[Minor] Vacuous assertion** `api/test/gotrue-behavior.int.test.ts:79`: `NaN >= 1000` is false when `confirmation_sent_at` is missing. Assert `first.body.confirmation_sent_at` is defined (strengthens AC 1.2).

Deferred and front-owned, non-blocking: AC 1.3, 1.4, 2.6 and all 3 edge cases go to the Lovable front (`web/src/features/auth/`). AC 1.7 and 3.3 go to accounts-categories.

---

## Security Notes

Author-raised concerns:

- **`minimum_password_length = 6` vs spec 8**: confirmed (`supabase/config.toml:183`; `password_requirements = ""`). See Gap 3.
- **JWT issuer/audience not checked**: confirmed (`api/src/plugins/auth.ts:43`; no `issuer`/`audience`). The risk is low with one project per key set, but cheap to close: `issuer: '<SUPABASE_URL>/auth/v1'`, `audience: 'authenticated'`. The `role` claim is not checked either. Anonymous sign-ins are disabled (`supabase/config.toml:179`). Re-check if they are ever enabled (`is_anonymous`).
- **`DATABASE_URL` is the postgres superuser locally**: partly refuted. Locally `postgres` has `rolsuper = f` but `rolbypassrls = t`. The substance holds: the connection role bypasses RLS, and isolation rests on `set local role authenticated` inside `withUser`. M14 and M15 (killed) guard that line. Any future raw use of the pool outside `withUser` would bypass RLS. Production should use a dedicated non-bypass role that is granted `authenticated`.
- **postgres.js default prepared statements**: confirmed (`api/src/plugins/db.ts:37`, no `prepare: false`). Fine on a direct connection. A Supavisor transaction pooler (port 6543) needs `prepare: false`. `set_config(..., true)` + `set local` are pooler-safe inside the transaction.
- **RLS catalog checks existence, not content**: confirmed (`api/test/rls-catalog.int.test.ts:22`, `:34-35`). For `profiles` the select content is covered behaviorally. For future tables, each feature must add its own cross-user behavior test (AUTH-08 404).

Additional findings:

- Hook/decorator coupling (Gap 1). The `withUser` guard is good defense in depth, but it hides hook regressions from the tests.
- Unauthenticated requests to unknown routes get 401 before 404. `routeOptions.url` is undefined, so the route is not public. No route enumeration is possible, which is good. This is untested.
- A direct GoTrue sign-up stores empty name and nickname (`supabase/migrations/0001_profiles.sql:33-34`). AC 1.3 is enforced only in the front.
- `handle_new_user` is `security definer` with `search_path = public`, no dynamic SQL, and `execute` revoked from public/anon/authenticated (`supabase/migrations/0001_profiles.sql:40`). Good.
- With `SUPABASE_JWT_SECRET` set, the API switches to HS256 only and fails closed for ES256 user tokens. The anon and service_role keys have no `sub` and are rejected (`api/src/plugins/auth.ts:59`).

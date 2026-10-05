# Autenticação Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/auth/design.md`
**Status**: Draft

**Feature prerequisites**: none (first feature; creates the shared api/ and web/ foundation).

---

## Test Coverage Matrix

> Generated from the approved design and spec - confirm before Execute. Guidelines found: none in the repo (greenfield; no `AGENTS.md`, `CONTRIBUTING.md` or test config) - strong defaults applied. Test stack taken from the approved designs: Vitest, local Supabase Postgres (`supabase start`), React Testing Library; package manager `pnpm` (assumption, confirm).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (parsers, validators, helpers) | unit | All branches; 1:1 to spec ACs; every listed edge case | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, services, SQL rules, migrations/RLS | integration | Every route: happy path + every listed edge case + error paths; RLS and constraints exercised | `api/test/**/*.int.test.ts` | `pnpm -C api test:int` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; error and empty states | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Scaffold / config / generated types | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the approved design - confirm before Execute. Commands do not exist yet; the scaffold tasks create them.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm -C api test:unit` (API tasks) / `yarn --cwd web test` (web tasks) |
| Full | After tasks with integration tests (needs `supabase start`) | `pnpm -C api test` (unit + integration) |
| Build | After phase completion or scaffold/config-only tasks | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: API tooling and base plugins

```
T1 → T2
T2 → T3
T2 → T4
T1 → T5
T1 → T6
T5 → T6
```

### Phase 2: Database access and token security

```
T8 → T10
T9 → T10
T7 → T11
T8 → T11
```

### Phase 3: Web app: session, sign-up, login (substituída pelo Lovable, ver lovable.md)
```
T14 → T15
T14 → T16
T16 → T17
T16 → T18
T16 → T19
T14 → T20
```

---

## Task Breakdown

### Phase 1: API tooling and base plugins

### T1: Scaffold the api project tooling

**What**: Create the `api/` package: TypeScript, Fastify, TypeBox, postgres.js, jose, Luxon, Vitest (`test:unit`, `test:int`, `test`), ESLint and `typecheck` scripts.
**Where**: `api/package.json`
**Depends on**: None
**Reuses**: -
**Requirement**: AUTH-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `pnpm -C api typecheck`, `lint` and `test` scripts exist and run clean on an empty suite
- [x] Scripts `test:unit` (`src/**/*.test.ts`) and `test:int` (`test/**/*.int.test.ts`) are separate
- [x] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): scaffold the api project tooling`

---

### T2: Create the Fastify app factory and health route

**What**: `buildApp()` returns a Fastify instance with `GET /health` (public, 200 `{ status: 'ok' }`).
**Where**: `api/src/app.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `GET /health` returns 200 with `{ status: 'ok' }` without a token
- [x] `buildApp()` can be called repeatedly in tests without port binding (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): create the Fastify app factory and health route`

---

### T3: Add the error plugin

**What**: Single error shape `{ error: { code, message, field? } }`, `AppError(code, status, message, field?)`, mapping for validation (400/422), 401, 403, 404, 409 and unexpected errors (500 without internals).
**Where**: `api/src/plugins/errors.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `AppError` produces the documented status and body
- [x] Validation failures expose `field`
- [x] Unexpected errors return 500 `internal_error` with no stack in the body (4 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): add the error plugin`

---

### T4: Add the timezone plugin

**What**: Read `X-Timezone`, validate as an IANA zone with Luxon and expose `request.tz` (default `America/Sao_Paulo`; invalid zone -> 400 `invalid_timezone`).
**Where**: `api/src/plugins/timezone.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Missing header yields `America/Sao_Paulo`
- [x] Valid zone is exposed on `request.tz`
- [x] Invalid zone yields 400 `invalid_timezone` (3 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): add the timezone plugin`

---

### T5: Initialize the local Supabase project

**What**: `supabase init` with `config.toml`: email confirmations enabled, local Auth/Postgres/Storage; npm scripts `db:start`, `db:reset`.
**Where**: `supabase/config.toml`
**Depends on**: T1
**Reuses**: -
**Requirement**: AUTH-02

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] `supabase start` brings up Postgres, Auth and Storage locally
- [x] `config.toml` has email confirmation enabled
- [x] Root README snippet documents the local stack commands
- [x] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): initialize the local Supabase project`

---

### T6: Create the integration test helpers

**What**: Helpers to connect as admin, create a confirmed test user, obtain a real access token for that user by signing in through GoTrue, and clean up. (Finding: local GoTrue signs user tokens with ES256 published at `/auth/v1/.well-known/jwks.json`; the HS256 `JWT_SECRET` signs only the anon and service_role API keys, so a user token cannot be minted locally.)
**Where**: `api/test/helpers/db.ts`
**Depends on**: T1, T5
**Reuses**: -
**Requirement**: AUTH-07

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] `createTestUser()` returns `{ id, token }` for a user present in `auth.users`
- [x] Two calls produce two distinct users
- [x] Cleanup removes created users (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): create the integration test helpers`

---

### Phase 2: Database access and token security

### T7: Create the profiles migration and new-user trigger

**What**: Migration `0001`: `profiles` table (RLS: select/update own row) and `handle_new_user` trigger on `auth.users` that inserts the profile from `raw_user_meta_data` (name, nickname).
**Where**: `supabase/migrations/0001_profiles.sql`
**Depends on**: T6
**Reuses**: Deviation from design: the trigger does not call `seed_categories` here; accounts-categories redefines `handle_new_user` to add the seed (it does not exist yet).
**Requirement**: AUTH-07

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Creating an `auth.users` row creates a `profiles` row with name and nickname
- [x] A user reads only their own profile; another user reads none
- [x] `handle_new_user` uses `set search_path = public` (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): create the profiles migration and new-user trigger`

---

### T8: Implement withUser database access

**What**: `withUser(claims, fn)` opens a transaction, runs `set_config('request.jwt.claims', claims, true)` and `set local role authenticated`, runs `fn`, commits.
**Where**: `api/src/plugins/db.ts`
**Depends on**: T6
**Reuses**: -
**Requirement**: AUTH-08

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [x] Inside `withUser`, `auth.uid()` equals the token subject and the role is `authenticated`
- [x] Two consecutive `withUser` calls for different users never see each other's claims (no leakage)
- [x] A thrown error rolls the transaction back (3 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): implement withUser database access`

---

### T9: Implement JWT verification

**What**: `verifyToken(token)` validates signature and expiry with `jose`: remote JWKS mode (primary; the local stack and new Supabase projects publish ES256 keys at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) and an HS256 secret mode kept as a config fallback for legacy projects; returns claims with `sub`.
**Where**: `api/src/plugins/auth.ts`
**Depends on**: T2, T3
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Valid HS256 token returns claims
- [x] Expired token and bad-signature token are rejected
- [x] JWKS mode accepts a token signed by a locally generated key set
- [x] Missing `sub` is rejected (5 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): implement JWT verification`

---

### T10: Wire the auth hook and protect routes

**What**: `onRequest` hook requires `Authorization: Bearer <JWT>` on every route except `/health` and `/docs`; sets `request.user`; 401 otherwise; registers `withUser` on the request.
**Where**: `api/src/app.ts`
**Depends on**: T8, T9
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Protected sample route returns 401 without token, with malformed token and with expired token
- [ ] Valid token returns 200 and `request.user.id` equals the subject
- [ ] `/health` stays public (4 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): wire the auth hook and protect routes`

---

### T11: Add the RLS catalog test

**What**: Test that every table in `public` with a `user_id` column has RLS enabled and at least one policy; grows automatically with later migrations.
**Where**: `api/test/rls-catalog.int.test.ts`
**Depends on**: T7, T8
**Reuses**: -
**Requirement**: AUTH-07

**Tools**:

- MCP: NONE
- Skill: supabase, supabase-postgres-best-practices

**Done when**:

- [ ] Query over `pg_class`/`information_schema` fails when a user-data table has RLS disabled
- [ ] Test passes for the tables existing now (1 test)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): add the RLS catalog test`

---

### T12: Register Swagger and export the OpenAPI contract

**What**: `@fastify/swagger` from TypeBox schemas, UI at `/docs` (public), JSON at `/docs/json`, script `openapi:export` writing `api/openapi.json`.
**Where**: `api/src/plugins/swagger.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `GET /docs/json` returns a valid OpenAPI document that lists `/health`
- [ ] `pnpm -C api openapi:export` writes `api/openapi.json` (2 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): register Swagger and export the OpenAPI contract`

---

### T13: Verify GoTrue behaviors against the local stack

**What**: Integration test that records the real behavior of Supabase Auth for: duplicate-email `signUp` response, unconfirmed-email login error code, invalid-credentials error; update `auth/design.md` Risks with the findings.
**Where**: `api/test/gotrue-behavior.int.test.ts`
**Depends on**: T6
**Reuses**: -
**Requirement**: AUTH-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Duplicate `signUp` result is captured and the detection rule for 'E-mail já cadastrado' is written in `design.md`
- [ ] Unconfirmed login error code and invalid-credentials code are captured
- [ ] If duplicate detection is impossible, STOP and report to the user before continuing (3 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): verify GoTrue behaviors against the local stack`

---

### Phase 3: Web app: session, sign-up, login (substituída pelo Lovable, ver lovable.md)
### T14: Scaffold the web project tooling

**What**: Create `web/`: Vite + React + TypeScript, React Router, TanStack Query, Tailwind, Vitest + Testing Library, ESLint, `typecheck` script.
**Where**: `web/package.json`
**Depends on**: None
**Reuses**: -
**Requirement**: AUTH-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `yarn --cwd web typecheck`, `lint` and `test` run clean
- [ ] `yarn --cwd web build` succeeds
- [ ] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): scaffold the web project tooling`

---

### T15: Create the API client

**What**: Typed `fetch` wrapper that attaches `Authorization: Bearer` and `X-Timezone` (from `Intl`), maps the error shape and signals 401 for session clearing.
**Where**: `web/src/lib/api/client.ts`
**Depends on**: T14
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Requests carry Bearer and `X-Timezone` headers
- [ ] A 401 triggers the unauthorized callback
- [ ] Error body is mapped to a typed error (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): create the API client`

---

### T16: Create the Supabase client and session hook

**What**: `useSession()` exposing `session`, `signIn`, `signUp`, `signOut` over `supabase-js`; `signUp` sends name and nickname as user metadata.
**Where**: `web/src/features/auth/useSession.ts`
**Depends on**: T14
**Reuses**: -
**Requirement**: AUTH-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `signUp` passes name and nickname in metadata
- [ ] `signIn` and `signOut` update the session state
- [ ] Session is restored on reload (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): create the Supabase client and session hook`

---

### T17: Build the sign-up page

**What**: Form with name, nickname, e-mail, password (min 8); field errors; shows 'E-mail já cadastrado' using the rule from T13; shows confirmation-sent state.
**Where**: `web/src/features/auth/SignUpPage.tsx`
**Depends on**: T16, T13
**Reuses**: -
**Requirement**: AUTH-01

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Empty field blocks submit and names the field
- [ ] Password shorter than 8 characters shows the short-password message
- [ ] Invalid e-mail format shows the invalid e-mail message
- [ ] Existing e-mail shows 'E-mail já cadastrado'
- [ ] E-mail send failure shows a generic confirmation-not-sent message
- [ ] Success shows the check-your-e-mail state (6 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): build the sign-up page`

---

### T18: Build the login page

**What**: E-mail and password form; generic message for invalid credentials; pending-confirmation message for unconfirmed e-mail; unavailable-service message.
**Where**: `web/src/features/auth/LoginPage.tsx`
**Depends on**: T16, T13
**Reuses**: -
**Requirement**: AUTH-05

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Valid credentials sign in and navigate to the app
- [ ] Invalid credentials show one generic message that does not name the field
- [ ] Unconfirmed e-mail shows the confirmation-pending message
- [ ] Auth service failure shows the unavailable message (4 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): build the login page`

---

### T19: Add the protected route guard

**What**: `<RequireAuth>` redirects to `/login` when there is no valid session and renders children otherwise.
**Where**: `web/src/features/auth/RequireAuth.tsx`
**Depends on**: T16
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] No session redirects to `/login`
- [ ] Session renders the protected content
- [ ] Session loss while on a page redirects to `/login` (3 tests)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(auth): add the protected route guard`

---

### T20: Add the API types generation script

**What**: Script `gen:api` runs `openapi-typescript ../api/openapi.json` into `web/src/lib/api/schema.d.ts`; commit the generated file.
**Where**: `web/package.json`
**Depends on**: T14, T12
**Reuses**: -
**Requirement**: AUTH-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `yarn --cwd web gen:api` regenerates `schema.d.ts` from `api/openapi.json`
- [ ] Typecheck passes with the generated types
- [ ] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): add the API types generation script`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

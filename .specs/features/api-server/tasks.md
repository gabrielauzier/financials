# Servidor da API e CORS Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/api-server/design.md`
**Status**: Draft

**Feature prerequisites**: auth, accounts-categories and transactions backends complete (branch feat/backend-transactions).

---

## Test Coverage Matrix

> Generated from the approved design and spec - confirm before Execute. Guidelines found: none in the repo (greenfield; no `AGENTS.md`, `CONTRIBUTING.md` or test config) - strong defaults applied. Test stack taken from the approved designs: Vitest, local Supabase Postgres (`supabase start`), React Testing Library; package manager `pnpm` (assumption, confirm).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (parsers, validators, helpers) | unit | All branches; 1:1 to spec ACs; every listed edge case | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, services, SQL rules, migrations/RLS | integration | Every route: happy path + every listed edge case + error paths; RLS and constraints exercised | `api/test/**/*.int.test.ts` | `pnpm -C api test:int` |
| Web components, hooks, helpers | unit | Spec-visible behavior per AC; error and empty states | `web/src/**/*.test.tsx` | `pnpm -C web test` |
| Scaffold / config / generated types | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the approved design - confirm before Execute. Commands do not exist yet; the scaffold tasks create them.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm -C api test:unit` (API tasks) / `pnpm -C web test` (web tasks) |
| Full | After tasks with integration tests (needs `supabase start`) | `pnpm -C api test` (unit + integration) |
| Build | After phase completion or scaffold/config-only tasks | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `pnpm -C web typecheck && pnpm -C web lint && pnpm -C web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Config and CORS

```
T1 → T2
```

### Phase 2: Server entry and scripts

```
T3 → T4
```

---

## Task Breakdown

### Phase 1: Config and CORS

### T1: Extend the config with port, host, CORS origins and log level

**What**: `loadConfig` reads `PORT` (default 3001, 1 to 65535), `HOST` (default 127.0.0.1), `CORS_ORIGINS` (normalized list, rejects `*`) and `LOG_LEVEL` (default `info`); `parseCorsOrigins` exported.
**Where**: `api/src/config.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: SRV-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Defaults apply when the variables are absent
- [x] An invalid `PORT` (0, 70000, `abc`, `3001.5`) is rejected with a message citing `PORT`
- [x] `CORS_ORIGINS` with spaces and trailing slashes normalizes to exact origins and drops empty entries
- [x] `CORS_ORIGINS` containing `*` is rejected with a message citing `CORS_ORIGINS`
- [x] Missing `SUPABASE_URL` or `DATABASE_URL` is rejected citing the variable (6 tests)
- [x] Gate check passes: `pnpm -C api test:unit`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api-server): extend the config with port, host, CORS origins and log level`

---

### T2: Register the CORS plugin before authentication

**What**: `corsPlugin` over `@fastify/cors` with exact origins, methods GET, POST, PATCH, DELETE and OPTIONS, headers authorization, content-type and x-timezone, max-age 600, no credentials; registered in `buildApp` before the auth plugin.
**Where**: `api/src/plugins/cors.ts`
**Depends on**: T1
**Reuses**: -
**Requirement**: CORS-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Preflight from an allowed origin asking PATCH with authorization, content-type and x-timezone answers 204 without a token and with the allow-origin, allow-methods, allow-headers and max-age 600 headers
- [x] Actual requests from an allowed origin carry allow-origin and `Vary: Origin`; a protected route without a token answers 401 with the standard error body and the allow-origin header
- [x] A non-listed origin, a missing `Origin` header and an empty `CORS_ORIGINS` produce no `Access-Control-*` header
- [x] `Access-Control-Allow-Credentials` is never sent and `PUT` is not advertised (8 tests)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(api-server): register the CORS plugin before authentication`

---

### Phase 2: Server entry and scripts

### T3: Add the server entry with graceful shutdown and safe logging

**What**: `startServer(env)` loads the config, builds the app with a pino logger (level from `LOG_LEVEL`, authorization redacted), listens and returns `{ app, address, close }`; `main` handles SIGTERM and SIGINT (close, exit 0) and prints configuration errors with exit 1.
**Where**: `api/src/server.ts`
**Depends on**: T2
**Reuses**: -
**Requirement**: SRV-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `startServer` on port 0 serves `GET /health` 200 over real HTTP
- [ ] A child process started with the compiled-or-tsx entry exits with code 0 after SIGTERM and after SIGINT and refuses new connections
- [ ] A child process without `SUPABASE_URL` exits non-zero with a message citing the variable
- [ ] A request carrying an Authorization header never leaves the token in the log output (5 tests)
- [ ] Gate check passes: `pnpm -C api test`
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: integration
**Gate**: full

**Commit**: `feat(api-server): add the server entry with graceful shutdown and safe logging`

---

### T4: Add the dev, build and start scripts and run documentation

**What**: `dev` (tsx watch with `--env-file-if-exists`), `build` (tsc to `dist/` via `tsconfig.build.json`), `start`, `api/.env.example` with local values and the README section on running the API with the local Supabase stack.
**Where**: `api/package.json`
**Depends on**: T3
**Reuses**: -
**Requirement**: SRV-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `pnpm -C api build` succeeds and `node api/dist/server.js` with the example variables serves `/health`
- [ ] `api/.env.example` lists every variable with a comment and local development values
- [ ] README explains the startup order: `db:start`, API, front
- [ ] Gate check passes: build gate for the layer (typecheck + lint + tests)
- [ ] Test count: all tests listed above pass, no silent deletions or skips

**Tests**: none
**Gate**: build

**Commit**: `feat(api-server): add the dev, build and start scripts and run documentation`

---

## Phase Execution Map

```
Phase 1 → Phase 2
```

Execution is strictly sequential within each phase; cross-feature order is auth → accounts-categories → transactions → import → credit-expenses → dashboards.

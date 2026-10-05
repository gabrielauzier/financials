# Validation: api-server (T1-T4), iteration 1 - FAIL

**Verdict**: FAIL

One conjunct of one AC has no evidence: SRV-03 (AC P1 "Subir a API" 5) requires the process to stop accepting connections, **close the database pool** and exit 0. The tests prove exit 0 and a refused connection, but a process that calls `process.exit(0)` without closing the app passes them too (mutant M24 survived). Nothing in the repo tests that the pool is closed (`dbPlugin` `onClose` at `api/src/plugins/db.ts:39-40` is never exercised by a test). Everything else holds: the CORS control is well discriminated (14 of 14 CORS code mutants killed or equivalent), the build gate is green (306 passed, 0 failed, 0 skipped) and the compiled server works against the local stack.

**Iteration**: 1 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/api-server/spec.md`
**Diff range**: `212a009^..HEAD`. `HEAD` = `0f4ae23f5ffbebb1850902cbdee7efbd3818fc8f`, branch `feat/api-server`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Build, manual runs and mutations ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-srv`, now removed).

## Scope

In scope: T1-T4 (`api/src/config.ts`, `api/src/plugins/cors.ts`, `api/src/app.ts`, `api/src/server.ts`, `api/package.json`, `api/tsconfig.build.json`, `api/.env.example`, `README.md`, the two new integration test files and the extended `api/src/config.test.ts`).

Classification key: (a) covered by tests in this diff; (b) verified by an artifact other than a test (command run by the Verifier, output cited); (c) deferred; GAP = no evidence.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown`, 4 task headings, every box ticked.

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| (spec) | - | `212a009` | spec, design, tasks, `INTEGRACAO-FRONT-BACK.md` |
| T1 config | ✅ Done | `99b66e5` | `LOG_LEVEL` lives in `loadServerConfig`, as the design says (tasks.md says `loadConfig`; harmless wording drift) |
| T2 CORS plugin | ✅ Done | `b49a851` | - |
| T3 server entry | ✅ Done | `72cb705` | Also adds `BuildAppOptions.logger` to `api/src/app.ts` (needed to inject the logger) |
| T4 scripts and docs | ✅ Done | `0f4ae23` | - |

One commit per task.

---

## Spec-Anchored Acceptance Criteria

Paths: `C` = `api/src/config.test.ts`, `CO` = `api/test/cors.int.test.ts`, `SV` = `api/test/server.int.test.ts`.

### P1: Subir a API

| # | Criterion | Spec-defined outcome | Class | Evidence (`file:line` - assertion) | Status |
| - | --------- | -------------------- | ----- | ---------------------------------- | ------ |
| 1 | Started with valid config, listens and serves `GET /health` over real HTTP | 200 `{ "status": "ok" }` | a + b | `api/test/server.int.test.ts:71` `expect(response.status).toBe(200)`; `:72` `toEqual({ status: 'ok' })` (real `fetch` to `startServer`). Child process via env `PORT`: `:87` `waitHealthy` (`response.ok`). (b) compiled `node --env-file=.env.example dist/server.js` -> `HTTP/1.1 200 OK {"status":"ok"}` | ✅ |
| 2 | Reads `PORT` (3001), `HOST` (127.0.0.1), `CORS_ORIGINS`, `LOG_LEVEL`, `SUPABASE_URL`, `DATABASE_URL`, `SUPABASE_JWT_SECRET` | defaults 3001 / 127.0.0.1 / info; values read | a | `api/src/config.test.ts:26-28` defaults `toBe(3001)`, `toBe('127.0.0.1')`, `toBe('info')`; `:33` `toEqual([8081, '0.0.0.0', 'warn'])`; `:60` `CORS_ORIGINS`; `:8` and `:15` URLs and JWT secret (pre-existing). Env wiring end to end: `api/test/server.int.test.ts:87` (child honours `PORT`), `:128` (`LOG_LEVEL=info` yields request logs; killed M27) | ✅ |
| 3 | Invalid `PORT` refused citing `PORT` | error mentions `PORT` | a | `api/src/config.test.ts:37` `toThrow(/PORT/)` for `0`, `65536`, `70000`, `abc`, `3001.5`, `-1`; `api/test/server.int.test.ts:80` `rejects.toThrow(/PORT/)`; process `:107-108` exit != 0, stderr contains `PORT` | ✅ |
| 4 | Missing `SUPABASE_URL` / `DATABASE_URL`: exit non-zero, message cites the variable | code != 0, message names variable | a + b | `api/test/server.int.test.ts:98-100` `code` not 0, not null, `stderr` contains name; `api/src/config.test.ts:41`. (b) `env -i ... node dist/server.js` -> one line `Missing required environment variable SUPABASE_URL`, exit 1, no stack trace | ✅ |
| 5 | SIGTERM/SIGINT: stop accepting connections, **close the DB pool**, exit 0 | listener closed, pool closed, code 0 | a (partial) | `api/test/server.int.test.ts:90` `toEqual({ code: 0, signal: null })`; `:91` `fetch(...).rejects.toThrow()`. Pool close: **no evidence** (M24 `server.close()` replaced by a no-op survived; process exit alone satisfies both assertions) | ❌ GAP (pool conjunct) |
| 6 | Each request logged as JSON without the `Authorization` header or token | JSON per request; token absent | a | `api/test/server.int.test.ts:121` every line `JSON.parse`; `:128` record with `req.url === '/accounts'`; `:129` `res.statusCode === 401`; `:130-131` stdout/stderr `not.toContain(token)`. Killed M22 (serializer that prints headers) | ✅ (see note on `redact`) |

### P1: CORS para o front

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 | Preflight from allowed origin asking `PATCH` + 3 headers, no token | 204 | a | `api/test/cors.int.test.ts:37` `toBe(204)` (no `authorization` header sent, PATCH on `/transactions/:id`); `:51` second origin. Killed M29 (CORS registered after auth: 3 tests fail) | ✅ |
| 2 | Preflight headers | ACAO = origin; methods `GET, POST, PATCH, DELETE, OPTIONS`; headers the 3; max-age 600 | a | `api/test/cors.int.test.ts:38` `toBe(ALLOWED)`; `:39` `toBe('GET, POST, PATCH, DELETE, OPTIONS')` (exact string); `:41` sorted list `toEqual(['authorization','content-type','x-timezone'])`; `:42` `toBe('600')`. Killed M6-M9, M11 | ✅ |
| 3 | Real request from allowed origin | ACAO = origin and `Vary: Origin` | a | `api/test/cors.int.test.ts:70` `toBe(ALLOWED)`; `:71` `vary` contains `origin` | ✅ |
| 4 | Protected route without token from allowed origin | 401, standard error body, ACAO | a | `api/test/cors.int.test.ts:77` `toBe(401)`; `:78` `error.code` `toBe('unauthorized')`; `:79` ACAO `toBe(ALLOWED)` | ✅ |
| 5 | Origin not listed | no `Access-Control-*` header | a | `api/test/cors.int.test.ts:96` (preflight) and `:98` (real) `corsHeaders(...)` `toEqual([])` for unlisted, subdomain, other port, other scheme, suffix. Killed M1, M3, M4 | ✅ |
| 6 | `CORS_ORIGINS` empty | no origin allowed | a | `api/test/cors.int.test.ts:113`, `:115` `toEqual([])` on an app built without origins; `api/src/config.test.ts:54-56` | ✅ |
| 7 | `CORS_ORIGINS` contains `*` | refused citing `CORS_ORIGINS` | a + b | `api/src/config.test.ts:66` `toThrow(/CORS_ORIGINS/)` for `*`, `http://localhost:8080,*`, ` * `. (b) process: `CORS_ORIGINS='http://a, * '` -> `CORS_ORIGINS must list exact origins; "*" is not allowed`, exit 1. Killed M12 | ✅ |
| 8 | Exact comparison, ignore trailing slash in config, no implicit subdomains | exact match | a | `api/src/config.test.ts:47` trailing slash stripped; `api/test/cors.int.test.ts:84-98` subdomain/port/scheme/suffix rejected. Case: no test (M2 case-insensitive survived; equivalent for browsers, see Sensor) | ✅ |
| 9 | Never sends `Access-Control-Allow-Credentials` | header absent | a | `api/test/cors.int.test.ts:62` (preflight) and `:72` (real) `toBeUndefined()`. Killed M10 | ✅ |

### Success criteria

| Criterion | Class | Evidence | Status |
| --------- | ----- | -------- | ------ |
| `pnpm -C api build && node api/dist/server.js` serves `/health` | b | Scratch worktree: `pnpm build` (exit 0, emits `dist/server.js`), `PORT=47311 node --env-file=.env.example dist/server.js` -> `/health` 200, allowed preflight 204 with all 4 headers, SIGTERM -> exit 0, then `curl` refused (exit 7) | ✅ |
| Front at `http://localhost:8080` lists accounts through the real API without a CORS error | c | Needs the front wired to the API (`INTEGRACAO-FRONT-BACK.md`); manual UAT | deferred |

**Count**: 15 ACs. a = 15 (4 also backed by b), b-only = 0, c = 0, GAP = 1 conjunct (SRV-03 pool close). Success criteria: 1 b, 1 c.

---

## Edge Cases

- [x] `CORS_ORIGINS` with spaces and trailing slashes normalized: `api/src/config.test.ts:47` - `toEqual(['http://localhost:8080', 'http://127.0.0.1:5173'])` for the exact spec input plus `,,`. Killed M13, M18.
- [x] No `Origin`: normal response, no CORS headers: `api/test/cors.int.test.ts:103-104` - `200` and `corsHeaders(...)` `toEqual([])`.
- [x] Preflight asking `PUT` does not advertise it: `api/test/cors.int.test.ts:61` - `not.toContain('PUT')`. Killed M11.

Design risks checked:

- [x] CORS before auth: `api/src/app.ts:36` (auth at `:39`); killed M29 (moving it after `timezonePlugin` breaks the preflight and the 401 ACAO tests).
- [x] Token never logged: M22 killed. See security note on `redact`.

---

## Check B (shallow assertions) and Check C (reverse mapping)

- Child-process tests: `api/test/server.int.test.ts:90` asserts the exact pair `{ code: 0, signal: null }`, so death by signal (code `null`) fails; `:91` proves the listener is gone. They do not prove the pool closed or that `app.close()` ran (M24). This is the blocking gap.
- `api/test/server.int.test.ts:103` ("invalid PORT") checks `code` not 0 but not `not.toBeNull()` as the sibling test does; a death by signal would pass it. Minor.
- `api/test/cors.int.test.ts:45` is titled "for routes that do not exist" but uses `/accounts`, which exists. Mislabelled, not shallow.
- `api/test/cors.int.test.ts:78` checks only `error.code`; enough to identify the standard body.
- Reverse mapping: all 36 new tests map to an AC, edge case or Done-when. `api/src/config.test.ts:59` (`corsOrigins` present only when non-empty) maps to the design contract (`AppConfig.corsOrigins?`).

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (from the real tree, once)
- **Result**: exit 0. 306 passed (93 unit in 6 files, 213 integration in 17 files), 0 failed, 0 skipped
- **New tests in this diff**: 36 (16 unit in `api/src/config.test.ts`, 12 in `api/test/cors.int.test.ts`, 8 in `api/test/server.int.test.ts`). No test deleted or weakened (the only edit to an existing test file is the added import and new `describe` blocks).
- **Skip scan**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api` matches only `process.exit(` in `api/src/server.ts:36,42,45` (false positive of `xit\(`). No skipped, focused or todo tests.

---

## Discrimination Sensor

Depth: P0 (CORS is a security control). 30 code mutations, one at a time, in the scratch worktree, each followed by the covering test file(s).

| # | File | Mutation | Result | Killing test |
| - | ---- | -------- | ------ | ------------ |
| M1 | `api/src/plugins/cors.ts:21` | `callback(null, true)` (allow every origin) | ✅ Killed | `cors.int.test.ts` CORS-04 (5 origins) |
| M2 | `cors.ts:21` | case-insensitive origin match | ⚪ Survived, equivalent for browsers | - |
| M3 | `cors.ts:21` | `origin.startsWith(allowed)` | ✅ Killed | CORS-04 "suffix" |
| M4 | `cors.ts:21` | host `endsWith`, scheme ignored | ✅ Killed | CORS-04 "subdomain", "different scheme" |
| M6 | `cors.ts:10` | drop `PATCH` | ✅ Killed | `cors.int.test.ts:39` |
| M7 | `cors.ts:10` | drop `DELETE` | ✅ Killed | `cors.int.test.ts:39` |
| M8 | `cors.ts:11` | drop `x-timezone` | ✅ Killed | `cors.int.test.ts:41` |
| M9 | `cors.ts:12` | max-age 86400 | ✅ Killed | `cors.int.test.ts:42` |
| M10 | `cors.ts` | `credentials: true` | ✅ Killed | `cors.int.test.ts:62`, `:72` |
| M11 | `cors.ts:10` | advertise `PUT` | ✅ Killed | `cors.int.test.ts:39`, `:61` |
| M29 | `api/src/app.ts:36` | register CORS after auth/timezone | ✅ Killed | `cors.int.test.ts:37`, `:51`, `:79` |
| M30 | `cors.ts:21` | `origin === undefined \|\| allowed.has(origin)` | ⚪ Survived, equivalent (`@fastify/cors` emits no ACAO when the request has no `Origin`) | - |
| M12 | `api/src/config.ts:31` | accept `*` | ✅ Killed | `config.test.ts:66` (3 cases) |
| M13 | `config.ts:29` | keep trailing slash | ✅ Killed | `config.test.ts:47`, `:60` |
| M18 | `config.ts:30` | keep empty entries | ✅ Killed | `config.test.ts:8`, `:47`, `:54` |
| M14 | `config.ts:49` | drop range check | ✅ Killed | `config.test.ts:37` (0, 65536, 70000) |
| M15 | `config.ts:49` | drop integer regex | ✅ Killed | `config.test.ts:37` (abc, 3001.5) |
| M16 | `config.ts:59` | default HOST `0.0.0.0` | ✅ Killed | `config.test.ts:27` |
| M17 | `config.ts:47` | default PORT 3000 | ✅ Killed | `config.test.ts:26` |
| M19 | `api/src/server.ts:50` | remove SIGINT handler | ✅ Killed | `server.int.test.ts:90` (SIGINT) |
| M20 | `server.ts:42` | exit 1 after shutdown | ✅ Killed | `server.int.test.ts:90` (both) |
| M24 | `server.ts:41` | `server.close()` -> `Promise.resolve()` (exit without closing app/pool) | ❌ **Survived** | - |
| M25 | `server.ts:36` | config error exits 0 | ✅ Killed | `server.int.test.ts:98`, `:107` |
| M26 | `server.ts:35` | generic error message | ✅ Killed | `server.int.test.ts:100`, `:108` |
| M21 | `server.ts:19` | `redact: []` | ⚪ Survived, equivalent today (Fastify's default `req` serializer never emits headers) | - |
| M22 | `server.ts:19` | serializer that logs `req.headers` | ✅ Killed | `server.int.test.ts:130` |
| M27 | `server.ts:19` | ignore `LOG_LEVEL` (`silent`) | ✅ Killed | `server.int.test.ts:128` |
| M28 | `app.ts:29` | `buildApp` ignores `options.logger` | ✅ Killed | `server.int.test.ts:128` |
| M23 | `server.ts:25` | no `app.close()` when `listen` fails | ❌ Survived (minor) | - |
| M5 | - | (helper step of M29, not run alone) | - | - |

**Result**: 30 run: 24 killed, 3 equivalent (M2, M21, M30), 2 real survivors (M24 blocking, M23 minor). Every CORS mutation is killed or equivalent.

Equivalence reasoning: M2 - browsers serialize `Origin` with lowercase scheme and host, so a case-insensitive comparison cannot admit another site; it only changes the outcome for an uppercase entry in `CORS_ORIGINS`. M21 - redaction is defence in depth; the observable log is identical until someone adds headers to the serializer, which M22 shows the test would catch.

---

## Manual checks (scratch worktree, local stack `financials` at 55321/55322)

| Check | Command | Observed |
| ----- | ------- | -------- |
| Build | `pnpm build` | exit 0, `dist/server.js` emitted |
| Compiled start | `PORT=47311 node --env-file=.env.example dist/server.js` | `/health` 200; allowed preflight 204 with ACAO, methods, headers, max-age 600; SIGTERM -> exit 0, connection refused |
| Disallowed preflight | `OPTIONS /accounts`, `Origin: https://evil.example` | 401 standard body, no `Access-Control-*`, `vary: Origin` present |
| Allowed 401 | `GET /accounts`, bad bearer | 401 with ACAO `http://localhost:8080` |
| `Vary` | every response | `vary: Origin` on all responses, allowed or not. Not an `Access-Control-*` header, so CORS-04.5 holds; it is the correct cache key behaviour |
| `pnpm dev` (tsx watch) | env from `.env.example`, `PORT=47317` | `/health` 200; stops on TERM |
| `pnpm start` | `PORT=47318` | `/health` 200; stops on TERM |
| Entry check | run through a symlinked dir and `./dist/server.js` | both serve `/health` (`isEntrypoint` holds) |
| Double SIGINT | two signals 0 / 10 / 100 ms apart | exit 0 every time (shutdown completes before the second signal; with `process.once` a later second signal falls back to the default and kills the process, which is acceptable "force quit") |
| Port in use | second process on a taken port | `listen EADDRINUSE ...`, exit 1, no stack |
| Invalid `LOG_LEVEL` | `LOG_LEVEL=bogus` | exit 1, message `default level:bogus must be included in custom levels` (does not name the variable) |
| `LOG_LEVEL=trace` | requests with `Authorization: Bearer ...` (opaque and JWT-shaped) | no token, no `authorization` in 8 log lines |
| Query string | `GET /accounts?access_token=QSECRET123` | URL logged verbatim, secret included (see security notes) |
| `PORT` inputs | `loadServerConfig` | `" 3001"`, `"3001 "`, `"3001abc"`, `"0x10"`, `"1e3"` rejected citing PORT; `"03001"` -> 3001; `""` -> 3001 (default) |
| `CORS_ORIGINS` inputs | `parseCorsOrigins` | `"http://a.com//"` -> `http://a.com`; `"HTTP://A.COM"`, `"localhost:8080"`, `"http://a.com/path"`, `"http://*.a.com"`, `"null"` accepted as-is |
| README / `.env.example` | read and run | Commands exist (`db:start`, `dev`, `build`, `start`); `.env` and `dist` are git-ignored (`api/.gitignore:2-3`); every variable documented; `CORS_ORIGINS` lists 8080 and 5173 on `localhost` and `127.0.0.1`; values reach the local stack |

---

## Isolation proof

- Baseline `git status --porcelain`: empty. After all work (before writing this report): empty. Only this file is new.
- `git worktree list` after `git worktree remove --force` + `git worktree prune`: only the main tree. `/Volumes/MacOnlySSD/dev/personal/.verify-srv` no longer exists.
- No listener on the throwaway ports 47311-47319; no leftover `dist/server.js` or `src/server.ts` process. Port 3001 was never used.
- `api/dist/` existed at baseline (`!! api/dist/`, files dated 02:37 local, before this run; the author's build). Not created or touched by the Verifier; not deleted. The Verifier's build ran inside the scratch worktree only.
- `api/node_modules` in the real tree is a real directory, intact (symlink in the scratch removed with the worktree).
- No `git stash`, no commit.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ `cors.ts` 26 lines, `server.ts` 55 lines |
| Surgical changes | ✅ `app.ts` only adds the CORS registration and the logger option |
| No scope creep | ✅ `BuildAppOptions` is the minimal seam to inject the pino logger while keeping tests quiet by default. `startServer(env, overrides)` adds an `overrides` parameter the design did not list; used only by tests (port 0, silent). Acceptable |
| Matches patterns | ✅ `fastify-plugin` wrapper like the other plugins; config errors as plain `Error` messages like `required()` |
| Spec-anchored outcome check | ⚠️ All but the SRV-03 pool conjunct |
| Per-layer coverage expectation | ✅ unit for parsers (all branches), integration for the HTTP surface and process |
| Every test maps to a requirement | ✅ |
| Documented guidelines followed | none in the repo - strong defaults applied |

---

## Ranked Gaps

1. **[Blocking] SRV-03: pool close has no evidence.** Mutant M24 (shutdown handler exits 0 without calling `server.close()`) survives `api/test/server.int.test.ts:85-91`. Fix task: add a test that fails when shutdown skips `app.close()`. Options: (a) start a slow in-flight request (or hold a `withUser` transaction) before SIGTERM and assert it completes before the exit; (b) assert in-process that after `startServer(...).close()` the pool is ended (e.g. `app.withUser(...)` rejects, or a postgres.js `onclose`/`application_name` probe on `pg_stat_activity` shows the connection gone); (c) log `server closed` from an `onClose` hook and assert it in the child's stdout before exit. Done when M24 is killed.
2. **[Minor] `startServer` closing the app on `listen` failure is untested** (M23 survived). Only matters for in-process callers; `main` exits anyway. Cover with a taken port and assert the pool is released, or drop the branch.
3. **[Minor] `api/test/server.int.test.ts:107`** lacks `expect(code).not.toBeNull()` (a signal death passes). **`api/test/cors.int.test.ts:45`** title says "routes that do not exist" but uses `/accounts`.

## Spec-precision gaps

1. **Origin comparison case and shape.** AC CORS-8 says "exata" but not whether config entries are lowercased or validated. Today `HTTP://LOCALHOST:8080`, `localhost:8080` (no scheme) or `http://host/path` are accepted silently and never match (fail closed, but a silent misconfiguration). `null` is accepted and would admit sandboxed iframes and `file://` pages if someone lists it. Recommend: validate each entry as `scheme://host[:port]` with `new URL(...).origin === entry`, lowercase, reject `null`.
2. **`PORT` with leading zeros / spaces.** `"03001"` is accepted as 3001; `" 3001"` is rejected. Spec says only "inteiro entre 1 e 65535". Behaviour is reasonable; state it.
3. **Invalid `LOG_LEVEL`.** Spec does not say. Today the process exits 1 with pino's message, which does not name `LOG_LEVEL`. Recommend validating it in `loadServerConfig` with a message citing the variable, like `PORT`.
4. **Disallowed-origin preflight status.** Spec only says "no `Access-Control-*`". Today it falls through to auth and answers 401 (no token) instead of 204/403. Browser outcome is the same (blocked). State it.
5. **Double signal.** Spec does not say what a second SIGINT during shutdown does. Today `process.once` means a late second signal kills the process with the default handler (exit by signal). Acceptable; state it.
6. **"fechar o pool"** is not externally observable by itself; the spec could name the observable (in-flight requests drain, or a log line) so a test can assert it.

## Security notes

- CORS is sound: exact `Set` lookup, no wildcard, no credentials, preflight answered in `onRequest` before auth, disallowed origins get no `Access-Control-*`. `Vary: Origin` is sent on every response, which is correct for shared caches.
- `redact: ['req.headers.authorization']` is a dead path with the default serializers (Fastify logs `method, url, host, remoteAddress, remotePort` only, at every level up to `trace`). It is harmless defence in depth. The real protection is the default serializer; the log test (M22 killed) guards it.
- **Query strings are logged verbatim** (`req.url`). The API never reads tokens from the query, but a client that puts `?access_token=...` (or any secret) in a URL would leak it to logs. Consider a `req` serializer that strips the query string or redacts known keys.
- Error logs: 4xx `AppError`s are not logged with details; nothing token-bearing appears.
- Production notes (out of scope, recorded only): `HOST=127.0.0.1` default will make a container unreachable until the deploy sets `0.0.0.0` (README and `.env.example` say so); no `trustProxy` (client IP in logs will be the proxy's behind a load balancer); Fastify defaults apply for body size (1 MiB) and there is no `requestTimeout`/`connectionTimeout` tuning; no rate limiting (spec out of scope). The `.env.example` `DATABASE_URL` uses the `postgres` superuser, which bypasses RLS; the comment says to use a dedicated role in production.

---

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| SRV-01 | Implementing | ✅ Verified |
| SRV-02 | Implementing | ✅ Verified |
| SRV-03 | Implementing | ❌ Needs fix (pool close evidence) |
| SRV-04 | Implementing | ✅ Verified |
| CORS-01 | Implementing | ✅ Verified |
| CORS-02 | Implementing | ✅ Verified |
| CORS-03 | Implementing | ✅ Verified |
| CORS-04 | Implementing | ✅ Verified |

## Summary

**Overall**: ❌ Not ready (one blocking evidence gap, small fix)

**Spec-anchored check**: 15 ACs, 14 fully evidenced, 1 with an unevidenced conjunct (SRV-03 pool close); 6 spec-precision gaps.
**Sensor**: 30 mutations, 24 killed, 3 equivalent, 2 survived (M24 blocking, M23 minor).
**Gate**: 306 passed, 0 failed, 0 skipped.

**Next steps**: route Gap 1 (and optionally 2-3) to a fix task, then re-verify (iteration 2 of 3).

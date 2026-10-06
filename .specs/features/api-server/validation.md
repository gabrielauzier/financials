# Validation: api-server (T1-T4 + F1-F3), iteration 2 - PASS

**Verdict**: PASS

The iteration 1 blocker is closed. Mutant M24 (shutdown exits 0 without `server.close()`) is now killed by `api/test/server.int.test.ts:94-113`, as are three variants (M24b log order, M24c missing pool log, M24e listener-only close). Every AC with an (a) or (b) classification has real evidence, the build gate is green (310 passed, 0 failed, 0 skipped) and every CORS mutation is killed.

Two minor, non-critical survivors remain and do not block. M24d: deleting `await sql.end()` in `api/src/plugins/db.ts:40` (code from before this feature) while keeping the log line survives the whole integration suite. The test observes that the `onClose` hook ran, not that the pool ended. The Verifier proved by a non-test probe that the real pool does end (`pg_stat_activity` backend 1 -> 0, `withUser` -> `CONNECTION_ENDED`) and that the same probe catches M24d. M23 (no `app.close()` when `listen` fails) still survives. The author's "nothing observable remains" claim does not hold: F1's `database pool closed` line is printed on `EADDRINUSE` at HEAD and missing under M23.

**Iteration**: 2 of 3
**Date**: 2026-10-05
**Spec**: `.specs/features/api-server/spec.md`
**Diff range**: `212a009^..HEAD` (fixes since iteration 1: `7be401d..HEAD` = `e868684`). `HEAD` = `e86868478abe477a0216e9e3b72e4f48b1df1114`, branch `feat/api-server`
**Verifier**: independent sub-agent (author != verifier). Read-only on the real tree. Mutations, probes and the build ran only in a temporary worktree (`/Volumes/MacOnlySSD/dev/personal/.verify-srv2`, now removed).

## Scope

In scope: T1-T4 and fix tasks F1-F3. Files: `api/src/config.ts`, `api/src/plugins/cors.ts`, `api/src/app.ts`, `api/src/server.ts`, `api/src/plugins/db.ts` (one log line added by F1), `api/package.json`, `api/tsconfig.build.json`, `api/.env.example`, `README.md`, `api/src/config.test.ts`, `api/test/cors.int.test.ts`, `api/test/server.int.test.ts`.

Classification key: (a) covered by tests in this diff; (b) verified by a non-test artifact (Verifier command, output cited); (c) deferred; GAP = no evidence.

---

## Task Completion

`tasks.md` has exactly one `## Task Breakdown`, 4 task headings, no unchecked boxes. The "Fix tasks (Verifier iteration 1)" section ticks F1-F3 and records M23 as "accepted, not fixed".

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 config | ✅ Done | `99b66e5` | - |
| T2 CORS plugin | ✅ Done | `b49a851` | - |
| T3 server entry | ✅ Done | `72cb705` | - |
| T4 scripts and docs | ✅ Done | `0f4ae23` | - |
| F1 observable shutdown | ✅ Done | `e868684` | Kills M24, M24b, M24c, M24e. M24d survives (see Sensor) |
| F2 query string out of logs | ✅ Done | `e868684` | Kills Q, Q2, Q3 |
| F3 test hygiene | ✅ Done | `e868684` | `api/test/server.int.test.ts:128` `not.toBeNull()`; `api/test/cors.int.test.ts:55-63` uses a route that does not exist |
| M23 | Accepted, not fixed | - | The stated reason is unsound (see Gap 2) |

`.specs/STATE.md` has no entry for this feature. That is consistent: the feature made no decision that needed logging.

---

## Spec-Anchored Acceptance Criteria

### P1: Subir a API

| # | Criterion | Spec-defined outcome | Class | Evidence (`file:line` - assertion) | Status |
| - | --------- | -------------------- | ----- | ---------------------------------- | ------ |
| 1 (SRV-01) | Valid config: listen and serve `GET /health` over real HTTP | 200 `{ "status": "ok" }` | a + b | `api/test/server.int.test.ts:71` `expect(response.status).toBe(200)`; `:72` `toEqual({ status: 'ok' })` (real `fetch`); child through env `PORT`: `:88` `waitHealthy` (`response.ok`). (b) scratch `pnpm build` exit 0, `PORT=47413 node dist/server.js` -> `{"status":"ok"} 200` | ✅ |
| 2 (SRV-02) | Read `PORT` (3001), `HOST` (127.0.0.1), `CORS_ORIGINS`, `LOG_LEVEL`, `SUPABASE_URL`, `DATABASE_URL`, `SUPABASE_JWT_SECRET` | Defaults 3001 / 127.0.0.1 / info; values read | a | `api/src/config.test.ts:26-28` `toBe(3001)`, `toBe('127.0.0.1')`, `toBe('info')`; `:33` `toEqual([8081, '0.0.0.0', 'warn'])`; `:60` CORS_ORIGINS; `:8`, `:15` URLs and secret. Env end to end: `api/test/server.int.test.ts:88` (child honours `PORT`), `:150` (`LOG_LEVEL=info` produces request logs). H1 and P1 killed | ✅ |
| 3 (SRV-02) | Invalid `PORT` refused, message cites `PORT` | Error mentions `PORT` | a | `api/src/config.test.ts:37` `toThrow(/PORT/)` for 0, 65536, 70000, abc, 3001.5, -1; `api/test/server.int.test.ts:80` `rejects.toThrow(/PORT/)`; process `:128-130` code not null, not 0, stderr contains `PORT`. P1 killed (5 tests) | ✅ |
| 4 (SRV-02) | Missing `SUPABASE_URL` / `DATABASE_URL`: exit non-zero, message cites variable | Code != 0, names variable | a | `api/test/server.int.test.ts:119-121` `not.toBe(0)`, `not.toBeNull()`, stderr `toContain(name)`; `api/src/config.test.ts:19`, `:41` `toThrow(name)` | ✅ |
| 5 (SRV-03) | SIGTERM/SIGINT: stop accepting connections, close the DB pool, exit 0 | Listener closed, pool closed, code 0 | a + b | Exit and listener: `api/test/server.int.test.ts:90` `toEqual({ code: 0, signal: null })`; `:91` `fetch(...).rejects.toThrow()`. Close ran before exit: `:101` exit pair; `:110` `expect(closed).toBeGreaterThan(-1)` (`database pool closed`, emitted at `api/src/plugins/db.ts:41` after `await sql.end()`); `:111` `expect(complete).toBeGreaterThan(closed)`. Kills M24, M24b, M24c, M24e, S1, S2. (b) Pool really ends: in-process probe in the scratch tree (`startServer`, one `withUser` query, `close()`) -> `{"backendBeforeClose":1,"backendAfterClose":0,"withUserAfterClose":"CONNECTION_ENDED"}`; with M24d -> `{"backendAfterClose":1,"withUserAfterClose":"ok"}` | ✅ (M24d minor, Gap 1) |
| 6 (SRV-04) | Each request logged as JSON without the `Authorization` header or the token | JSON per request; token absent | a + b | `api/test/server.int.test.ts:149` every line `JSON.parse`; `:150` `req.url === '/accounts'`; `:151` `res.statusCode === 401`; `:152-153` stdout and stderr `not.toContain(token)`. Kills R3 (headers in serializer with `redact: []`). (b) `LOG_LEVEL=trace`, 6 hostile requests with `Authorization: Bearer TOKENHDR88` -> 18 lines, token 0 hits, `authorization` 0 hits | ✅ |

### P1: CORS para o front

| # | Criterion | Spec-defined outcome | Class | Evidence | Status |
| - | --------- | -------------------- | ----- | -------- | ------ |
| 1 (CORS-01) | Preflight from allowed origin, `PATCH` + 3 headers, no token | 204 | a | `api/test/cors.int.test.ts:37` `toBe(204)` (no `authorization` sent); `:51`; `:61` on a route that does not exist. C2 killed (4 tests) | ✅ |
| 2 (CORS-02) | Preflight headers | ACAO = origin; methods `GET, POST, PATCH, DELETE, OPTIONS`; the 3 headers; max-age 600 | a | `api/test/cors.int.test.ts:38` `toBe(ALLOWED)`; `:39` exact methods string; `:41` sorted headers `toEqual([...])`; `:42` `toBe('600')`. C3 killed | ✅ |
| 3 (CORS-03) | Real request from allowed origin | ACAO = origin and `Vary: Origin` | a | `api/test/cors.int.test.ts:80` `toBe(ALLOWED)`; `:81` `vary` contains `origin` | ✅ |
| 4 (CORS-03) | Protected route, no token, allowed origin | 401, standard error body, ACAO | a | `api/test/cors.int.test.ts:87` `toBe(401)`; `:88` `error.code` `toBe('unauthorized')`; `:89` ACAO `toBe(ALLOWED)`. C2 killed | ✅ |
| 5 (CORS-04) | Origin not listed | No `Access-Control-*` header | a | `api/test/cors.int.test.ts:106` (preflight), `:108` (real) `toEqual([])` for unlisted, subdomain, other port, other scheme, suffix. C1 killed (6 tests) | ✅ |
| 6 (CORS-04) | `CORS_ORIGINS` empty | No origin allowed | a | `api/test/cors.int.test.ts:123`, `:125` `toEqual([])`; `api/src/config.test.ts:54-56` | ✅ |
| 7 (CORS-04) | `CORS_ORIGINS` contains `*` | Refused, message cites `CORS_ORIGINS` | a | `api/src/config.test.ts:66` `toThrow(/CORS_ORIGINS/)` for `*`, `http://localhost:8080,*`, ` * ` | ✅ |
| 8 (CORS-04) | Exact comparison, trailing slash ignored in config, no implicit subdomains | Exact match | a | `api/src/config.test.ts:47` trailing slash stripped; `api/test/cors.int.test.ts:94-108` subdomain, port, scheme, suffix rejected | ✅ |
| 9 (CORS-04) | Never sends `Access-Control-Allow-Credentials` | Header absent | a | `api/test/cors.int.test.ts:72` (preflight), `:82` (real) `toBeUndefined()`. C4 killed | ✅ |

### Success criteria

| Criterion | Class | Evidence | Status |
| --------- | ----- | -------- | ------ |
| `pnpm -C api build && node api/dist/server.js` serves `/health` | b | Scratch tree at HEAD: `pnpm build` exit 0; `PORT=47413 node dist/server.js` -> `/health` 200; SIGINT -> exit 0, logs `shutting down`, `database pool closed`, `shutdown complete`; `curl` afterwards exit 7 (refused) | ✅ |
| Front at `http://localhost:8080` lists accounts with no CORS error | c | Needs the front wired to the API (`.specs/INTEGRACAO-FRONT-BACK.md`); manual UAT | deferred |

**Count**: 15 ACs. a = 15 (SRV-01, SRV-03 and SRV-04 also backed by b), b-only = 0, c = 0, GAP = 0. Success criteria: 1 b, 1 c (deferred).

---

## Edge Cases

- [x] `CORS_ORIGINS` with spaces and trailing slashes is normalized: `api/src/config.test.ts:47`, `toEqual(['http://localhost:8080', 'http://127.0.0.1:5173'])` for the exact spec input plus `,,`.
- [x] No `Origin`: normal response, no CORS headers: `api/test/cors.int.test.ts:113-114`, `200` and `corsHeaders(...)` `toEqual([])`.
- [x] Preflight asking `PUT` does not advertise it: `api/test/cors.int.test.ts:71`, `not.toContain('PUT')`.

---

## Check B (shallow assertions) and Check C (reverse mapping)

Check B, new and changed tests:

- `api/test/server.int.test.ts:94-113` (pool close): asserts the exit pair and the order `closed < complete`. It is not shallow for the server entry: replacing, reordering or short-circuiting `server.close()` fails it. Its limit is that the signal is a log line written by the code under test. The pool never opens a connection in this test (only `/health` is called, which does not touch the DB), so `sql.end()` has nothing to close and deleting it changes nothing visible (M24d). The probe under SRV-03 shows a cheap observable that would catch it.
- `api/test/server.int.test.ts:156-171` (query string): asserts the record `req.url === '/accounts'` (positive) and that the secret is absent from stdout (negative). The positive assertion stops a vacuous pass where nothing is logged. Kills Q, Q2 (strips only after `&`) and Q3 (serializer removed).
- `api/test/server.int.test.ts:128`: `not.toBeNull()` now present (iteration 1 hygiene gap closed).
- `api/test/cors.int.test.ts:55-63`: a real missing route (`/this-route-does-not-exist`), 204 plus ACAO. The old title is fixed at `:45`.

Check C, reverse mapping:

- Pool-close tests -> SRV-03 (AC 5). Mapped.
- Missing-route preflight -> CORS-01 (AC 1, "sem exigir token" on any path). Mapped.
- Query-string test -> **only partly mapped.** AC 6 says the log must not include "o cabeçalho `Authorization` nem o token". The API never reads a token from the query, so a query token is not "the token" the AC protects. The search-text half (`q`) maps to no AC. The test maps to fix task F2, not to the spec. This is a sound defence-in-depth extra and does not fail the feature. **Recommendation:** add to `spec.md` either an assumption ("request logs record the path only; the query string is never logged") or an AC 7 under "Subir a API", so the test has a spec anchor.
- All other tests map as in iteration 1.

---

## Gate Check

- **Gate command**: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` (from the real tree, once)
- **Result**: exit 0. **310 passed** (unit 93 in 6 files, integration 217 in 17 files), 0 failed, 0 skipped
- **Count before fixes (iteration 1)**: 306. **Delta**: +4 (2 pool-close cases, 1 missing-route preflight, 1 query-string). No test removed. One test was renamed (`cors.int.test.ts:45`); its assertions did not change. No assertion was weakened.
- **Skip scan**: `git grep -nE "\.(skip|only|todo)\(|xit\(|xdescribe\(" -- api` matches `api/src/server.ts:51,59,63` (`process.exit(`) and the comment `api/test/server.int.test.ts:107`. Both are `xit\(` false positives. No skipped, focused or todo tests.

---

## Discrimination Sensor

Depth: P0 (CORS and log redaction are security controls). 20 code mutations, one at a time, in the scratch worktree. Each was followed by its covering test files and then `git checkout -- .`. The scratch tree was clean after every mutation.

| # | File | Mutation | Result | Killing test |
| - | ---- | -------- | ------ | ------------ |
| M24 | `api/src/server.ts:56` | `server.close()` -> `Promise.resolve()` (exit without closing) | ✅ Killed (was a survivor) | `server.int.test.ts:94-113` (SIGTERM, SIGINT) |
| M24b | `server.ts:55-58` | log `shutdown complete` before `server.close()` | ✅ Killed | `server.int.test.ts:111` |
| M24c | `api/src/plugins/db.ts:41` | drop the `database pool closed` log | ✅ Killed | `server.int.test.ts:110` |
| M24e | `server.ts:56` | close only the HTTP listener (`app.server.close`), not the app | ✅ Killed | `server.int.test.ts:110` |
| M24d | `db.ts:40` | delete `await sql.end()`, keep the log | ❌ Survived (full integration suite, 217 pass) | - (minor, Gap 1) |
| M23 | `server.ts:40` | no `app.close()` when `listen` fails | ❌ Survived (minor, Gap 2) | - |
| Q | `server.ts:28` | log `request.url` with the query | ✅ Killed | `server.int.test.ts:156` |
| Q2 | `server.ts:28` | strip only after `&` | ✅ Killed | `server.int.test.ts:156` |
| Q3 | `server.ts:23` | disable the custom serializer (Fastify default) | ✅ Killed | `server.int.test.ts:156` |
| R1 | `server.ts:22` | `redact: []` | ⚪ Equivalent (the serializer emits no headers) | - |
| R2 | `server.ts:30` | serializer adds `headers`, redact kept | ⚪ Equivalent (redact censors `req.headers.authorization`; this is the defence working) | - |
| R3 | `server.ts:22,30` | serializer adds `headers` and `redact: []` | ✅ Killed | `server.int.test.ts:152` |
| C1 | `api/src/plugins/cors.ts:21` | allow every origin | ✅ Killed | `cors.int.test.ts:100-126` (6 tests) |
| C2 | `api/src/app.ts:36` | register CORS after `timezonePlugin` (after auth) | ✅ Killed | `cors.int.test.ts:37`, `:51`, `:61`, `:89` |
| C3 | `cors.ts:10` | drop `PATCH` | ✅ Killed | `cors.int.test.ts:39` |
| C4 | `cors.ts:24` | `credentials: true` | ✅ Killed | `cors.int.test.ts:72`, `:82` |
| S1 | `server.ts:59` | exit 1 after shutdown | ✅ Killed | `server.int.test.ts:90`, `:101` (4 tests) |
| S2 | `server.ts:68` | remove the SIGINT handler | ✅ Killed | `server.int.test.ts:90`, `:101` (SIGINT) |
| P1 | `api/src/config.ts:49` | drop the PORT range check | ✅ Killed | `config.test.ts:37` (3 cases); `server.int.test.ts:80`, `:128` |
| H1 | `config.ts:59` | default HOST `0.0.0.0` | ✅ Killed | `config.test.ts:27` |

**Result**: 20 run: 16 killed, 2 equivalent (R1, R2), 2 survivors (M24d, M23), both minor and neither on a critical behavior. All iteration 1 survivors have been re-run: M24 is now killed and M23 still survives. Every CORS and log-leak mutation is killed or equivalent.

**Why M24d is not blocking**: the line it deletes predates this feature (auth, `db.ts:40`). The SRV-03 outcome holds at HEAD (b-probe: backend 1 -> 0, `CONNECTION_ENDED`). Even under the mutant, `process.exit(0)` follows, so the OS drops the sockets and Postgres frees the backends. The difference is a graceful Terminate versus a dropped socket. No data or security property depends on it, because `app.close()` has already drained in-flight requests before the hook runs.

---

## Manual checks (scratch worktree, local stack `financials` at 55321/55322)

| Check | Command | Observed |
| ----- | ------- | -------- |
| Pool really closes | `node --import tsx vprobe/pool.ts` (`startServer`, `withUser` -> `pg_backend_pid()`, `close()`, `pg_stat_activity` by pid) | HEAD: backend 1 -> 0, `withUser` after close -> `CONNECTION_ENDED`. M24d: backend stays 1, `withUser` succeeds, process hangs (killed by alarm, exit 142) |
| M23 observable | hold port 47411, `PORT=47411 LOG_LEVEL=info node --import tsx src/server.ts` | HEAD: `{"msg":"database pool closed"}`, then `listen EADDRINUSE ...`, exit 1. M23: only `listen EADDRINUSE ...`, exit 1 |
| Trace-level leak probe | `LOG_LEVEL=trace`, 6 requests: unknown route + `?access_token=`, bad JSON POST + bearer + `?q=`, preflight + `?token=`, `?q=&page=abc` + bearer, malformed `%ZZ` query, `/accounts;token=` | 18 log lines. Bearer token: 0 hits. Query secret: 0 hits except the `;token=` path (see Security notes). Messages are only `incoming request`, `request completed`, lifecycle lines |
| Compiled server | `pnpm build`; `PORT=47413 node dist/server.js` | `/health` 200; `?access_token=DISTSECRET` absent from logs; SIGINT -> exit 0, refused afterwards |

---

## Isolation proof

- Baseline `git status --porcelain` (before any work): empty. After gate, sensor and cleanup (before writing this report): empty. The only change is this file.
- `git worktree list` after `git worktree remove --force` and `git worktree prune`: only `/Volumes/MacOnlySSD/dev/personal/financials e868684 [feat/api-server]`. `/Volumes/MacOnlySSD/dev/personal/.verify-srv2` no longer exists.
- No listener on the throwaway ports 47411-47413 and no `src/server.ts` / `dist/server.js` process left (`lsof`, `pgrep` empty). Port 3001 was never used. The `web` stack (54321-54327) was not touched.
- `api/dist/` in the real tree: aggregate `shasum` of every file `1013a6d7...` before and after. Not touched (files dated 02:37, the author's build, older than `e868684`). The Verifier's build ran only in the scratch tree.
- `api/node_modules` in the real tree is still a real directory. The scratch symlink was removed with the worktree.
- No `git stash`, no commit.

---

## Code Quality (`git diff 7be401d..HEAD`)

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ +22 lines in `server.ts`, +1 in `db.ts` |
| Surgical changes | ✅ Only the shutdown callback, the logger options and one log line changed |
| No scope creep | ⚠️ Query stripping goes beyond AC 6 (search text is not "the token"). It is a justified hardening but is not in the spec (see Check C) |
| Matches patterns | ✅ The serializer keeps Fastify's default `req` fields (method, url, host, remoteAddress, remotePort) and changes only `url` |
| `db.ts` log line | ✅ Acceptable: one info line in the plugin's own `onClose`, after `sql.end()`. Tests now depend on the message text `database pool closed`, which is a small, documented coupling (`server.int.test.ts:107`) |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage expectation | ✅ |
| Every test maps to a requirement | ⚠️ The query-string test maps to F2, and only partly to AC 6 |
| Documented guidelines followed | none in the repo - strong defaults applied |

---

## Remaining Gaps (ranked, none blocking)

1. **[Minor] M24d: `sql.end()` is never discriminated.** No test in the repo fails if `db.ts:40` is deleted, because the shutdown test never opens a pool connection. Suggested test (in process, about 10 lines): `startServer` on port 0, run one `app.withUser(claims, tx => tx\`select 1\`)`, `await close()`, then expect a second `withUser` to reject with `code: 'CONNECTION_ENDED'`. The probe above shows this kills M24d.
2. **[Minor] M23: closing the app on a failed `listen` is untested.** The stated reason ("the pool connects lazily and nothing observable remains") is unsound. On `EADDRINUSE` the child prints `database pool closed` at HEAD and not under M23. Cheap test: hold a port with `net.createServer`, start the child on it with `LOG_LEVEL=info`, assert exit code 1 and the log line. In practice this only affects in-process callers, because `main` exits anyway.
3. **[Spec] Query-string logging is not in the spec.** Record it as an assumption or as AC 7 of "Subir a API" so `server.int.test.ts:156` has a spec anchor.

## Spec-precision gaps

1. Origin entry shape and case (`HTTP://...`, missing scheme, `/path`, `null` accepted silently). Carried over from iteration 1.
2. `PORT` with leading zeros or spaces (`"03001"` accepted, `" 3001"` rejected). Carried over.
3. Invalid `LOG_LEVEL` exits with pino's message, which does not name the variable. Carried over.
4. Status of a preflight from a disallowed origin (falls through to auth, 401). Carried over.
5. Second signal during shutdown. Carried over.
6. "fechar o pool" has no named observable. F1 picked a log line. The spec should name the observable (for example "the pool's connections are ended before exit"), which would lead to the Gap 1 test.
7. What to log for a request (path only versus full URL) is unstated (Gap 3).
8. Cleanup when `listen` fails is unstated.

## Security notes

- **Authorization header**: never logged. The custom serializer emits no headers, and `redact: ['req.headers.authorization']` is now a live second layer: R2 (headers added to the serializer) is still censored. Only removing both layers leaks (R3, killed).
- **Query string**: stripped (`split('?')[0]`). Verified at `trace` on 404, 400 (bad JSON), preflight and malformed-escape requests, and on the compiled build. **Residual**: matrix-style path parameters (`/accounts;token=x`) are logged because `;` is part of the path (`useSemicolonDelimiter` is false in Fastify 5.12.5). The front never sends such URLs, so this is informational only.
- **`reqId`**: server-generated (`req-N`). Fastify 5 defaults `requestIdHeader` to `false`, so a client cannot inject a value into the logs through it.
- **500 path**: `api/src/plugins/errors.ts:50` logs `request.log.error(error)`. The child logger carries only `reqId`; the `req` object is logged only on `incoming request`. postgres.js 3.4.9 defines `query`, `parameters`, `args` and `types` on errors as non-enumerable unless `debug` is on (`node_modules/postgres/src/connection.js:403-409`). pino's error serializer copies only enumerable keys, so SQL parameters (including the JWT claims JSON set by `withUser`) are not logged. A `PostgresError` can still carry enumerable `detail` text with row values, such as a unique-violation key. That is user data, not a credential. 4xx errors are not logged.
- CORS is unchanged since iteration 1 and fully discriminated (C1-C4 killed).
- Housekeeping: the real tree's `api/dist/` is a stale build from before `e868684` (no query stripping). Rebuild before running `node api/dist/server.js` for UAT. It is git-ignored, so the repo is unaffected.

---

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| SRV-01 | ✅ Verified | ✅ Verified |
| SRV-02 | ✅ Verified | ✅ Verified |
| SRV-03 | ❌ Needs fix | ✅ Verified (M24d minor) |
| SRV-04 | ✅ Verified | ✅ Verified |
| CORS-01 | ✅ Verified | ✅ Verified |
| CORS-02 | ✅ Verified | ✅ Verified |
| CORS-03 | ✅ Verified | ✅ Verified |
| CORS-04 | ✅ Verified | ✅ Verified |

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 15 ACs: a = 15 (3 also b), c = 0 (plus 1 deferred success criterion), GAP = 0; 8 spec-precision gaps.
**Sensor**: 20 mutations: 16 killed, 2 equivalent, 2 minor survivors (M24d, M23).
**Gate**: 310 passed, 0 failed, 0 skipped.
**Next steps**: optionally close Gaps 1 and 2 with the two small tests above, and record the query-string rule in the spec. Neither blocks merge.

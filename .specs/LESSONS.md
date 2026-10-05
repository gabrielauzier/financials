# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

### L-004 - State in the spec how duplicates are matched (case, accents, spaces) for every uniqueness rule
- signal: `spec_precision_gap` · recurrence: 2 feature(s) · scope: `uniqueness` · harmful: 0
- features: accounts-categories, import
- evidence: spec-precision gaps 1-3 (validation.md): duplicate matching for holder names, category names, nicknames (uniqueness) (+1 more)
- last seen: 2026-10-05T10:26:44Z

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test an auth hook with a protected route that has no guard of its own, so removing the hook makes the test fail
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `auth-hook` · harmful: 0
- features: auth
- evidence: mutants M11/M11c (validation iteration 1), api/test/auth.int.test.ts (auth-hook)
- last seen: 2026-10-05T04:00:56Z

### L-002 - When an acceptance criterion is delegated to an external service, record its real behavior in an integration test instead of assuming it
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `external-service` · harmful: 0
- features: auth
- evidence: AUTH-01.6 (validation iteration 1) (external-service)
- last seen: 2026-10-05T04:00:56Z

### L-003 - Enforce spec limits on the server side too, not only in the front end
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `config` · harmful: 0
- features: auth
- evidence: AUTH-01.4 password minimum 8 vs server 6 (validation iteration 1) (config)
- last seen: 2026-10-05T04:00:56Z

### L-005 - Disable framework type coercion on money fields and reject non-string amounts instead of converting them
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `money` · harmful: 0
- features: transactions
- evidence: ranked gap 1 (validation.md): JSON-number amount coerced by Ajv (money)
- last seen: 2026-10-05T06:22:46Z

### L-006 - Define one API-wide status for missing and blank required fields (400 vs 422) before implementing routes
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: transactions
- evidence: spec-precision gaps (validation.md): status for blank vs missing required fields (validation)
- last seen: 2026-10-05T06:22:46Z

### L-007 - Prove a resource is released with a direct check, such as a failing call after close, not with a log line printed by the code under test
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `shutdown` · harmful: 0
- features: api-server
- evidence: M24 shutdown without server.close() (validation iteration 1) (shutdown)
- last seen: 2026-10-05T07:01:39Z

### L-008 - Validate configured origins as URL origins and define accepted formats for numeric environment variables
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `config` · harmful: 0
- features: api-server
- evidence: origin shape and PORT parsing gaps (validation.md) (config)
- last seen: 2026-10-05T07:01:40Z

### L-009 - Validate every field against the database constraints at parse time so one bad row cannot fail the whole import
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `parsers` · harmful: 0
- features: import
- evidence: gap 1 (validation.md): empty description/title made confirm fail with 500 (parsers)
- last seen: 2026-10-05T10:26:44Z

### L-010 - Log only safe error fields: never the raw Postgres error whose detail holds the row values
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `logging` · harmful: 0
- features: import
- evidence: gap 4 (validation.md): 500 log carried Postgres detail with row values (logging)
- last seen: 2026-10-05T10:26:44Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_

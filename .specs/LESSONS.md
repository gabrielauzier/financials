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

### L-006 - Define one API-wide status for missing and blank required fields (400 vs 422) before implementing routes
- signal: `spec_precision_gap` · recurrence: 2 feature(s) · scope: `validation` · harmful: 0
- features: transactions, credit-expenses
- evidence: spec-precision gaps (validation.md): status for blank vs missing required fields (validation) (+1 more)
- last seen: 2026-10-05T16:31:15Z

### L-013 - Test the failure path of every destructive action and every conditional option list, asserting the Portuguese text and the visible options
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `ui-tests` · harmful: 0
- features: credit-expenses, dashboards
- evidence: W2c and W9a/W9b (validation.md): delete failure text and account selector rules untested (ui-tests) (+1 more)
- last seen: 2026-10-05T19:28:15Z

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

### L-011 - Test the rollback of an optimistic update with the refetch also failing, so only the rollback can restore the previous state
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `optimistic-updates` · harmful: 0
- features: front-fixes
- evidence: M14 (validation iteration 2): rollback removal not observable while the refetch succeeds (optimistic-updates)
- last seen: 2026-10-05T15:08:23Z

### L-012 - Start every reset-to-default test from a non-default state that nothing else resets
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: front-fixes
- evidence: M17 (validation iteration 1): clear filters never tested from page 2 (tests)
- last seen: 2026-10-05T15:08:23Z

### L-014 - Seed rows on the first and last period boundaries (oldest month, first day of a month, exact local midnight) so a window shifted by one period or one day changes the result
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `time-windows` · harmful: 0
- features: dashboards
- evidence: mutants E6, E17, E18 (validation.md) (time-windows)
- last seen: 2026-10-05T19:28:15Z

### L-015 - Test every aggregate endpoint with only future-dated rows, not past data plus future noise, to prove its empty path
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `aggregates` · harmful: 0
- features: dashboards
- evidence: mutants E16, E24 (validation.md) (aggregates)
- last seen: 2026-10-05T19:28:15Z

### L-016 - Test clearing an optional field on edit and assert the request sends null, not that the field is omitted
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: dashboards
- evidence: mutant W19 (validation.md) (ui-tests)
- last seen: 2026-10-05T19:28:15Z

### L-017 - State in the spec the display name and the zero-total behavior of every derived group row
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-outcomes` · harmful: 0
- features: dashboards
- evidence: SPG-1, SPG-5 (validation.md): Estorno display name, zero-net card category (spec-outcomes)
- last seen: 2026-10-05T19:28:16Z

### L-018 - State in the spec the format (decimals and sign) of every computed percentage shown to the user
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `formatting` · harmful: 0
- features: dashboards
- evidence: SPG-2 (validation.md): percentage format (formatting)
- last seen: 2026-10-05T19:28:16Z

### L-019 - Pick dates in jsdom tests through the month the calendar already shows (fake clock), not through dropdown navigation: each Calendar dropdown change costs about 1.5 s and the test times out under parallel load
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: transactions-ux
- evidence: Gate Check runs 1,4 (extratoCrud.test.tsx:83, extratoFilters.test.tsx:74) (ui-tests)
- last seen: 2026-10-06T00:12:52Z

### L-020 - Wait for a debounce with fake timers or the recorded request, never with fixed real sleeps or default waitFor windows
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: transactions-ux
- evidence: Gate Check, extratoFilters.test.tsx:99 and sleeps at extratoInline.test.tsx:123 (ui-tests)
- last seen: 2026-10-06T00:12:52Z

### L-021 - Start every filter-reset test from page 2 and assert the next query is page 1, for every control that changes the query
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: transactions-ux
- evidence: mutants W38, W40 (validation.md) (ui-tests)
- last seen: 2026-10-06T00:12:52Z

### L-022 - On every error-toast path assert the text mapped from an ApiError code, not only the generic fallback
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: transactions-ux
- evidence: mutant W12 (validation.md) (ui-tests)
- last seen: 2026-10-06T00:12:52Z

### L-023 - Assert the content of the OpenAPI document for every field the spec names, not only that the committed file equals a fresh export
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `openapi` · harmful: 0
- features: transactions-ux
- evidence: mutants A17, A18 (validation.md) (openapi)
- last seen: 2026-10-06T00:12:53Z

### L-024 - Assert the exact option list of a select whose range the spec derives from a rule
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui-tests` · harmful: 0
- features: transactions-ux
- evidence: mutant W45 (validation.md) (ui-tests)
- last seen: 2026-10-06T00:12:53Z

### L-025 - Write spec examples that are reachable with the real clock when an input range is derived from the current date
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-outcomes` · harmful: 0
- features: transactions-ux
- evidence: SPG-1 (validation.md) (spec-outcomes)
- last seen: 2026-10-06T00:12:53Z

### L-026 - State in the spec the dialog state after a failed confirm action, not only the toast
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-outcomes` · harmful: 0
- features: transactions-ux
- evidence: SPG-2 (validation.md) (spec-outcomes)
- last seen: 2026-10-06T00:12:53Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_

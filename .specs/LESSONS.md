# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_

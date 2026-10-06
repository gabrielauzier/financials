# Extrato: ajustes finos v2 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transactions-ux-v2/design.md`
**Status**: Approved

**Feature prerequisites**: transactions-ux, import-fixes and colors-and-icons merged on `main` (the `description` column, `Other` payment method and `AccountLabel` exist); migrations 0001 to 0009 applied locally (no new migration). Branch `feat/transactions-ux-v2`, based on `origin/main`; no push.

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`), the `package.json` scripts and the confirmed lessons L-004, L-006, L-013 and L-027; no `AGENTS.md` or `CONTRIBUTING.md` - strong defaults applied. Floor taken from the existing tests (`api/test/transactions*.int.test.ts`, `web/src/features/transactions/*.test.tsx`, `web/src/lib/notify.test.tsx`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API routes, schema and OpenAPI | integration | Every route touched (GET, POST, PATCH): happy path + every listed edge case + RLS; `openapi.json` shape | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web components and hooks | unit | Spec-visible behavior per AC; failure paths assert the Portuguese text and the visible options (L-013); one test per filter | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Web pure helpers (`utils`, color contrast) | unit | All branches; 1:1 to spec ACs; every listed edge case (23:30 in two zones, month and year turn, leap year) | `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web mocks and hand-written API types | unit when behavior (mock handlers); none for types | Mock handlers behave like the API for `identifier`; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
| Styles, config | none | - (build gate only; the toast classes are covered through the contrast test of the helper that holds them) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After web tasks with unit tests only | `yarn --cwd web test` |
| Full | After API tasks with integration tests (needs `supabase start`) | `pnpm -C api test` |
| Build | After phase completion | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. The 8 tasks fit one worker batch (executed inline in the main window).

### Phase 1: Identifier contract

```
T1 → T2
```

### Phase 2: Modal identifiers and toast colors

```
T2 → T3
T4
```

### Phase 3: Clear each filter

```
T5 → T6
```

### Phase 4: Weekday

```
T7 → T8
T6 → T8
```

---

## Task Breakdown

### Phase 1: Identifier contract

### T1: Expose identifier in the transactions API

**What**: `identifier` in `TransactionSchema`, the row type, `selectColumns` and `toTransaction`, read-only (not in the POST or PATCH bodies, so both ignore it); regenerate `api/openapi.json` with `pnpm -C api openapi:export`; integration tests in `api/test/transactions.int.test.ts` and `api/test/swagger.int.test.ts`.
**Where**: `api/src/modules/transactions/schema.ts`
**Depends on**: None
**Reuses**: `api/test/transactions.int.test.ts` (block `transaction description`), `api/test/swagger.int.test.ts`, `api/src/modules/transactions/routes.ts` (unchanged)
**Requirement**: TUXV2-01, TUXV2-02, TUXV2-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Every `Transaction` of the list, the 201 of POST and the 200 of PATCH carries `identifier` (`string` or `null`); a manual transaction returns `null`; the existing key-set test lists `identifier` (AC 1)
- [x] A row inserted with an identifier directly in the database (as the import does) is returned unchanged by GET and PATCH, spaces at the ends kept (AC 2 and edge case)
- [x] POST with `identifier` as a string, a number, an object or `null` answers 201 with `identifier: null` and stores null (AC 3 and edge case)
- [x] PATCH with `identifier` alone, and together with `name`, answers 200 and keeps the stored value (AC 4)
- [x] Another user lists no row and gets 404 on PATCH, and the response does not contain the identifier (AC 5)
- [x] `api/openapi.json` describes `identifier` in `Transaction` and not in the POST and PATCH bodies; `swagger.int.test.ts` confirms the shape and that the file is current (AC 6)
- [x] Gate check passes: `pnpm -C api test`
- [x] Test count: 625 integration tests (615 existing plus 10 new) and 382 unit tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(transactions-ux-v2): expose the read-only identifier in the API`

---

### T2: Add identifier to the web type and the mock

**What**: `Transaction.identifier: string | null` in the web types (not in `TransactionInput` or `TransactionUpdate`) and in the mock: some seeded rows with an identifier, `null` on create whatever the body carries, ignored on PATCH; fix every fixture the new required field breaks.
**Where**: `web/src/lib/api/mock/transactions.ts`
**Depends on**: T1
**Reuses**: `web/src/lib/api/types.ts`, `web/src/lib/api/mock/transactions.test.ts`
**Requirement**: TUXV2-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `Transaction` has `identifier: string | null`; `TransactionInput` and `TransactionUpdate` reject it at compile time (a `@ts-expect-error` line in the mock test; typecheck passes) (AC 7)
- [ ] The mock list returns `identifier` on every row, some filled and some `null` (AC 8)
- [ ] The mock creates with `identifier: null` even when the body sends one, and the PATCH keeps the stored value, also when `name` changes in the same body (AC 8)
- [ ] Gate check passes: `yarn --cwd web test` and `yarn --cwd web typecheck`
- [ ] Test count: 617 existing web tests plus at least 4 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): add identifier to the web type and the mock`

---

### Phase 2: Modal identifiers and toast colors

### T3: Show the identifiers in the edit modal

**What**: `TransactionIdentifiers` (a `dl` named "Identificadores da transação" with "ID" and "Identificador externo", "—" when null, copy buttons with toasts and the failure toast) rendered by `TransactionForm` between the header and the form only when editing.
**Where**: `web/src/features/transactions/TransactionIdentifiers.tsx`
**Depends on**: T2
**Reuses**: `web/src/features/transactions/TransactionForm.tsx`, `web/src/lib/notify.ts`, `web/src/features/transactions/extratoDescriptionForm.test.tsx`
**Requirement**: TUXV2-05, TUXV2-06

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] The edit modal shows "ID" with the transaction `id` and "Identificador externo" with the exact `identifier` as text (AC 1 and 2 of the modal story)
- [ ] A transaction without `identifier` shows "—" and has no "Copiar identificador externo" button (AC 3)
- [ ] No input, textarea or other editable control holds either value, and the PATCH body sent by Salvar has no `id` and no `identifier` (AC 4)
- [ ] The create form shows no identifiers block, and reopening the modal for another transaction shows the new values (AC 5 and edge case)
- [ ] "Copiar ID" writes the exact `id` to the clipboard and emits "ID copiado"; "Copiar identificador externo" writes the exact identifier and emits "Identificador externo copiado" (AC 6 and 7)
- [ ] With `navigator.clipboard` undefined, and with a rejected write, the toast "Não foi possível concluir a operação. Tente novamente." is emitted and the modal stays open (AC 8)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 9 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): show the identifiers in the edit modal`

---

### T4: Color the toasts by type

**What**: `toast-styles.ts` with the per-type classes (success emerald, error red, neutral for info, default, warning and loading; light and `dark:`), consumed by `sonner.tsx`; `notifyInfo` in `notify.ts`; a color helper and a contrast test computed from the Tailwind theme and `styles.css`; the Tailwind compilation of the classes is checked once and recorded in the commit body.
**Where**: `web/src/components/ui/toast-styles.ts`
**Depends on**: None
**Reuses**: `web/src/components/ui/sonner.tsx`, `web/src/lib/notify.ts`, `web/src/lib/notify.test.tsx`, `web/src/styles.css`
**Requirement**: TUXV2-07, TUXV2-08

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `notifyInfo(message)` emits `toast.info` with the exact text and no other helper calls `toast` directly (AC 1 of the toast story)
- [ ] A real `Toaster` renders a success, an error and an info toast through `notify`, and each toast element carries the type attribute and the color classes of its own type only (AC 2, 3 and 4)
- [ ] The background and text colors resolved from the theme have a green hue for success, a red hue for error and a chroma under 0.03 for info, in the light and the dark theme (AC 2, 3 and 4)
- [ ] The text and background of every type in both themes have a WCAG contrast ratio of at least 4.5:1 (AC 5)
- [ ] `RootComponent` still mounts one "Notifications" region (AC 6, existing test)
- [ ] The Tailwind compilation of the classes contains the `dark` rule for `:is(.dark *)` with the `group-[.toaster]` prefix (recorded in the commit body)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 12 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): color the toasts by type`

---

### Phase 3: Clear each filter

### T5: Create the FilterField component

**What**: `FilterField` (rótulo with an optional "x" button named "Limpar filtro <rótulo>", with an optional `clearLabel`) and the exported `ClearButton` used for the search field.
**Where**: `web/src/features/transactions/FilterField.tsx`
**Depends on**: None
**Reuses**: `Label` and `Button` of `web/src/components/ui`
**Requirement**: TUXV2-09

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Without `onClear` there is only the label; with `onClear` there is a button named "Limpar filtro <rótulo>" beside the label that calls `onClear` once per click (AC 1 of the filter story)
- [ ] `clearLabel` replaces the label in the button name; the label stays associated with its control (`getByLabelText`) (AC 10)
- [ ] `ClearButton` renders a button with the given accessible name and calls its handler
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 4 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): add the filter field with a clear button`

---

### T6: Clear each active filter in the extrato

**What**: Replace `Filter` by `FilterField` in `TransactionsPage` and wire each "x": Tipo, Conta, Categoria and Neutra by `changeFilter`, De and Até by `changeDate` (only without the quick month), the quick month by `clearQuick` (beside "Mês", named "Limpar filtro Mês rápido"), and the search by an immediate reset of the field and of `q`.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T5
**Reuses**: `changeFilter`, `changeDate`, `clearQuick`, `web/src/features/transactions/extratoFilters.test.tsx`, `web/src/features/transactions/extratoQuickMonth.test.tsx`
**Requirement**: TUXV2-09, TUXV2-10, TUXV2-11

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Each of the five filters (busca, Tipo, Conta, Categoria, Neutra) shows its "x" only while it has a value, and clicking it queries without that parameter only, keeping the other filters and `sort`/`order` and going to page 1; one test per filter (AC 1 to 6 of the filter story)
- [ ] "Limpar filtro De" drops `from` and keeps `to`; "Limpar filtro Até" drops `to` and keeps `from`; neither shows while the quick month is active (AC 7, 8 and 9)
- [ ] The quick month "x" shows only with month and year chosen (not with just one), and clicking it queries without `from` and `to`, enables empty De and Até, keeps the other filters and the sort and goes to page 1 (AC 10 and 11)
- [ ] Clearing the last active filter queries with the base filters and removes every "Limpar filtro" button; clearing De or Até removes the invalid-period alert; the search "x" does not query a second time 300 ms later; clearing from page 2 goes to page 1 (edge cases)
- [ ] The existing filter, quick month and CRUD tests keep passing without weakened assertions
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 14 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): clear each active filter of the extrato`

---

### Phase 4: Weekday

### T7: Create the weekday helper

**What**: `weekdayAbbrev(iso)` in `utils.ts`: the local-day weekday ("Dom" to "Sáb") of `new Date(iso)` with `getDay()`, empty for an invalid instant.
**Where**: `web/src/features/transactions/utils.ts`
**Depends on**: None
**Reuses**: `formatDateLocal` (same zone), `web/src/features/transactions/utils.test.ts` (the `process.env.TZ` pattern)
**Requirement**: TUXV2-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] The seven days of 2026-10-04 (Dom) to 2026-10-10 (Sáb) map to "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb" (AC 1)
- [ ] 2026-10-05T23:30 local in America/Sao_Paulo (an instant already on the 6th in UTC) gives "Seg", and the same instant with `TZ` UTC gives "Ter" (AC 2 and 3)
- [ ] 2026-02-28 gives "Sáb" and 2026-03-01 "Dom"; 2026-12-31 gives "Qui" and 2027-01-01 "Sex"; 2028-02-29 gives "Ter" and 2028-03-01 "Qua" (AC 4 and 5)
- [ ] `2026-03-01T00:00:00Z` with `TZ` America/Sao_Paulo gives "Sáb", the weekday of the local day 28/02 that `formatDateLocal` shows (AC 6)
- [ ] An invalid string gives "" (AC 7)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 8 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): add the weekday helper`

---

### T8: Show the weekday under the date in the extrato

**What**: `TransactionDate` (date plus a second line with the weekday, `text-xs text-muted-foreground`) used by the table date cell and by the mobile card, which keeps the account beside it after the "·".
**Where**: `web/src/features/transactions/TransactionDate.tsx`
**Depends on**: T7, T6
**Reuses**: `web/src/features/transactions/TransactionsPage.tsx`, `formatDateLocal`, `weekdayAbbrev`, `web/src/features/transactions/extratoDescription.test.tsx`
**Requirement**: TUXV2-13

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] The table date cell shows the formatted date and, in a second line below it, the weekday abbreviation (AC 8)
- [ ] The mobile card shows the weekday abbreviation below the date and keeps the account after the "·" (AC 9)
- [ ] The weekday element has `text-xs` and `text-muted-foreground` and the date element has neither (AC 10)
- [ ] With `TZ` America/Sao_Paulo, a transaction at 2026-10-05 23:30 local shows "05/10/2026" and "Seg" in the table and in the card, and one at 2026-12-31 shows "31/12/2026" and "Qui" (AC 2, 4 and 8)
- [ ] An invalid `occurredAt` renders no weekday element (AC 7)
- [ ] The existing account label, description and CRUD tests keep passing without weakened assertions
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus at least 5 new pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions-ux-v2): show the weekday under the date`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2
Phase 2:  T3   (T3 after T2)   T4 (independent)
Phase 3:  T5 ------→ T6
Phase 4:  T7 ------→ T8  (T8 also after T6)
```

Execution is strictly sequential - there is no intra-phase parallelism.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: identifier in the API | 1 field through schema and OpenAPI (routes unchanged) | ✅ Granular |
| T2: web type and mock | 1 field through type and mock | ✅ Granular |
| T3: identifiers in the modal | 1 component plus a one-line mount | ✅ Granular |
| T4: toast colors | 1 style module consumed by the wrapper, 1 helper, 1 test helper | ✅ Granular |
| T5: FilterField | 1 component | ✅ Granular |
| T6: wire the clear buttons | 1 file, 8 handlers already existing or one-line | ✅ Granular |
| T7: weekday helper | 1 function | ✅ Granular |
| T8: weekday in the extrato | 1 component plus its two usages | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | None | none | ✅ Match |
| T5 | None | none | ✅ Match |
| T6 | T5 | T5 | ✅ Match |
| T7 | None | none | ✅ Match |
| T8 | T7, T6 | T7, T6 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: API identifier | Routes, schema and OpenAPI | integration | integration | ✅ OK |
| T2: web type and mock | Mock handlers (behavior) and types | unit | unit | ✅ OK |
| T3: modal identifiers | Web components | unit | unit | ✅ OK |
| T4: toast colors | Web helpers and styles | unit | unit | ✅ OK |
| T5: FilterField | Web components | unit | unit | ✅ OK |
| T6: clear buttons | Web components | unit | unit | ✅ OK |
| T7: weekday helper | Web pure helpers | unit | unit | ✅ OK |
| T8: weekday display | Web components | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| TUXV2-01 | T1 |
| TUXV2-02 | T1 |
| TUXV2-03 | T1 |
| TUXV2-04 | T2 |
| TUXV2-05 | T3 |
| TUXV2-06 | T3 |
| TUXV2-07 | T4 |
| TUXV2-08 | T4 |
| TUXV2-09 | T5, T6 |
| TUXV2-10 | T6 |
| TUXV2-11 | T6 |
| TUXV2-12 | T7, T8 |
| TUXV2-13 | T8 |

**Notes for the worker**: `api/openapi.json` is regenerated in T1 and not edited by hand. Tests that depend on the zone set `process.env.TZ` and restore it, and fake only `Date`; no fixed sleeps, no raised timeouts and no month or year dropdown of the DatePicker (L-027). Prove each new guard test with a quick mutation in a temporary git worktree on the external volume and record the proof in the commit body.

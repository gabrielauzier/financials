# Cores e ícones: categorias, contas e bancos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/colors-and-icons/design.md`
**Status**: Draft

**Feature prerequisites**: import-improvements complete (the `CategoryOptionLabel` single render point, `CategorySelect` in the import preview); migrations 0001 to 0007 applied (`pnpm -C api db:reset`; the local Supabase stack must be running for integration tests, `pnpm -C api db:start`). Branch `feat/colors-and-icons`, stacked on `feat/import-improvements`; the only new migration is `0008_colors.sql`; no push. Production gets the migration with `supabase db push` only after the merge and with the owner's confirmation (outside this feature).

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test configs (`api/vitest.unit.config.ts`, `api/vitest.int.config.ts`, `web/vitest.config.ts`) and the `package.json` scripts; no `AGENTS.md` or `CONTRIBUTING.md` at the root (`web/AGENTS.md` only holds Lovable and transaction-mock notes) - strong defaults applied. Floor taken from the existing tests (`api/test/accounts*.int.test.ts`, `api/test/categories.int.test.ts`, `api/test/accounts-categories-schema.int.test.ts`, `api/test/swagger.int.test.ts`, `web/src/features/accounts/accounts.test.tsx`, `web/src/features/categories/*.test.tsx`, `web/src/features/transactions/*.test.tsx`, `web/src/features/import/*.test.tsx`). Determinism rules for every new test (spec: Testes determinísticos; lessons L-027 and the transactions-ux rules): no fixed sleeps or `setTimeout` waits, no raised timeouts (`testTimeout` stays 15 000 ms and the slowest new test stays under 7.5 s), no slow date or dropdown helpers (`pickDate` is not needed here), `findBy*`/`waitFor` for async UI, failure paths and conditional lists assert the Portuguese text and the visible options (L-013).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API pure logic (palette constant, key guard) | unit | All branches; 1:1 to spec ACs; 66 keys, no duplicates, exact-match guard rejects case, whitespace and unknown values | `api/src/**/*.test.ts` | `pnpm -C api test:unit` |
| API routes, SQL migrations, RLS, OpenAPI | integration | Every route touched: happy path + every listed edge case + error paths (422 field `color`, 400 wrong type, 403 system category, 404 foreign id, 409 name conflict with a valid color); constraint and domain exercised; seed and backfill executed; RLS unchanged for two users; `openapi.json` up to date | `api/test/**/*.int.test.ts` | `pnpm -C api test` |
| Web pure helpers (palette map, labels, contrast, asset sanity, lookups) | unit | All branches; 1:1 to spec ACs; every one of the 66 keys; contrast of every entry from the real `theme.css`; every SVG file checked against the sanitize rule | `web/src/**/*.test.ts` | `yarn --cwd web test` |
| Web components, hooks, pages | unit | Spec-visible behavior per AC in every place the feature touches (picker, badge in each select and table, icon in each place, forms); failure paths and conditional lists assert the Portuguese text and the visible options (L-013) | `web/src/**/*.test.tsx` | `yarn --cwd web test` |
| Web API client, mocks and hand-written types | unit when behavior (client calls, mock handlers); none for types | Mock handlers store, return and validate `color`; the seeded colors equal the design table; types by typecheck | `web/src/lib/api/**/*.test.ts` | `yarn --cwd web test` |
| Static assets and docs (SVG files, `NOTICE`) | unit via the asset sanity test | Size, `viewBox`, forbidden content, presence of the four files and of the `NOTICE` entries | `web/src/assets/banks/*.test.ts` | `yarn --cwd web test` |
| Config / scaffold | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After web tasks with unit tests only; after API tasks with unit tests only | `yarn --cwd web test` for web tasks; `pnpm -C api test:unit` for API unit-only tasks |
| Full | After API tasks with integration tests (needs `supabase start`) | `pnpm -C api test` |
| Build | After phase completion | `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. Phases 1 and 2 (5 tasks) form the first worker batch; phases 3 and 4 (8 tasks) the second.

### Phase 1: Migration and API

```
T1
T1 → T2
T2 → T3
```

### Phase 2: Web contract and palette

```
T3 → T4
T4 → T5
```

### Phase 3: Web components

```
T4 → T6
T4 → T7
T5 → T7
T8
T4 → T9
T5 → T9
T8 → T9
```

### Phase 4: Integration in the screens

```
T5 → T10
T6 → T10
T8 → T10
T5 → T11
T6 → T11
T7 → T11
T7 → T12
T9 → T12
T7 → T13
```

---

## Task Breakdown

### Phase 1: Migration and API

### T1: Add the palette, the color columns and the seeded colors

**What**: `api/src/lib/palette.ts` (`COLOR_FAMILIES`, `COLOR_SHADES`, `COLOR_KEYS` family by family and shade ascending, `isColorKey` exact match, `DEFAULT_COLOR = "slate-600"`) and migration `0008_colors.sql`: domain `public.palette_color` with the 66-key check, `color public.palette_color not null default 'slate-600'` on `categories` and `accounts`, the backfill block between `-- backfill:begin` and `-- backfill:end` (17 seeded keys by the design table, accounts by bank), and `create or replace function public.seed_categories` with the same 17 rows plus `color` (grants and `security definer` unchanged; `handle_new_user` untouched).
**Where**: `supabase/migrations/0008_colors.sql`
**Depends on**: None
**Reuses**: `supabase/migrations/0002_accounts_categories.sql` (the 17 rows, names and `is_system`, the revoke); `api/test/accounts-categories-schema.int.test.ts` and `api/test/helpers/db.ts` (`createTestUser`, `getAdminSql`, `asUser`); `api/test/rls-catalog.int.test.ts` as the RLS safety net; the table "Tabela de cores semeadas" of the design; new `api/src/lib/palette.test.ts` and `api/test/colors-schema.int.test.ts`
**Requirement**: COLOR-01, COLOR-02, COLOR-03

**Tools**:

- MCP: NONE
- Skill: supabase-postgres-best-practices

**Done when**:

- [x] Unit tests of `palette.ts` (`palette.test.ts`): exactly 22 families and 3 shades give 66 distinct keys matching `^[a-z]+-(400|600|900)$`; `DEFAULT_COLOR` is in the list; `isColorKey` accepts every key and rejects `""`, `"blue"`, `"blue-500"`, `"Blue-600"`, `" blue-600"` and `"#2563eb"` (COLOR-01 AC 1)
- [x] Integration: the domain `palette_color` constraint, read from `pg_constraint` (`contypid`), lists exactly the keys of `COLOR_KEYS`, so the SQL and the constant cannot diverge (COLOR-01 AC 2)
- [x] Integration: `categories.color` and `accounts.color` are `not null`, of domain `palette_color`, default `slate-600` (`information_schema.columns`); inserting `'blue-500'` into either table fails with SQLSTATE 23514 (COLOR-02 AC 3 and 4)
- [x] Integration: the `-- backfill` block extracted from the migration file and run after resetting every `color` to `slate-600` gives the 17 seeded categories the design colors, all 17 distinct; a user category (no `key`) stays `slate-600`; accounts get `purple-600`, `teal-600`, `sky-600`, `zinc-900`, `slate-600` for Nubank, SofisaDireto, Neon, XP, Other (COLOR-02 AC 5 and 6)
- [x] Integration: a new user created through the signup path (`createTestUser`) has the 17 categories with the design colors and the same names, keys and `is_system` flags as before; calling `seed_categories` twice adds nothing; `authenticated` and `anon` still cannot execute it (COLOR-03 AC 7)
- [x] Integration: user B cannot read or update the colors of user A's rows; an authenticated update of `color` on a system category affects 0 rows; `rls-catalog` and the schema tests still pass (COLOR-03 AC 8)
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` after `pnpm -C api db:reset`
- [x] Test count: the existing API tests plus about 8 new unit tests and 10 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(colors-and-icons): add palette, color columns and seed colors`

---

### T2: Accept and return the color of accounts

**What**: `accounts/routes.ts` accepts optional `color` in `POST` and `PATCH`, validates it with `validColor` (422 `validation_error`, field `color`), selects and returns `color` in every account response (POST, GET, PATCH, activate, deactivate), documents the `enum` in the response schema and the key list in the body description; regenerate `api/openapi.json`; update the existing account tests that compare whole responses.
**Where**: `api/src/modules/accounts/routes.ts`
**Depends on**: T1
**Reuses**: `api/src/lib/palette.ts` (`COLOR_KEYS`, `isColorKey`); `validBank` and `invalid` in the same file; `api/test/accounts.int.test.ts`, `api/test/accounts-categories-isolation.int.test.ts`, `api/test/swagger.int.test.ts`; `pnpm -C api openapi:export`
**Requirement**: COLOR-04, COLOR-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Integration: `POST /accounts` with `color: "teal-400"` answers 201 with that color and the row stores it; without `color` it stores and returns `slate-600` (COLOR-04 AC 1 and 2)
- [x] Integration: `POST` and `PATCH` with `""`, `"blue"`, `"blue-500"`, `"Blue-600"`, `" blue-600"` and `"#2563eb"` answer 422 `validation_error` with `field: "color"` and write nothing; `null`, a number and an object answer 400 `validation_error` (COLOR-04 AC 3 and 4)
- [x] Integration: `PATCH` with only `color` changes the color and keeps bank, nickname and holders; `PATCH` with `color` and an invalid `nickname` changes nothing; `GET /accounts`, `activate` and `deactivate` return `color` (COLOR-04 AC 5 and 6)
- [x] Integration: user B `PATCH`ing user A's account answers 404 `not_found` and A's color is unchanged (COLOR-04 AC 7)
- [x] `api/openapi.json` regenerated (never edited by hand) lists `color` with an enum of 66 keys on the account schema and the key list on the POST and PATCH bodies; the swagger test passes (COLOR-06 AC 1)
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [x] Test count: the existing API tests (whole-response assertions updated to include `color`) plus about 14 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(colors-and-icons): accept and return the account color`

---

### T3: Accept and return the color of categories

**What**: `categories/routes.ts` returns `color` everywhere; `POST` accepts optional `color`; `PATCH` takes optional `name` and `color` (an empty body returns the row; a blank name stays 422; both fields written in one `update` after `assertEditable`); regenerate `api/openapi.json`; update the category tests (the old "missing name is 400" case follows the new contract).
**Where**: `api/src/modules/categories/routes.ts`
**Depends on**: T2
**Reuses**: `api/src/lib/palette.ts`; `validName`, `assertEditable`, `isNameConflict`, `duplicateName` in the same file; `api/test/categories.int.test.ts`, `api/test/accounts-categories-isolation.int.test.ts`, `api/test/swagger.int.test.ts`; `pnpm -C api openapi:export`
**Requirement**: COLOR-05, COLOR-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Integration: `GET /categories` returns `color` for each category and the 17 seeded ones carry the design table colors (COLOR-05 AC 1)
- [x] Integration: `POST /categories` with `name` and `color: "rose-900"` answers 201 with that color; without `color` it returns `slate-600`; an invalid string color answers 422 `validation_error` with `field: "color"` and creates nothing (COLOR-05 AC 2, 3 and 4)
- [x] Integration: `PATCH` with only `color` changes the color and keeps the name; with `name` and `color` both change; with a valid color and a name that conflicts answers 409 `duplicate_name` and the color is unchanged; with a valid name and an invalid color answers 422 and the name is unchanged (COLOR-05 AC 4, 5 and 6)
- [x] Integration: `PATCH` with an empty body answers 200 with the category unchanged (COLOR-05 AC 7)
- [x] Integration: `PATCH` of a system category (`Uncategorized`) with a name or a color answers 403 `category_protected` and the color stays; user B `PATCH`ing user A's category answers 404 `not_found` (COLOR-05 AC 8 and 9)
- [x] `api/openapi.json` regenerated (never edited by hand) lists `color` with the 66-key enum on the category schema and the key list on the POST and PATCH bodies; the swagger test passes (COLOR-06 AC 1)
- [x] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test`
- [x] Test count: the existing API tests (updated where the contract changed) plus about 14 new integration tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(colors-and-icons): accept and return the category color`

---

### Phase 2: Web contract and palette

### T4: Create the web palette, labels, class map and contract test

**What**: `web/src/features/colors/palette.ts` with `COLOR_FAMILIES`, `COLOR_SHADES`, `COLOR_KEYS` (same order as the API), `ColorKey`, `isColorKey`, `DEFAULT_COLOR`, `colorLabel` (`Azul 600`, names from the spec) and `COLOR_CLASSES` with 66 literal `{ bg, text }` entries by the text rule of the design (400 `text-<family>-950`, 900 `text-white`, 600 white or black by family), plus `colorClasses(value)` falling back to `slate-600`. The contract test reads `api/openapi.json`.
**Where**: `web/src/features/colors/palette.ts`
**Depends on**: T3
**Reuses**: the design table "Sincronia das listas"; `web/node_modules/tailwindcss/theme.css` (read by the test through `require.resolve("tailwindcss/theme.css")`); `api/openapi.json` (read by the test through `new URL("../../../../api/openapi.json", import.meta.url)`); new `palette.test.ts` and `paletteContract.test.ts` next to it
**Requirement**: COLOR-01, COLOR-06, COLOR-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Unit: 66 distinct keys of the form `<family>-<shade>`, 22 families times 400, 600 and 900, in the API's order; `isColorKey` is exact (rejects case, whitespace, unknown) and `colorLabel` gives 66 distinct Portuguese names such as `Azul 600`, `Verde-azulado 400`, `Rosê 900` (COLOR-01 AC 1)
- [ ] Unit: every `COLOR_CLASSES` entry has `bg` exactly `bg-<family>-<shade>` and `text` per the rule; the source file contains no `${` inside the map (literal classes only); `colorClasses` of an unknown value, `undefined` and `""` equals the `slate-600` entry (COLOR-09 AC 1, 2 and 5)
- [ ] Unit: the contrast of every one of the 66 entries, computed from the oklch values of `tailwindcss/theme.css` (treating `none` as hue 0), is at least 4.5:1 (COLOR-09 AC 3)
- [ ] Contract test: the `enum` of `color` in the `GET /accounts` and `GET /categories` 200 schemas of `api/openapi.json` equals `COLOR_KEYS` as a set of 66; a mutated list in the test makes the comparison fail with the difference listed (COLOR-06 AC 2, COLOR-01 AC 2)
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add the web palette and the contract test`

---

### T5: Add color to the web types, clients and mocks

**What**: `Account.color` and `Category.color` (`ColorKey`, required), `AccountInput`/`AccountUpdate` and category inputs accept `color`; `createCategory({ name, color? })` and `updateCategory({ id, name?, color? })` replace `renameCategory` (and `useUpdateCategory` replaces `useRenameCategory`); the account and category mocks store, return and validate `color` (422 `validation_error`, field `color`), seed the 17 categories with the design colors and the two accounts with the per-bank colors; every test fixture that builds an `Account` or `Category` gets a `color`.
**Where**: `web/src/lib/api/types.ts`
**Depends on**: T4
**Reuses**: `web/src/lib/api/mock/accounts.ts`, `web/src/lib/api/mock/categories.ts` (seed table and handlers); `web/src/features/accounts/api.ts`, `web/src/features/categories/api.ts`, `web/src/features/categories/hooks.ts`; `web/src/features/colors/palette.ts` (`isColorKey`); the fixtures of `accounts.test.tsx`, `categories.test.tsx`, `transactions.test.tsx`, `extratoCrud.test.tsx`, `CreditExpenseForm.test.tsx`, `InvestmentReturns.test.tsx`; `web/src/lib/api/mock/transactions.test.ts`
**Requirement**: COLOR-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Mock tests: `POST` and `PATCH` of accounts and categories with a valid `color` store and return it; an invalid string (`""`, `"blue-500"`, `"Blue-600"`) throws a 422 mock error with code `validation_error` and field `color`; a category `PATCH` with `name` and `color` updates both and a system category still throws `category_protected` (COLOR-06 AC 4)
- [ ] Mock tests: the 17 seeded categories carry exactly the design table colors (all distinct) and the two seeded accounts the Nubank color `purple-600`; `GET /accounts` and `GET /categories` return `color` on every item (COLOR-06 AC 5)
- [ ] Types: `color` required on `Account` and `Category`; the clients send `color` in create and update calls (a test asserts the request body of `createCategory`, `updateCategory`, `createAccount` and `updateAccount`) (COLOR-06 AC 3)
- [ ] Every existing test still passes after the fixtures got `color`; `yarn --cwd web typecheck` is green at this commit (no optional `color` workaround)
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 10 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add color to the web types, clients and mocks`

---

### Phase 3: Web components

### T6: Create the ColorPicker

**What**: `ColorPicker({ value, onChange, id, disabled, ariaLabel? })`: an outline trigger button showing the swatch and `colorLabel(value)`, opening a `Popover` with a `radiogroup` "Paleta de cores" of 66 `radio` buttons in a 6-column grid (selected one with `aria-checked`, a check mark and a ring), roving `tabIndex`, arrows (±1 and ±6, no wrap), Home, End, Enter and Space, focus returns to the trigger after a pick or Escape.
**Where**: `web/src/features/colors/ColorPicker.tsx`
**Depends on**: T4
**Reuses**: `web/src/components/ui/popover.tsx` and `button.tsx`; `web/src/components/ui/date-picker.tsx` (the Popover plus trigger pattern); `web/src/features/colors/palette.ts` (`COLOR_KEYS`, `colorLabel`, `colorClasses`, `DEFAULT_COLOR`)
**Requirement**: COLOR-07

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] Opening the trigger shows a radiogroup named "Paleta de cores" with 66 radios, each named `<Família> <tom>` in Portuguese (for example `Azul 600`), all names unique (AC 1)
- [ ] With `value="blue-600"` only `Azul 600` has `aria-checked="true"` and the check mark, and the trigger text is "Azul 600"; clicking another color calls `onChange` with its exact key once, closes the popover and returns focus to the trigger (AC 2 and 3)
- [ ] Keyboard (via `fireEvent.keyDown` in sequence): right and left move one, down and up move six, none leaves the grid at the first or last cell; Home and End go to the first and last; Enter and Space on the focused radio choose it; Escape closes without calling `onChange` (AC 4, 5 and 6)
- [ ] A disabled picker does not open on click; an unknown `value` (`"banana"`) shows "Ardósia 600" on the trigger and checks no radio; exactly one radio has `tabIndex=0`; the `id` is on the trigger so `getByLabelText` finds it (AC 7, 8 and 9)
- [ ] No fixed sleep or raised timeout; the slowest test of the file runs under 7.5 s with two suites in parallel (lesson L-027)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add the accessible color picker`

---

### T7: Show categories as colored badges in the selects

**What**: `CategoryBadge({ name, color, className })` over the shadcn `Badge` (classes from `colorClasses`, `ring-1 ring-inset ring-black/10 dark:ring-white/25`, truncate, `title`), `CategoryOptionLabel` renders it, and `useCategoryLookup()` in `categories/hooks.ts` returns `{ byId, ready }` over `useCategories()`.
**Where**: `web/src/features/categories/CategoryBadge.tsx`
**Depends on**: T4, T5
**Reuses**: `web/src/components/ui/badge.tsx`; `web/src/features/categories/CategoryOptionLabel.tsx` and `CategorySelect.tsx` (no code change in the select: `SelectValue` shows the selected item); `web/src/features/colors/palette.ts`; `web/src/features/categories/CategorySelect.test.tsx`, `CategoryOptionLabel.test.tsx`; `web/src/test/apiSpy.tsx`
**Requirement**: COLOR-09, COLOR-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `CategoryBadge` renders the name with the `bg` and `text` classes of its key plus `ring-1`, `ring-inset`, `ring-black/10` and `dark:ring-white/25`; an unknown color uses the `slate-600` classes; a long name has the `truncate` class and the `title` with the full name (COLOR-09 AC 4, 5 and 6)
- [ ] An opened `CategorySelect` renders every item as a badge with that category's color and each `option` keeps the category name as accessible name (the spec AC 1); with a value, the trigger shows the selected category's badge (AC 2)
- [ ] The select still shows "Carregando categorias…" and stays disabled while the query is pending, and the existing options-count assertions pass (AC 8)
- [ ] `useCategoryLookup` returns `ready: false` while loading or failing (empty map) and a map by id when loaded
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): show category badges in the selects`

---

### T8: Vendor the bank SVGs and create the BankIcon

**What**: Copy the four SVGs from `Tgentil/Bancos-em-SVG` into `web/src/assets/banks/` as `nubank.svg`, `sofisa-direto.svg`, `neon.svg` and `xp.svg` (sources in the design; XML declaration, comments and editor metadata removed, Neon `viewBox` tightened to the mark), write the `NOTICE` (origin URL and commit consulted, source folders and files, the owner's license confirmation for personal use, the edits made, the warning for non-personal use), and create `BankIcon({ bank, size, decorative })` with `bankLabels` and the `Landmark` fallback (also on `onError`).
**Where**: `web/src/features/accounts/BankIcon.tsx`
**Depends on**: None
**Reuses**: `lucide-react` `Landmark`; `bankLabels` currently duplicated in `web/src/features/accounts/AccountsPage.tsx:20` and `AccountForm.tsx` (moved here and imported by both in T10); the files fetched with `gh api repos/Tgentil/Bancos-em-SVG/contents/<folder>`; new `BankIcon.test.tsx` and `web/src/assets/banks/banks.test.ts`
**Requirement**: ICON-01, ICON-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Asset test: the four files exist; each has a root `<svg` with `viewBox`, is at most 12 KB, all together at most 40 KB; none contains `<script`, `<foreignObject`, `<image`, `<iframe`, an `on*=` attribute, an `href` or `xlink:href` that is not `#fragment`, `url(` with `http`, `https` or `//`, or `@import`; the test's own negative cases (a string with `<script>` and one with `href="https://x"`) fail the same predicate (ICON-01 AC 1, 3 and 4)
- [ ] The `NOTICE` exists and names the repository URL, the four source files, the four vendored names, the owner's confirmation for personal use, the edits and the non-personal-use warning; the asset test checks that each of the four vendored names appears in it (ICON-01 AC 2 and 4)
- [ ] `BankIcon` for Nubank, SofisaDireto, Neon and XP renders one `<img>` inside the 20 px frame (32 px with `size="lg"`) whose `src` is the imported file of that bank; for `Other` and an unknown value it renders the generic icon without throwing (ICON-02 AC 1 and 2)
- [ ] By default the icon is `aria-hidden` with `alt=""` and no `role="img"`; with `decorative={false}` it has `role="img"` named `Banco Nubank`, `Banco Sofisa Direto`, `Banco Neon`, `Banco XP` or `Banco Outro` (ICON-02 AC 3 and 4)
- [ ] A `load` error on the image swaps it for the generic icon and the frame keeps its size (ICON-02 AC 5)
- [ ] The commit body records that the four icons were viewed rendered at 20 px and 32 px in the browser, light and dark theme (the Neon mark readable)
- [ ] Gate check passes: `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 12 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): vendor the bank svgs and add the bank icon`

---

### T9: Show the bank icon and color in the account select

**What**: `AccountLabel({ account, showInactive })` (bank icon, nickname with the ` (inativa)` suffix in the same text node when asked, 10 px color dot, `aria-hidden`), `useAccountLookup()` in `accounts/hooks.ts` over `useAccounts()` (all accounts), and `AccountSelect` renders `AccountLabel` for every item (with `showInactive`) and, through the Radix value, in the trigger.
**Where**: `web/src/features/accounts/AccountLabel.tsx`
**Depends on**: T4, T5, T8
**Reuses**: `web/src/features/accounts/AccountSelect.tsx` and `hooks.ts`; `web/src/features/accounts/BankIcon.tsx`; `web/src/features/colors/palette.ts` (`colorClasses`); `web/src/features/accounts/accounts.test.tsx`; the import-start tests that open the account select (`web/src/features/import/ImportStartStep.test.tsx`)
**Requirement**: ICON-03, ICON-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] `AccountLabel` renders the bank icon, the nickname and a dot with the account's `bg` class (unknown color uses `slate-600`); the dot and the icon are `aria-hidden`; the color is never the only text (ICON-03 AC 1, ICON-04 AC 7)
- [ ] An opened `AccountSelect` renders each item as `AccountLabel` and each `option` keeps the nickname as accessible name, with ` (inativa)` for an inactive account when `includeInactive` is on; with a value the trigger shows the same label (ICON-03 AC 1 and 2)
- [ ] The select still shows "Carregando contas…" and stays disabled while pending; the filter, transaction form, credit-expense form, investment-return form and import start step keep working with the existing tests unchanged (ICON-03 AC 6)
- [ ] `useAccountLookup` returns `ready: false` and an empty map while loading or failing and a map by id when loaded
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 8 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add the account label to the account select`

---

### Phase 4: Integration in the screens

### T10: Add the color to the account form and the icon to the accounts list

**What**: `AccountForm` gets the "Cor" field (`Label` plus `ColorPicker id="account-color"`, `slate-600` for a new account, the account's color when editing), sends `color` in the create and update inputs and shows "Escolha uma cor da paleta." for a 422 on `color`; `AccountsPage` imports `bankLabels` from `BankIcon.tsx` and shows each card with the 32 px `BankIcon`, nickname, bank label and the 6 px vertical color bar (`aria-hidden`), keeping the "Editar", "Desativar" and "Reativar" buttons and the reduced opacity for inactive accounts.
**Where**: `web/src/features/accounts/AccountsPage.tsx`
**Depends on**: T5, T6, T8
**Reuses**: `web/src/features/accounts/AccountForm.tsx` (the new field and the schema); `web/src/features/colors/ColorPicker.tsx`; `web/src/features/accounts/BankIcon.tsx` (`BankIcon`, `bankLabels`); `web/src/lib/api/errorMessages.ts` (`fieldForError`); `web/src/features/accounts/accounts.test.tsx`
**Requirement**: COLOR-08, ICON-03, ICON-04

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] The new account form opens with the picker showing "Ardósia 600"; the edit form opens with the account's color; saving sends `color` with the other fields in the `POST` and in the `PATCH` (the spied request body is asserted) (COLOR-08 AC 1 and 2)
- [ ] A mocked 422 on `color` shows "Escolha uma cor da paleta." and keeps what was typed; another failure shows the `messageForError` text and keeps the dialog open (COLOR-08 AC 5 and 6)
- [ ] The accounts list shows, for each account, the bank icon, the nickname, the Portuguese bank label and a color bar with the account's `bg` class, plus the "Editar", "Desativar" and "Reativar" buttons as before (ICON-03 AC 5)
- [ ] After a `PATCH` of the color the list refetches and the bar shows the new class without a reload; an inactive account keeps `opacity-55` and its icon and bar stay rendered (ICON-04 AC 8 and 9)
- [ ] The browser check against the local API (create and recolor an account, see the icon and bar, light and dark theme) is recorded in the commit body
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 9 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add account color and icon to the accounts page`

---

### T11: Add the color to the category forms and the badge to the categories list

**What**: `CategoriesPage`: the create form sends `{ name, color }` with a `ColorPicker` (`slate-600` by default, back to it after a successful create); the edit form has the picker with the current color, the button "Salvar categoria" and one `updateCategory` call with `name` and `color`; each row shows `CategoryBadge` instead of the plain name; system categories show the badge and no edit control; a 422 on `color` shows "Escolha uma cor da paleta.".
**Where**: `web/src/features/categories/CategoriesPage.tsx`
**Depends on**: T5, T6, T7
**Reuses**: `web/src/features/colors/ColorPicker.tsx`; `web/src/features/categories/CategoryBadge.tsx`; `useUpdateCategory` and `createCategory` from T5; `web/src/features/categories/categories.test.tsx`; `fieldForError`
**Requirement**: COLOR-08, COLOR-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] The create form sends `name` and the chosen `color` (default `slate-600`); after success the name clears and the picker goes back to "Ardósia 600" (COLOR-08 AC 3)
- [ ] The edit form shows the name and the picker with the current color; "Salvar categoria" sends one `PATCH` with `name` and `color`; a mocked 422 on `color` shows "Escolha uma cor da paleta." and keeps the edit open; another error shows the mapped Portuguese text (COLOR-08 AC 4, 5 and 6)
- [ ] Each category row shows its `CategoryBadge` with its color and the buttons keep the names "Renomear <nome>" and "Excluir <nome>"; a system category shows the badge and the lock, with no rename, color or delete control (COLOR-10 AC 7, COLOR-08 AC 7)
- [ ] The reassign-destination select (delete of a category in use) shows badges in its items (COLOR-10 AC 4)
- [ ] The existing create, rename, delete and reassign tests pass with the "Salvar nome" label updated to "Salvar categoria"
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 10 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): add color to the category forms and list`

---

### T12: Show the account icon and color in the extrato

**What**: The extrato table cell and the mobile card resolve the account by `accountId` with `useAccountLookup` and render `AccountLabel` (without the inactive suffix); while the lookup is not ready or the id is missing they keep rendering `accountNickname` as plain text.
**Where**: `web/src/features/transactions/TransactionsPage.tsx`
**Depends on**: T7, T9
**Reuses**: `web/src/features/accounts/AccountLabel.tsx` and `useAccountLookup`; `web/src/features/transactions/extratoCrud.test.tsx`, `extratoInline.test.tsx`, `extratoDescription.test.tsx`, `transactions.test.tsx`; `web/src/test/apiSpy.tsx`
**Requirement**: ICON-03

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] A table row and a mobile card of a Nubank account show the Nubank icon, the nickname and the color dot of that account, resolved by `accountId` (ICON-03 AC 3)
- [ ] While `GET /accounts` is pending or when it fails the row and the card show only `accountNickname` as text, with no icon or dot, and the rest of the row (name, description, category select, amount) renders as before; the loaded state then swaps to the label (ICON-03 AC 4)
- [ ] A transaction of an inactive account shows the nickname with icon and dot and no " (inativa)" suffix (edge case)
- [ ] The filter's `AccountSelect` and the bulk-apply and row category selects show badges and account labels in the opened options (COLOR-10 AC 3 and ICON-03 AC 6) with the Portuguese option names asserted
- [ ] The extrato tests that read the account name by text still pass (the nickname text node is intact)
- [ ] Gate check passes: `yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 8 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(colors-and-icons): show the account icon and color in the extrato`

---

### T13: Show category badges in the import preview text cells and verify in the browser

**What**: In `ImportPreviewTable`, the `ignored` and `invalid` rows and the fallback shown when categories fail to load use `CategoryBadge` through `useCategoryLookup` when the lookup is ready and has the row's `categoryId`, and the plain `categoryName` text otherwise; the selectable rows already get the badge through `CategorySelect`. After the code, run the manual browser verification against the local API and record it.
**Where**: `web/src/features/import/ImportPreviewTable.tsx`
**Depends on**: T7
**Reuses**: `web/src/features/categories/CategoryBadge.tsx` and `useCategoryLookup`; `web/src/features/import/ImportPreviewTable.test.tsx`, `ImportPage.test.tsx`; `web/src/test/apiSpy.tsx`
**Requirement**: COLOR-10

**Tools**:

- MCP: NONE
- Skill: react-best-practices

**Done when**:

- [ ] A selectable preview row's select shows the category badge in its trigger and in its opened options (COLOR-10 AC 5)
- [ ] An `ignored` or `invalid` row shows the `CategoryBadge` with the category name and the color of the user's category with that id when the lookup is ready (COLOR-10 AC 5)
- [ ] When `GET /categories` fails the column shows the `categoryName` text for every row, with no badge, as before; while loading the select shows "Carregando categorias…" (COLOR-10 AC 6 and 8)
- [ ] The browser check against the local API is recorded in the commit body: the picker changes a category and an account color and the extrato, selects, accounts list and import preview reflect it; badges legible in the light and dark theme for 400, 600 and 900; the icon of Nubank, Sofisa Direto, Neon, XP and the generic one for Outro visible in the account select and the extrato; `pnpm -C api openapi:export` leaves `api/openapi.json` with no diff
- [ ] Gate check passes: `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` and `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`
- [ ] Test count: the existing web tests plus about 5 new ones pass (no silent deletions)

**Tests**: unit
**Gate**: build

**Commit**: `feat(colors-and-icons): show category badges in the import preview`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2 ------→ T3
Phase 2:  T4 ------→ T5
Phase 3:  T6, T7, T8 (independent of each other), then T9 (after T8)
Phase 4:  T10, T11, T12, T13 (independent of each other)
```

T4 depends on T3 (the OpenAPI enum), T5 on T4, T6 and T7 on T4 (T7 also on T5), T9 on T4, T5 and T8, T10 on T5, T6 and T8, T11 on T5, T6 and T7, T12 on T7 and T9, T13 on T7 (earlier phases). T8 has no dependency.

Execution is strictly sequential - there is no intra-phase parallelism; the independent tasks of a phase can run in any order.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: palette, columns, seed | 1 migration with its API constant and sync tests | ✅ Granular |
| T2: account color API | 1 route module | ✅ Granular |
| T3: category color API | 1 route module | ✅ Granular |
| T4: web palette and contract test | 1 module with its 2 tests | ✅ Granular |
| T5: types, clients, mocks | 1 contract change across types, 2 clients and 2 mocks | ✅ Granular |
| T6: ColorPicker | 1 component | ✅ Granular |
| T7: CategoryBadge | 1 component and the option label | ✅ Granular |
| T8: assets and BankIcon | 1 component with 4 vendored files | ✅ Granular |
| T9: AccountLabel and select | 1 component and its select | ✅ Granular |
| T10: account form and list | 1 page with the form field | ✅ Granular |
| T11: category forms and list | 1 page | ✅ Granular |
| T12: extrato account cell | 1 cell in 2 layouts | ✅ Granular |
| T13: import preview cells and browser check | 1 cell and the manual check | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 (previous phase) | ✅ Match |
| T5 | T4 | T4 | ✅ Match |
| T6 | T4 | T4 (earlier phase) | ✅ Match |
| T7 | T4, T5 | T4, T5 (earlier phases) | ✅ Match |
| T8 | None | none | ✅ Match |
| T9 | T4, T5, T8 | T4, T5 (earlier phases), T8 | ✅ Match |
| T10 | T5, T6, T8 | T5, T6, T8 (earlier phases) | ✅ Match |
| T11 | T5, T6, T7 | T5, T6, T7 (earlier phases) | ✅ Match |
| T12 | T7, T9 | T7, T9 (earlier phase) | ✅ Match |
| T13 | T7 | T7 (earlier phase) | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: palette, columns, seed | API pure logic (palette) and SQL migration, RLS | unit + integration | integration (unit tests in Done when) | ✅ OK |
| T2: account color API | API routes, OpenAPI | integration | integration | ✅ OK |
| T3: category color API | API routes, OpenAPI | integration | integration | ✅ OK |
| T4: web palette | Web pure helpers (palette, contract test) | unit | unit | ✅ OK |
| T5: types, clients, mocks | Web types, client calls and mocks | unit when behavior | unit | ✅ OK |
| T6: ColorPicker | Web component | unit | unit | ✅ OK |
| T7: CategoryBadge | Web component and hook | unit | unit | ✅ OK |
| T8: assets and BankIcon | Web component and static assets | unit | unit | ✅ OK |
| T9: AccountLabel and select | Web component and hook | unit | unit | ✅ OK |
| T10: accounts page and form | Web page and form | unit | unit | ✅ OK |
| T11: categories page | Web page and form | unit | unit | ✅ OK |
| T12: extrato account cell | Web page | unit | unit | ✅ OK |
| T13: import preview cells | Web component | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| COLOR-01 | T1, T4 |
| COLOR-02 | T1 |
| COLOR-03 | T1 |
| COLOR-04 | T2 |
| COLOR-05 | T3 |
| COLOR-06 | T2, T3, T4, T5 |
| COLOR-07 | T6 |
| COLOR-08 | T10, T11 |
| COLOR-09 | T4, T7 |
| COLOR-10 | T7, T11, T12, T13 |
| ICON-01 | T8 |
| ICON-02 | T8 |
| ICON-03 | T9, T10, T12 |
| ICON-04 | T9, T10 |

**Notes for the worker**: `api/openapi.json` is regenerated by `pnpm -C api openapi:export` (T2, T3), never edited by hand; the web contract test (T4) reads it. The palette key list exists three times (SQL domain, `api/src/lib/palette.ts`, `web/src/features/colors/palette.ts`); never add a fourth place, and keep the order identical in the two TypeScript files. Every Tailwind class in `COLOR_CLASSES` must be a complete literal string; do not build classes with template strings. Do not edit `0002`..`0007`: the new behavior of `seed_categories` is a `create or replace` in `0008`. The SVGs are used only as `<img>` through the Vite import; never inline them and never copy other files from the logo repository. The Neon `viewBox` edit and every other change to the vendored files go in the `NOTICE`. `CategoryOptionLabel` stays the single place that renders a category option; `AccountLabel` is the single place that renders an account option or cell. Color and bank for the extrato come from the account and category lists in cache, not from the transactions API (that contract does not change). Test determinism: no sleeps, no raised timeouts, no `pickDate`-style slow helpers; budget the picker tests for a two-suite run (L-027).

# Extrato: filtros salvos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/saved-filters/design.md`
**Status**: Implemented (the independent Verifier has not run yet; the owner's browser check stays open)

**Feature prerequisites**: `transactions-list` implemented on `feat/transactions-list` (branch `feat/saved-filters` is stacked on it). Web only: no API, no database, no migration, `pnpm -C api typecheck` untouched. No push, no `db reset`, nothing touches the hosted Supabase or Vercel, `web/.env.local` is not touched, and no agent logs in to the app.

---

## Test Coverage Matrix

> Generated from the codebase, the spec and the design - confirm before Execute. Guidelines found: none beyond the test config (`web/vitest.config.ts`), the `package.json` scripts, `web/AGENTS.md` (feature folders, transaction list state as TanStack Query state, mocks resolving relations from their area mocks) and the confirmed lessons L-004, L-013 and L-027 plus the candidates L-020, L-039, L-040, L-041 and L-043 - strong defaults applied. Floor taken from the existing tests (`web/src/features/transactions/extrato*.test.tsx`, `usePageSize.test.ts`, `Pagination.test.tsx`, `web/src/features/auth/useSession.test.tsx`, `web/src/components/ui/toaster.test.tsx`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Web pure modules (`savedFilterState.ts`, `savedFilters.ts`) | unit | All branches; 1:1 to spec ACs; every listed edge case; invalid JSON, wrong shape, version mismatch, quota exceeded, blocked storage, duplicate names (case, accent, spaces), the cap and per-user isolation; the literal storage key asserted at least once (L-043) | `web/src/features/transactions/savedFilter*.test.ts` | `yarn --cwd web test` |
| Web hooks (`useSavedFilters`, `useSessionUserId`, `notifyErrorMessage`) | unit | Spec-visible behavior per AC through `renderHook` and the real Toaster; the failure and user-change paths | `web/src/features/**/*.test.ts(x)`, `web/src/lib/notifyErrorMessage.test.tsx` | `yarn --cwd web test` |
| Web presentational components (`SaveFilterDialog`, `SavedFiltersMenu`, `ManageFiltersDialog`) | unit | Each rendered alone with the real hook in a small harness: validation text, focus, keyboard, aria, failure paths asserting the Portuguese text and the visible options (L-013); no page, light (L-027) | `web/src/features/transactions/*.test.tsx` | `yarn --cwd web test` |
| Web container and extrato mount (`SavedFiltersControls`, `TransactionsPage`) | unit | Toasts, apply semantics and the marker at the container; at the page only what needs it: controls updated, exact request parameters through the `apiSpy` log, page 1 from page 2, no new request, page size kept; every test uses `lightList` and starts a return to page 1 from page 2 (L-041) | `web/src/features/transactions/*.test.tsx` | `yarn --cwd web test` |
| Styles, config | none | - (build gate only; the painted colors of the menu, the marker and the dialogs are measured in a real Chromium page and the facts are recorded, L-040) | - | build gate only |

## Gate Check Commands

> Generated from the codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After every task (web unit tests only) | `yarn --cwd web test` |
| Full | Not used: the feature has no API or integration layer | - |
| Build | After phase completion and at the end (three runs in a row, plus one with two suites in parallel) | `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test`, with `pnpm -C api typecheck` left untouched |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order. The 10 tasks would pack into two batches; the owner asked for no sub-agents, so a single agent executes them inline, in order.

### Phase 1: State and storage modules

```
T1 → T2
```

### Phase 2: Hooks

```
T3
T4
T5
```

### Phase 3: Components

```
T6
T7
T8
```

### Phase 4: Container and extrato

```
T9 → T10
```

---

## Task Breakdown

### Phase 1: State and storage modules

### T1: Add the saved filter state module

**What**: `savedFilterState.ts` with `SavedFilterState`, `toSavedState`, `toFilterState`, `sanitizeSavedState`, `isDefaultState`, `sameSavedState`, `withoutMissingRefs` and `describeSavedState`, and unit tests in `savedFilterState.test.ts`.
**Where**: `web/src/features/transactions/savedFilterState.ts`
**Depends on**: None
**Reuses**: `FilterState`, `QuickMonth` and `monthRange` of `utils.ts`, `TransactionFilters` of `types.ts`
**Requirement**: SFILT-01, SFILT-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `toSavedState` of a state with every field, page 3 and a page size has exactly the keys `q`, `type`, `accountId`, `categoryId`, `neutral`, `from`, `to`, `quick`, `sort` and `order`, and no `page` or `pageSize`; empty fields are absent (AC 1 of the state story)
- [x] `q` is stored trimmed and a blank `q` is absent (AC 2)
- [x] A complete quick month is stored as `quick` with `from` and `to` of `monthRange`; a quick month with only the year or only the month is not stored (AC 3)
- [x] `toFilterState` is on page 1, with `sort` and `order` of the saved state and `date`/`desc` when they are missing (AC 4), and gives `quick` and the month's `from`/`to` for a saved quick month and an empty `quick` otherwise (AC 5)
- [x] `isDefaultState` is true for the initial state and for a lone incomplete quick month, and false for each of the ten fields set (and for `sort` or `order` different from `date`/`desc`) (AC 6)
- [x] `sameSavedState` is true across page, page size, incomplete quick month, key order and blank `q`, and false when any of the ten fields differs, `neutral` false against absent included (AC 7)
- [x] `withoutMissingRefs` drops an `accountId` or `categoryId` that is not in the known set and reports which, keeps it when the set is absent, and keeps it when present (AC 8)
- [x] `describeSavedState` gives the exact Portuguese lines (`Busca: ...`, `Tipo: Receita`, `Conta: ...`, `Categoria: ...`, `Neutra: Sim`, `De: 01/06/2026`, `Até: 30/06/2026`, `Mês: Junho de 2026` instead of De and Até, `Ordenação: Valor (crescente)`), the fallbacks `Conta selecionada` and `Categoria selecionada`, and no line for page or page size (AC 9)
- [x] `sanitizeSavedState` drops unknown fields, turns an invalid `type`, `neutral`, id, `q`, date, `quick`, `sort` and `order` into absent (`sort`/`order` into the defaults) and keeps the valid ones (AC 5 and 6 of the storage story, field level)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 923 web tests pass (877 existing plus 46 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the saved filter state module`

---

### T2: Add the saved filters storage module

**What**: `savedFilters.ts` with the per-user key, the versioned JSON, the validation of everything read, the name rules, the cap and `addSavedFilter`, `renameSavedFilter`, `deleteSavedFilter`, `readSavedFilters`, `sortSavedFilters`, `normalizeFilterName` and `FILTER_MESSAGES`, all in `try/catch`; unit tests in `savedFilters.test.ts`.
**Where**: `web/src/features/transactions/savedFilters.ts`
**Depends on**: T1
**Reuses**: `sanitizeSavedState` of T1, the `try/catch` shape of `usePageSize.ts`
**Requirement**: SFILT-02, SFILT-03, SFILT-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The key is exactly `financials:transactions:saved-filters:<userId>` asserted as a literal text, and the stored text parses to `{ version: 1, filters: [{ id, name, state }] }` with no extra field (AC 1 of the storage story)
- [x] Text that is not JSON, JSON that is not an object, `filters` that is not a list and `version` 2 each read as an empty list with `available` true and no throw (AC 2)
- [x] An entry that is not an object, has no valid `id` or has an invalid name is dropped and the others stay; duplicate `id` and duplicate name keep the first; 25 entries keep the first 20 (AC 3 and 4)
- [x] Unknown fields of an entry are dropped, an invalid state field reads as absent and a state with only some fields reads with the others empty (AC 5 and 6)
- [x] `getItem` throwing, and `localStorage` itself throwing on access, read as an empty list with `available` false and no throw (AC 7)
- [x] User A's filters are invisible to user B on the same storage, and an action of one does not change the other's list (AC 8); an empty user id reads empty and unavailable and every action fails with `storage` without touching the storage (AC 9)
- [x] The name is trimmed before validating and stored trimmed; an empty one fails with `invalid-name` and "Informe um nome para o filtro"; 41 characters fail with "O nome deve ter no máximo 40 caracteres" while 1 and exactly 40 pass (AC 1 to 3 of the names story)
- [x] "Mês atual" against "mes  ATUAL" and " MÊS atual" fails with `duplicate-name` and "Já existe um filtro salvo com esse nome"; renaming a filter to its own name in another case, accent or spacing succeeds (AC 4 and 5)
- [x] The 21st filter fails with `limit` and "Limite de 20 filtros salvos atingido. Exclua um para salvar outro."; after one is deleted saving succeeds (AC 6)
- [x] Saving appends one entry with the trimmed name and the state without a page, leaving the others intact; renaming changes only that `id`'s name; deleting removes only that `id`; an unknown `id` fails with `not-found` and writes nothing (AC 7 to 10)
- [x] An entry another tab wrote between two actions counts for the duplicate check and the cap and is kept (AC 11)
- [x] `setItem` throwing (quota or blocked) fails with `storage` and the storage message, and the next read gives the list from before; `getItem` throwing on an action fails with `storage` and nothing is written (AC 12 and 13)
- [x] `sortSavedFilters` orders by name ignoring case and accent (`Água`, `banana`, `Cebola`) and keeps equal names in stored order
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 963 web tests pass (923 after T1 plus 40 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the saved filters storage module`

---

### Phase 2: Hooks

### T3: Add the session user id hook

**What**: `useSessionUserId(): string | null` reading `SessionContext` without throwing, with the context and its types moved from `useSession.tsx` to `sessionContext.ts` (a second function export in `useSession.tsx` would add a `react-refresh` lint warning); tests in `useSessionUserId.test.tsx`.
**Where**: `web/src/features/auth/useSessionUserId.ts`
**Depends on**: None
**Reuses**: `SessionContext` and the supabase mock of `useSession.test.tsx`; `useSession.tsx` itself only changes its imports
**Requirement**: SFILT-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Inside the provider with a session `useSessionUserId()` returns that session's `user.id` (AC 1 of the hook story)
- [x] Inside the provider without a session it returns `null`, and outside any provider it returns `null` without throwing (AC 1)
- [x] `useSession` still throws outside the provider (existing behavior unchanged)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 966 web tests pass (963 after T2 plus 3 new; no silent deletions); lint warnings stay at 7

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add a session user id hook`

---

### T4: Add the saved filters hook

**What**: `useSavedFilters(userId)` returning the alphabetical list, `available`, `atLimit` and `add`, `rename` and `remove`, re-reading after each action; tests in `useSavedFilters.test.ts`.
**Where**: `web/src/features/transactions/useSavedFilters.ts`
**Depends on**: T2
**Reuses**: `readSavedFilters`, `addSavedFilter`, `renameSavedFilter`, `deleteSavedFilter`, `sortSavedFilters` of T2
**Requirement**: SFILT-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The list of the user comes back in alphabetical order by name ignoring case and accent, with `available` true (AC 2 of the hook story)
- [x] `atLimit` is true with 20 filters and false with 19 (AC 2)
- [x] After `add`, `rename` and `remove` the next render has the new list, and each returns the storage result (AC 2 and 3)
- [x] After a `not-found` result the list is re-read (a filter written by hand in the meantime appears) (AC 3)
- [x] Changing the `userId` gives the other user's list; `null` gives an empty list, `available` false and actions that fail with `storage` (AC 4)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 973 web tests pass (966 after T3 plus 7 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the saved filters hook`

---

### T5: Add the error toast with its own text

**What**: `notifyErrorMessage(message: string)` in `notify.ts` (the same `toast.error`), and `notifyErrorMessage.test.tsx` rendering the real Toaster (the existing `notify.test.tsx` stays untouched).
**Where**: `web/src/lib/notify.ts`
**Depends on**: None
**Reuses**: the Toaster pattern of `web/src/components/ui/toaster.test.tsx`, `toast-styles.ts`
**Requirement**: SFILT-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `notifyErrorMessage("texto")` shows a toast with exactly that text and the error type attribute, styled with the error classes of `toast-styles` (the same as `notifyError`) (supports AC 11 of the save story and AC 8 of the manage story)
- [x] `notifyError` is unchanged (its existing tests pass)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 974 web tests pass (973 after T4 plus 1 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add an error toast with its own text`

---

### Phase 3: Components

### T6: Add the save filter dialog

**What**: `SaveFilterDialog` (the "Salvar filtro" button as the dialog trigger, so the focus returns to it; title, labeled name field focused on open, "Filtros que serão salvos" list, Cancelar and Salvar, inline error, limit alert, Enter to save) and its tests with a small harness around the real hook.
**Where**: `web/src/features/transactions/SaveFilterDialog.tsx`
**Depends on**: T2
**Reuses**: `Dialog`, `DialogTrigger`, `Input`, `Label`, `Button`, `FILTER_MESSAGES`, `useSavedFilters` (in the harness)
**Requirement**: SFILT-06, SFILT-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Opening shows the dialog named "Salvar filtro" with a description, the field labeled "Nome do filtro" empty and focused, the list "Filtros que serão salvos" with the lines it was given, and the buttons "Cancelar" and "Salvar" (AC 3 and 4 of the save story, AC 1 of the polish story)
- [x] "Salvar" and Enter in the field each store the filter with the trimmed name, close the dialog and give the focus back to the button that opened it (AC 5)
- [x] An empty, a 41-character and a repeated name keep the dialog open, show the storage message under the field (`role="alert"`, field `aria-invalid="true"`), put the focus back on the field and store nothing (AC 7); typing then clears the message (AC 8)
- [x] "Cancelar" and Esc close without storing, give the focus back to the opening button, and reopening shows the field empty (AC 9)
- [x] With 20 saved filters the dialog shows "Limite de 20 filtros salvos atingido. Exclua um para salvar outro." as an alert and "Salvar" is disabled (AC 10)
- [x] With `setItem` throwing the dialog stays open with the typed name and nothing is stored; the toast itself is the container's (AC 11, dialog side)
- [x] Pressing Enter twice stores one filter (edge case)
- [x] The `disabled` button cannot open the dialog (AC 1 and 2 of the save story, component side)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 987 web tests pass (974 after T5 plus 13 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the save filter dialog`

---

### T7: Add the saved filters menu

**What**: `SavedFiltersMenu` ("Filtros salvos" trigger exposed through `triggerRef`, items in the given order, empty state, applied marker with `aria-current`, "Gerenciar filtros" item) and its tests.
**Where**: `web/src/features/transactions/SavedFiltersMenu.tsx`
**Depends on**: T2
**Reuses**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `Button`, `lucide-react` icons
**Requirement**: SFILT-07, SFILT-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The "Filtros salvos" button opens the menu by Enter, Space and ArrowDown, listing one item per filter in the order given and the final item "Gerenciar filtros" (AC 1 of the menu story; the mouse click is checked in the real Chromium page, since jsdom has no `PointerEvent` and Radix opens on `pointerdown`)
- [x] With no filters the menu shows "Nenhum filtro salvo ainda" and "Gerenciar filtros" is disabled (AC 2)
- [x] The item of an applied filter has `aria-current="true"` and an accessible name ending in "(aplicado)", with the check icon and `font-medium`; the others have neither the attribute nor the suffix (AC 3, AC 2 of the polish story)
- [x] Choosing an item with Enter closes the menu and calls `onApply` with that filter; Esc closes without calling it and gives the focus back to the button (AC 5)
- [x] "Gerenciar filtros" calls `onManage` (AC 6), and the trigger button is handed out through `triggerRef`
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 997 web tests pass (987 after T6 plus 10 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the saved filters menu`

---

### T8: Add the manage filters dialog

**What**: `ManageFiltersDialog` (rows with `Renomear <nome>` and `Excluir <nome>`, inline rename with the same name rules, delete confirmation, empty state, focus returned to `returnFocusRef` on close) and its tests with a small harness around the real hook.
**Where**: `web/src/features/transactions/ManageFiltersDialog.tsx`
**Depends on**: T2
**Reuses**: `Dialog`, `AlertDialog`, `Input`, `Button`, `FILTER_MESSAGES`, the delete pattern of `TransactionsPage.tsx`, `useSavedFilters` (in the harness)
**Requirement**: SFILT-09, SFILT-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The dialog named "Gerenciar filtros" (with a description) lists one row per filter in the order given, each with a name and native buttons named `Renomear <nome>` and `Excluir <nome>` (AC 1 of the manage story, AC 1 and 4 of the polish story)
- [x] `Renomear <nome>` shows the field with the current name selected and focused, and "Salvar nome" and "Cancelar" (AC 2)
- [x] A valid new name (button or Enter) renames only that filter and the row goes back to reading mode with the new name (AC 3)
- [x] An empty, a 41-character and a repeated name keep the editing open with the storage message under the field (`role="alert"`, `aria-invalid="true"`) and change nothing, while the same name in another case, accent or spacing is accepted (AC 4)
- [x] "Cancelar" and Esc in the editing end it without a change and the dialog stays open (AC 5); Esc with no editing closes the dialog and gives the focus back to the "Filtros salvos" button (AC 12, dialog side)
- [x] Typing after a name error clears the message (AC 13), and closing in the middle of an editing and reopening shows the list without it
- [x] `Excluir <nome>` opens `Excluir o filtro "<nome>"?` with "Essa ação não pode ser desfeita.", "Cancelar" and "Excluir" and deletes nothing yet; "Excluir" removes only that filter and closes the confirmation, "Cancelar" keeps it (AC 6 and 7)
- [x] With `setItem` throwing, renaming keeps the editing open and deleting keeps the confirmation open, and the list is as it was (AC 8, dialog side)
- [x] When the filter was removed meanwhile (a `not-found` result) the list is refreshed, the row is gone and an open confirmation closes (AC 9, dialog side)
- [x] With no filters the dialog shows "Nenhum filtro salvo ainda" (AC 10)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 1013 web tests pass (997 after T7 plus 16 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the manage filters dialog`

---

### Phase 4: Container and extrato

### T9: Add the saved filters controls

**What**: `SavedFiltersControls` joining the user id, `useSavedFilters`, the account and category lookups, the three components, the toasts, the applied marker and the missing-reference handling; container tests with a stub state and `onApply`.
**Where**: `web/src/features/transactions/SavedFiltersControls.tsx`
**Depends on**: T1, T3, T4, T5, T6, T7, T8
**Reuses**: `useSessionUserId`, `useSavedFilters`, `toSavedState`, `toFilterState`, `sameSavedState`, `isDefaultState`, `withoutMissingRefs`, `describeSavedState`, `useAccountLookup`, `useCategoryLookup`, `notifySuccess`, `notifyInfo`, `notifyErrorMessage`, `apiSpy`
**Requirement**: SFILT-06, SFILT-07, SFILT-08, SFILT-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Without a user id nothing is rendered (AC 2 of the mount story)
- [x] "Salvar filtro" is disabled for the initial state, for an incomplete quick month and for an inverted period, and enabled for a type filter and for a sort different from date descending (AC 1 and 2 of the save story)
- [x] The dialog lines carry the account nickname and category name from the cached lists, and the fallbacks without them (AC 4 of the save story)
- [x] Saving shows `Filtro "<nome>" salvo`, stores under the literal key of the user, shows the item as applied, and does not call `onApply` (AC 5 and 6)
- [x] A storage failure when saving shows the toast with the storage message and keeps the dialog open (AC 11)
- [x] Applying calls `onApply` with the full `FilterState` of the saved filter (every field, page 1, the month's `from`/`to` for a quick month, default sort when missing) and nothing of the previous state (AC 1 of the apply story, state side)
- [x] A missing account, a missing category and both each apply the rest and show the exact information toast; an inactive account is kept; with the lists not loaded or failed the whole filter is applied with no toast (AC 8 and 9, edge case)
- [x] The applied marker follows `state`: equal state marks the item, a change unmarks it, a page change does not, and two filters with the same state are both marked (AC 3 and 4 of the menu story, edge case)
- [x] Renaming and deleting show `Filtro renomeado para "<nome>"` and `Filtro "<nome>" excluído`; a storage failure shows the storage toast; a `not-found` shows "Esse filtro não existe mais" and refreshes (AC 3, 7 to 9 of the manage story)
- [x] The applied filter keeps its marker when renamed, and deleting it leaves nothing marked and calls no `onApply` (AC 11)
- [x] Closing "Gerenciar filtros" gives the focus back to the "Filtros salvos" button (AC 12)
- [x] With 20 saved filters the save dialog shows the limit and does not save (AC 10 of the save story); saving, applying, renaming and deleting send no API request (AC 3 of the mount story)
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 1040 web tests pass (1013 after T8 plus 27 new; no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): add the saved filters controls`

---

### T10: Mount the saved filters in the extrato

**What**: Render `SavedFiltersControls` after the quick month group in `TransactionsPage.tsx` with `applySaved(next)` (`setState(next)` and `setSearch(next.filters.q ?? "")`); page tests in `extratoSavedFilters.test.tsx` with `lightList`, `fakeClock` and a simulated user.
**Where**: `web/src/features/transactions/TransactionsPage.tsx` (modify)
**Depends on**: T9
**Reuses**: `SavedFiltersControls`, `lightList`, `fakeClock`, `listPaths`, `lastListParams`, `chooseOption`, `advance` of `extratoKit.ts`, `pickDate`, `apiSpy`
**Requirement**: SFILT-08, SFILT-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] With a user id the section "Filtros do extrato" has "Salvar filtro" and "Filtros salvos" after the "Limpar mês" button; without one neither is rendered and the existing extrato tests pass with no assertion weakened (AC 1 and 2 of the mount story)
- [x] From page 2, applying a saved filter sends one list query with exactly the saved parameters plus `page=1` and none of the previous ones, and the search field, "Tipo", "Conta", "Categoria", "Neutra", "De", "Até" and the sort indicator show the saved values (AC 1 to 4 of the apply story)
- [x] A saved quick month shows "Mês" and "Ano" with "De" and "Até" disabled, and applying a filter without one clears a quick month already there (AC 5)
- [x] A saved search shows in the field at once and no second list query goes out 300 ms later; a filter without search empties a typed one (AC 6, edge case)
- [x] The applied filter shows as applied, and changing the Tipo unmarks it (AC 7, AC 4 of the menu story)
- [x] With page size 25 chosen, saving and applying keeps `pageSize=25`, the stored state has no `pageSize`, and applying with size 50 sends none (AC 2 of the apply story, AC 5 of the mount story)
- [x] Saving, listing, applying, renaming and deleting send no request other than the list, summary, accounts and categories queries (AC 3 of the mount story)
- [x] "Limpar filtros" keeps the saved filters in the menu (AC 4)
- [x] With an inverted period "Salvar filtro" is disabled at the page too (AC 2 of the save story)
- [x] `TransactionsPage.tsx` ends at no more than 765 lines
- [x] Gate check passes: `yarn --cwd web test`
- [x] Test count: 1049 web tests pass (1040 after T9 plus 9 new; no silent deletions); `TransactionsPage.tsx` 739 lines (was 740, the month names moved to `savedFilterState.ts`)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saved-filters): mount the saved filters in the extrato`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2
Phase 2:  T3 (independent)  T4 (after T2)  T5 (independent)
Phase 3:  T6 (after T2)  T7 (after T2)  T8 (after T2)
Phase 4:  T9 (after T1, T3 to T8) ------→ T10
```

Execution is strictly sequential, in the order T1 to T10 - there is no intra-phase parallelism.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: state module | 1 pure module with its tests | ✅ Granular |
| T2: storage module | 1 pure module with its tests | ✅ Granular |
| T3: session user id | 1 function | ✅ Granular |
| T4: saved filters hook | 1 hook | ✅ Granular |
| T5: error toast | 1 function | ✅ Granular |
| T6: save dialog | 1 component | ✅ Granular |
| T7: menu | 1 component | ✅ Granular |
| T8: manage dialog | 1 component | ✅ Granular |
| T9: controls | 1 container component | ✅ Granular |
| T10: mount | 1 file, one element and one function | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | None | none | ✅ Match |
| T4 | T2 | earlier phase | ✅ Match |
| T5 | None | none | ✅ Match |
| T6 | T2 | earlier phase | ✅ Match |
| T7 | T2 | earlier phase | ✅ Match |
| T8 | T2 | earlier phase | ✅ Match |
| T9 | T1, T3, T4, T5, T6, T7, T8 | earlier phases | ✅ Match |
| T10 | T9 | T9 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: state module | Web pure modules | unit | unit | ✅ OK |
| T2: storage module | Web pure modules | unit | unit | ✅ OK |
| T3: session user id | Web hooks | unit | unit | ✅ OK |
| T4: saved filters hook | Web hooks | unit | unit | ✅ OK |
| T5: error toast | Web hooks | unit | unit | ✅ OK |
| T6: save dialog | Web presentational components | unit | unit | ✅ OK |
| T7: menu | Web presentational components | unit | unit | ✅ OK |
| T8: manage dialog | Web presentational components | unit | unit | ✅ OK |
| T9: controls | Web container | unit | unit | ✅ OK |
| T10: mount | Web container and extrato mount | unit | unit | ✅ OK |

## Requirement Coverage

| Requirement ID | Tasks |
| -------------- | ----- |
| SFILT-01 | T1 |
| SFILT-02 | T1, T2 |
| SFILT-03 | T2 |
| SFILT-04 | T2 |
| SFILT-05 | T3, T4 |
| SFILT-06 | T5, T6, T9 |
| SFILT-07 | T7, T9 |
| SFILT-08 | T9, T10 |
| SFILT-09 | T8, T9 |
| SFILT-10 | T10 |
| SFILT-11 | T6, T7, T8 |

**Notes for the worker**: web tests that depend on time use the fake `Date` and timers of `fakeClock` (`shouldAdvanceTime`), no fixed sleeps, no raised timeouts, no month or year dropdown of the DatePicker; the page tests use `lightList` (three rows) and every test of a return to page 1 starts from page 2; the components are tested alone before the page. Tests never assert the value of a saved filter's `id`; they read stored filters by name. The saved filters are seeded in page tests with a raw JSON literal in `localStorage`, and the key is asserted as a literal at least once. The user is simulated by mocking the `@/features/auth/useSessionUserId` module; `localStorage` is cleared after each test. Prove each new guard test with a quick mutation in a temporary git worktree on the external volume (never in the real tree, never `git stash`) and record the proof in the commit body. The painted colors of the menu, the applied marker and the dialogs are measured in a real Chromium page (throwaway Vite page, no login) before T10 is committed, and the facts go in the T10 commit body. The boxes "browser check by the owner" of the spec stay open: no agent logs in to the app.

### Painted check (author, real Chromium, no login)

A throwaway Vite page in a temporary git worktree (`.sf-probe` on the external volume, removed afterwards) mounted the real `TransactionsPage` with the app `styles.css` and Tailwind plugin, the mock API (`VITE_MOCK_AREAS=*`), dummy Supabase variables and a fake `SessionContext` value (no sign-in, no credentials). Colors are the browser's painted ones (`getComputedStyle`, composited over the ancestors' backgrounds, WCAG ratio); transitions only advance while the page renders frames, so each measure was taken after a screenshot. Facts, light then dark:

| What | Light | Dark |
| ---- | ----- | ---- |
| Save dialog: title, label, Cancelar | 17.62:1 on `rgb(251,250,247)` | 19.27:1 on `rgb(2,6,24)` |
| Save dialog: description and summary list | 4.56:1 | 7.66:1 |
| Save dialog: name error (`role="alert"`) | 4.57:1 | 6.98:1 |
| Save dialog: Salvar button | 9.25:1 | 11.70:1 |
| Manage dialog: title, field, Cancelar, Salvar nome (editing with error) | 17.62:1, 12.21:1, error 4.57:1 | same tokens as above |
| Menu: item text on `rgb(255,255,255)` / `rgb(15,23,43)` | 20.16:1 | 17.04:1 |
| Menu: applied item (`font-medium`, `bg-muted`, check icon) | 18.40:1 on `rgb(241,245,249)` | 13.97:1 on `rgb(29,41,61)` |
| Invalid name field border (after the `aria-invalid` rule was added) | `oklch(0.577 0.245 27.325)` | not measured |

Also checked in Chromium: a real mouse click on "Filtros salvos" opens the menu (`pointerdown`, which jsdom cannot do); choosing "Gerenciar filtros" opens its dialog and, after Esc, the focus is back on the "Filtros salvos" button; Esc in the rename field ends only the editing, and the next Esc closes the dialog (its `data-state` is `closed` at once, the element leaves the DOM when the exit animation ends); the success toast `Filtro "Despesas do mês" salvo` is green; at 375 px the two buttons sit on one 36 px row (24 to 334 px), the menu opens inside the viewport (24 to 186 px) and the page has no horizontal overflow; at 1440 px the buttons sit right of the quick month group, in the same row. The marker is not color-only: the check icon and the heavier weight carry it, and the background is a subtle `bg-muted`.

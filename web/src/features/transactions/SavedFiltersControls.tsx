import { useMemo, useRef, useState } from "react";
import { useAccountLookup } from "@/features/accounts/hooks";
import { useSessionUserId } from "@/features/auth/useSessionUserId";
import { useCategoryLookup } from "@/features/categories/hooks";
import { notifyErrorMessage, notifyInfo, notifySuccess } from "@/lib/notify";
import { ManageFiltersDialog } from "./ManageFiltersDialog";
import {
  describeSavedState,
  isDefaultState,
  sameSavedState,
  toFilterState,
  toSavedState,
  withoutMissingRefs,
} from "./savedFilterState";
import type { SavedFilter, SavedFilterResult } from "./savedFilters";
import { SaveFilterDialog } from "./SaveFilterDialog";
import { SavedFiltersMenu } from "./SavedFiltersMenu";
import { useSavedFilters } from "./useSavedFilters";
import type { FilterState } from "./utils";

type Props = {
  /** The filters the extrato is using now. */
  state: FilterState;
  invalidPeriod: boolean;
  /** Replaces every filter of the extrato (and goes back to page 1). */
  onApply: (next: FilterState) => void;
};

const missingMessage = (name: string, missing: Array<"account" | "category">) => {
  const what =
    missing.length === 2
      ? "a conta e a categoria que não existem mais"
      : missing[0] === "account"
        ? "a conta que não existe mais"
        : "a categoria que não existe mais";
  return `Filtro "${name}" aplicado sem ${what}`;
};

/**
 * "Salvar filtro", "Filtros salvos" and "Gerenciar filtros" of the extrato: ties the signed-in user's saved
 * filters to the extrato state, says what happened with toasts, and marks the filter that equals the state.
 * Nothing renders without a user: filters are never kept under a key without an owner.
 */
export function SavedFiltersControls({ state, invalidPeriod, onApply }: Props) {
  const userId = useSessionUserId();
  const saved = useSavedFilters(userId);
  const accounts = useAccountLookup();
  const categories = useCategoryLookup();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const current = useMemo(() => toSavedState(state), [state]);
  const appliedIds = useMemo(
    () =>
      new Set(
        saved.filters.filter((filter) => sameSavedState(filter.state, current)).map((f) => f.id),
      ),
    [saved.filters, current],
  );
  if (userId === null) return null;

  const names = {
    account: current.accountId ? accounts.byId.get(current.accountId)?.nickname : undefined,
    category: current.categoryId ? categories.byId.get(current.categoryId)?.name : undefined,
  };
  const save = (name: string): SavedFilterResult => {
    const result = saved.add(name, current);
    if (result.ok) notifySuccess(`Filtro "${result.filter?.name ?? name.trim()}" salvo`);
    else if (result.reason === "storage") notifyErrorMessage(result.message);
    return result;
  };
  const apply = (filter: SavedFilter) => {
    const { state: resolved, missing } = withoutMissingRefs(filter.state, {
      ...(accounts.ready && { accountIds: new Set(accounts.byId.keys()) }),
      ...(categories.ready && { categoryIds: new Set(categories.byId.keys()) }),
    });
    onApply(toFilterState(resolved));
    if (missing.length > 0) notifyInfo(missingMessage(filter.name, missing));
  };
  const rename = (id: string, name: string): SavedFilterResult => {
    const result = saved.rename(id, name);
    if (result.ok) notifySuccess(`Filtro renomeado para "${result.filter?.name ?? name.trim()}"`);
    else if (result.reason === "storage" || result.reason === "not-found") {
      notifyErrorMessage(result.message);
    }
    return result;
  };
  const remove = (id: string): SavedFilterResult => {
    const name = saved.filters.find((filter) => filter.id === id)?.name ?? "";
    const result = saved.remove(id);
    if (result.ok) notifySuccess(`Filtro "${name}" excluído`);
    else notifyErrorMessage(result.message);
    return result;
  };

  return (
    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-4 xl:justify-end">
      <SaveFilterDialog
        disabled={isDefaultState(current) || invalidPeriod}
        lines={describeSavedState(current, names)}
        atLimit={saved.atLimit}
        onSave={save}
      />
      <SavedFiltersMenu
        filters={saved.filters}
        appliedIds={appliedIds}
        triggerRef={menuTrigger}
        onApply={apply}
        onManage={() => setManageOpen(true)}
      />
      <ManageFiltersDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        returnFocusRef={menuTrigger}
        filters={saved.filters}
        onRename={rename}
        onDelete={remove}
      />
    </div>
  );
}

import { Bookmark, Check, ChevronDown, Settings2 } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedFilter } from "./savedFilters";

type Props = {
  /** In the order they show. */
  filters: SavedFilter[];
  /** The filters whose state equals the current one: marked as applied. */
  appliedIds: ReadonlySet<string>;
  /** The button that opens the menu, for whoever must give the focus back to it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  onApply: (filter: SavedFilter) => void;
  onManage: () => void;
};

/** The "Filtros salvos" button and its menu: one item per saved filter, the applied one marked, and "Gerenciar filtros". */
export function SavedFiltersMenu({ filters, appliedIds, triggerRef, onApply, onManage }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="outline">
          <Bookmark />
          Filtros salvos
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(22rem,90vw)]">
        {filters.length === 0 && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Nenhum filtro salvo ainda
          </DropdownMenuLabel>
        )}
        {filters.map((filter) => {
          const applied = appliedIds.has(filter.id);
          return (
            <DropdownMenuItem
              key={filter.id}
              aria-current={applied ? "true" : undefined}
              className={applied ? "bg-muted font-medium" : undefined}
              onSelect={() => onApply(filter)}
            >
              <Check className={applied ? undefined : "invisible"} />
              <span className="truncate">{filter.name}</span>
              {applied && <span className="sr-only">(aplicado)</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={filters.length === 0} onSelect={onManage}>
          <Settings2 />
          Gerenciar filtros
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageSize } from "@/lib/api/types";
import { pageNumbers } from "./pageNumbers";
import { PAGE_SIZES } from "./usePageSize";

type Props = {
  /** The page shown, starting at 1. */
  page: number;
  /** Rows the filter matches (the list `total`). */
  total: number;
  /** The size the API used for this page: the page count comes from it, not from the select. */
  pageSize: PageSize;
  /** The size the select shows. */
  selectedPageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
};

/** Touch-sized (36 px) buttons for the bar. */
const BUTTON_SIZE = "min-h-9 min-w-9";

/**
 * Position text, rows-per-page select and the page buttons: "Anterior", numbered pages with "…" gaps (first,
 * last, the current one and its neighbors) and "Próxima". The numbered buttons are hidden under 640 px, where
 * the text "Página X de Y" and the two arrows are enough.
 */
export function Pagination({
  page,
  total,
  pageSize,
  selectedPageSize,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label="Paginação do extrato"
      className="flex flex-col gap-3 py-5 text-sm md:flex-row md:items-center md:justify-between"
    >
      <p>
        {total} transações · Página {page} de {pages}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="page-size" className="whitespace-nowrap">
            Itens por página
          </Label>
          <Select
            value={String(selectedPageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
          >
            <SelectTrigger id="page-size" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={BUTTON_SIZE}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers(page, pages).map((entry, index) =>
              entry === "…" ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="px-1 text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={entry}
                  variant={entry === page ? "default" : "outline"}
                  size="sm"
                  className={BUTTON_SIZE}
                  aria-label={`Página ${entry}`}
                  {...(entry === page ? { "aria-current": "page" as const } : {})}
                  onClick={() => entry !== page && onPageChange(entry)}
                >
                  {entry}
                </Button>
              ),
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={BUTTON_SIZE}
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </nav>
  );
}

import { Button } from "@/components/ui/button";
import { useCategories } from "@/features/categories/hooks";
import { formatBRL } from "@/lib/format";
import type { TransactionFilters, TransactionType } from "@/lib/api/types";
import { useTransactionSummary } from "./hooks";
import { balanceClassName, summaryActiveRing, summaryColors } from "./summaryStyles";

type Props = {
  filters: TransactionFilters;
  /** False while the filters cannot be applied (inverted period): nothing is requested. */
  enabled?: boolean;
  /** Receitas and Despesas apply (or, with `undefined`, remove) the type filter. */
  onSelectType: (type: TransactionType | undefined) => void;
  /** Investimentos applies (or, with `undefined`, removes) the category filter. */
  onSelectCategory: (categoryId: string | undefined) => void;
};

const countFormat = new Intl.NumberFormat("pt-BR");

type ValueProps = {
  label: string;
  value: string;
  tone: string;
  /** Present when the figure filters the list; absent for plain text. */
  onToggle?: (() => void) | undefined;
  active?: boolean;
};

/** One labeled figure: a toggle button while it can filter the list, plain text otherwise. */
function Figure({ label, value, tone, onToggle, active = false }: ValueProps) {
  const content = (
    <>
      <span className="block text-sm text-muted-foreground">{label}</span>
      <span className={`block text-lg font-semibold tabular-nums ${tone}`}>{formatBRL(value)}</span>
    </>
  );
  if (!onToggle) return <div className="px-2 py-1">{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-9 rounded-md px-2 py-1 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? summaryActiveRing : ""}`}
    >
      {content}
    </button>
  );
}

/**
 * Totals of the filtered rows, exactly as the API computed them (never summed here): the number of rows in
 * large type and, smaller, what came in, went out, was invested and the balance. Income, expense and
 * investments filter the list when clicked; the balance is text.
 */
export function SummaryCard({ filters, enabled = true, onSelectType, onSelectCategory }: Props) {
  const { data, isLoading, isError, refetch } = useTransactionSummary(filters, enabled);
  const { data: categories } = useCategories();
  // by key, never by name: the name is what the user sees and can be translated or changed
  const investmentsId = categories?.find((category) => category.key === "Investments")?.id;

  let body;
  if (isLoading) {
    body = (
      <div role="status" aria-label="Carregando resumo" className="flex animate-pulse gap-4">
        <div className="h-14 w-24 rounded-md bg-muted" />
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  } else if (isError) {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-destructive">Não foi possível carregar o resumo.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  } else if (data) {
    body = (
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div>
          <p className="text-4xl font-semibold tabular-nums">{countFormat.format(data.count)}</p>
          <p className="text-sm text-muted-foreground">
            {data.count === 1 ? "transação" : "transações"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Figure
            label="Receitas"
            value={data.income}
            tone={summaryColors.income}
            active={filters.type === "Income"}
            onToggle={() => onSelectType(filters.type === "Income" ? undefined : "Income")}
          />
          <Figure
            label="Despesas"
            value={data.expense}
            tone={summaryColors.expense}
            active={filters.type === "Expense"}
            onToggle={() => onSelectType(filters.type === "Expense" ? undefined : "Expense")}
          />
          <Figure
            label="Investimentos"
            value={data.investments}
            tone={summaryColors.investments}
            active={investmentsId !== undefined && filters.categoryId === investmentsId}
            onToggle={
              investmentsId === undefined
                ? undefined
                : () =>
                    onSelectCategory(
                      filters.categoryId === investmentsId ? undefined : investmentsId,
                    )
            }
          />
          <Figure label="Saldo" value={data.balance} tone={balanceClassName(data.balance)} />
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Resumo do extrato" className="border-b py-6">
      <div className="rounded-lg border bg-card p-4 text-card-foreground sm:p-6">{body}</div>
    </section>
  );
}

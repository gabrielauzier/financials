import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./Panel";
import { useLast30Days } from "./hooks";

// Display only: the API already computed the percentage; this just formats it as "+50,0%".
const formatPct = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(1).replace(".", ",")}%`;

export function Last30DaysCard() {
  const { data, isLoading, isError, refetch } = useLast30Days();
  const change = data?.changePct;
  return (
    <Panel
      title="Despesas dos últimos 30 dias"
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    >
      {data && (
        <div className="space-y-2">
          <p className="text-3xl font-semibold">{formatBRL(data.total)}</p>
          {change === null || change === undefined ? (
            <p className="text-sm text-muted-foreground">sem base de comparação</p>
          ) : (
            <p
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                change > 0 && "text-red-600",
                change < 0 && "text-green-600",
                change === 0 && "text-muted-foreground",
              )}
            >
              {change > 0 && <ArrowUpRight aria-hidden="true" className="size-4" />}
              {change < 0 && <ArrowDownRight aria-hidden="true" className="size-4" />}
              <span>{formatPct(change)}</span>
              <span className="font-normal text-muted-foreground">
                em relação aos 30 dias anteriores
              </span>
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

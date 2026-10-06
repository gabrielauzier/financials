import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./Panel";
import { PeriodSelect } from "./PeriodSelect";
import { useCategoryDistribution } from "./hooks";
import { initialPeriod, resolvePeriod } from "./period";
import { positiveShares } from "./shares";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#e11d48", "#65a30d"];

export function CategoryBreakdown() {
  const [state, setState] = useState(initialPeriod);
  const resolved = resolvePeriod(state);
  const period = resolved.status === "ok" ? resolved.period : null;
  const { data, isLoading, isError, refetch } = useCategoryDistribution(period);
  const items = data?.items ?? [];
  const shares = positiveShares(items.map((item) => item.total));
  const positive = items.filter((item) => !item.total.startsWith("-"));

  return (
    <Panel
      title="Gastos por categoria"
      isLoading={period !== null && isLoading}
      isError={period !== null && isError}
      onRetry={() => refetch()}
      actions={
        <PeriodSelect
          id="categories"
          value={state}
          onChange={setState}
          invalid={resolved.status === "invalid"}
        />
      }
    >
      {period === null ? null : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas no período</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="h-64 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={positive.map((item) => ({ name: item.name, value: Number(item.total) }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                >
                  {positive.map((item, index) => (
                    <Cell key={item.categoryId} fill={COLORS[index % COLORS.length] as string} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Percentual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const reversal = item.total.startsWith("-");
                return (
                  <TableRow
                    key={item.categoryId}
                    data-reversal={reversal || undefined}
                    className={cn(
                      reversal &&
                        "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
                    )}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatBRL(item.total)}
                    </TableCell>
                    <TableCell className="text-right">{shares[index] ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { chartColor } from "@/features/colors/palette";
import type { ExpenseTrend } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { Panel } from "./Panel";
import { TrendFilters } from "./TrendFilters";
import { useExpenseTrend } from "./hooks";
import { formatMonth } from "./months";
import { initialTrendPeriod, queryPeriod, resolvePeriod } from "./period";

type Category = ExpenseTrend["categories"][number];
type Row = { label: string; values: Record<string, string> } & Record<string, unknown>;
export type TooltipRow = Pick<Row, "label" | "values">;

// Recharts needs numbers to plot; they are never shown, every label uses the API strings.
const plot = (trend: ExpenseTrend): Row[] =>
  trend.points.map((point) => ({
    ...Object.fromEntries(
      trend.categories.map((category) => [
        category.categoryId,
        Number(point.values[category.categoryId] ?? 0),
      ]),
    ),
    label: formatMonth(point.month),
    values: point.values,
  }));

export function ExpenseTooltip({
  active,
  payload,
  categories,
}: {
  active?: boolean;
  payload?: { payload: TooltipRow }[];
  categories: Category[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  // Only the categories with spending (or a reversal) in the month, in the legend order.
  const shown = categories.filter((category) => {
    const value = row.values[category.categoryId];
    return value !== undefined && !/^-?0+(\.0+)?$/.test(value);
  });
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow">
      <p className="mb-1 font-medium">{row.label}</p>
      {shown.length === 0 && <p className="text-muted-foreground">Sem despesas</p>}
      {shown.map((category) => (
        <p key={category.categoryId} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: chartColor(category.color) }}
          />
          {category.name}: {formatBRL(row.values[category.categoryId] ?? "0.00")}
        </p>
      ))}
    </div>
  );
}

export function ExpenseTrendChart() {
  const [state, setState] = useState(initialTrendPeriod);
  const resolved = resolvePeriod(state);
  const period = queryPeriod(resolved);
  const { data, isLoading, isError, refetch } = useExpenseTrend(period);
  const requested = period !== null;
  const categories = data?.categories ?? [];
  const config: ChartConfig = Object.fromEntries(
    categories.map((category) => [
      category.categoryId,
      { label: category.name, color: chartColor(category.color) },
    ]),
  );
  return (
    <Panel
      title="Tendência de Despesas"
      isLoading={requested && isLoading}
      isError={requested && isError}
      onRetry={() => refetch()}
      actions={
        <TrendFilters
          id="expense-trend"
          value={state}
          onChange={setState}
          invalid={resolved.status === "invalid"}
        />
      }
    >
      {!requested || !data ? null : categories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas no período</p>
      ) : (
        <>
          <div aria-hidden="true">
            <ChartContainer config={config} className="aspect-auto h-80 w-full">
              {/* stackOffset "sign" stacks negative values (the Estorno, a negative amount inside its own
                  category) below the zero line and positive ones above it, so a reversal never eats into
                  the stack of the other categories; it is drawn as the API sent it. */}
              <BarChart data={plot(data)} stackOffset="sign">
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={data.months.length > 12 ? "preserveStartEnd" : 0}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis fontSize={12} width={56} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ExpenseTooltip categories={categories} />} />
                <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
                {categories.map((category) => (
                  <Bar
                    key={category.categoryId}
                    dataKey={category.categoryId}
                    stackId="expenses"
                    // painted at once: the chart is redrawn on every period change
                    isAnimationActive={false}
                    fill={`var(--color-${category.categoryId})`}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </div>
          <Table className="sr-only">
            <caption>
              {resolved.status === "default"
                ? "Despesas por categoria nos últimos 12 meses"
                : "Despesas por categoria no período escolhido"}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                {categories.map((category) => (
                  <TableHead key={category.categoryId}>{category.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.points.map((point) => (
                <TableRow key={point.month}>
                  <TableCell>{formatMonth(point.month)}</TableCell>
                  {categories.map((category) => (
                    <TableCell key={category.categoryId}>
                      {formatBRL(point.values[category.categoryId] ?? "0.00")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Panel>
  );
}

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { balanceClassName, summaryColors } from "@/features/transactions/summaryStyles";
import type { TrendPoint, TrendTotals } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { Panel } from "./Panel";
import { TrendFilters } from "./TrendFilters";
import { useTrend } from "./hooks";
import { formatMonth } from "./months";
import { initialTrendPeriod, queryPeriod, resolvePeriod } from "./period";

const INCOME = "#16a34a";
const EXPENSE = "#dc2626";
const BALANCE = "#2563eb";

// Recharts needs numbers to plot; they are never shown, every label uses the API strings.
const plot = (point: TrendPoint) => ({
  label: formatMonth(point.month),
  income: Number(point.income),
  expense: Number(point.expense),
  balance: Number(point.balance),
  point,
});

type TooltipProps = { active?: boolean; payload?: { payload: ReturnType<typeof plot> }[] };

function TrendTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow">
      <p className="mb-1 font-medium">{row.label}</p>
      <p>Receitas: {formatBRL(row.point.income)}</p>
      <p>Despesas: {formatBRL(row.point.expense)}</p>
      <p>Balanço: {formatBRL(row.point.balance)}</p>
    </div>
  );
}

/** Receitas, despesas and balanço of the period shown, straight from the API `totals`. */
function TrendSummary({ totals }: { totals: TrendTotals }) {
  return (
    <dl
      aria-label="Resumo do período"
      className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3"
    >
      <div>
        <dt className="text-sm text-muted-foreground">Receitas</dt>
        <dd className={`text-lg font-semibold tabular-nums ${summaryColors.income}`}>
          {formatBRL(totals.income)}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Despesas</dt>
        <dd className={`text-lg font-semibold tabular-nums ${summaryColors.expense}`}>
          {formatBRL(totals.expense)}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Balanço</dt>
        <dd className={`text-lg font-semibold tabular-nums ${balanceClassName(totals.balance)}`}>
          {formatBRL(totals.balance)}
        </dd>
      </div>
    </dl>
  );
}

export function TrendChart() {
  const [state, setState] = useState(initialTrendPeriod);
  const resolved = resolvePeriod(state);
  const period = queryPeriod(resolved);
  const { data, isLoading, isError, refetch } = useTrend(period);
  const requested = period !== null;
  const points = data?.points ?? [];
  const caption =
    resolved.status === "default"
      ? "Receitas, despesas e balanço dos últimos 12 meses"
      : "Receitas, despesas e balanço do período escolhido";
  return (
    <Panel
      title="Tendência de 12 meses"
      isLoading={requested && isLoading}
      isError={requested && isError}
      onRetry={() => refetch()}
      actions={
        <TrendFilters
          id="trend"
          value={state}
          onChange={setState}
          invalid={resolved.status === "invalid"}
        />
      }
    >
      {requested && data && (
        <>
          <div className="h-72 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points.map(plot)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={points.length > 12 ? "preserveStartEnd" : 0}
                  fontSize={12}
                />
                <YAxis fontSize={12} width={56} />
                <Tooltip content={<TrendTooltip />} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill={INCOME} />
                <Bar dataKey="expense" name="Despesas" fill={EXPENSE} />
                <Line dataKey="balance" name="Balanço" stroke={BALANCE} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Table className="sr-only">
            <caption>{caption}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Receitas</TableHead>
                <TableHead>Despesas</TableHead>
                <TableHead>Balanço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.month}>
                  <TableCell>{formatMonth(point.month)}</TableCell>
                  <TableCell>{formatBRL(point.income)}</TableCell>
                  <TableCell>{formatBRL(point.expense)}</TableCell>
                  <TableCell>{formatBRL(point.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TrendSummary totals={data.totals} />
        </>
      )}
    </Panel>
  );
}

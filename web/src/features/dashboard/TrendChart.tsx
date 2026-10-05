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
import type { TrendPoint } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { Panel } from "./Panel";
import { useTrend } from "./hooks";
import { formatMonth } from "./months";

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

export function TrendChart() {
  const { data, isLoading, isError, refetch } = useTrend();
  const points = data?.points ?? [];
  return (
    <Panel
      title="Tendência de 12 meses"
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    >
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points.map(plot)}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" interval={0} fontSize={12} />
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
        <caption>Receitas, despesas e balanço dos últimos 12 meses</caption>
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
    </Panel>
  );
}

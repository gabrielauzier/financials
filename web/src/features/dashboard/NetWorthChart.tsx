import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { formatBRL } from "@/lib/format";
import { Panel } from "./Panel";
import { useNetWorth } from "./hooks";
import { formatMonth } from "./months";

type TooltipProps = {
  active?: boolean;
  payload?: { payload: { label: string; raw: string } }[];
};

function NetWorthTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow">
      <p className="mb-1 font-medium">{row.label}</p>
      <p>{formatBRL(row.raw)}</p>
    </div>
  );
}

export function NetWorthChart() {
  const { data, isLoading, isError, refetch } = useNetWorth();
  const series = data?.series ?? [];
  return (
    <Panel title="Patrimônio" isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      {data && (
        <div className="space-y-4">
          <p className="text-3xl font-semibold">{formatBRL(data.current)}</p>
          {series.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Ainda não há movimentações</p>
          ) : (
            <>
              <div className="h-48 w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={series.map((point) => ({
                      label: formatMonth(point.month),
                      // Plotted only; every visible value is the API string.
                      value: Number(point.value),
                      raw: point.value,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} width={56} />
                    <Tooltip content={<NetWorthTooltip />} />
                    <Area dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <Table className="sr-only">
                <caption>Patrimônio acumulado ao fim de cada mês</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Patrimônio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((point) => (
                    <TableRow key={point.month}>
                      <TableCell>{formatMonth(point.month)}</TableCell>
                      <TableCell>{formatBRL(point.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

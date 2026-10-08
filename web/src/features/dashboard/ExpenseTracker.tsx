import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExpenseSearch } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { Panel } from "./Panel";
import { useExpenseSearch } from "./hooks";
import { formatMonth } from "./months";

const MAX_LENGTH = 80;
// Light and dark tones of the line, set through the chart style so the theme picks the right one.
const config: ChartConfig = {
  total: { label: "Total do mês", theme: { light: "#2563eb", dark: "#60a5fa" } },
};

type Row = { label: string; raw: string; total: number };

function SearchTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow">
      <p className="mb-1 font-medium">{row.label}</p>
      <p>{formatBRL(row.raw)}</p>
    </div>
  );
}

const countText = (count: number) =>
  count === 1 ? "1 transação" : `${new Intl.NumberFormat("pt-BR").format(count)} transações`;

function Results({ term, result }: { term: string; result: ExpenseSearch }) {
  if (result.count === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma despesa encontrada para “{term}”
      </p>
    );
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Total acumulado de “{term}”</p>
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(result.total)}</p>
        <p className="text-sm text-muted-foreground">{countText(result.count)}</p>
      </div>
      <div aria-hidden="true">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <LineChart
            // room on the right so the last month label is not cut at the card edge
            margin={{ right: 16 }}
            data={result.points.map((point): Row => ({
              label: formatMonth(point.month),
              // Plotted only; every visible value is the API string.
              total: Number(point.total),
              raw: point.total,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" interval="preserveStartEnd" fontSize={12} />
            <YAxis fontSize={12} width={56} />
            <ChartTooltip content={<SearchTooltip />} />
            <Line
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={{ fill: "var(--color-total)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
      <Table className="sr-only">
        <caption>Total por mês das despesas de “{term}”</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.points.map((point) => (
            <TableRow key={point.month}>
              <TableCell>{formatMonth(point.month)}</TableCell>
              <TableCell>{formatBRL(point.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Follows one expense over time: the text (name or description) is searched only when submitted, so typing
 * alone never queries. The submitted term is what the results belong to, not what the field holds now.
 */
export function ExpenseTracker() {
  const [text, setText] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useExpenseSearch(term);
  const blank = text.trim() === "";
  const submit = () => {
    if (blank) return;
    const next = text.trim();
    // the same term again repeats the search instead of silently doing nothing
    if (next === term) void refetch();
    else setTerm(next);
  };
  return (
    <Panel
      title="Acompanhar Despesas"
      isLoading={term !== null && isLoading}
      isError={term !== null && isError}
      onRetry={() => refetch()}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="expense-tracker-search">Nome ou descrição</Label>
            <Input
              id="expense-tracker-search"
              value={text}
              maxLength={MAX_LENGTH}
              placeholder="Ex.: Netflix"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                // Enter searches like the button (not while an input method is composing text)
                if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
              }}
            />
          </div>
          <Button type="button" disabled={blank} onClick={submit}>
            Pesquisar
          </Button>
        </div>
      }
    >
      {term === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Pesquise uma despesa pelo nome ou pela descrição para ver quanto ela somou mês a mês.
        </p>
      ) : data ? (
        <Results term={term} result={data} />
      ) : null}
    </Panel>
  );
}

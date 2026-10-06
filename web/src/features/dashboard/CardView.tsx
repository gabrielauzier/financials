import { useState } from "react";
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
import { PeriodSelect } from "./PeriodSelect";
import { useCardView } from "./hooks";
import { initialPeriod, resolvePeriod } from "./period";

type Row = { name: string; value: string };

function Section({
  title,
  valueLabel,
  rows,
  empty,
}: {
  title: string;
  valueLabel: string;
  rows: Row[];
  empty: string;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">{valueLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {formatBRL(row.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

export function CardView() {
  const [state, setState] = useState(initialPeriod);
  const resolved = resolvePeriod(state);
  const period = resolved.status === "ok" ? resolved.period : null;
  const { data, isLoading, isError, refetch } = useCardView(period);
  return (
    <Panel
      title="Visão do cartão"
      isLoading={period !== null && isLoading}
      isError={period !== null && isError}
      onRetry={() => refetch()}
      actions={
        <PeriodSelect
          id="card"
          value={state}
          onChange={setState}
          invalid={resolved.status === "invalid"}
        />
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Valores do cartão não somam nos totais de receitas, despesas e patrimônio.
      </p>
      {period !== null && data && (
        <div className="grid gap-6 md:grid-cols-2">
          <Section
            title="Compras no cartão por categoria"
            valueLabel="Total"
            rows={data.transactions.map((item) => ({ name: item.categoryName, value: item.total }))}
            empty="Sem compras no cartão no período"
          />
          <Section
            title="Parcelas e recorrências a pagar"
            valueLabel="Restante"
            rows={data.creditExpenses.map((item) => ({
              name: item.categoryName,
              value: item.remaining,
            }))}
            empty="Sem parcelas ou recorrências a pagar"
          />
        </div>
      )}
    </Panel>
  );
}

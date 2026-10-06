import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paymentMethodLabels, transactionTypeLabels } from "@/features/transactions/labels";
import { formatBRL } from "@/lib/format";
import type { ImportPreview, ImportRowStatus, PreviewRow } from "@/lib/api/types";
import { formatLocalDate, importStatusLabels } from "./labels";
import { isSelectable, type PreviewSelection } from "./previewSelection";

type ImportPreviewTableProps = {
  preview: ImportPreview;
  selection: PreviewSelection;
  onSelectionChange: (selection: PreviewSelection) => void;
};

const totalsOrder: Array<[ImportRowStatus, string]> = [
  ["new", "novas"],
  ["duplicate", "duplicadas"],
  ["ignored", "ignoradas"],
  ["unrecognized", "não reconhecidas"],
  ["invalid", "inválidas"],
];

const statusVariant: Record<ImportRowStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    new: "default",
    duplicate: "secondary",
    ignored: "outline",
    unrecognized: "outline",
    invalid: "destructive",
  };

const signedAmount = (row: PreviewRow) =>
  formatBRL(row.type === "Expense" && !row.amount.startsWith("-") ? `-${row.amount}` : row.amount);

export function ImportPreviewTable({
  preview,
  selection,
  onSelectionChange,
}: ImportPreviewTableProps) {
  // A row missing from `selection` is shown, and edited, with the neutral value the preview sent.
  const choiceOf = (row: PreviewRow) =>
    selection[row.index] ?? { selected: false, neutral: row.neutral };
  const update = (row: PreviewRow, patch: Partial<PreviewSelection[number]>) => {
    onSelectionChange({ ...selection, [row.index]: { ...choiceOf(row), ...patch } });
  };
  const selectedCount = preview.rows.filter(
    (row) => isSelectable(row.status) && selection[row.index]?.selected,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-label="Resumo da prévia">
        {totalsOrder.map(([status, label]) => (
          <li key={status}>
            <span className="font-semibold">{preview.totals[status]}</span> {label}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Transferências entre suas próprias contas são marcadas como neutras automaticamente.
      </p>
      <p className="text-sm font-medium" aria-live="polite">
        {selectedCount === 1 ? "1 linha selecionada" : `${selectedCount} linhas selecionadas`}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Selecionar</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Neutra</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row) => {
            const selectable = isSelectable(row.status);
            const choice = choiceOf(row);
            return (
              <TableRow
                key={row.index}
                data-status={row.status}
                className={row.status === "unrecognized" ? "bg-amber-50 dark:bg-amber-950/30" : ""}
              >
                <TableCell>
                  {selectable ? (
                    <Checkbox
                      aria-label={`Selecionar ${row.name}`}
                      checked={choice.selected}
                      onCheckedChange={(checked) => update(row, { selected: checked === true })}
                    />
                  ) : null}
                </TableCell>
                <TableCell>{formatLocalDate(row.localDate)}</TableCell>
                <TableCell>
                  {row.name}
                  {row.status === "unrecognized" ? (
                    <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">
                      Revise esta linha
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{paymentMethodLabels[row.paymentMethod]}</TableCell>
                <TableCell>{row.categoryName}</TableCell>
                <TableCell>{transactionTypeLabels[row.type]}</TableCell>
                <TableCell className="text-right tabular-nums">{signedAmount(row)}</TableCell>
                <TableCell>
                  {selectable ? (
                    <Switch
                      aria-label={`Marcar ${row.name} como neutra`}
                      checked={choice.neutral}
                      onCheckedChange={(neutral) => update(row, { neutral })}
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[row.status]} title={row.reason}>
                    {importStatusLabels[row.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

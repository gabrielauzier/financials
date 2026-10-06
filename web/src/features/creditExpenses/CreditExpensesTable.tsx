import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreditExpense, CreditExpenseStatus } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { creditExpenseStatuses, creditExpenseStatusLabels } from "./labels";

type Props = {
  items: CreditExpense[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  status: CreditExpenseStatus | undefined;
  onStatusChange: (status: CreditExpenseStatus | undefined) => void;
  onEdit: (item: CreditExpense) => void;
  onDelete: (item: CreditExpense) => void;
  /** Replaces the status badge, e.g. with an editable select. */
  renderStatus?: (item: CreditExpense) => ReactNode;
};

const ALL = "all";

export function CreditExpensesTable({
  items,
  isLoading,
  isError,
  onRetry,
  status,
  onStatusChange,
  onEdit,
  onDelete,
  renderStatus = (item) => (
    <Badge variant="secondary">{creditExpenseStatusLabels[item.status]}</Badge>
  ),
}: Props) {
  return (
    <div>
      <div className="max-w-xs space-y-2 border-b py-6">
        <Label htmlFor="credit-expense-status-filter">Status</Label>
        <Select
          value={status ?? ALL}
          onValueChange={(value) =>
            onStatusChange(value === ALL ? undefined : (value as CreditExpenseStatus))
          }
        >
          <SelectTrigger id="credit-expense-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {creditExpenseStatuses.map((value) => (
              <SelectItem key={value} value={value}>
                {creditExpenseStatusLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading && (
        <p className="py-10 text-sm text-muted-foreground">Carregando despesas de cartão…</p>
      )}
      {isError && (
        <div className="flex items-center gap-3 py-10">
          <p className="text-sm text-destructive">
            Não foi possível carregar as despesas de cartão.
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="border-b py-12 text-center text-sm text-muted-foreground">
          Nenhuma despesa de cartão cadastrada.
        </p>
      )}
      {items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto border-b md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>Valor pago</TableHead>
                  <TableHead>Restante</TableHead>
                  <TableHead>Dia da fatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-40 font-medium">{item.name}</TableCell>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatBRL(item.totalAmount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatBRL(item.paidAmount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">
                      {formatBRL(item.remainingAmount)}
                    </TableCell>
                    <TableCell>{item.recurrencyDay}</TableCell>
                    <TableCell className="min-w-56">{renderStatus(item)}</TableCell>
                    <TableCell className="max-w-48 truncate">{item.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Actions item={item} onEdit={onEdit} onDelete={onDelete} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y border-b md:hidden">
            {items.map((item) => (
              <article key={item.id} className="space-y-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="text-sm text-muted-foreground">{item.categoryName}</p>
                  </div>
                  <Actions item={item} onEdit={onEdit} onDelete={onDelete} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Valor total</dt>
                    <dd>{formatBRL(item.totalAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Valor pago</dt>
                    <dd>{formatBRL(item.paidAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Restante</dt>
                    <dd className="font-semibold">{formatBRL(item.remainingAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dia da fatura</dt>
                    <dd>{item.recurrencyDay}</dd>
                  </div>
                </dl>
                {renderStatus(item)}
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Actions({
  item,
  onEdit,
  onDelete,
}: {
  item: CreditExpense;
  onEdit: (item: CreditExpense) => void;
  onDelete: (item: CreditExpense) => void;
}) {
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${item.name}`}
        onClick={() => onEdit(item)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Excluir ${item.name}`}
        onClick={() => onDelete(item)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

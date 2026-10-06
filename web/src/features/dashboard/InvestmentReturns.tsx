import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { messageForError } from "@/lib/api/errorMessages";
import type { InvestmentReturn } from "@/lib/api/types";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./Panel";
import { useDeleteInvestmentReturn, useInvestmentReturns } from "./hooks";
import { InvestmentReturnForm } from "./InvestmentReturnForm";
import { daysSince, formatIsoDate } from "./isoDate";

const STALE_AFTER_DAYS = 30;

export function InvestmentReturns() {
  const { data, isLoading, isError, refetch } = useInvestmentReturns();
  const remove = useDeleteInvestmentReturn();
  const [editing, setEditing] = useState<InvestmentReturn>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<InvestmentReturn>();
  const [actionError, setActionError] = useState("");
  const items = data?.items ?? [];
  const lastDate = data?.lastDate ?? null;
  const stale = lastDate !== null && daysSince(lastDate) > STALE_AFTER_DAYS;

  return (
    <Panel
      title="Rendimentos de investimentos"
      isLoading={isLoading}
      // A failed background refetch keeps the rows already shown (e.g. after a rolled-back edit).
      isError={isError && !data}
      onRetry={() => refetch()}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus />
          Novo rendimento
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aportes e resgates não alteram o patrimônio; lance aqui o ganho ou a perda dos seus
          investimentos.
        </p>
        {lastDate !== null && (
          <p
            data-stale={stale || undefined}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              stale
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                : "text-muted-foreground",
            )}
          >
            Último lançamento em {formatIsoDate(lastDate)}
            {stale && <strong className="ml-2 font-semibold">Atualize seus rendimentos</strong>}
          </p>
        )}
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum rendimento lançado
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const negative = item.amount.startsWith("-");
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatIsoDate(item.occurredOn)}
                      </TableCell>
                      <TableCell>{item.accountNickname}</TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-medium",
                          negative ? "text-red-600" : "text-green-600",
                        )}
                      >
                        {negative ? "" : "+"}
                        {formatBRL(item.amount)}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{item.notes ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar rendimento de ${formatIsoDate(item.occurredOn)}`}
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir rendimento de ${formatIsoDate(item.occurredOn)}`}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <InvestmentReturnForm
        open={formOpen}
        onOpenChange={setFormOpen}
        {...(editing ? { investmentReturn: editing } : {})}
      />
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este rendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O patrimônio será recalculado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                setActionError("");
                try {
                  await remove.mutateAsync(deleting.id);
                  setDeleting(undefined);
                } catch (reason) {
                  setActionError(messageForError(reason, "investmentReturn"));
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

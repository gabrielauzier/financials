import { useState } from "react";
import { Plus } from "lucide-react";
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
import { messageForError } from "@/lib/api/errorMessages";
import type { CreditExpense, CreditExpenseStatus } from "@/lib/api/types";
import { CreditExpenseForm } from "./CreditExpenseForm";
import { CreditExpensesTable } from "./CreditExpensesTable";
import { useCreditExpenses, useDeleteCreditExpense } from "./hooks";
import { StatusSelect } from "./StatusSelect";

export function CreditExpensesPage() {
  const [status, setStatus] = useState<CreditExpenseStatus>();
  const [editing, setEditing] = useState<CreditExpense>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CreditExpense>();
  const [actionError, setActionError] = useState("");
  const { data, isLoading, isError, refetch } = useCreditExpenses({ status });
  const remove = useDeleteCreditExpense();

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent-foreground">Controle manual</p>
          <h1 className="mt-1 text-3xl font-semibold">Cartão de crédito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estes valores não entram no dashboard de receitas, despesas nem patrimônio.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status e valor pago são atualizados manualmente.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nova despesa
        </Button>
      </header>
      {actionError && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {actionError}
        </p>
      )}
      <CreditExpensesTable
        items={data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        status={status}
        onStatusChange={setStatus}
        onEdit={(item) => {
          setEditing(item);
          setFormOpen(true);
        }}
        onDelete={setDeleting}
        renderStatus={(item) => <StatusSelect expense={item} />}
      />
      <CreditExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        {...(editing ? { expense: editing } : {})}
      />
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta despesa?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
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
                  setActionError(messageForError(reason, "creditExpense"));
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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

type DuplicateConfirmDialogProps = {
  open: boolean;
  /** Number of selected rows that were already imported. */
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function DuplicateConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
  disabled = false,
}: DuplicateConfirmDialogProps) {
  const sentence =
    count === 1
      ? "1 linha selecionada já foi importada antes"
      : `${count} linhas selecionadas já foram importadas antes`;
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importar linhas duplicadas?</AlertDialogTitle>
          <AlertDialogDescription>
            {sentence}. Importar mesmo assim cria transações repetidas no extrato.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={onConfirm}>
            Importar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

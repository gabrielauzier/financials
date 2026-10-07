import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Small "x" button that clears one filter; its name is "Limpar filtro <label>". */
export function ClearButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className ?? "size-5 rounded-full text-muted-foreground"}
      aria-label={`Limpar filtro ${label}`}
      onClick={onClick}
    >
      <X className="size-3" />
    </Button>
  );
}

type Props = {
  label: string;
  id: string;
  /** Present only while the filter is active; renders the "x" beside the label. */
  onClear?: (() => void) | undefined;
  /** Name used in the button when it differs from the visible label ("Mês rápido" beside "Mês"). */
  clearLabel?: string;
  children: React.ReactNode;
};
/** A filter control with its label and, while the filter is active, an "x" that clears only that filter. */
export function FilterField({ label, id, onClear, clearLabel, children }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {onClear && <ClearButton label={clearLabel ?? label} onClick={onClear} />}
      </div>
      {children}
    </div>
  );
}

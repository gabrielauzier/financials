import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FILTER_MESSAGES, type SavedFilterResult } from "./savedFilters";

type Props = {
  /** The "Salvar filtro" button is off (no filter applied, or an inverted period). */
  disabled: boolean;
  /** What will be saved, one line per applied filter (and the sort). */
  lines: string[];
  /** The user already has the most filters allowed: the message shows and saving is off. */
  atLimit: boolean;
  /** Saves under the given name; a storage failure is reported by the caller (toast), the rest shows here. */
  onSave: (name: string) => SavedFilterResult;
};

/**
 * The "Salvar filtro" button and the dialog it opens: asks for the name, showing what will be saved and why a
 * name is refused. The button is the dialog's trigger, so the focus comes back to it when the dialog closes.
 */
export function SaveFilterDialog({ disabled, lines, atLimit, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setName("");
      setError(undefined);
    }
  }, [open]);

  const save = () => {
    if (atLimit) return;
    const result = onSave(name);
    if (result.ok) {
      setOpen(false);
      return;
    }
    // the caller already told about a storage failure; the dialog stays open with the typed name
    if (result.reason === "storage") return;
    setError(result.message);
    input.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Save />
          Salvar filtro
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Salvar filtro</DialogTitle>
          <DialogDescription>
            Dê um nome aos filtros aplicados para aplicá-los de novo com um clique.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="save-filter-name">Nome do filtro</Label>
          <Input
            id="save-filter-name"
            ref={input}
            className="aria-[invalid=true]:border-destructive"
            value={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "save-filter-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              save();
            }}
          />
          {error && (
            <p id="save-filter-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p id="save-filter-summary" className="text-sm font-medium">
            Filtros que serão salvos
          </p>
          <ul
            aria-labelledby="save-filter-summary"
            className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground"
          >
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {atLimit && (
          <p role="alert" className="text-sm text-destructive">
            {FILTER_MESSAGES.limit}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={atLimit} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

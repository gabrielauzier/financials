import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatLocalDate, parseLocalDate } from "./date-picker-utils";

type Props = {
  id?: string;
  /** `YYYY-MM-DD`, or `""` when empty. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  "aria-label"?: string;
};

/** Calendar date picker (pt-BR) that hands back the chosen local day as `YYYY-MM-DD`. */
export function DatePicker({
  id,
  value,
  onChange,
  disabled = false,
  clearable = true,
  placeholder = "Selecione a data",
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const date = parseLocalDate(value);
  const thisYear = new Date().getFullYear();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(thisYear + 5, 11)}
          {...(date ? { selected: date, defaultMonth: date } : {})}
          onSelect={(picked) => {
            // clicking the selected day again deselects it in react-day-picker: keep the value
            if (!picked) return;
            onChange(formatLocalDate(picked));
            setOpen(false);
          }}
        />
        {date && clearable && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

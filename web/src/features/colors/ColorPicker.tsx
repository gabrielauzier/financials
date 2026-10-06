import { useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  COLOR_KEYS,
  DEFAULT_COLOR,
  colorClasses,
  colorLabel,
  isColorKey,
  type ColorKey,
} from "./palette";

const COLUMNS = 6;
const LAST = COLOR_KEYS.length - 1;

type ColorPickerProps = {
  /** Accepts an unknown key (a future API version): the trigger falls back to the default color. */
  value: string;
  onChange: (key: ColorKey) => void;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

/** Trigger plus popover with the 66-color palette as a radio group (2D arrow-key navigation). */
export function ColorPicker({ value, onChange, id, disabled, ariaLabel }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedIndex = isColorKey(value) ? COLOR_KEYS.indexOf(value) : -1;
  const [focusIndex, setFocusIndex] = useState(Math.max(selectedIndex, 0));
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const shown: ColorKey = isColorKey(value) ? value : DEFAULT_COLOR;

  const handleOpenChange = (next: boolean) => {
    if (next) setFocusIndex(Math.max(selectedIndex, 0));
    setOpen(next);
  };

  const choose = (key: ColorKey) => {
    onChange(key);
    setOpen(false);
  };

  const moveTo = (index: number) => {
    setFocusIndex(index);
    radios.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = COLOR_KEYS[index];
    if (!key) return;
    const target: Record<string, number> = {
      ArrowRight: Math.min(index + 1, LAST),
      ArrowLeft: Math.max(index - 1, 0),
      ArrowDown: index + COLUMNS <= LAST ? index + COLUMNS : index,
      ArrowUp: index - COLUMNS >= 0 ? index - COLUMNS : index,
      Home: 0,
      End: LAST,
    };
    const next = target[event.key];
    if (next !== undefined) {
      event.preventDefault();
      moveTo(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(key);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className="w-full justify-start font-normal"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-4 rounded-full ring-1 ring-black/10 dark:ring-white/25",
              colorClasses(shown).bg,
            )}
          />
          {colorLabel(shown)}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          radios.current[Math.max(selectedIndex, 0)]?.focus();
        }}
      >
        <div role="radiogroup" aria-label="Paleta de cores" className="grid grid-cols-6 gap-1">
          {COLOR_KEYS.map((key, index) => {
            const classes = colorClasses(key);
            const checked = index === selectedIndex;
            return (
              <button
                key={key}
                ref={(node) => {
                  radios.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={colorLabel(key)}
                tabIndex={index === focusIndex ? 0 : -1}
                onClick={() => choose(key)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md ring-1 ring-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:ring-white/25",
                  classes.bg,
                  checked && "ring-2 ring-ring ring-offset-2",
                )}
              >
                {checked ? (
                  <Check aria-hidden="true" className={cn("size-4", classes.text)} />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

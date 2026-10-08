import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES } from "@/features/transactions/savedFilterState";
import { monthRange } from "@/features/transactions/utils";
import { useYears } from "./hooks";
import {
  periodKeys,
  periodLabels,
  trendPeriodKeys,
  type PeriodKey,
  type PeriodState,
} from "./period";

type Props = {
  /** Unique per panel: prefixes the control ids. */
  id: string;
  value: PeriodState;
  onChange: (value: PeriodState) => void;
  invalid?: boolean;
  /** Trend cards also offer "Últimos 12 meses" (the default: no period is sent). */
  allowRolling?: boolean;
};

/** The user's years with transactions plus the current year (and the chosen one), newest first. */
const yearOptions = (years: number[], chosen: number | null, current: number) =>
  [...new Set([...years, current, ...(chosen === null ? [] : [chosen])])].sort((a, b) => b - a);

export function PeriodSelect({ id, value, onChange, invalid, allowRolling = false }: Props) {
  const byMonth = value.key === "monthYear";
  const custom = value.key === "custom";
  // The years are only needed once the month/year choice is on screen.
  const { data } = useYears(byMonth);
  const range =
    byMonth && value.month !== null && value.year !== null
      ? monthRange(value.year, value.month)
      : null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-period`}>Período</Label>
        <Select
          value={value.key}
          onValueChange={(key) => onChange({ ...value, key: key as PeriodKey })}
        >
          <SelectTrigger id={`${id}-period`} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(allowRolling ? trendPeriodKeys : periodKeys).map((key) => (
              <SelectItem key={key} value={key}>
                {periodLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(custom || byMonth) && (
        <>
          {/* De/Até and Mês/Ano exclude each other: only the mode that is on is editable */}
          <div className="space-y-1">
            <Label htmlFor={`${id}-from`}>De</Label>
            <DatePicker
              id={`${id}-from`}
              value={byMonth ? (range?.from ?? "") : value.from}
              disabled={byMonth}
              onChange={(from) => onChange({ ...value, from })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-to`}>Até</Label>
            <DatePicker
              id={`${id}-to`}
              value={byMonth ? (range?.to ?? "") : value.to}
              disabled={byMonth}
              onChange={(to) => onChange({ ...value, to })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-month`}>Mês</Label>
            <Select
              disabled={custom}
              value={value.month === null ? "" : String(value.month)}
              onValueChange={(month) => onChange({ ...value, month: Number(month) })}
            >
              <SelectTrigger id={`${id}-month`} className="w-36">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, index) => (
                  <SelectItem key={name} value={String(index + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-year`}>Ano</Label>
            <Select
              disabled={custom}
              value={value.year === null ? "" : String(value.year)}
              onValueChange={(year) => onChange({ ...value, year: Number(year) })}
            >
              <SelectTrigger id={`${id}-year`} className="w-28">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions(data?.years ?? [], value.year, new Date().getFullYear()).map(
                  (year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          Período inválido
        </p>
      )}
    </div>
  );
}

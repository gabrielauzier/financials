import { Button } from "@/components/ui/button";
import { PeriodSelect } from "./PeriodSelect";
import { useYears } from "./hooks";
import {
  initialPeriod,
  initialTrendPeriod,
  shownPeriod,
  yearPeriod,
  type PeriodState,
} from "./period";

type Props = {
  /** Unique per panel: prefixes the control ids. */
  id: string;
  value: PeriodState;
  onChange: (value: PeriodState) => void;
  invalid: boolean;
};

/**
 * Filters of the trend cards: the period select (default: the rolling 12 months) and one shortcut per year the
 * user has transactions in. A year shortcut is a full-year custom period, so it shows up in De/Até; it is the
 * active one while the period shown is exactly that year, and clicking it again goes back to the default.
 */
export function TrendFilters({ id, value, onChange, invalid }: Props) {
  const { data } = useYears();
  const shown = shownPeriod(value);
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect id={id} value={value} onChange={onChange} invalid={invalid} allowRolling />
      {data && data.years.length > 0 && (
        <div role="group" aria-label="Atalhos de ano" className="flex flex-wrap gap-2">
          {data.years.map((year) => {
            const range = yearPeriod(year);
            const active = shown?.from === range.from && shown.to === range.to;
            return (
              <Button
                key={year}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? initialTrendPeriod() : { ...initialPeriod("custom"), ...range })
                }
              >
                {year}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

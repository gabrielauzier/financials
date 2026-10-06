import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodKeys, periodLabels, type PeriodKey, type PeriodState } from "./period";

type Props = {
  /** Unique per panel: prefixes the control ids. */
  id: string;
  value: PeriodState;
  onChange: (value: PeriodState) => void;
  invalid?: boolean;
};

export function PeriodSelect({ id, value, onChange, invalid }: Props) {
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
            {periodKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {periodLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.key === "custom" && (
        <>
          <div className="space-y-1">
            <Label htmlFor={`${id}-from`}>De</Label>
            <Input
              id={`${id}-from`}
              type="date"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-to`}>Até</Label>
            <Input
              id={`${id}-to`}
              type="date"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
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

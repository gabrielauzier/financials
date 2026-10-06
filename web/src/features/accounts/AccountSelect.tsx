import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountLabel } from "./AccountLabel";
import { useAccounts } from "./hooks";

type AccountSelectProps = {
  value?: string | undefined;
  onChange: (id: string) => void;
  includeInactive?: boolean;
  id?: string;
  disabled?: boolean;
};

export function AccountSelect({
  value,
  onChange,
  includeInactive = false,
  id,
  disabled,
}: AccountSelectProps) {
  const { data = [], isLoading } = useAccounts(includeInactive ? {} : { active: true });
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={isLoading ? "Carregando contas…" : "Selecione uma conta"} />
      </SelectTrigger>
      <SelectContent>
        {data.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <AccountLabel account={account} showInactive />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "./hooks";

type CategorySelectProps = {
  value?: string | undefined;
  onChange: (id: string) => void;
  id?: string;
  disabled?: boolean;
  excludeId?: string | undefined;
};

export function CategorySelect({ value, onChange, id, disabled, excludeId }: CategorySelectProps) {
  const { data = [], isLoading } = useCategories();
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue
          placeholder={isLoading ? "Carregando categorias…" : "Selecione uma categoria"}
        />
      </SelectTrigger>
      <SelectContent>
        {data
          .filter((category) => category.id !== excludeId)
          .map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

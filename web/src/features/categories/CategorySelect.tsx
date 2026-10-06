import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useCategories } from "./hooks";

type CategorySelectProps = {
  value?: string | undefined;
  onChange: (id: string) => void;
  id?: string;
  disabled?: boolean;
  excludeId?: string | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
};

/** The only place that renders an option's content: the select items and the displayed value. */
export function CategoryOptionLabel({ category }: { category: Category }) {
  return <>{category.name}</>;
}

export function CategorySelect({
  value,
  onChange,
  id,
  disabled,
  excludeId,
  ariaLabel,
  className,
}: CategorySelectProps) {
  const { data = [], isLoading } = useCategories();
  return (
    <Select
      value={isLoading ? "" : (value ?? "")}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue
          placeholder={isLoading ? "Carregando categorias…" : "Selecione uma categoria"}
        />
      </SelectTrigger>
      <SelectContent>
        {data
          .filter((category) => category.id !== excludeId)
          .map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <CategoryOptionLabel category={category} />
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

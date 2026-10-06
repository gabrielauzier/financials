import type { Category } from "@/lib/api/types";
import { CategoryBadge } from "./CategoryBadge";

/** The only place that renders an option's content: the select items and the displayed value. */
export function CategoryOptionLabel({ category }: { category: Category }) {
  return <CategoryBadge name={category.name} color={category.color} />;
}

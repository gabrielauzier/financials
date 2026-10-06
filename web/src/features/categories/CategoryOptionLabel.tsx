import type { Category } from "@/lib/api/types";

/** The only place that renders an option's content: the select items and the displayed value. */
export function CategoryOptionLabel({ category }: { category: Category }) {
  return <>{category.name}</>;
}

/**
 * Tables whose rows point at a category. Deleting a category moves these rows to the destination
 * category first. Each referencing table needs the composite FK `(column, user_id)` to
 * `categories (id, user_id)` with `on delete no action`, and RLS like any user-data table.
 *
 * Features register their tables when their module loads (`public.transactions` from the
 * transactions routes). Names are code-defined constants, never user input; queries still quote
 * them as identifiers.
 */
export interface CategoryReference {
  /** Schema-qualified table, e.g. `public.transactions`. */
  table: string;
  column: string;
}

const references: CategoryReference[] = [];

/** Registers a referencing table; returns a function that removes the registration. */
export function registerCategoryReference(reference: CategoryReference): () => void {
  references.push(reference);
  return () => {
    const index = references.indexOf(reference);
    if (index !== -1) references.splice(index, 1);
  };
}

export function categoryReferences(): readonly CategoryReference[] {
  return references;
}

type TransactionCategoryRelations = {
  hasTransactions: (categoryId: string) => boolean;
  reassignTransactions: (fromCategoryId: string, toCategoryId: string) => void;
};

let relations: TransactionCategoryRelations | undefined;

export function registerTransactionCategoryRelations(next: TransactionCategoryRelations) {
  relations = next;
}

export function categoryHasTransactions(categoryId: string) {
  return relations?.hasTransactions(categoryId) ?? false;
}

export function reassignCategoryTransactions(fromCategoryId: string, toCategoryId: string) {
  relations?.reassignTransactions(fromCategoryId, toCategoryId);
}

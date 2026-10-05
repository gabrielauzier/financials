import type { PaymentMethod, TransactionType } from "@/lib/api/types";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  BankTransfer: "Transferência bancária",
  Boleto: "Boleto",
  Cash: "Dinheiro",
  CreditCard: "Cartão de crédito",
  DebitCard: "Cartão de débito",
  NuPay: "NuPay",
  PIX: "PIX",
};
export const transactionTypeLabels: Record<TransactionType, string> = {
  Income: "Receita",
  Expense: "Despesa",
};

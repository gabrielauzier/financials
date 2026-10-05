import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { CreditExpensesPage } from "@/features/creditExpenses/CreditExpensesPage";

export const Route = createFileRoute("/cartao")({
  head: () => ({
    meta: [
      { title: "Cartão de crédito — Financials" },
      { name: "description", content: "Cartão de crédito no Financials." },
      { property: "og:title", content: "Cartão de crédito — Financials" },
      { property: "og:description", content: "Cartão de crédito no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppLayout>
        <CreditExpensesPage />
      </AppLayout>
    </RequireAuth>
  ),
});

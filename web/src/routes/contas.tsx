import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { AccountsPage } from "@/features/accounts/AccountsPage";

export const Route = createFileRoute("/contas")({
  head: () => ({
    meta: [
      { title: "Contas — Financials" },
      { name: "description", content: "Contas no Financials." },
      { property: "og:title", content: "Contas — Financials" },
      { property: "og:description", content: "Contas no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppLayout>
        <AccountsPage />
      </AppLayout>
    </RequireAuth>
  ),
});

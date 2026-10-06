import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Financials" },
      { name: "description", content: "Visão geral das suas finanças no Financials." },
      { property: "og:title", content: "Dashboard — Financials" },
      { property: "og:description", content: "Visão geral das suas finanças no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <RequireAuth>
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    </RequireAuth>
  );
}

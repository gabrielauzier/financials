import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { PlaceholderPage } from "@/features/pages/PlaceholderPage";

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

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <RequireAuth>
      <AppLayout>
        <PlaceholderPage title="Dashboard" />
      </AppLayout>
    </RequireAuth>
  );
}

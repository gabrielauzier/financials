import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { PlaceholderPage } from "@/features/pages/PlaceholderPage";

export const Route = createFileRoute("/extrato")({
  head: () => ({
    meta: [
      { title: "Extrato — Financials" },
      { name: "description", content: "Extrato no Financials." },
      { property: "og:title", content: "Extrato — Financials" },
      { property: "og:description", content: "Extrato no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppLayout>
        <PlaceholderPage title="Extrato" />
      </AppLayout>
    </RequireAuth>
  ),
});

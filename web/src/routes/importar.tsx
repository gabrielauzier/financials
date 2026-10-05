import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { PlaceholderPage } from "@/features/pages/PlaceholderPage";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar — Financials" },
      { name: "description", content: "Importar no Financials." },
      { property: "og:title", content: "Importar — Financials" },
      { property: "og:description", content: "Importar no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppLayout>
        <PlaceholderPage title="Importar" />
      </AppLayout>
    </RequireAuth>
  ),
});

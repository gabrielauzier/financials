import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppLayout } from "@/features/layout/AppLayout";
import { CategoriesPage } from "@/features/categories/CategoriesPage";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Financials" },
      { name: "description", content: "Categorias no Financials." },
      { property: "og:title", content: "Categorias — Financials" },
      { property: "og:description", content: "Categorias no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppLayout>
        <CategoriesPage />
      </AppLayout>
    </RequireAuth>
  ),
});

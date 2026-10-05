import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/features/auth/AuthShell";
import { LoginForm } from "@/features/auth/LoginForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Financials" },
      { name: "description", content: "Entre na sua conta do Financials." },
      { property: "og:title", content: "Entrar — Financials" },
      { property: "og:description", content: "Entre na sua conta do Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  ),
});

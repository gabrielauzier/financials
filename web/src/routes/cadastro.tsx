import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/features/auth/AuthShell";
import { SignupForm } from "@/features/auth/SignupForm";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Financials" },
      { name: "description", content: "Crie sua conta no Financials." },
      { property: "og:title", content: "Criar conta — Financials" },
      { property: "og:description", content: "Crie sua conta no Financials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  ),
});

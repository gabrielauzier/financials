import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "./useSession";

function loginMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  if (code === "invalid_credentials") return "E-mail ou senha incorretos";
  if (code === "email_not_confirmed")
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (status >= 500 || error instanceof TypeError)
    return "Serviço indisponível no momento. Tente novamente em instantes.";
  return "E-mail ou senha incorretos";
}

export function LoginForm() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("senha")));
      await navigate({ to: "/" });
    } catch (reason) {
      setError(loginMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <header>
        <p className="text-sm font-medium text-accent-foreground">Bem-vindo de volta</p>
        <h2 className="mt-2 text-3xl font-semibold">Entre na sua conta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use seus dados para acessar o Financials.
        </p>
      </header>
      <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={error ? "login-error" : undefined}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <Button className="h-11 w-full" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Ainda não tem uma conta?{" "}
        <Link to="/cadastro" className="font-medium text-foreground underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </>
  );
}

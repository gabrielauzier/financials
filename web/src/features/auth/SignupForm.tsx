import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isEmailAlreadyRegistered } from "./emailExists";
import { useSession } from "./useSession";

type Fields = "nome" | "apelido" | "email" | "senha";
type Errors = Partial<Record<Fields | "form", string>>;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const { signUp } = useSession();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      nome: String(data.get("nome")).trim(),
      apelido: String(data.get("apelido")).trim(),
      email: String(data.get("email")).trim(),
      senha: String(data.get("senha")),
    };
    const next: Errors = {};
    if (!values.nome) next.nome = "Informe o nome";
    if (!values.apelido) next.apelido = "Informe o apelido";
    if (!values.email) next.email = "Informe o e-mail";
    else if (!emailPattern.test(values.email)) next.email = "Informe um e-mail válido";
    if (!values.senha) next.senha = "Informe a senha";
    else if (values.senha.length < 8) next.senha = "A senha deve ter pelo menos 8 caracteres";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await signUp(values);
      if (isEmailAlreadyRegistered(result)) {
        setErrors({ email: "E-mail já cadastrado" });
        return;
      }
      if (result.error) {
        const message =
          result.error.code === "user_already_exists"
            ? "E-mail já cadastrado"
            : "Não foi possível enviar o e-mail de confirmação. Tente novamente.";
        setErrors(
          result.error.code === "user_already_exists" ? { email: message } : { form: message },
        );
        return;
      }
      setSuccess(true);
    } catch {
      setErrors({ form: "Não foi possível enviar o e-mail de confirmação. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }
  if (success)
    return (
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <CheckCircle2 />
        </span>
        <h2 className="mt-5 text-3xl font-semibold">Verifique seu e-mail</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enviamos uma mensagem de confirmação. Confirme seu endereço antes de entrar.
        </p>
        <Button asChild className="mt-7 w-full">
          <Link to="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  return (
    <>
      <header>
        <p className="text-sm font-medium text-accent-foreground">Comece agora</p>
        <h2 className="mt-2 text-3xl font-semibold">Crie sua conta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Organize sua vida financeira com tranquilidade.
        </p>
      </header>
      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        {errors.form && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.form}
          </p>
        )}
        {(
          [
            ["nome", "Nome", "text", "Seu nome"],
            ["apelido", "Apelido", "text", "Como quer ser chamado"],
            ["email", "E-mail", "email", "voce@exemplo.com"],
            ["senha", "Senha", "password", "Mínimo de 8 caracteres"],
          ] as const
        ).map(([name, label, type, placeholder]) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              name={name}
              type={type}
              placeholder={placeholder}
              autoComplete={name === "senha" ? "new-password" : name === "email" ? "email" : "off"}
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
            />
            {errors[name] && (
              <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
                {errors[name]}
              </p>
            )}
          </div>
        ))}
        <Button className="h-11 w-full" disabled={submitting}>
          {submitting ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Já tenho conta
        </Link>
      </p>
    </>
  );
}

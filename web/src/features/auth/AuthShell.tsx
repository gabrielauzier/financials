import { Landmark, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AuthShell({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setDark((value) => !value);
  };
  return (
    <main className="relative grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
      <section className="hidden overflow-hidden border-r border-border bg-primary px-14 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="grid size-10 place-items-center rounded-md bg-primary-foreground/10">
            <Landmark aria-hidden="true" />
          </span>
          Financials
        </div>
        <div className="max-w-xl pb-16">
          <p className="mb-5 text-sm font-medium uppercase text-primary-foreground/70">
            Clareza para suas escolhas
          </p>
          <h1 className="text-5xl font-semibold leading-tight">
            Sua vida financeira, organizada em um só lugar.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-primary-foreground/75">
            Acompanhe suas finanças com simplicidade, segurança e uma visão clara do que importa.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">Controle financeiro sem complicação.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-10">
        <Button
          aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
          variant="ghost"
          size="icon"
          className="absolute right-5 top-5"
          onClick={toggleTheme}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 text-lg font-semibold lg:hidden">
            <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Landmark aria-hidden="true" />
            </span>
            Financials
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

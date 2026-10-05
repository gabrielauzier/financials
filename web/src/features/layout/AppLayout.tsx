import { Link, useNavigate } from "@tanstack/react-router";
import {
  CreditCard,
  FileUp,
  LayoutDashboard,
  Landmark,
  List,
  LogOut,
  Menu,
  Tags,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/features/auth/useSession";

const items = [
  { to: "/" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/extrato" as const, label: "Extrato", icon: List },
  { to: "/importar" as const, label: "Importar", icon: FileUp },
  { to: "/cartao" as const, label: "Cartão de crédito", icon: CreditCard },
  { to: "/contas" as const, label: "Contas", icon: WalletCards },
  { to: "/categorias" as const, label: "Categorias", icon: Tags },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="space-y-1">
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function AppLayout({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const nickname = String(
    session?.user.user_metadata?.["nickname"] ?? session?.user.user_metadata?.["name"] ?? "Usuário",
  );
  const leave = async () => {
    await signOut();
    await navigate({ to: "/login", replace: true });
  };
  const footer = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="mb-3 truncate px-3 text-sm font-medium">{nickname}</p>
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground"
        onClick={leave}
      >
        <LogOut />
        Sair
      </Button>
    </div>
  );
  return (
    <div className="min-h-screen bg-muted/35">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar p-5 md:flex md:flex-col">
        <div className="mb-10 flex items-center gap-3 font-semibold">
          <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Landmark className="size-5" />
          </span>
          Financials
        </div>
        <Navigation />
        <div className="mt-auto">{footer}</div>
      </aside>
      <header className="flex h-16 items-center border-b bg-background px-4 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-5">
            <SheetTitle className="mb-8 flex items-center gap-3">
              <Landmark />
              Financials
            </SheetTitle>
            <Navigation />
            <div className="mt-auto">{footer}</div>
          </SheetContent>
        </Sheet>
        <span className="ml-3 font-semibold">Financials</span>
      </header>
      <main className="min-h-screen px-5 py-8 md:ml-64 md:px-10 md:py-12">{children}</main>
    </div>
  );
}

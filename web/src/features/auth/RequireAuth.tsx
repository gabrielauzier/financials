import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession } from "./useSession";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

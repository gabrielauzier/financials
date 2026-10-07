import type { AuthResponse, Session } from "@supabase/supabase-js";
import { createContext } from "react";

export type SignUpInput = { nome: string; apelido: string; email: string; senha: string };
export type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, senha: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

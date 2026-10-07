import { useContext } from "react";
import { SessionContext } from "./sessionContext";

/** The id of the signed-in user, or `null` without a session or outside a `SessionProvider` (never throws). */
export function useSessionUserId(): string | null {
  return useContext(SessionContext)?.session?.user.id ?? null;
}

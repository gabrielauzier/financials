import type { AuthResponse } from "@supabase/supabase-js";

export function isEmailAlreadyRegistered(result: AuthResponse): boolean {
  return Boolean(result.data.user && result.data.user.identities?.length === 0);
}

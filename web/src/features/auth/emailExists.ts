import type { AuthResponse } from "@supabase/supabase-js";

// Supabase hides an existing e-mail: an unconfirmed user comes back as a "new" sign-up whose
// confirmation e-mail was re-sent well after the account was created.
const RESENT_CONFIRMATION_GAP_MS = 1000;

export function isEmailAlreadyRegistered(result: AuthResponse): boolean {
  if (result.error?.code === "user_already_exists") return true;
  const user = result.data?.user;
  if (!user) return false;
  if (Array.isArray(user.identities) && user.identities.length === 0) return true;
  const sentAt = Date.parse(String(user.confirmation_sent_at));
  const createdAt = Date.parse(String(user.created_at));
  return sentAt - createdAt >= RESENT_CONFIRMATION_GAP_MS;
}

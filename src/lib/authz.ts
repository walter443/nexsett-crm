import { createClient } from "@/lib/supabase/server";
import { allowedWorkspaceDomain, isAllowedEmail } from "@/lib/config";
import type { Profile } from "@/lib/types";

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: Profile;
  userId: string;
  email: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as {
    sub?: string;
    email?: string;
    amr?: Array<{ method?: string }>;
  } | undefined;
  const email = claims?.email?.trim().toLowerCase() || "";
  const isGoogleSession = claims?.amr?.some((method) => method.method === "oauth") === true;
  if (error || !claims?.sub || !isAllowedEmail(email) || !isGoogleSession) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .maybeSingle();
  if (
    !profile
    || profile.status !== "Active"
    || !profile.workspace_verified_at
    || profile.email.toLowerCase() !== email
    || !email.endsWith(`@${allowedWorkspaceDomain}`)
  ) return null;
  return {
    supabase,
    profile: profile as Profile,
    userId: claims.sub,
    email
  };
}

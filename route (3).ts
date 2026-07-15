import { NextResponse, type NextRequest } from "next/server";
import { allowedWorkspaceDomain, safeNextPath, siteUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  hd?: string;
  name?: string;
  sub?: string;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const origin = siteUrl;
  const supabase = await createClient();

  async function deny(reason: "workspace" | "uninvited" | "callback") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  if (!code) return deny("callback");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session?.user) return deny("callback");

  const session = data.session;
  const user = session.user;
  const hasGoogleIdentity = user.identities?.some((identity) => identity.provider === "google");
  if (!hasGoogleIdentity) return deny("workspace");

  let googleProfile: GoogleUserInfo = {
    email: user.email,
    email_verified: user.user_metadata?.email_verified,
    hd: user.user_metadata?.hd,
    name: user.user_metadata?.full_name || user.user_metadata?.name
  };

  if (session.provider_token) {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${session.provider_token}` },
      cache: "no-store"
    });
    if (response.ok) googleProfile = await response.json() as GoogleUserInfo;
  }

  const email = googleProfile.email?.trim().toLowerCase() || "";
  const hostedDomain = googleProfile.hd?.trim().toLowerCase() || "";
  if (!googleProfile.email_verified || hostedDomain !== allowedWorkspaceDomain || !email.endsWith(`@${allowedWorkspaceDomain}`)) {
    return deny("workspace");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,email,status,full_name,workspace_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.email.toLowerCase() !== email || profile.status === "Suspended") {
    return deny("uninvited");
  }

  const verifiedAt = new Date().toISOString();
  const { error: verificationError } = await admin
      .from("profiles")
      .update({
        status: "Active",
        full_name: profile.status === "Invited" ? googleProfile.name || profile.full_name : profile.full_name,
        workspace_verified_at: profile.workspace_verified_at || verifiedAt,
        last_sign_in_at: verifiedAt
      })
      .eq("id", user.id);
  if (verificationError) return deny("callback");

  if (profile.status === "Invited") {
    await admin
      .from("invitations")
      .update({ status: "Accepted", accepted_at: verifiedAt })
      .eq("email", email)
      .eq("status", "Pending");
    await admin.from("audit_log").insert({
      actor_id: user.id,
      actor_email: email,
      action: "Activated",
      entity_type: "User",
      entity_id: user.id,
      summary: `${googleProfile.name || profile.full_name} activated Google Workspace access`,
      details: { provider: "google", hosted_domain: hostedDomain }
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}

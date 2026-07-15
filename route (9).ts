import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";
import { siteUrl } from "@/lib/config";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "users.manage")) {
    return NextResponse.json({ error: "You cannot invite users." }, { status: 403 });
  }
  const parsed = invitationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,status")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existingProfile) {
    const message = existingProfile.status === "Active"
      ? "That user already has active access."
      : "That account already exists. Edit it from Users & access instead of creating another invitation.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const invitation = {
    ...parsed.data,
    status: "Pending",
    invited_by: context.userId,
    invited_at: new Date().toISOString(),
    accepted_at: null
  };
  const { error: invitationError } = await admin
    .from("invitations")
    .upsert(invitation, { onConflict: "email" });
  if (invitationError) return NextResponse.json({ error: invitationError.message }, { status: 400 });

  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/login?invited=1`,
    data: { full_name: parsed.data.full_name, invited_to: "Nexsett CRM" }
  });
  if (emailError) {
    return NextResponse.json({ error: `Invitation saved, but email delivery failed: ${emailError.message}` }, { status: 502 });
  }

  await admin.from("audit_log").insert({
    actor_id: context.userId,
    actor_email: context.email,
    action: "Invited",
    entity_type: "User",
    entity_id: parsed.data.email,
    summary: `${parsed.data.full_name} invited as ${parsed.data.role}`,
    details: { team: parsed.data.team, scope: parsed.data.record_scope }
  });
  return NextResponse.json({ invited: true }, { status: 201 });
}

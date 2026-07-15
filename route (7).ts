import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";
import { hasPermission, roleDefault } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PermissionKey, Profile } from "@/lib/types";
import { userUpdateSchema } from "@/lib/validation";

function candidatePermission(candidate: Pick<Profile, "role" | "status" | "permission_overrides">, key: PermissionKey) {
  if (candidate.status !== "Active") return false;
  const override = candidate.permission_overrides[key];
  return typeof override === "boolean" ? override : roleDefault(candidate.role, key);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "users.manage")) {
    return NextResponse.json({ error: "You cannot manage users." }, { status: 403 });
  }
  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const { data: otherProfiles } = await admin.from("profiles").select("role,status,permission_overrides").neq("id", id);
  if (target.role === "Admin" && target.status === "Active" && (parsed.data.role !== "Admin" || parsed.data.status !== "Active")) {
    const otherAdmin = otherProfiles?.some((profile) => profile.role === "Admin" && profile.status === "Active");
    if (!otherAdmin) return NextResponse.json({ error: "Keep at least one active Admin account." }, { status: 409 });
  }
  const candidate = parsed.data as Pick<Profile, "role" | "status" | "permission_overrides">;
  const otherManager = otherProfiles?.some((profile) => candidatePermission(profile as typeof candidate, "users.manage"));
  if (!candidatePermission(candidate, "users.manage") && !otherManager) {
    return NextResponse.json({ error: "Keep at least one active account able to manage users." }, { status: 409 });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: parsed.data.status === "Suspended" ? "876000h" : "none",
    user_metadata: { full_name: parsed.data.full_name }
  });
  await admin.from("audit_log").insert({
    actor_id: context.userId,
    actor_email: context.email,
    action: "Updated",
    entity_type: "User",
    entity_id: id,
    summary: `${parsed.data.full_name} · ${parsed.data.role} · ${parsed.data.status}`,
    details: { team: parsed.data.team, scope: parsed.data.record_scope }
  });
  if (authError) {
    return NextResponse.json({
      error: `The CRM access record was updated, but the authentication account could not be synchronised: ${authError.message}`
    }, { status: 502 });
  }
  return NextResponse.json({ user: data });
}

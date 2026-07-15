import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { commissionPlanSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "settings.manage")) {
    return NextResponse.json({ error: "You cannot publish Commission Plans." }, { status: 403 });
  }
  const parsed = commissionPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("commission_plans")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 400 });
  const { data, error } = await admin.from("commission_plans").insert({
    version: Number(current?.version || 0) + 1,
    published_by: context.userId,
    ...parsed.data
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("audit_log").insert({
    actor_id: context.userId,
    actor_email: context.email,
    action: "Published",
    entity_type: "Commission Plan",
    entity_id: String(data.version),
    summary: `Commission Plan v${data.version}`,
    details: { change_reason: data.change_reason, material_threshold: data.material_threshold }
  });
  return NextResponse.json({ plan: data }, { status: 201 });
}

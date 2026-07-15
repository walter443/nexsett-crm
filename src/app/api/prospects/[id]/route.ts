import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";
import { deliverNotificationsBestEffort } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";
import { prospectSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "prospects.edit")) {
    return NextResponse.json({ error: "You cannot edit prospects." }, { status: 403 });
  }
  const parsed = prospectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const payload: Record<string, unknown> = {
    ...parsed.data,
    contact_email: parsed.data.contact_email || null,
    commission_suggested_category_id: parsed.data.commission_suggested_category_id || null,
    commission_category_id: parsed.data.commission_category_id || null,
    approval_date: parsed.data.approval_date || null,
    next_action_date: parsed.data.next_action_date || null
  };
  if (!hasPermission(context.profile, "prospects.reassign")) delete payload.owner_id;
  if (!hasPermission(context.profile, "commissions.manage")) {
    [
      "commission_category_id", "incremental_annual_net_revenue", "strategic_rate", "strategic_years",
      "team_deal", "contributors", "allocation_confirmed"
    ].forEach((key) => delete payload[key]);
  }
  if (!hasPermission(context.profile, "approvals.manage")) {
    ["approval_status", "approval_date", "approval_evidence"].forEach((key) => delete payload[key]);
  }
  if (!(hasPermission(context.profile, "commissions.manage") && hasPermission(context.profile, "approvals.manage"))) {
    delete payload.commission_review_notes;
    if (["Approved", "Rejected"].includes(parsed.data.commission_review_status)) {
      delete payload.commission_review_status;
    }
  }
  const { id } = await params;
  const { data, error } = await context.supabase.from("prospects").update(payload).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) return NextResponse.json({ error: "Prospect not found in your scope." }, { status: 404 });
  const notification = await deliverNotificationsBestEffort(10);
  return NextResponse.json({ prospect: data, notification });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "prospects.delete")) {
    return NextResponse.json({ error: "You cannot delete prospects." }, { status: 403 });
  }
  const { id } = await params;
  const { data, error } = await context.supabase.from("prospects").delete().eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) return NextResponse.json({ error: "Prospect not found in your scope." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

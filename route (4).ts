import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";
import { deliverNotificationsBestEffort } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";
import { prospectSchema } from "@/lib/validation";

function databasePayload(input: ReturnType<typeof prospectSchema.parse>) {
  return {
    ...input,
    contact_email: input.contact_email || null,
    commission_suggested_category_id: input.commission_suggested_category_id || null,
    commission_category_id: input.commission_category_id || null,
    approval_date: input.approval_date || null,
    next_action_date: input.next_action_date || null
  };
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(context.profile, "prospects.create")) {
    return NextResponse.json({ error: "You cannot create prospects." }, { status: 403 });
  }

  const parsed = prospectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (["Approved", "Rejected"].includes(parsed.data.commission_review_status)) {
    return NextResponse.json({ error: "Create the prospect as Pending so an authorised reviewer can record the decision." }, { status: 400 });
  }
  const payload = databasePayload(parsed.data);
  if (!hasPermission(context.profile, "prospects.reassign")) payload.owner_id = context.userId;
  if (!hasPermission(context.profile, "commissions.manage")) {
    payload.commission_category_id = null;
    payload.contributors = [];
    payload.team_deal = false;
    payload.allocation_confirmed = false;
  }
  if (!hasPermission(context.profile, "approvals.manage")) {
    payload.approval_status = "Not required";
    payload.approval_date = null;
    payload.approval_evidence = "";
  }
  if (!(hasPermission(context.profile, "commissions.manage") && hasPermission(context.profile, "approvals.manage"))) {
    payload.commission_review_notes = "";
  }

  const { data, error } = await context.supabase.from("prospects").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  const notification = await deliverNotificationsBestEffort(10);
  return NextResponse.json({ prospect: data, notification }, { status: 201 });
}

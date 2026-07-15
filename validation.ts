import { z } from "zod";
import { allowedWorkspaceDomain } from "@/lib/config";
import { permissionDefinitions } from "@/lib/permissions";

const optionalEmail = z.union([z.literal(""), z.string().email()]);
const dateOrEmpty = z.union([z.literal(""), z.iso.date()]);
const permissionKeys = permissionDefinitions.map((permission) => permission.id);

export const contributorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  split: z.number().min(0).max(100)
});

export const prospectSchema = z.object({
  organisation: z.string().trim().min(1).max(200),
  organisation_type: z.string().trim().min(1).max(120),
  country: z.string().trim().max(120),
  corridor: z.string().trim().max(180),
  stage: z.enum(["Identify", "Engage", "Qualify", "Execute"]),
  outcome: z.enum(["Open", "On hold", "Live", "Closed — lost"]),
  owner_id: z.uuid(),
  source: z.string().trim().max(160),
  provider: z.string().trim().max(160),
  contact_name: z.string().trim().max(160),
  contact_email: optionalEmail,
  monthly_volume: z.number().min(0).max(1_000_000_000),
  average_transaction: z.number().min(0).max(1_000_000_000),
  expected_annual_net_revenue: z.number().min(0).max(1_000_000_000_000),
  probability: z.number().min(0).max(100),
  repeat_corridor: z.boolean(),
  authorised_contact: z.boolean(),
  opportunity_case: z.string().trim().max(5_000),
  commission_review_status: z.enum(["Not requested", "Pending", "Approved", "Rejected"]),
  commission_suggested_category_id: z.union([z.literal(""), z.string().trim().min(1).max(100), z.null()]),
  commission_request_notes: z.string().trim().max(5_000),
  commission_review_notes: z.string().trim().max(5_000),
  commission_category_id: z.union([z.literal(""), z.string().trim().min(1).max(100), z.null()]),
  incremental_annual_net_revenue: z.number().min(0).max(1_000_000_000_000),
  strategic_rate: z.number().min(0).max(100),
  strategic_years: z.number().int().min(1).max(10),
  team_deal: z.boolean(),
  contributors: z.array(contributorSchema).max(20),
  allocation_confirmed: z.boolean(),
  approval_status: z.enum(["Not required", "Pending", "Approved", "Rejected"]),
  approval_date: dateOrEmpty,
  approval_evidence: z.string().trim().max(5_000),
  next_action: z.string().trim().max(500),
  next_action_date: dateOrEmpty
}).superRefine((value, context) => {
  if (value.commission_category_id && value.contributors.length) {
    const total = value.contributors.reduce((sum, contributor) => sum + contributor.split, 0);
    if (Math.abs(total - 100) > 0.01) {
      context.addIssue({ code: "custom", message: "Commission allocations must total 100%.", path: ["contributors"] });
    }
  }
  if (value.approval_status === "Approved" && (!value.approval_date || !value.approval_evidence)) {
    context.addIssue({ code: "custom", message: "Approved opportunities need a date and written evidence.", path: ["approval_status"] });
  }
  if (value.commission_review_status === "Approved" && !value.commission_category_id) {
    context.addIssue({ code: "custom", message: "Choose the approved commission category before approving the review.", path: ["commission_category_id"] });
  }
  if (value.commission_review_status === "Rejected" && !value.commission_review_notes) {
    context.addIssue({ code: "custom", message: "Explain why the commission request was rejected.", path: ["commission_review_notes"] });
  }
});

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().refine(
    (email) => email.endsWith(`@${allowedWorkspaceDomain}`),
    `Use a ${allowedWorkspaceDomain} email address.`
  ),
  full_name: z.string().trim().min(1).max(160),
  team: z.string().trim().max(120),
  role: z.enum(["Sales", "Manager", "Admin"]),
  record_scope: z.enum(["own", "team", "all"]),
  permission_overrides: z.record(z.string(), z.boolean()).refine(
    (overrides) => Object.keys(overrides).every((key) => permissionKeys.includes(key as never)),
    "An unknown permission override was supplied."
  )
});

export const userUpdateSchema = invitationSchema.omit({ email: true }).extend({
  status: z.enum(["Invited", "Active", "Suspended"])
});

export const commissionBandSchema = z.object({
  label: z.string().trim().min(1).max(100),
  rate: z.number().min(0).max(100)
});

export const commissionCategorySchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  name: z.string().trim().min(1).max(160),
  basis: z.enum(["total", "incremental"]),
  schedule: z.array(commissionBandSchema).max(10),
  approvalRequired: z.boolean(),
  bespoke: z.boolean(),
  introProtectionMonths: z.number().int().min(0).max(120),
  active: z.boolean(),
  notes: z.string().trim().max(2_000)
}).superRefine((value, context) => {
  if (!value.bespoke && !value.schedule.length) {
    context.addIssue({ code: "custom", message: "A non-bespoke category needs at least one rate band.", path: ["schedule"] });
  }
});

export const commissionPlanSchema = z.object({
  material_threshold: z.number().min(0).max(1_000_000_000_000),
  change_reason: z.string().trim().min(3).max(500),
  categories: z.array(commissionCategorySchema).min(1).max(30)
});

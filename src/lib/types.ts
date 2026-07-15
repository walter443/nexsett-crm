export type Role = "Sales" | "Manager" | "Admin";
export type RecordScope = "own" | "team" | "all";
export type UserStatus = "Invited" | "Active" | "Suspended";
export type CommissionReviewStatus = "Not requested" | "Pending" | "Approved" | "Rejected";

export type PermissionKey =
  | "prospects.create"
  | "prospects.edit"
  | "prospects.delete"
  | "prospects.reassign"
  | "commissions.view"
  | "commissions.manage"
  | "approvals.manage"
  | "settings.manage"
  | "data.export"
  | "users.manage"
  | "audit.view";

export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  team: string;
  role: Role;
  record_scope: RecordScope;
  status: UserStatus;
  workspace_verified_at: string | null;
  last_sign_in_at: string | null;
  permission_overrides: PermissionOverrides;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionBand {
  label: string;
  rate: number;
}

export interface CommissionCategory {
  id: string;
  name: string;
  basis: "total" | "incremental";
  schedule: CommissionBand[];
  approvalRequired: boolean;
  bespoke: boolean;
  introProtectionMonths: number;
  active: boolean;
  notes: string;
}

export interface CommissionPlan {
  version: number;
  material_threshold: number;
  change_reason: string;
  categories: CommissionCategory[];
  published_by: string | null;
  published_at: string;
}

export interface Contributor {
  name: string;
  split: number;
}

export interface Prospect {
  id: string;
  reference_code: string;
  organisation: string;
  organisation_type: string;
  country: string;
  corridor: string;
  stage: "Identify" | "Engage" | "Qualify" | "Execute";
  outcome: "Open" | "On hold" | "Live" | "Closed — lost";
  owner_id: string;
  source: string;
  provider: string;
  contact_name: string;
  contact_email: string | null;
  monthly_volume: number;
  average_transaction: number;
  expected_annual_net_revenue: number;
  probability: number;
  repeat_corridor: boolean;
  authorised_contact: boolean;
  opportunity_case: string;
  commission_review_status: CommissionReviewStatus;
  commission_suggested_category_id: string | null;
  commission_request_notes: string;
  commission_requested_by: string | null;
  commission_requested_at: string | null;
  commission_reviewed_by: string | null;
  commission_reviewed_at: string | null;
  commission_review_notes: string;
  commission_review_iteration: number;
  commission_category_id: string | null;
  commission_plan_version: number | null;
  commission_material_threshold: number | null;
  commission_rule_snapshot: CommissionCategory | null;
  incremental_annual_net_revenue: number;
  strategic_rate: number;
  strategic_years: number;
  team_deal: boolean;
  contributors: Contributor[];
  allocation_confirmed: boolean;
  approval_status: "Not required" | "Pending" | "Approved" | "Rejected";
  approval_date: string | null;
  approval_evidence: string;
  next_action: string;
  next_action_date: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ProspectInput {
  organisation: string;
  organisation_type: string;
  country: string;
  corridor: string;
  stage: Prospect["stage"];
  outcome: Prospect["outcome"];
  owner_id: string;
  source: string;
  provider: string;
  contact_name: string;
  contact_email: string;
  monthly_volume: number;
  average_transaction: number;
  expected_annual_net_revenue: number;
  probability: number;
  repeat_corridor: boolean;
  authorised_contact: boolean;
  opportunity_case: string;
  commission_review_status: CommissionReviewStatus;
  commission_suggested_category_id: string | null;
  commission_request_notes: string;
  commission_review_notes: string;
  commission_category_id: string | null;
  incremental_annual_net_revenue: number;
  strategic_rate: number;
  strategic_years: number;
  team_deal: boolean;
  contributors: Contributor[];
  allocation_confirmed: boolean;
  approval_status: Prospect["approval_status"];
  approval_date: string;
  approval_evidence: string;
  next_action: string;
  next_action_date: string;
}

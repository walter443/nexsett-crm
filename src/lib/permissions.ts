import type { PermissionKey, Profile, Role } from "@/lib/types";

export const permissionDefinitions: Array<{
  id: PermissionKey;
  group: string;
  label: string;
}> = [
  { id: "prospects.create", group: "Prospects", label: "Create prospects" },
  { id: "prospects.edit", group: "Prospects", label: "Edit visible prospects" },
  { id: "prospects.delete", group: "Prospects", label: "Delete prospects" },
  { id: "prospects.reassign", group: "Prospects", label: "Reassign ownership" },
  { id: "commissions.view", group: "Commissions", label: "View commission forecasts" },
  { id: "commissions.manage", group: "Commissions", label: "Manage opportunity commissions" },
  { id: "approvals.manage", group: "Governance", label: "Manage approvals" },
  { id: "settings.manage", group: "Governance", label: "Publish Commission Plans" },
  { id: "data.export", group: "Data", label: "Export scoped data" },
  { id: "users.manage", group: "Administration", label: "Manage users and permissions" },
  { id: "audit.view", group: "Administration", label: "View audit history" }
];

const sales = new Set<PermissionKey>([
  "prospects.create",
  "prospects.edit",
  "commissions.view"
]);

const manager = new Set<PermissionKey>([
  "prospects.create",
  "prospects.edit",
  "prospects.reassign",
  "commissions.view",
  "commissions.manage",
  "approvals.manage",
  "data.export",
  "audit.view"
]);

export function roleDefault(role: Role, permission: PermissionKey): boolean {
  if (role === "Admin") return true;
  if (role === "Manager") return manager.has(permission);
  return sales.has(permission);
}

export function hasPermission(profile: Profile, permission: PermissionKey): boolean {
  if (profile.status !== "Active") return false;
  const override = profile.permission_overrides?.[permission];
  return typeof override === "boolean" ? override : roleDefault(profile.role, permission);
}

export function scopeLabel(scope: Profile["record_scope"]): string {
  if (scope === "all") return "All records";
  if (scope === "team") return "Team records";
  return "Own records";
}

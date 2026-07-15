export const allowedWorkspaceDomain = (
  process.env.ALLOWED_GOOGLE_WORKSPACE_DOMAIN || "nexsett.com"
).trim().toLowerCase();

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export function isAllowedEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && Boolean(parts[0]) && parts[1] === allowedWorkspaceDomain;
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

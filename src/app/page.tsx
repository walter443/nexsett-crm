import { redirect } from "next/navigation";
import { CrmShell } from "@/components/crm-shell";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { AuditEntry, CommissionPlan, Profile, Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ prospect?: string; review?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profileData || profileData.status !== "Active") redirect("/login?error=uninvited");
  const profile = profileData as Profile;

  const [prospectsResult, usersResult, plansResult, auditResult] = await Promise.all([
    supabase.from("prospects").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
    supabase.from("commission_plans").select("*").order("version", { ascending: false }),
    hasPermission(profile, "audit.view")
      ? supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null })
  ]);

  return (
    <CrmShell
      profile={profile}
      initialProspects={(prospectsResult.data || []) as Prospect[]}
      initialUsers={(usersResult.data || []) as Profile[]}
      initialPlans={(plansResult.data || []) as CommissionPlan[]}
      initialAudit={(auditResult.data || []) as AuditEntry[]}
      initialProspectId={query.review === "commission" ? query.prospect : undefined}
    />
  );
}

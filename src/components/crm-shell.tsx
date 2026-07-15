"use client";

import { useMemo, useState } from "react";
import {
  BadgePoundSterling,
  BellRing,
  Building2,
  Database,
  Download,
  History,
  LayoutDashboard,
  Plus,
  Settings2,
  ShieldCheck,
  Users
} from "lucide-react";
import { PlanDialog } from "@/components/plan-dialog";
import { ProspectDialog } from "@/components/prospect-dialog";
import { UserDialog } from "@/components/user-dialog";
import { hasPermission, scopeLabel } from "@/lib/permissions";
import type { AuditEntry, CommissionPlan, Profile, Prospect } from "@/lib/types";

type View = "dashboard" | "prospects" | "reviews" | "commissions" | "settings" | "users" | "audit" | "data";

const viewMeta: Record<View, [string, string]> = {
  dashboard: ["Commercial overview", "Pipeline dashboard"],
  prospects: ["Opportunity management", "Prospects"],
  reviews: ["Commission governance", "Commission review queue"],
  commissions: ["Commercial governance", "Commission register"],
  settings: ["Versioned commercial rules", "Commission settings"],
  users: ["Secure administration", "Users & permissions"],
  audit: ["Accountability", "Audit history"],
  data: ["Scoped reporting", "Data export"]
};

const stages: Prospect["stage"][] = ["Identify", "Engage", "Qualify", "Execute"];

const money = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const compactMoney = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1
}).format(Number(value) || 0);

const date = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : "Not set";

function commissionPool(prospect: Prospect) {
  const rule = prospect.commission_rule_snapshot;
  if (!rule) return 0;
  const annual = rule.basis === "incremental"
    ? Number(prospect.incremental_annual_net_revenue) || 0
    : Number(prospect.expected_annual_net_revenue) || 0;
  const schedule = rule.bespoke
    ? Array.from({ length: prospect.strategic_years }, () => ({ rate: prospect.strategic_rate }))
    : rule.schedule;
  return schedule.reduce((sum, band) => sum + annual * Number(band.rate || 0) / 100, 0);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function CrmShell({
  profile,
  initialProspects,
  initialUsers,
  initialPlans,
  initialAudit,
  initialProspectId
}: {
  profile: Profile;
  initialProspects: Prospect[];
  initialUsers: Profile[];
  initialPlans: CommissionPlan[];
  initialAudit: AuditEntry[];
  initialProspectId?: string;
}) {
  const canManageReviews = hasPermission(profile, "commissions.manage") && hasPermission(profile, "approvals.manage");
  const linkedProspect = initialProspects.find((prospect) => prospect.id === initialProspectId);
  const [view, setView] = useState<View>(linkedProspect && canManageReviews ? "reviews" : "dashboard");
  const [prospects, setProspects] = useState(initialProspects);
  const [users, setUsers] = useState(initialUsers);
  const [plans, setPlans] = useState(initialPlans);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("All");
  const [editingProspect, setEditingProspect] = useState<Prospect | null | undefined>(linkedProspect);
  const [editingUser, setEditingUser] = useState<Profile | null | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState(false);
  const currentPlan = plans[0] || null;
  const ownerNames = useMemo(() => new Map(users.map((user) => [user.id, user.full_name])), [users]);
  const active = prospects.filter((prospect) => prospect.outcome !== "Closed — lost");
  const totalRevenue = active.reduce((sum, prospect) => sum + Number(prospect.expected_annual_net_revenue), 0);
  const weightedRevenue = active.reduce((sum, prospect) => sum + Number(prospect.expected_annual_net_revenue) * Number(prospect.probability) / 100, 0);
  const approvalQueue = active.filter((prospect) => prospect.approval_status === "Pending");
  const commissionReviewQueue = active
    .filter((prospect) => prospect.commission_review_status === "Pending")
    .sort((left, right) => new Date(left.commission_requested_at || 0).getTime() - new Date(right.commission_requested_at || 0).getTime());
  const completedCommissionReviews = prospects
    .filter((prospect) => ["Approved", "Rejected"].includes(prospect.commission_review_status))
    .sort((left, right) => new Date(right.commission_reviewed_at || 0).getTime() - new Date(left.commission_reviewed_at || 0).getTime())
    .slice(0, 10);
  const filteredProspects = prospects.filter((prospect) => {
    const haystack = [prospect.organisation, prospect.country, prospect.corridor, ownerNames.get(prospect.owner_id)].join(" ").toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (stage === "All" || prospect.stage === stage);
  });

  const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard; show: boolean; count?: number }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { id: "prospects", label: "Prospects", icon: Building2, show: true },
    { id: "reviews", label: "Commission reviews", icon: BellRing, show: canManageReviews, count: commissionReviewQueue.length },
    { id: "commissions", label: "Commissions", icon: BadgePoundSterling, show: hasPermission(profile, "commissions.view") },
    { id: "settings", label: "Commission settings", icon: Settings2, show: true },
    { id: "users", label: "Users & access", icon: Users, show: hasPermission(profile, "users.manage") },
    { id: "audit", label: "Audit history", icon: History, show: hasPermission(profile, "audit.view") },
    { id: "data", label: "Data export", icon: Database, show: hasPermission(profile, "data.export") }
  ];

  function savedProspect(saved: Prospect) {
    const previousReviewStatus = editingProspect?.commission_review_status;
    const reviewTransitioned = previousReviewStatus !== saved.commission_review_status;
    setProspects((current) => current.some((item) => item.id === saved.id)
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]);
    setEditingProspect(undefined);
    setNotice(reviewTransitioned && saved.commission_review_status === "Pending"
      ? `${saved.organisation} submitted for commission review; approver email is sent immediately or queued for automatic retry.`
      : reviewTransitioned && saved.commission_review_status === "Approved"
        ? `${saved.organisation} commission review approved; the requester notification is queued.`
        : reviewTransitioned && saved.commission_review_status === "Rejected"
          ? `${saved.organisation} commission review rejected; the requester notification is queued.`
          : `${saved.organisation} saved securely.`);
  }

  function savedUser(saved: Profile) {
    setUsers((current) => current.map((item) => item.id === saved.id ? saved : item));
    setEditingUser(undefined);
    setNotice(`${saved.full_name} updated.`);
  }

  function savedPlan(saved: CommissionPlan) {
    setPlans((current) => [saved, ...current]);
    setEditingPlan(false);
    setNotice(`Commission Plan v${saved.version} published.`);
  }

  function exportCsv() {
    const headers = ["Reference", "Organisation", "Country", "Corridor", "Stage", "Outcome", "Owner", "Annual Net Revenue", "Probability", "Commission review", "Approval", "Updated"];
    const rows = prospects.map((prospect) => [
      prospect.reference_code,
      prospect.organisation,
      prospect.country,
      prospect.corridor,
      prospect.stage,
      prospect.outcome,
      ownerNames.get(prospect.owner_id) || "Unassigned",
      prospect.expected_annual_net_revenue,
      prospect.probability,
      prospect.commission_review_status,
      prospect.approval_status,
      prospect.updated_at
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexsett-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${prospects.length} scoped record${prospects.length === 1 ? "" : "s"} exported.`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <picture className="brand-logo">
          <source media="(prefers-color-scheme: dark)" srcSet="/nexsett-logo-white.png" />
          <img src="/nexsett-logo-colour.png" alt="Nexsett" />
        </picture>
        <p className="product-name">Prospect &amp; Commission CRM</p>
        <nav aria-label="CRM navigation">
          {navigation.filter((item) => item.show).map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "nav-button active" : "nav-button"} type="button" onClick={() => setView(item.id)} aria-pressed={view === item.id}>
                <Icon size={17} aria-hidden="true" />{item.label}{typeof item.count === "number" && item.count > 0 && <span className="nav-count" aria-label={`${item.count} pending`}>{item.count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="signed-in-card">
          <strong>{profile.full_name}</strong>
          <span>{profile.email}</span>
          <div className="badge-row"><span className="badge info">{profile.role}</span><span className="badge">{scopeLabel(profile.record_scope)}</span></div>
          <form action="/auth/signout" method="post"><button className="button ghost" type="submit">Sign out</button></form>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">{viewMeta[view][0]}</p><h1>{viewMeta[view][1]}</h1></div>
          <div className="actions">
            {hasPermission(profile, "data.export") && <button className="button" type="button" onClick={exportCsv}><Download size={16} />Export CSV</button>}
            {hasPermission(profile, "prospects.create") && ["dashboard", "prospects", "commissions"].includes(view) && (
              <button className="button primary" type="button" onClick={() => setEditingProspect(null)}><Plus size={16} />New prospect</button>
            )}
          </div>
        </header>

        {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

        {view === "dashboard" && (
          <div className="stack">
            <div className="callout"><ShieldCheck size={19} /><p><strong>Secure team edition.</strong> Google Workspace authentication and database policies are active on every record request.</p></div>
            <div className="stats-grid">
              <article className="stat"><span>Active opportunities</span><strong>{active.length}</strong><small>Visible in your {scopeLabel(profile.record_scope).toLowerCase()}</small></article>
              <article className="stat"><span>Forecast annual Net Revenue</span><strong>{compactMoney(totalRevenue)}</strong><small>Forecast, not received revenue</small></article>
              <article className="stat"><span>Probability weighted</span><strong>{compactMoney(weightedRevenue)}</strong><small>Based on opportunity probability</small></article>
              {canManageReviews && <article className="stat"><span>Commission review queue</span><strong>{commissionReviewQueue.length}</strong><small>Requests awaiting an authorised decision</small></article>}
              <article className="stat"><span>Approval queue</span><strong>{approvalQueue.length}</strong><small>Pending governance decisions</small></article>
            </div>
            {canManageReviews && commissionReviewQueue.length > 0 && <section className="panel"><div className="section-head"><div><h2>Commission reviews needing attention</h2><span>Oldest requests first</span></div><button className="button" type="button" onClick={() => setView("reviews")}>Open queue</button></div>{commissionReviewQueue.slice(0, 3).map((prospect) => <div className="history-row" key={prospect.id}><span className="badge warning">Pending</span><div><strong>{prospect.organisation}</strong><small>{prospect.reference_code} · {ownerNames.get(prospect.owner_id) || "Unassigned"}</small></div><button className="button" type="button" onClick={() => setEditingProspect(prospect)}>Review</button></div>)}</section>}
            <section>
              <div className="section-head"><h2>Opportunity workflow</h2><span>Expected annual Net Revenue</span></div>
              <div className="stage-grid">
                {stages.map((stageName) => {
                  const items = active.filter((prospect) => prospect.stage === stageName);
                  return (
                    <article className="stage-column" key={stageName} data-stage={stageName}>
                      <div className="section-head"><strong>{stageName}</strong><span>{items.length}</span></div>
                      <p className="stage-total">{compactMoney(items.reduce((sum, prospect) => sum + Number(prospect.expected_annual_net_revenue), 0))}</p>
                      <div className="stage-cards">
                        {items.map((prospect) => (
                          <button className="opportunity-card" type="button" key={prospect.id} onClick={() => setEditingProspect(prospect)}>
                            <strong>{prospect.organisation}</strong><span>{prospect.corridor || prospect.country || "No corridor"}</span><small>{prospect.probability}% · {ownerNames.get(prospect.owner_id)}</small>
                          </button>
                        ))}
                        {!items.length && <p className="empty-copy">No opportunities</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {view === "prospects" && (
          <div className="stack">
            <div className="filters">
              <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Organisation, owner or corridor" /></label>
              <label>Stage<select value={stage} onChange={(event) => setStage(event.target.value)}><option>All</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="section-head"><p>{filteredProspects.length} of {prospects.length} records in scope</p>{hasPermission(profile, "prospects.create") && <button className="button primary" onClick={() => setEditingProspect(null)}><Plus size={16} />Add prospect</button>}</div>
            <div className="record-list">
              {filteredProspects.map((prospect) => (
                <article className="record" key={prospect.id}>
                  <div><strong>{prospect.organisation}</strong><span>{prospect.reference_code} · {prospect.corridor || prospect.country || "No corridor"}</span><div className="badge-row"><span className="badge info">{prospect.stage}</span><span className="badge">{prospect.outcome}</span></div></div>
                  <div><span>Annual Net Revenue</span><strong>{money(prospect.expected_annual_net_revenue)}</strong><small>{prospect.probability}% probability</small></div>
                  <div><span>Owner</span><strong>{ownerNames.get(prospect.owner_id) || "Unassigned"}</strong><small>Commission: {prospect.commission_review_status}</small></div>
                  <button className="button" onClick={() => setEditingProspect(prospect)}>{hasPermission(profile, "prospects.edit") ? "Edit" : "View"}</button>
                </article>
              ))}
              {!filteredProspects.length && <div className="empty">No prospects match these filters.</div>}
            </div>
          </div>
        )}

        {view === "reviews" && canManageReviews && (
          <div className="stack">
            <div className="callout"><BellRing size={19} /><p><strong>Authorised review queue.</strong> Sales can request consideration, but only users with both commission-management and approval authority can assign terms and record a decision.</p></div>
            <section>
              <div className="section-head"><div><h2>Awaiting decision</h2><span>{commissionReviewQueue.length} pending request{commissionReviewQueue.length === 1 ? "" : "s"}</span></div></div>
              <div className="record-list">
                {commissionReviewQueue.map((prospect) => <article className="record" key={prospect.id}><div><strong>{prospect.organisation}</strong><span>{prospect.reference_code} · {prospect.corridor || prospect.country || "No corridor"}</span><div className="badge-row"><span className="badge warning">Pending review</span>{prospect.commission_suggested_category_id && <span className="badge">Suggested: {currentPlan?.categories.find((category) => category.id === prospect.commission_suggested_category_id)?.name || prospect.commission_suggested_category_id}</span>}</div></div><div><span>Annual Net Revenue</span><strong>{money(prospect.expected_annual_net_revenue)}</strong><small>{prospect.probability}% probability</small></div><div><span>Requested by</span><strong>{users.find((user) => user.id === prospect.commission_requested_by)?.full_name || ownerNames.get(prospect.owner_id) || "Unknown"}</strong><small>{date(prospect.commission_requested_at)}</small></div><button className="button primary" type="button" onClick={() => setEditingProspect(prospect)}>Review request</button></article>)}
                {!commissionReviewQueue.length && <div className="empty">There are no commission requests awaiting a decision.</div>}
              </div>
            </section>
            {completedCommissionReviews.length > 0 && <section className="panel"><div className="section-head"><h2>Recent decisions</h2><span>Latest 10 in your scope</span></div>{completedCommissionReviews.map((prospect) => <div className="history-row" key={prospect.id}><span className={prospect.commission_review_status === "Approved" ? "badge success" : "badge danger"}>{prospect.commission_review_status}</span><div><strong>{prospect.organisation}</strong><small>{prospect.reference_code} · {date(prospect.commission_reviewed_at)}</small></div><button className="button" type="button" onClick={() => setEditingProspect(prospect)}>Open</button></div>)}</section>}
          </div>
        )}

        {view === "commissions" && (
          <div className="stack">
            <div className="callout"><BadgePoundSterling size={19} /><p><strong>Forecast only.</strong> Commission becomes payable only on Nexsett Net Revenue actually received and under the applicable published plan.</p></div>
            <section>
              <div className="section-head"><div><h2>Current Commission Plan</h2><span>{currentPlan ? `Version ${currentPlan.version} · ${date(currentPlan.published_at)}` : "Not configured"}</span></div><button className="button" onClick={() => setView("settings")}>Review rules</button></div>
              <div className="category-grid">{currentPlan?.categories.filter((category) => category.active).map((category) => <article className="category" key={category.id}><strong>{category.name}</strong><span>{category.bespoke ? "Bespoke rate" : category.schedule.map((band) => `${band.label} ${band.rate}%`).join(" · ")}</span><small>{category.notes}</small></article>)}</div>
            </section>
            <section>
              <div className="section-head"><h2>Opportunity commission register</h2><span>{prospects.filter((item) => item.commission_category_id).length} records</span></div>
              <div className="record-list">{prospects.filter((item) => item.commission_category_id).map((prospect) => <article className="record" key={prospect.id}><div><strong>{prospect.organisation}</strong><span>{prospect.commission_rule_snapshot?.name || prospect.commission_category_id}</span></div><div><span>Illustrative pool</span><strong>{money(commissionPool(prospect))}</strong><small>Plan v{prospect.commission_plan_version}</small></div><div><span>Allocation</span><strong>{prospect.contributors.map((person) => `${person.name} ${person.split}%`).join(" · ") || "Not allocated"}</strong><small>Review: {prospect.commission_review_status} · Governance: {prospect.approval_status}</small></div><button className="button" onClick={() => setEditingProspect(prospect)}>Review</button></article>)}</div>
            </section>
          </div>
        )}

        {view === "settings" && (
          <div className="stack">
            <div className="callout"><Settings2 size={19} /><p><strong>{hasPermission(profile, "settings.manage") ? "Administrator controls active." : "Read-only plan access."}</strong> Published versions are immutable; existing opportunities retain their saved rule snapshots.</p></div>
            {currentPlan && <><div className="section-head"><div><h2>Active Commission Plan v{currentPlan.version}</h2><span>{currentPlan.change_reason} · {date(currentPlan.published_at)}</span></div>{hasPermission(profile, "settings.manage") && <button className="button primary" onClick={() => setEditingPlan(true)}>Edit and publish v{currentPlan.version + 1}</button>}</div><div className="stats-grid"><article className="stat"><span>Current version</span><strong>v{currentPlan.version}</strong><small>Immutable once replaced</small></article><article className="stat"><span>Material threshold</span><strong>{compactMoney(currentPlan.material_threshold)}</strong><small>Annual Nexsett Net Revenue</small></article><article className="stat"><span>Active categories</span><strong>{currentPlan.categories.filter((category) => category.active).length}</strong><small>{currentPlan.categories.length} total</small></article></div><div className="category-grid">{currentPlan.categories.map((category) => <article className="category" key={category.id}><div className="section-head"><strong>{category.name}</strong><span className={category.active ? "badge success" : "badge"}>{category.active ? "Active" : "Archived"}</span></div><span>{category.bespoke ? "Bespoke rate and term" : category.schedule.map((band) => `${band.label} ${band.rate}%`).join(" · ")}</span><small>{category.notes}</small></article>)}</div><section className="panel"><div className="section-head"><h2>Version history</h2><span>{plans.length} versions</span></div>{plans.map((plan) => <div className="history-row" key={plan.version}><span className="badge info">v{plan.version}</span><div><strong>{plan.change_reason}</strong><small>{date(plan.published_at)} · {plan.categories.length} categories</small></div><span>{compactMoney(plan.material_threshold)}</span></div>)}</section></>}
          </div>
        )}

        {view === "users" && (
          <div className="stack">
            <div className="callout"><ShieldCheck size={19} /><p><strong>Google Workspace accounts only.</strong> New users receive an invitation from info@nexsett.com and remain locked until Google confirms the Nexsett Workspace organisation.</p></div>
            <div className="section-head"><div><h2>User accounts</h2><span>{users.filter((user) => user.status === "Active").length} active</span></div><button className="button primary" onClick={() => setEditingUser(null)}><Plus size={16} />Invite user</button></div>
            <div className="record-list">{users.map((user) => <article className="record" key={user.id}><div><strong>{user.full_name}</strong><span>{user.email}</span><div className="badge-row"><span className="badge info">{user.role}</span><span className={user.status === "Active" ? "badge success" : "badge warning"}>{user.status}</span></div></div><div><span>Team</span><strong>{user.team || "Not assigned"}</strong><small>{scopeLabel(user.record_scope)}</small></div><div><span>Custom access</span><strong>{Object.keys(user.permission_overrides || {}).length}</strong><small>Overrides</small></div><button className="button" onClick={() => setEditingUser(user)}>Edit access</button></article>)}</div>
          </div>
        )}

        {view === "audit" && (
          <div className="stack"><div className="callout"><History size={19} /><p><strong>Append-only activity.</strong> This view is already limited by the signed-in user’s authorised scope.</p></div><section className="panel"><div className="section-head"><h2>Latest activity</h2><span>{initialAudit.length} events</span></div>{initialAudit.map((entry) => <div className="history-row" key={entry.id}><span className="badge info">{entry.action}</span><div><strong>{entry.summary}</strong><small>{entry.actor_email || "System"} · {date(entry.created_at)}</small></div><span>{entry.entity_type}</span></div>)}{!initialAudit.length && <p className="empty-copy">No audit events are visible in this scope.</p>}</section></div>
        )}

        {view === "data" && (
          <div className="stack"><div className="callout"><Database size={19} /><p><strong>Scoped reporting.</strong> Exports contain only records that database policies permit this account to read. Managed database backups are handled separately by the platform.</p></div><section className="panel data-panel"><h2>Prospect CSV</h2><p>Export {prospects.length} currently visible record{prospects.length === 1 ? "" : "s"} for reporting.</p><button className="button primary" onClick={exportCsv}><Download size={16} />Export scoped CSV</button></section></div>
        )}
      </main>

      {editingProspect !== undefined && <ProspectDialog profile={profile} prospect={editingProspect} users={users} plan={currentPlan} onClose={() => setEditingProspect(undefined)} onSaved={savedProspect} />}
      {editingUser !== undefined && <UserDialog user={editingUser} onClose={() => setEditingUser(undefined)} onSaved={savedUser} onInvited={() => { setEditingUser(undefined); setNotice("Invitation sent from info@nexsett.com. Reload to see the new invited account."); }} />}
      {editingPlan && currentPlan && <PlanDialog plan={currentPlan} onClose={() => setEditingPlan(false)} onSaved={savedPlan} />}
    </div>
  );
}

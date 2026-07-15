"use client";

import { useState } from "react";
import { BellRing, Plus, Save, Trash2, X } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { CommissionPlan, Contributor, Profile, Prospect, ProspectInput } from "@/lib/types";

const stages: Prospect["stage"][] = ["Identify", "Engage", "Qualify", "Execute"];
const outcomes: Prospect["outcome"][] = ["Open", "On hold", "Live", "Closed — lost"];

function initialValue(prospect: Prospect | null, profile: Profile): ProspectInput {
  return prospect ? {
    organisation: prospect.organisation,
    organisation_type: prospect.organisation_type,
    country: prospect.country,
    corridor: prospect.corridor,
    stage: prospect.stage,
    outcome: prospect.outcome,
    owner_id: prospect.owner_id,
    source: prospect.source,
    provider: prospect.provider,
    contact_name: prospect.contact_name,
    contact_email: prospect.contact_email || "",
    monthly_volume: Number(prospect.monthly_volume),
    average_transaction: Number(prospect.average_transaction),
    expected_annual_net_revenue: Number(prospect.expected_annual_net_revenue),
    probability: Number(prospect.probability),
    repeat_corridor: prospect.repeat_corridor,
    authorised_contact: prospect.authorised_contact,
    opportunity_case: prospect.opportunity_case,
    commission_review_status: prospect.commission_review_status || "Not requested",
    commission_suggested_category_id: prospect.commission_suggested_category_id,
    commission_request_notes: prospect.commission_request_notes || "",
    commission_review_notes: prospect.commission_review_notes || "",
    commission_category_id: prospect.commission_category_id,
    incremental_annual_net_revenue: Number(prospect.incremental_annual_net_revenue),
    strategic_rate: Number(prospect.strategic_rate),
    strategic_years: Number(prospect.strategic_years),
    team_deal: prospect.team_deal,
    contributors: prospect.contributors || [],
    allocation_confirmed: prospect.allocation_confirmed,
    approval_status: prospect.approval_status,
    approval_date: prospect.approval_date || "",
    approval_evidence: prospect.approval_evidence,
    next_action: prospect.next_action,
    next_action_date: prospect.next_action_date || ""
  } : {
    organisation: "",
    organisation_type: "Money transfer operator",
    country: "",
    corridor: "",
    stage: "Identify",
    outcome: "Open",
    owner_id: profile.id,
    source: "Direct origination",
    provider: "",
    contact_name: "",
    contact_email: "",
    monthly_volume: 0,
    average_transaction: 0,
    expected_annual_net_revenue: 0,
    probability: 20,
    repeat_corridor: false,
    authorised_contact: false,
    opportunity_case: "",
    commission_review_status: "Not requested",
    commission_suggested_category_id: null,
    commission_request_notes: "",
    commission_review_notes: "",
    commission_category_id: null,
    incremental_annual_net_revenue: 0,
    strategic_rate: 0,
    strategic_years: 1,
    team_deal: false,
    contributors: [],
    allocation_confirmed: false,
    approval_status: "Not required",
    approval_date: "",
    approval_evidence: "",
    next_action: "",
    next_action_date: ""
  };
}

export function ProspectDialog({
  profile,
  prospect,
  users,
  plan,
  onClose,
  onSaved
}: {
  profile: Profile;
  prospect: Prospect | null;
  users: Profile[];
  plan: CommissionPlan | null;
  onClose: () => void;
  onSaved: (prospect: Prospect) => void;
}) {
  const isNew = !prospect;
  const editable = isNew ? hasPermission(profile, "prospects.create") : hasPermission(profile, "prospects.edit");
  const canReassign = editable && hasPermission(profile, "prospects.reassign");
  const canManageCommission = editable && hasPermission(profile, "commissions.manage");
  const canManageApprovals = editable && hasPermission(profile, "approvals.manage");
  const canManageReview = canManageCommission && canManageApprovals;
  const canDelete = Boolean(prospect) && hasPermission(profile, "prospects.delete");
  const [value, setValue] = useState(() => initialValue(prospect, profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedCategory = plan?.categories.find((category) => category.id === value.commission_category_id)
    || prospect?.commission_rule_snapshot
    || null;
  const originalReviewStatus = prospect?.commission_review_status || "Not requested";
  const canEditRequest = editable && (!prospect || ["Not requested", "Rejected"].includes(originalReviewStatus));
  const requestIsSelected = value.commission_review_status === "Pending";
  const requestActor = users.find((user) => user.id === prospect?.commission_requested_by)?.full_name || "the salesperson";
  const reviewer = users.find((user) => user.id === prospect?.commission_reviewed_by)?.full_name || "an authorised approver";
  const defaultContributorName = users.find((user) => user.id === prospect?.commission_requested_by)?.full_name
    || users.find((user) => user.id === value.owner_id)?.full_name
    || profile.full_name;
  const decisionOptions: Prospect["commission_review_status"][] = originalReviewStatus === "Pending"
    ? ["Pending", "Approved", "Rejected"]
    : ["Approved", "Rejected"].includes(originalReviewStatus)
      ? [originalReviewStatus as Prospect["commission_review_status"], "Pending"]
      : ["Not requested", "Pending"];

  function change<K extends keyof ProspectInput>(key: K, next: ProspectInput[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function updateContributor(index: number, patch: Partial<Contributor>) {
    change("contributors", value.contributors.map((person, personIndex) => personIndex === index ? { ...person, ...patch } : person));
  }

  function toggleReviewRequest() {
    change("commission_review_status", requestIsSelected ? originalReviewStatus : "Pending");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editable) return;
    setBusy(true);
    setError("");
    const response = await fetch(isNew ? "/api/prospects" : `/api/prospects/${prospect.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "The prospect could not be saved.");
      return;
    }
    onSaved(result.prospect as Prospect);
  }

  async function remove() {
    if (!prospect || !canDelete || !window.confirm(`Delete ${prospect.organisation}? This cannot be undone.`)) return;
    setBusy(true);
    const response = await fetch(`/api/prospects/${prospect.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "The prospect could not be deleted.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="prospect-dialog-title">
        <header className="modal-head"><div><p className="eyebrow">{prospect?.reference_code || "New opportunity"}</p><h2 id="prospect-dialog-title">{prospect?.organisation || "Add prospect"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close prospect editor"><X size={18} /></button></header>
        <form onSubmit={submit}>
          <div className="modal-body">
            {!editable && <div className="callout"><p><strong>Read-only record.</strong> Your current role can view this opportunity but cannot change it.</p></div>}
            {editable && (!canReassign || !canManageCommission || !canManageApprovals) && <div className="callout"><p><strong>Frontline access active.</strong> You can submit a commission review request; actual categories, rates and decisions remain protected for authorised approvers.</p></div>}
            {error && <div className="error" role="alert">{error}</div>}

            <fieldset disabled={!editable}>
              <legend>Opportunity</legend>
              <div className="form-grid">
                <label>Organisation *<input required value={value.organisation} onChange={(event) => change("organisation", event.target.value)} /></label>
                <label>Organisation type<select value={value.organisation_type} onChange={(event) => change("organisation_type", event.target.value)}><option>Money transfer operator</option><option>Payment business</option><option>Corporate treasury</option><option>Financial institution</option><option>Strategic partner</option><option>Other</option></select></label>
                <label>Country<input value={value.country} onChange={(event) => change("country", event.target.value)} /></label>
                <label>Priority corridor<input value={value.corridor} onChange={(event) => change("corridor", event.target.value)} placeholder="e.g. UK → Ghana" /></label>
                <label>Workflow stage<select value={value.stage} onChange={(event) => change("stage", event.target.value as Prospect["stage"])}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Outcome<select value={value.outcome} onChange={(event) => change("outcome", event.target.value as Prospect["outcome"])}>{outcomes.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Opportunity owner<select value={value.owner_id} onChange={(event) => change("owner_id", event.target.value)} disabled={!canReassign}>{users.filter((user) => user.status !== "Suspended" || user.id === value.owner_id).map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.team || user.role}</option>)}</select></label>
                <label>Lead source<input value={value.source} onChange={(event) => change("source", event.target.value)} /></label>
                <label>Provider<input value={value.provider} onChange={(event) => change("provider", event.target.value)} /></label>
                <label>Contact name<input value={value.contact_name} onChange={(event) => change("contact_name", event.target.value)} /></label>
                <label>Contact email<input type="email" value={value.contact_email} onChange={(event) => change("contact_email", event.target.value)} /></label>
              </div>
            </fieldset>

            <fieldset disabled={!editable}>
              <legend>Commercial qualification</legend>
              <div className="form-grid three">
                <label>Monthly volume (£m)<input type="number" min="0" step="0.1" value={value.monthly_volume} onChange={(event) => change("monthly_volume", Number(event.target.value))} /></label>
                <label>Average transaction (£m)<input type="number" min="0" step="0.1" value={value.average_transaction} onChange={(event) => change("average_transaction", Number(event.target.value))} /></label>
                <label>Expected annual Net Revenue (£)<input type="number" min="0" step="1000" value={value.expected_annual_net_revenue} onChange={(event) => change("expected_annual_net_revenue", Number(event.target.value))} /></label>
                <label>Probability (%)<input type="number" min="0" max="100" value={value.probability} onChange={(event) => change("probability", Number(event.target.value))} /></label>
              </div>
              <div className="check-row"><label><input type="checkbox" checked={value.repeat_corridor} onChange={(event) => change("repeat_corridor", event.target.checked)} />Repeat corridor</label><label><input type="checkbox" checked={value.authorised_contact} onChange={(event) => change("authorised_contact", event.target.checked)} />Authorised contact</label></div>
              <label>Opportunity case<textarea value={value.opportunity_case} onChange={(event) => change("opportunity_case", event.target.value)} /></label>
            </fieldset>

            <fieldset>
              <legend>Commission review request</legend>
              <div className="review-status-row">
                <div><span>Current status</span><strong className={`badge review-${value.commission_review_status.toLowerCase().replace(" ", "-")}`}>{value.commission_review_status}</strong></div>
                {prospect?.commission_requested_at && <small>Submitted by {requestActor} on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(prospect.commission_requested_at))}</small>}
              </div>
              <div className="form-grid">
                <label>Suggested category
                  <select value={value.commission_suggested_category_id || ""} disabled={!canEditRequest || requestIsSelected} onChange={(event) => change("commission_suggested_category_id", event.target.value || null)}>
                    <option value="">For the administrator to determine</option>
                    {plan?.categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active}>{category.name}{category.active ? "" : " — archived"}</option>)}
                  </select>
                </label>
                <label className="span-all">Why should commission be considered?
                  <textarea value={value.commission_request_notes} disabled={!canEditRequest || requestIsSelected} onChange={(event) => change("commission_request_notes", event.target.value)} placeholder="Add the salesperson’s context, contribution or suggested treatment." />
                </label>
              </div>
              {canEditRequest && <div className="review-actions"><button className={requestIsSelected ? "button" : "button primary"} type="button" onClick={toggleReviewRequest}><BellRing size={16} />{requestIsSelected ? "Remove request before saving" : originalReviewStatus === "Rejected" ? "Resubmit for commission review" : "Request commission review on save"}</button><small>Saving a request adds it to the authorised review queue and queues an email alert.</small></div>}
              {originalReviewStatus === "Pending" && <div className="callout"><BellRing size={18} /><p><strong>Awaiting an authorised decision.</strong> The request details are locked while Walter or another permitted approver reviews the category and terms.</p></div>}
              {["Approved", "Rejected"].includes(originalReviewStatus) && <div className={originalReviewStatus === "Approved" ? "callout success" : "callout warning"}><p><strong>{originalReviewStatus} by {reviewer}.</strong> {prospect?.commission_review_notes || (originalReviewStatus === "Approved" ? "The approved category is recorded below." : "No decision notes are available.")}</p></div>}
            </fieldset>

            <fieldset disabled={!canManageCommission}>
              <legend>Commission attribution</legend>
              <div className="form-grid three">
                <label>Commission category<select value={value.commission_category_id || ""} onChange={(event) => { const id = event.target.value || null; change("commission_category_id", id); if (id && !value.contributors.length) change("contributors", [{ name: defaultContributorName, split: 100 }]); }}><option value="">No individual commission</option>{plan?.categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                {selectedCategory?.basis === "incremental" && <label>Incremental annual Net Revenue (£)<input type="number" min="0" step="1000" value={value.incremental_annual_net_revenue} onChange={(event) => change("incremental_annual_net_revenue", Number(event.target.value))} /></label>}
                {selectedCategory?.bespoke && <><label>Bespoke rate (%)<input type="number" min="0" max="100" step="0.1" value={value.strategic_rate} onChange={(event) => change("strategic_rate", Number(event.target.value))} /></label><label>Term (years)<input type="number" min="1" max="10" value={value.strategic_years} onChange={(event) => change("strategic_years", Number(event.target.value))} /></label></>}
              </div>
              {value.commission_category_id && <>
                <div className="check-row"><label><input type="checkbox" checked={value.team_deal} onChange={(event) => change("team_deal", event.target.checked)} />Team deal</label><label><input type="checkbox" checked={value.allocation_confirmed} onChange={(event) => change("allocation_confirmed", event.target.checked)} />Allocation confirmed in writing</label></div>
                <div className="contributors">{value.contributors.map((person, index) => <div className="contributor-row" key={index}><label>Contributor<input value={person.name} onChange={(event) => updateContributor(index, { name: event.target.value })} /></label><label>Split (%)<input type="number" min="0" max="100" step="0.1" value={person.split} onChange={(event) => updateContributor(index, { split: Number(event.target.value) })} /></label><button className="button ghost" type="button" onClick={() => change("contributors", value.contributors.filter((_, personIndex) => personIndex !== index))}>Remove</button></div>)}</div>
                <button className="button" type="button" onClick={() => change("contributors", [...value.contributors, { name: "", split: 0 }])}><Plus size={15} />Add contributor</button>
              </>}
            </fieldset>

            {prospect && canManageReview && <fieldset>
              <legend>Commission review decision</legend>
              <div className="form-grid">
                <label>Review status<select value={value.commission_review_status} onChange={(event) => change("commission_review_status", event.target.value as Prospect["commission_review_status"])}>{decisionOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="span-all">Decision notes {value.commission_review_status === "Rejected" ? "*" : ""}<textarea required={value.commission_review_status === "Rejected"} value={value.commission_review_notes} onChange={(event) => change("commission_review_notes", event.target.value)} placeholder="Record the reason, agreed treatment or action needed." /></label>
              </div>
              {value.commission_review_status === "Approved" && !value.commission_category_id && <div className="error" role="alert">Choose the approved commission category above before saving.</div>}
              <p className="fine-print">Approving or rejecting records your identity and time, writes an audit entry, and queues a completion email to the requester. Reopening a completed review creates a new review cycle.</p>
            </fieldset>}

            <fieldset disabled={!canManageApprovals}>
              <legend>Material / special-term approval</legend>
              <div className="form-grid three">
                <label>Approval status<select value={value.approval_status} onChange={(event) => change("approval_status", event.target.value as Prospect["approval_status"])}><option>Not required</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></label>
                <label>Approval date<input type="date" value={value.approval_date} onChange={(event) => change("approval_date", event.target.value)} /></label>
                <label className="span-all">Approval evidence<textarea value={value.approval_evidence} onChange={(event) => change("approval_evidence", event.target.value)} /></label>
              </div>
            </fieldset>

            <fieldset disabled={!editable}>
              <legend>Next action</legend>
              <div className="form-grid"><label>Action<input value={value.next_action} onChange={(event) => change("next_action", event.target.value)} /></label><label>Due date<input type="date" value={value.next_action_date} onChange={(event) => change("next_action_date", event.target.value)} /></label></div>
            </fieldset>
          </div>
          <footer className="modal-foot">
            <div>{canDelete && <button className="button danger" type="button" disabled={busy} onClick={remove}><Trash2 size={16} />Delete</button>}</div>
            <div className="actions"><button className="button" type="button" onClick={onClose}>{editable ? "Cancel" : "Close"}</button>{editable && <button className="button primary" type="submit" disabled={busy}><Save size={16} />{busy ? "Saving…" : value.commission_review_status === "Pending" && originalReviewStatus !== "Pending" ? "Save & request review" : ["Approved", "Rejected"].includes(value.commission_review_status) && value.commission_review_status !== originalReviewStatus ? "Save decision" : "Save prospect"}</button>}</div>
          </footer>
        </form>
      </section>
    </div>
  );
}

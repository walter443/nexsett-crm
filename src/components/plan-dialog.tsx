"use client";

import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import type { CommissionCategory, CommissionPlan } from "@/lib/types";

function nextCategoryId(categories: CommissionCategory[]) {
  let sequence = categories.length + 1;
  while (categories.some((category) => category.id === `custom-category-${sequence}`)) sequence += 1;
  return `custom-category-${sequence}`;
}

export function PlanDialog({ plan, onClose, onSaved }: { plan: CommissionPlan; onClose: () => void; onSaved: (plan: CommissionPlan) => void }) {
  const [threshold, setThreshold] = useState(Number(plan.material_threshold));
  const [reason, setReason] = useState("");
  const [categories, setCategories] = useState<CommissionCategory[]>(() => structuredClone(plan.categories));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function categoryPatch(index: number, patch: Partial<CommissionCategory>) {
    setCategories((current) => current.map((category, categoryIndex) => categoryIndex === index ? { ...category, ...patch } : category));
  }

  function updateRate(categoryIndex: number, rateIndex: number, patch: { label?: string; rate?: number }) {
    setCategories((current) => current.map((category, currentCategoryIndex) => currentCategoryIndex === categoryIndex ? {
      ...category,
      schedule: category.schedule.map((band, currentRateIndex) => currentRateIndex === rateIndex ? { ...band, ...patch } : band)
    } : category));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/commission-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material_threshold: threshold, change_reason: reason, categories })
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "The Commission Plan could not be published.");
      return;
    }
    onSaved(result.plan as CommissionPlan);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title">
        <header className="modal-head"><div><p className="eyebrow">Current v{plan.version} → new v{plan.version + 1}</p><h2 id="plan-dialog-title">Publish Commission Plan</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close Commission Plan editor"><X size={18} /></button></header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="callout"><p><strong>Versioned governance.</strong> Publishing creates an immutable new plan. Existing opportunity snapshots are not rewritten.</p></div>
            {error && <div className="error" role="alert">{error}</div>}
            <fieldset>
              <legend>Plan controls</legend>
              <div className="form-grid"><label>Material-opportunity threshold (£)<input required type="number" min="0" step="1000" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label><label>Reason for change *<input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Shareholders approved revised framework" /></label></div>
            </fieldset>
            <fieldset>
              <div className="section-head"><div><legend>Commission categories</legend><span>Archive categories already used by opportunities.</span></div><button className="button" type="button" onClick={() => setCategories((current) => [...current, { id: nextCategoryId(current), name: "New commission category", basis: "total", schedule: [{ label: "Year 1", rate: 0 }], approvalRequired: false, bespoke: false, introProtectionMonths: 0, active: true, notes: "" }])}><Plus size={15} />Add category</button></div>
              <div className="category-editor-list">{categories.map((category, categoryIndex) => <article className="category-editor" key={category.id}>
                <div className="section-head"><div><strong>{category.name}</strong><small>{category.id}</small></div><label className="switch"><input type="checkbox" checked={category.active} onChange={(event) => categoryPatch(categoryIndex, { active: event.target.checked })} />Active</label></div>
                <div className="form-grid three"><label>Category name<input required value={category.name} onChange={(event) => categoryPatch(categoryIndex, { name: event.target.value })} /></label><label>Calculation basis<select value={category.basis} onChange={(event) => categoryPatch(categoryIndex, { basis: event.target.value as CommissionCategory["basis"] })}><option value="total">Total Net Revenue</option><option value="incremental">Incremental Net Revenue</option></select></label><label>Protection (months)<input type="number" min="0" max="120" value={category.introProtectionMonths} onChange={(event) => categoryPatch(categoryIndex, { introProtectionMonths: Number(event.target.value) })} /></label></div>
                <div className="check-row"><label><input type="checkbox" checked={category.approvalRequired} onChange={(event) => categoryPatch(categoryIndex, { approvalRequired: event.target.checked })} />Consent always required</label><label><input type="checkbox" checked={category.bespoke} onChange={(event) => categoryPatch(categoryIndex, { bespoke: event.target.checked })} />Rate and term set per opportunity</label></div>
                {!category.bespoke && <div><div className="section-head"><strong>Rate bands</strong><button className="button" type="button" onClick={() => categoryPatch(categoryIndex, { schedule: [...category.schedule, { label: `Year ${category.schedule.length + 1}`, rate: 0 }] })}><Plus size={14} />Add period</button></div><div className="rate-list">{category.schedule.map((band, rateIndex) => <div className="rate-row" key={rateIndex}><label>Period<input value={band.label} onChange={(event) => updateRate(categoryIndex, rateIndex, { label: event.target.value })} /></label><label>Rate (%)<input type="number" min="0" max="100" step="0.1" value={band.rate} onChange={(event) => updateRate(categoryIndex, rateIndex, { rate: Number(event.target.value) })} /></label><button className="button ghost" type="button" disabled={category.schedule.length === 1} onClick={() => categoryPatch(categoryIndex, { schedule: category.schedule.filter((_, index) => index !== rateIndex) })}>Remove</button></div>)}</div></div>}
                <label>Rule notes<textarea value={category.notes} onChange={(event) => categoryPatch(categoryIndex, { notes: event.target.value })} /></label>
              </article>)}</div>
            </fieldset>
          </div>
          <footer className="modal-foot"><span className="muted">Only publishing changes the active plan.</span><div className="actions"><button className="button" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={busy}><Save size={16} />{busy ? "Publishing…" : `Publish v${plan.version + 1}`}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

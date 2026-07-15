"use client";

import { useState } from "react";
import { Save, Send, X } from "lucide-react";
import { permissionDefinitions, roleDefault } from "@/lib/permissions";
import type { PermissionKey, PermissionOverrides, Profile, RecordScope, Role, UserStatus } from "@/lib/types";

interface UserFormValue {
  email: string;
  full_name: string;
  team: string;
  role: Role;
  record_scope: RecordScope;
  status: UserStatus;
  permission_overrides: PermissionOverrides;
}

export function UserDialog({
  user,
  onClose,
  onSaved,
  onInvited
}: {
  user: Profile | null;
  onClose: () => void;
  onSaved: (user: Profile) => void;
  onInvited: () => void;
}) {
  const isNew = !user;
  const [value, setValue] = useState<UserFormValue>(() => user ? {
    email: user.email,
    full_name: user.full_name,
    team: user.team,
    role: user.role,
    record_scope: user.record_scope,
    status: user.status,
    permission_overrides: user.permission_overrides || {}
  } : {
    email: "",
    full_name: "",
    team: "Commercial",
    role: "Sales",
    record_scope: "own",
    status: "Invited",
    permission_overrides: {}
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof UserFormValue>(key: K, next: UserFormValue[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function permissionValue(permission: PermissionKey) {
    const override = value.permission_overrides[permission];
    return override === true ? "allow" : override === false ? "deny" : "default";
  }

  function setPermission(permission: PermissionKey, setting: string) {
    const overrides = { ...value.permission_overrides };
    if (setting === "default") delete overrides[permission];
    else overrides[permission] = setting === "allow";
    change("permission_overrides", overrides);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = isNew ? {
      email: value.email,
      full_name: value.full_name,
      team: value.team,
      role: value.role,
      record_scope: value.record_scope,
      permission_overrides: value.permission_overrides
    } : {
      full_name: value.full_name,
      team: value.team,
      role: value.role,
      record_scope: value.record_scope,
      status: value.status,
      permission_overrides: value.permission_overrides
    };
    const response = await fetch(isNew ? "/api/invitations" : `/api/users/${user.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "The account could not be saved.");
      return;
    }
    if (isNew) onInvited();
    else onSaved(result.user as Profile);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal medium" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <header className="modal-head"><div><p className="eyebrow">{isNew ? "Invitation only" : user.id}</p><h2 id="user-dialog-title">{isNew ? "Invite user" : `Edit ${user.full_name}`}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close user editor"><X size={18} /></button></header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="callout"><p><strong>Google Workspace access.</strong> {isNew ? "The account remains locked until the invited person signs in with the matching nexsett.com Google account." : "Role and scope changes take effect on the next authorised request."}</p></div>
            {error && <div className="error" role="alert">{error}</div>}
            <fieldset>
              <legend>Account</legend>
              <div className="form-grid three">
                <label>Full name *<input required value={value.full_name} onChange={(event) => change("full_name", event.target.value)} /></label>
                <label>Email *<input required type="email" value={value.email} onChange={(event) => change("email", event.target.value)} disabled={!isNew} placeholder="name@nexsett.com" /></label>
                <label>Team<input value={value.team} onChange={(event) => change("team", event.target.value)} /></label>
                <label>Role<select value={value.role} onChange={(event) => { const role = event.target.value as Role; change("role", role); if (isNew) change("record_scope", role === "Admin" ? "all" : role === "Manager" ? "team" : "own"); }}><option>Sales</option><option>Manager</option><option>Admin</option></select></label>
                <label>Record scope<select value={value.record_scope} onChange={(event) => change("record_scope", event.target.value as RecordScope)}><option value="own">Own records</option><option value="team">Team records</option><option value="all">All records</option></select></label>
                {!isNew && <label>Status<select value={value.status} onChange={(event) => change("status", event.target.value as UserStatus)}><option>Invited</option><option>Active</option><option>Suspended</option></select></label>}
              </div>
            </fieldset>
            <fieldset>
              <legend>Capability overrides</legend>
              <p className="muted">Keep the role default or explicitly allow or block an individual capability.</p>
              <div className="permission-list">{permissionDefinitions.map((permission) => <div className="permission-row" key={permission.id}><div><strong>{permission.label}</strong><small>{permission.group}</small></div><label><span className="sr-only">{permission.label}</span><select value={permissionValue(permission.id)} onChange={(event) => setPermission(permission.id, event.target.value)}><option value="default">Role default · {roleDefault(value.role, permission.id) ? "Allowed" : "Blocked"}</option><option value="allow">Allow</option><option value="deny">Block</option></select></label></div>)}</div>
            </fieldset>
          </div>
          <footer className="modal-foot"><span className="muted">Invitations are sent from info@nexsett.com.</span><div className="actions"><button className="button" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{isNew ? <Send size={16} /> : <Save size={16} />}{busy ? "Saving…" : isNew ? "Send invitation" : "Save user"}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

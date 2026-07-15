"use client";

import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginCard({ domain, invited, error }: { domain: string; invited: boolean; error: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error);

  async function signIn() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { hd: domain, prompt: "select_account" }
      }
    });
    if (signInError) {
      setMessage(signInError.message);
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <picture className="login-logo">
          <source media="(prefers-color-scheme: dark)" srcSet="/nexsett-logo-white.png" />
          <img src="/nexsett-logo-colour.png" alt="Nexsett" />
        </picture>
        <div>
          <p className="eyebrow">Secure team access</p>
          <h1 id="login-title">Prospect &amp; Commission CRM</h1>
          <p className="muted">
            Sign in with an invited Nexsett Google Workspace account. Personal Google accounts and uninvited users are blocked.
          </p>
        </div>
        {invited && (
          <div className="callout success" role="status">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>Your invitation is ready. Continue with the invited Google Workspace account to activate access.</p>
          </div>
        )}
        {message && <div className="error" role="alert">{message}</div>}
        <button className="button primary wide" type="button" onClick={signIn} disabled={busy}>
          <LogIn size={17} aria-hidden="true" />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <p className="fine-print">Allowed organisation: {domain}</p>
      </section>
    </main>
  );
}

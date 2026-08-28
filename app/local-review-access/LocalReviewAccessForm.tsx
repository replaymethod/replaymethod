"use client";

import { useEffect, useState } from "react";

export function LocalReviewLoginForm() {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHydrated(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    setState("saving");
    try {
      const response = await fetch("/api/local-review-session", { method: "POST", body: new FormData(event.currentTarget) });
      const result = await response.json() as { redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error("local review login failed");
      window.location.assign(result.redirectTo);
    } catch {
      setState("error");
    }
  }
  return <form action="/api/local-review-session" method="post" onSubmit={submit} data-hydrated={hydrated}>
    <label><span>DISPLAY NAME</span><input name="displayName" autoComplete="name" maxLength={120} required /></label>
    <label><span>REVIEW IDENTITY EMAIL</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label><span>LOCAL ACCESS CODE</span><input name="accessCode" type="password" autoComplete="off" minLength={32} required /></label>
    <button disabled={!hydrated || state === "saving"}>{state === "saving" ? "VERIFYING…" : <>OPEN PRIVATE REVIEW <b>→</b></>}</button>
    {state === "error" && <small>Identity or access code was not accepted.</small>}
  </form>;
}

export function LocalReviewLogoutButton() {
  const [saving, setSaving] = useState(false);
  async function logout() {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/local-review-session/logout", { method: "POST" });
      if (!response.ok) throw new Error("local review logout failed");
      window.location.assign("/local-review-access");
    } catch {
      setSaving(false);
    }
  }
  return <button className="local-review-logout" type="button" disabled={saving} onClick={logout}>{saving ? "ENDING…" : "END LOCAL SESSION"}</button>;
}

"use client";

import { useEffect, useState } from "react";

export default function OwnerQaActivate() {
  const [state, setState] = useState<"hydrating" | "idle" | "loading" | "error">("hydrating");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setState("idle"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function activate() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/player/owner-qa-session", { method: "POST" });
      const result = await response.json() as { redirect?: string; error?: string };
      if (!response.ok || !result.redirect) throw new Error(result.error || "Owner QA verification failed.");
      location.href = result.redirect;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Owner QA verification failed.");
    }
  }

  return <div className="owner-qa-activate" data-hydrated={state !== "hydrating"}><button type="button" disabled={state === "hydrating" || state === "loading"} onClick={activate}>{state === "loading" ? "VERIFYING…" : "ACTIVATE OWNER QA ON THIS DEVICE →"}</button>{message && <p role="alert">{message}</p>}</div>;
}

"use client";

import { useEffect, useRef, useState } from "react";

export default function OwnerQaActivate() {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<"hydrating" | "loading" | "error">("hydrating");
  const [message, setMessage] = useState("");

  useEffect(() => {
    rootRef.current?.setAttribute("data-hydrated", "true");
    if (buttonRef.current) buttonRef.current.disabled = false;
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

  return <div ref={rootRef} className="owner-qa-activate" data-hydrated="false"><button ref={buttonRef} type="button" disabled={state === "hydrating" || state === "loading"} onClick={activate}>{state === "loading" ? "VERIFYING…" : "ACTIVATE OWNER QA ON THIS DEVICE →"}</button>{message && <p role="alert">{message}</p>}</div>;
}

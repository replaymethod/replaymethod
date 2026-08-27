"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewQueueImport() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const response = await fetch("/api/admin/rl-review-queue", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json() as { imported?: number; replayCount?: number; holdoutOverlapCount?: number; error?: string };
    setState(response.ok ? "saved" : "error");
    setMessage(response.ok ? `${result.imported} moments from ${result.replayCount} calibration replays imported · ${result.holdoutOverlapCount} holdout overlap.` : result.error || "Import failed.");
    if (response.ok) router.refresh();
  }

  return <form className="review-queue-import" onSubmit={submit}>
    <div><span>LOCKED PRIVATE OPPORTUNITY QUEUE</span><b>Only the owner-authorized 343 moments / 85 calibration_dev replays artifact pair is accepted.</b><small>Byte-level SHA-256 allowlist · firing + non-firing + abstention · zero holdout overlap · idempotent audit record</small></div>
    <label><span>Selected queue JSON.gz</span><input name="queue" type="file" accept="application/gzip,.gz" required /></label>
    <label><span>Anonymized moments JSON.gz</span><input name="moments" type="file" accept="application/gzip,.gz" required /></label>
    <button disabled={state === "saving"}>{state === "saving" ? "Importing…" : "Import private review set"}</button>
    {message && <p className={state}>{message}</p>}
  </form>;
}

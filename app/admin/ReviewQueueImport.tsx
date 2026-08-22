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
    <div><span>LOCKED PRIVATE CALIBRATION QUEUE</span><b>Only the owner-authorized 102 moments / 64 replays artifact pair is accepted.</b><small>Byte-level SHA-256 allowlist · calibration only · zero holdout overlap · idempotent audit record</small></div>
    <label><span>Selected queue JSON</span><input name="queue" type="file" accept="application/json,.json" required /></label>
    <label><span>Anonymized moments JSON</span><input name="moments" type="file" accept="application/json,.json" required /></label>
    <button disabled={state === "saving"}>{state === "saving" ? "Importing…" : "Import private review set"}</button>
    {message && <p className={state}>{message}</p>}
  </form>;
}

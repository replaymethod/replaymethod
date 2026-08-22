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
    const result = await response.json() as { imported?: number; error?: string };
    setState(response.ok ? "saved" : "error");
    setMessage(response.ok ? `${result.imported} private calibration moments imported.` : result.error || "Import failed.");
    if (response.ok) router.refresh();
  }

  return <form className="review-queue-import" onSubmit={submit}>
    <div><span>PRIVATE CALIBRATION QUEUE</span><b>Import anonymized moments without putting replay data in Git.</b><small>Calibration split only · holdout rejected · owner access required</small></div>
    <label><span>Selected queue JSON</span><input name="queue" type="file" accept="application/json,.json" required /></label>
    <label><span>Anonymized moments JSON</span><input name="moments" type="file" accept="application/json,.json" required /></label>
    <button disabled={state === "saving"}>{state === "saving" ? "Importing…" : "Import private review set"}</button>
    {message && <p className={state}>{message}</p>}
  </form>;
}

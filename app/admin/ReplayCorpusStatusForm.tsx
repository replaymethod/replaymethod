"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReplayState = {
  id: number;
  parserStatus: string;
  parserVersion: string | null;
  parsedMode: string | null;
  attributionStatus: string;
  usabilityStatus: string;
  reviewState: string;
  detectorSetVersion: string | null;
  processingErrorCode: string | null;
};

export default function ReplayCorpusStatusForm({ replay }: { replay: ReplayState }) {
  const router = useRouter();
  const [values, setValues] = useState(replay);
  const [state, setState] = useState("idle");
  const set = (key: keyof ReplayState, value: string) => setValues(current => ({ ...current, [key]: value }));

  async function save() {
    setState("saving");
    const response = await fetch(`/api/admin/rl-beta-submissions/${replay.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return <details className="corpus-status-form"><summary>Update state</summary><div>
    <select aria-label="Parser state" value={values.parserStatus} onChange={event => set("parserStatus", event.target.value)}><option value="pending">Parser pending</option><option value="parsed">Parsed</option><option value="failed">Parser failed</option></select>
    <select aria-label="Parsed mode" value={values.parsedMode || ""} onChange={event => set("parsedMode", event.target.value)}><option value="">Mode pending</option><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option><option value="private">Private</option><option value="unknown">Unknown</option></select>
    <select aria-label="Attribution state" value={values.attributionStatus} onChange={event => set("attributionStatus", event.target.value)}><option value="pending">Attribution pending</option><option value="matched">Player matched</option><option value="mismatch">Player mismatch</option><option value="ambiguous">Player ambiguous</option></select>
    <select aria-label="Usability state" value={values.usabilityStatus} onChange={event => set("usabilityStatus", event.target.value)}><option value="pending">Usability pending</option><option value="usable">Usable</option><option value="rejected">Rejected</option></select>
    <select aria-label="Review state" value={values.reviewState} onChange={event => set("reviewState", event.target.value)}><option value="not_started">Review not started</option><option value="queued">Queued</option><option value="in_review">In review</option><option value="reviewed">Reviewed</option></select>
    <input aria-label="Parser version" value={values.parserVersion || ""} onChange={event => set("parserVersion", event.target.value)} placeholder="Parser version" />
    <input aria-label="Detector set version" value={values.detectorSetVersion || ""} onChange={event => set("detectorSetVersion", event.target.value)} placeholder="Detector set version" />
    <input aria-label="Processing error code" value={values.processingErrorCode || ""} onChange={event => set("processingErrorCode", event.target.value)} placeholder="Error code, if any" />
    <button type="button" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save pipeline state"}</button>
    <small>{state === "saved" ? "Saved" : state === "error" ? "Could not save" : ""}</small>
  </div></details>;
}

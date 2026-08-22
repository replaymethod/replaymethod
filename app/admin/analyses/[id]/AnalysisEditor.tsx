"use client";

import { FormEvent, useState } from "react";

type Analysis = { id: number; publicId: string; email: string; status: string; jobPublicId: string | null; jobStatus: string | null; highestImpactMistake: string; whyItCosts: string; evidenceMoments: string; nextQueueRule: string; practicePlan: string; coachNote: string };

export default function AnalysisEditor({ analysis }: { analysis: Analysis }) {
  const [values, setValues] = useState(analysis);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [retryState, setRetryState] = useState<"idle" | "retrying" | "queued" | "error">("idle");
  const [message, setMessage] = useState("");
  const update = (key: keyof Analysis, value: string) => setValues(current => ({ ...current, [key]: value }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const response = await fetch(`/api/admin/analyses/${analysis.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json() as { error?: string; emailSent?: boolean };
    if (!response.ok) { setState("error"); setMessage(result.error || "Could not save."); return; }
    setState("saved");
    setMessage(values.status === "ready" ? (result.emailSent ? "Report published and the player email was sent." : "Report published. Transactional email is not configured yet—use the player email button below.") : "Draft saved.");
  }

  async function retry() {
    setRetryState("retrying");
    setMessage("");
    const response = await fetch(`/api/admin/analyses/${analysis.id}/retry`, { method: "POST" });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setRetryState("error");
      setMessage(result.error || "Could not queue the retry.");
      return;
    }
    setRetryState("queued");
    setMessage("Retry queued. The existing upload will be reprocessed without asking the player to submit again.");
    window.setTimeout(() => window.location.reload(), 1800);
  }

  const reportLink = typeof location === "undefined" ? `/report/${analysis.publicId}` : `${location.origin}/report/${analysis.publicId}`;
  const mailSubject = encodeURIComponent("Your Replay Method report is ready");
  const mailBody = encodeURIComponent(`Your private Replay Method report is ready:\n\n${reportLink}`);

  return <form className="analysis-editor" onSubmit={save}><div className="editor-toolbar"><label><span>QUALITY OVERRIDE STATUS</span><select value={values.status} onChange={e => update("status", e.target.value)}><option value="received">Received</option><option value="analyzing">Analyzing</option><option value="blocked">Blocked</option><option value="failed">Failed</option><option value="ready">Ready — publish report</option></select></label><div>{analysis.jobPublicId && <button className="retry-job" type="button" disabled={retryState === "retrying"} onClick={retry}>{retryState === "retrying" ? "Queuing…" : retryState === "queued" ? "Queued ✓" : analysis.jobStatus === "running" ? "Recover stale worker ↻" : "Retry automation ↻"}</button>}<a href={`mailto:${analysis.email}?subject=${mailSubject}&body=${mailBody}`}>Email player ↗</a><button disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save override"}</button></div></div><section><span>01 · DIAGNOSIS</span><label><b>Highest-impact repeated mistake</b><textarea value={values.highestImpactMistake} onChange={e => update("highestImpactMistake", e.target.value)} placeholder="One clear repeated decision—not a vague skill label." /></label><label><b>Why it costs games</b><textarea value={values.whyItCosts} onChange={e => update("whyItCosts", e.target.value)} placeholder="Explain the consequence in plain language." /></label></section><section><span>02 · EVIDENCE</span><label><b>Evidence moments — one per line</b><textarea className="tall" value={values.evidenceMoments} onChange={e => update("evidenceMoments", e.target.value)} placeholder={"00:42 — ...\n02:18 — ...\n04:51 — ..."} /></label></section><section><span>03 · NEXT-QUEUE RULE</span><label><b>One rule the player can remember</b><textarea value={values.nextQueueRule} onChange={e => update("nextQueueRule", e.target.value)} placeholder="When X happens, do Y before Z." /></label></section><section><span>04 · PRACTICE</span><label><b>Focused plan — one step per line</b><textarea className="tall" value={values.practicePlan} onChange={e => update("practicePlan", e.target.value)} placeholder={"Before queue: ...\nDuring match: ...\nAfter match: ..."} /></label><label><b>Optional coach note</b><textarea value={values.coachNote} onChange={e => update("coachNote", e.target.value)} placeholder="Context, encouragement or what to submit next." /></label></section>{message && <p className={`editor-message ${retryState === "error" ? "error" : retryState === "queued" ? "saved" : state}`}>{message}</p>}<div className="editor-publish"><span>This manual quality override remains a safety tool. Normal reports should be produced by the versioned analysis pipeline.</span><button disabled={state === "saving"}>{values.status === "ready" ? "Publish quality override →" : "Save override →"}</button></div></form>;
}

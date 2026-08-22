"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  id: number;
  locked: boolean;
  verdict: string;
  gameplayTruth: string | null;
  timestampVerified: boolean | null;
  contextCorrect: boolean | null;
  coachingRelevance: string | null;
  notes: string | null;
};

type Draft = {
  gameplayTruth: string;
  timestampResult: string;
  contextResult: string;
  coachingRelevance: string;
  notes: string;
};

const emptyDraft: Draft = { gameplayTruth: "", timestampResult: "", contextResult: "", coachingRelevance: "", notes: "" };

export default function ReviewCandidateForm({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const storageKey = `replaymethod:${candidate.id}:expert-review.v3`;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<"idle" | "autosaved" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!candidate.locked) {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) setDraft({ ...emptyDraft, ...JSON.parse(stored) as Draft });
        } catch { /* Corrupt local drafts fail closed to a fresh form. */ }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [candidate.locked, storageKey]);

  useEffect(() => {
    if (!hydrated || candidate.locked) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setState(current => current === "saving" || current === "error" ? current : "autosaved");
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [candidate.locked, draft, hydrated, storageKey]);

  if (candidate.locked) return <section className="rl-locked-review" aria-label="Locked independent judgment">
    <div><span>INDEPENDENT JUDGMENT LOCKED</span><b>{candidate.verdict.replaceAll("_", " ")}</b><small>This stable identity cannot revise the first judgment.</small></div>
    <dl><div><dt>Gameplay truth</dt><dd>{candidate.gameplayTruth ?? "uncertain"}</dd></div><div><dt>Timestamp</dt><dd>{candidate.timestampVerified == null ? "uncertain" : candidate.timestampVerified ? "verified" : "incorrect"}</dd></div><div><dt>Mode/rank context</dt><dd>{candidate.contextCorrect == null ? "uncertain" : candidate.contextCorrect ? "correct" : "incorrect"}</dd></div><div><dt>Coaching relevance</dt><dd>{candidate.coachingRelevance?.replaceAll("_", " ") ?? "uncertain"}</dd></div></dl>
    {candidate.notes && <p>{candidate.notes}</p>}
  </section>;

  const complete = Boolean(draft.gameplayTruth && draft.timestampResult && draft.contextResult && draft.coachingRelevance);
  const update = (field: keyof Draft, value: string) => setDraft(current => ({ ...current, [field]: value }));

  async function lock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete) return;
    if (!window.confirm("Lock this independent judgment? It cannot be revised after submission.")) return;
    setState("saving");
    setMessage("");
    const response = await fetch(`/api/admin/rl-review/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "Could not lock this review.");
      return;
    }
    localStorage.removeItem(storageKey);
    setState("saved");
    setMessage("Independent judgment locked in the versioned label set.");
    router.refresh();
  }

  return <form className="rl-review-form" onSubmit={lock}>
    <div className="rl-review-controls structured">
      <label><span>GAMEPLAY TRUTH</span><select required value={draft.gameplayTruth} onChange={event => update("gameplayTruth", event.target.value)}><option value="">Choose…</option><option value="present">Behavior is present</option><option value="absent">Behavior is absent</option><option value="uncertain">Cannot determine</option></select></label>
      <label><span>TIMESTAMP</span><select required value={draft.timestampResult} onChange={event => update("timestampResult", event.target.value)}><option value="">Choose…</option><option value="verified">Correct moment</option><option value="incorrect">Incorrect moment</option><option value="uncertain">Cannot determine</option></select></label>
      <label><span>MODE / RANK CONTEXT</span><select required value={draft.contextResult} onChange={event => update("contextResult", event.target.value)}><option value="">Choose…</option><option value="verified">Context is correct</option><option value="incorrect">Context is incorrect</option><option value="uncertain">Cannot determine</option></select></label>
      <label><span>COACHING RELEVANCE</span><select required value={draft.coachingRelevance} onChange={event => update("coachingRelevance", event.target.value)}><option value="">Choose…</option><option value="actionable">Actionable coaching point</option><option value="not_actionable">Not actionable</option><option value="uncertain">Cannot determine</option></select></label>
    </div>
    <label className="rl-review-notes"><span>REVIEW NOTES</span><textarea value={draft.notes} onChange={event => update("notes", event.target.value)} placeholder="What is present, missing or ambiguous in the gameplay evidence?" /></label>
    <div className="rl-review-lock-note"><b>First judgment only.</b><span>Your draft autosaves on this device. Other reviewers and detector output remain hidden until you lock it.</span></div>
    <div className="rl-review-save"><small className={state}>{message || (state === "autosaved" ? "Draft autosaved · safe to resume later" : "")}</small><button disabled={!complete || state === "saving"}>{state === "saving" ? "Locking…" : "Lock independent judgment →"}</button></div>
  </form>;
}

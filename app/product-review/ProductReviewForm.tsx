"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductReviewKind, ProductReviewSection } from "../../lib/product-review";

type ChecklistValue = { score: number | null; finding: string };
type Issue = { severity: string; problem: string; steps: string; suggestion: string };
type Evidence = { issueIndex: number; originalName: string; size: number; sha256: string };
type Initial = {
  state: string;
  checklist: Record<string, ChecklistValue>;
  issues: Issue[];
  evidence: Evidence[];
  overallRecommendation: string;
  sessionNotes: string;
  submittedAt: string | null;
};

const emptyIssue = (): Issue => ({ severity: "medium", problem: "", steps: "", suggestion: "" });

export default function ProductReviewForm({ reviewerPublicId, reviewKind, sections, initial }: { reviewerPublicId: string; reviewKind: ProductReviewKind; sections: ProductReviewSection[]; initial: Initial }) {
  const formRef = useRef<HTMLDivElement>(null);
  const storageKey = `replay-method:product-review:${reviewerPublicId}:${reviewKind}`;
  const normalizedChecklist = useMemo(() => Object.fromEntries(sections.map(section => {
    const saved = initial.checklist?.[section.key];
    return [section.key, { score: saved?.score ?? null, finding: saved?.finding ?? "" }];
  })), [initial.checklist, sections]);
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>(normalizedChecklist);
  const [issues, setIssues] = useState<Issue[]>(() => [...initial.issues, ...Array.from({ length: Math.max(0, 3 - initial.issues.length) }, emptyIssue)].slice(0, 5));
  const [evidenceFiles, setEvidenceFiles] = useState<Record<number, File>>({});
  const [securedEvidence, setSecuredEvidence] = useState(initial.evidence);
  const [overallRecommendation, setOverallRecommendation] = useState(initial.overallRecommendation);
  const [sessionNotes, setSessionNotes] = useState(initial.sessionNotes);
  const [state, setState] = useState(initial.state === "submitted" ? "submitted" : "idle");
  const [message, setMessage] = useState(initial.submittedAt ? `Submitted ${new Date(initial.submittedAt).toLocaleString("en-GB")}` : "");

  useEffect(() => {
    let restoreTimer = 0;
    let readyFrame = 0;
    const markReady = () => { readyFrame = window.requestAnimationFrame(() => formRef.current?.setAttribute("data-hydrated", "true")); };
    if (initial.state === "submitted") {
      markReady();
      return () => window.cancelAnimationFrame(readyFrame);
    }
    try {
      const local = JSON.parse(localStorage.getItem(storageKey) || "null") as { checklist?: Record<string, ChecklistValue>; issues?: Issue[]; overallRecommendation?: string; sessionNotes?: string } | null;
      if (!local) {
        markReady();
        return () => window.cancelAnimationFrame(readyFrame);
      }
      restoreTimer = window.setTimeout(() => {
        if (local.checklist) setChecklist(local.checklist);
        if (Array.isArray(local.issues)) setIssues([...local.issues, ...Array.from({ length: Math.max(0, 3 - local.issues.length) }, emptyIssue)].slice(0, 5));
        if (typeof local.overallRecommendation === "string") setOverallRecommendation(local.overallRecommendation);
        if (typeof local.sessionNotes === "string") setSessionNotes(local.sessionNotes);
        setMessage("Local draft restored on this device");
        markReady();
      }, 0);
    } catch { markReady(); }
    return () => { window.clearTimeout(restoreTimer); window.cancelAnimationFrame(readyFrame); };
  }, [initial.state, storageKey]);

  useEffect(() => {
    if (initial.state === "submitted") return;
    localStorage.setItem(storageKey, JSON.stringify({ checklist, issues, overallRecommendation, sessionNotes }));
  }, [checklist, issues, overallRecommendation, sessionNotes, initial.state, storageKey]);

  function updateChecklist(key: string, patch: Partial<ChecklistValue>) {
    setChecklist(current => ({ ...current, [key]: { ...current[key], ...patch } }));
    setState("idle");
    setMessage("Draft autosaved on this device");
  }

  function updateIssue(index: number, patch: Partial<Issue>) {
    setIssues(current => current.map((issue, issueIndex) => issueIndex === index ? { ...issue, ...patch } : issue));
    setState("idle");
    setMessage("Draft autosaved on this device");
  }

  async function save(nextState: "draft" | "submitted") {
    if (nextState === "submitted" && !window.confirm("Submit and lock this product review? You will not be able to edit it afterwards.")) return;
    setState("saving");
    setMessage(nextState === "submitted" ? "Submitting private review…" : "Saving private draft…");
    const form = new FormData();
    form.set("payload", JSON.stringify({ state: nextState, checklist, issues, overallRecommendation, sessionNotes }));
    Object.entries(evidenceFiles).forEach(([index, file]) => form.set(`issueEvidence-${index}`, file));
    const response = await fetch("/api/product-review", { method: "POST", body: form });
    const body = await response.json().catch(() => ({})) as { error?: string; submittedAt?: string; evidence?: Evidence[] };
    if (!response.ok) {
      setState("error");
      setMessage(body.error || "Could not save this review.");
      return;
    }
    setEvidenceFiles({});
    if (Array.isArray(body.evidence)) setSecuredEvidence(body.evidence);
    if (nextState === "submitted") {
      localStorage.removeItem(storageKey);
      setState("submitted");
      setMessage(`Submitted and locked ${body.submittedAt ? new Date(body.submittedAt).toLocaleString("en-GB") : ""}`);
    } else {
      setState("saved");
      setMessage("Private draft saved · safe to resume on another device");
    }
  }

  const locked = state === "submitted";
  const title = reviewKind === "commercial" ? "Commercial checklist" : "UX / funnel checklist";

  return <div ref={formRef} data-hydrated="false" className={`product-review-form ${locked ? "locked" : ""}`}>
    <section className="product-review-checklist"><header><span>01 · STRUCTURED ASSESSMENT</span><h2>{title}</h2><p>Score 1 = broken or absent, 5 = convincing and complete. Record the observation behind every score.</p></header>{sections.map(section => <article key={section.key}><div><span>{section.label}</span><b>{section.prompt}</b></div><label><span>SCORE</span><select aria-label={`${section.label} score`} disabled={locked} value={checklist[section.key]?.score ?? ""} onChange={event => updateChecklist(section.key, { score: Number(event.target.value) || null })}><option value="">Choose 1–5</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select></label><label><span>EVIDENCE / FINDING</span><textarea aria-label={`${section.label} finding`} disabled={locked} value={checklist[section.key]?.finding ?? ""} onChange={event => updateChecklist(section.key, { finding: event.target.value })} placeholder="What did you observe in the real journey?" /></label></article>)}</section>

    <section className="product-review-issues"><header><span>02 · REPRODUCIBLE ISSUES</span><h2>Problems, steps and fixes</h2><p>Leave unused issue cards blank. Evidence is private and accepts PNG, JPG, WebP, MP4, WebM or MOV.</p></header>{issues.map((issue, index) => <article key={index}><div className="product-issue-head"><b>Issue {index + 1}</b><select aria-label={`Issue ${index + 1} severity`} disabled={locked} value={issue.severity} onChange={event => updateIssue(index, { severity: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div><label><span>CONCRETE PROBLEM</span><textarea aria-label={`Issue ${index + 1} problem`} disabled={locked} value={issue.problem} onChange={event => updateIssue(index, { problem: event.target.value })} /></label><label><span>EXACT STEPS / LOCATION</span><textarea aria-label={`Issue ${index + 1} steps`} disabled={locked} value={issue.steps} onChange={event => updateIssue(index, { steps: event.target.value })} /></label><label><span>IMPROVEMENT SUGGESTION</span><textarea aria-label={`Issue ${index + 1} suggestion`} disabled={locked} value={issue.suggestion} onChange={event => updateIssue(index, { suggestion: event.target.value })} /></label><label className="product-evidence"><span>SCREENSHOT / SHORT RECORDING · MAX 8 MB</span><input aria-label={`Issue ${index + 1} evidence`} disabled={locked} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" onChange={event => { const file = event.target.files?.[0]; if (file) { setEvidenceFiles(current => ({ ...current, [index]: file })); setMessage("Evidence selected · save the private draft to upload it"); } }} />{evidenceFiles[index] && <small>Ready to upload: {evidenceFiles[index].name}</small>}{!evidenceFiles[index] && securedEvidence.find(item => item.issueIndex === index) && <small>Secured privately: {securedEvidence.find(item => item.issueIndex === index)?.originalName}</small>}</label></article>)}{issues.length < 5 && !locked && <button className="product-add-issue" type="button" onClick={() => { setIssues(current => [...current, emptyIssue()]); setMessage("Draft autosaved on this device"); }}>Add another issue →</button>}</section>

    <section className="product-review-close"><header><span>03 · DECISION</span><h2>Make the next move explicit</h2></header><label><span>OVERALL RECOMMENDATION</span><textarea aria-label="Overall recommendation" disabled={locked} value={overallRecommendation} onChange={event => { setOverallRecommendation(event.target.value); setState("idle"); setMessage("Draft autosaved on this device"); }} placeholder="Ship, change or stop—and why?" /></label><label><span>SESSION NOTES / TEST CONTEXT</span><textarea aria-label="Session notes" disabled={locked} value={sessionNotes} onChange={event => { setSessionNotes(event.target.value); setState("idle"); setMessage("Draft autosaved on this device"); }} placeholder="Device, viewport, path tested, expectations and any limitations." /></label><div className="product-review-actions"><small className={state}>{message}</small>{!locked && <><button type="button" disabled={state === "saving"} onClick={() => save("draft")}>Save private draft</button><button type="button" disabled={state === "saving"} onClick={() => save("submitted")}>Submit & lock review →</button></>}</div></section>
  </div>;
}

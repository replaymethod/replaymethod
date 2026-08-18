"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  id: number;
  verdict: string;
  timestampVerified: boolean | null;
  notes: string | null;
};

export default function ReviewCandidateForm({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState(candidate.verdict);
  const [timestampVerified, setTimestampVerified] = useState(candidate.timestampVerified == null ? "unknown" : candidate.timestampVerified ? "yes" : "no");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const response = await fetch(`/api/admin/rl-review/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict,
        timestampVerified: timestampVerified === "unknown" ? null : timestampVerified === "yes",
        notes
      })
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "Could not save this review.");
      return;
    }
    setState("saved");
    setMessage("Saved to the versioned expert label set.");
    router.refresh();
  }

  return <form className="rl-review-form" onSubmit={save}>
    <div className="rl-review-controls">
      <label><span>VERDICT</span><select value={verdict} onChange={event => setVerdict(event.target.value)}><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed signal</option><option value="rejected">False positive</option><option value="uncertain">Uncertain</option></select></label>
      <label><span>TIMESTAMP</span><select value={timestampVerified} onChange={event => setTimestampVerified(event.target.value)}><option value="unknown">Not checked</option><option value="yes">Verified</option><option value="no">Incorrect</option></select></label>
    </div>
    <label className="rl-review-notes"><span>REVIEW NOTES</span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="What makes this useful, wrong or ambiguous?" /></label>
    <div className="rl-review-save"><small className={state}>{message}</small><button disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save review →"}</button></div>
  </form>;
}

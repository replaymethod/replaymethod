"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Reviewer = { id: number; status: string; qualification: string; };

export default function ReviewerAccessForm({ reviewer }: { reviewer: Reviewer }) {
  const router = useRouter();
  const [qualification, setQualification] = useState(reviewer.qualification === "unverified" ? "competitive_player" : reviewer.qualification);
  const [state, setState] = useState("idle");

  async function update(status: "active" | "revoked") {
    setState("saving");
    const response = await fetch("/api/admin/rl-reviewers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewer.id, status, qualification })
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return <div className="reviewer-access-form">
    <select aria-label="Reviewer qualification" value={qualification} onChange={event => setQualification(event.target.value)}>
      <option value="competitive_player">Competitive player</option>
      <option value="rocket_league_coach">Rocket League coach</option>
      <option value="replay_analyst">Replay analyst</option>
    </select>
    {reviewer.status !== "active" && <button type="button" onClick={() => update("active")} disabled={state === "saving"}>Approve</button>}
    {reviewer.status === "active" && <button type="button" onClick={() => update("revoked")} disabled={state === "saving"}>Revoke</button>}
    <small>{state === "error" ? "Could not save" : state === "saved" ? "Saved" : ""}</small>
  </div>;
}

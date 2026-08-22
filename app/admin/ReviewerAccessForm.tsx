"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Reviewer = { id: number; status: string; qualification: string; playlistQualificationsJson: string; };

const ranks = ["unverified", "Gold I", "Gold II", "Gold III", "Platinum I", "Platinum II", "Platinum III", "Diamond I", "Diamond II", "Diamond III", "Champion I", "Champion II", "Champion III", "Grand Champion I", "Grand Champion II", "Grand Champion III", "Supersonic Legend"];

function initialScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => [mode, typeof parsed[mode] === "string" ? parsed[mode] : "unverified"]));
  } catch {
    return { "1v1": "unverified", "2v2": "unverified", "3v3": "unverified" };
  }
}

export default function ReviewerAccessForm({ reviewer }: { reviewer: Reviewer }) {
  const router = useRouter();
  const [qualification, setQualification] = useState(reviewer.qualification === "unverified" ? "competitive_player" : reviewer.qualification);
  const [playlistQualifications, setPlaylistQualifications] = useState(() => initialScopes(reviewer.playlistQualificationsJson));
  const [state, setState] = useState("idle");

  async function update(status: "active" | "revoked") {
    setState("saving");
    const response = await fetch("/api/admin/rl-reviewers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewer.id, status, qualification, playlistQualifications })
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
    {(["1v1", "2v2", "3v3"] as const).map(mode => <label key={mode}><span>{mode} verified peak</span><select aria-label={`${mode} qualification`} value={playlistQualifications[mode]} onChange={event => setPlaylistQualifications(current => ({ ...current, [mode]: event.target.value }))}>{ranks.map(rank => <option value={rank} key={rank}>{rank === "unverified" ? "Not verified" : rank}</option>)}</select></label>)}
    {reviewer.status !== "active" && <button type="button" onClick={() => update("active")} disabled={state === "saving"}>Approve</button>}
    {reviewer.status === "active" && <button type="button" onClick={() => update("revoked")} disabled={state === "saving"}>Revoke</button>}
    <small>{state === "error" ? "Could not save" : state === "saved" ? "Saved" : ""}</small>
  </div>;
}

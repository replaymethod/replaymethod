"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Reviewer = { id: number; status: string; qualification: string; playlistQualificationsJson: string; platform: string | null; qualificationNotes: string | null; };

const ranks = ["unverified", "Gold I", "Gold II", "Gold III", "Platinum I", "Platinum II", "Platinum III", "Diamond I", "Diamond II", "Diamond III", "Champion I", "Champion II", "Champion III", "Grand Champion I", "Grand Champion II", "Grand Champion III", "Supersonic Legend"];

function initialScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => {
      const legacy = typeof parsed[mode] === "string" ? parsed[mode] as string : null;
      const scope = parsed[mode] && typeof parsed[mode] === "object" ? parsed[mode] as Record<string, unknown> : {};
      return [mode, {
        currentRank: typeof scope.currentRank === "string" ? scope.currentRank : legacy ?? "unverified",
        highestRank: typeof scope.highestRank === "string" ? scope.highestRank : legacy ?? "unverified"
      }];
    }));
  } catch {
    return Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => [mode, { currentRank: "unverified", highestRank: "unverified" }]));
  }
}

export default function ReviewerAccessForm({ reviewer }: { reviewer: Reviewer }) {
  const router = useRouter();
  const [qualification, setQualification] = useState(reviewer.qualification === "unverified" ? "competitive_player" : reviewer.qualification);
  const [playlistQualifications, setPlaylistQualifications] = useState(() => initialScopes(reviewer.playlistQualificationsJson));
  const [platform, setPlatform] = useState(reviewer.platform ?? "epic");
  const [qualificationNotes, setQualificationNotes] = useState(reviewer.qualificationNotes ?? "");
  const [qualificationConfirmed, setQualificationConfirmed] = useState(reviewer.status === "active");
  const [state, setState] = useState("idle");

  async function update(status: "active" | "revoked") {
    setState("saving");
    const response = await fetch("/api/admin/rl-reviewers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewer.id, status, qualification, platform, qualificationNotes, qualificationConfirmed, playlistQualifications })
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return <div className="reviewer-access-form">
    <select aria-label="Reviewer qualification" value={qualification} onChange={event => setQualification(event.target.value)}>
      <option value="competitive_player">Competitive player</option>
      <option value="rocket_league_coach">Rocket League coach</option>
      <option value="replay_analyst">Replay analyst</option>
      <option value="owner_control">Owner control (excluded)</option>
    </select>
    <label><span>Verified platform</span><select aria-label="Reviewer platform" value={platform} onChange={event => setPlatform(event.target.value)}><option value="epic">Epic</option><option value="steam">Steam</option><option value="playstation">PlayStation</option><option value="xbox">Xbox</option><option value="switch">Switch</option></select></label>
    {(["1v1", "2v2", "3v3"] as const).map(mode => <div className="reviewer-rank-pair" key={mode}><b>{mode}</b><label><span>Current rank</span><select aria-label={`${mode} current rank`} value={playlistQualifications[mode].currentRank} onChange={event => setPlaylistQualifications(current => ({ ...current, [mode]: { ...current[mode], currentRank: event.target.value } }))}>{ranks.map(rank => <option value={rank} key={rank}>{rank === "unverified" ? "Not verified" : rank}</option>)}</select></label><label><span>Highest rank</span><select aria-label={`${mode} highest rank`} value={playlistQualifications[mode].highestRank} onChange={event => setPlaylistQualifications(current => ({ ...current, [mode]: { ...current[mode], highestRank: event.target.value } }))}>{ranks.map(rank => <option value={rank} key={rank}>{rank === "unverified" ? "Not verified" : rank}</option>)}</select></label></div>)}
    <label><span>Verification record</span><textarea aria-label="Qualification verification record" value={qualificationNotes} onChange={event => setQualificationNotes(event.target.value)} placeholder="How identity, platform, current rank and peak were verified; note provisional claims." /></label>
    <label className="reviewer-confirmation"><input type="checkbox" checked={qualificationConfirmed} onChange={event => setQualificationConfirmed(event.target.checked)} /><span>Identity, platform, current rank and historical peak are confirmed—not provisional.</span></label>
    {reviewer.status !== "active" && <button type="button" onClick={() => update("active")} disabled={state === "saving"}>Approve</button>}
    {reviewer.status === "active" && <button type="button" onClick={() => update("revoked")} disabled={state === "saving"}>Revoke</button>}
    <small>{state === "error" ? "Could not save" : state === "saved" ? "Saved" : ""}</small>
  </div>;
}

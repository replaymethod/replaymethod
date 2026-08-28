export const RL_LABEL_SET_VERSION = "rocket-league-expert-labels.v4-opportunity";
export const RL_PRIVATE_REVIEW_SET = Object.freeze({
  id: "engine-foundation-0.5-opportunity-calibration-2026-08-26.v1",
  queueSchemaVersion: "rocket-league-opportunity-review-queue.v1",
  sourceCorpusAssignment: "calibration_dev",
  sourceReportFingerprint: "9a468554eb76498d04de36203542a30fb0cb741f16b54f5687ba1d3a04d4a75c",
  candidateCount: 343,
  replayCount: 85,
  queueSha256: "5610880fa34b1688064139f0fe1fe06ec53152ad6cd729d94a4ada3448d6062d",
  momentsSha256: "934ca81ea5fca8858a43fe35b64cbfdddb4305934bbc0081438f91fb555c9871",
  queueContentSha256: "493fb7be6747439124e857fa6a744f6354a93853d8d1c330d1998ce06c3b3af3",
  momentsContentSha256: "a53a0eda796edd8534846c921da6e4afc754e81db3da74ef1ea55d19af5628c7",
  corpusManifestSha256: "dac9ed20e482ed8258b4ad0614173d162427fefe5c0ddbee58d7ce749e9843b9",
  holdoutReportSha256: "14cea7c08d831c69a061f1bc3cd4fac30d3c673deac938b8c4f2687becdf9f30",
  holdoutReproducibilityFingerprint: "e514f24febc556ce2eb57a4678d422f24af09dbba6eda338e6a67f815e449b3c",
});
export const RL_REVIEW_VERDICTS = ["unreviewed", "confirmed", "rejected", "uncertain"] as const;
export type RlReviewVerdict = typeof RL_REVIEW_VERDICTS[number];

type ReviewPassCandidate = {
  candidateKey: string;
  detectorId: string;
  contextKey?: string | null;
  observationJson: string;
};

function reviewStratum(candidate: ReviewPassCandidate) {
  let opportunityStatus = "unknown";
  try {
    const observation = JSON.parse(candidate.observationJson) as Record<string, unknown>;
    if (typeof observation.opportunityStatus === "string") opportunityStatus = observation.opportunityStatus;
  } catch { /* Invalid observations remain isolated in an explicit unknown stratum. */ }
  return `${candidate.detectorId}:${opportunityStatus}:${candidate.contextKey ?? "unknown"}`;
}

export function splitRlReviewPasses<T extends ReviewPassCandidate>(candidates: T[]) {
  const strata = Map.groupBy(candidates, reviewStratum);
  const first: T[] = [];
  const second: T[] = [];
  for (const key of [...strata.keys()].sort()) {
    const rows = [...(strata.get(key) ?? [])].sort((left, right) => left.candidateKey.localeCompare(right.candidateKey));
    const firstGetsOdd = first.length <= second.length;
    rows.forEach((row, index) => {
      const destination = (index % 2 === 0) === firstGetsOdd ? first : second;
      destination.push(row);
    });
  }
  return {
    first: first.sort((left, right) => left.candidateKey.localeCompare(right.candidateKey)),
    second: second.sort((left, right) => left.candidateKey.localeCompare(right.candidateKey)),
  };
}

export function isRlReviewVerdict(value: unknown): value is RlReviewVerdict {
  return typeof value === "string" && (RL_REVIEW_VERDICTS as readonly string[]).includes(value);
}

export function detectorName(detectorId: string) {
  return ({
    "boost.zero_duration": "Zero-boost exposure",
    "boost.supersonic_waste": "Supersonic boost waste",
    "kickoff.speed": "Kickoff arrival",
    "possession.first_touch": "First-touch control",
    "challenge.dive": "Risky challenge",
    "rotation.spacing_too_close": "Compressed spacing",
    "teamplay.double_commit": "Double commit",
    "recovery.momentum_loss": "Momentum loss",
    "possession.first_touch_retention": "First-touch retention",
    "challenge.quality": "Challenge quality",
    "recovery.reentry_quality": "Recovery re-entry"
  } as Record<string, string>)[detectorId] ?? detectorId;
}

export function reviewerPlaylistScopes(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
    return new Set(["1v1", "2v2", "3v3"].filter(mode => {
      const scope = parsed[mode];
      if (typeof scope === "string") return scope !== "unverified";
      if (!scope || typeof scope !== "object") return false;
      const ranks = scope as Record<string, unknown>;
      return typeof ranks.highestRank === "string" && ranks.highestRank !== "unverified";
    }));
  } catch {
    return new Set<string>();
  }
}

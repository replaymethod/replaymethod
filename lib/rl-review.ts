export const RL_LABEL_SET_VERSION = "rocket-league-expert-labels.v3";
export const RL_PRIVATE_REVIEW_SET = Object.freeze({
  id: "kickoff-calibration-2026-08-22.v1",
  candidateCount: 102,
  replayCount: 64,
  queueSha256: "937b94d07e31acc746e12424350c694770a63e5e0cdc63d2199eb6d390e533d7",
  momentsSha256: "895c21b10c43bd81ca01c5c4b5a83926f4a18c18cacfa363cb05771c7145466e",
  corpusManifestSha256: "66be35f92e7a7770e34d78a0ddf8caca8551314e1173073ce66adee6da435b01",
  holdoutReportSha256: "7962e90e45e3dc3679f1ccce81a7fff7c928242946b870fd66bef83db77ac3ac",
  holdoutReproducibilityFingerprint: "1ea5dfe44630d708f9be7553d8005ebc371c69ea16816fb227f274aabdfd7309",
});
export const RL_REVIEW_VERDICTS = ["unreviewed", "confirmed", "rejected", "uncertain"] as const;
export type RlReviewVerdict = typeof RL_REVIEW_VERDICTS[number];
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
    "recovery.momentum_loss": "Momentum loss"
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

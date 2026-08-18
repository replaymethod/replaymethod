export const COACH_REPORT_VERSION = "rocket-league-coach-report.v1";

const prescriptions = Object.freeze({
  "boost.zero_duration": {
    title: "Protect your usable boost reserve",
    queueRule: "Before committing, name the exit pad or keep enough boost to recover goal-side.",
    practice: "Play three matches while tracking only whether every commitment has an exit route.",
    successMetric: "Reduce costly zero-boost windows in live play across the next three matches.",
  },
  "boost.supersonic_waste": {
    title: "Stop paying boost for speed you already have",
    queueRule: "At supersonic speed, release boost unless it changes your line or preserves momentum through contact.",
    practice: "Run recovery routes while holding supersonic with throttle, flips and small pads instead of continuous boost.",
    successMetric: "Reduce boost spent while already supersonic without slowing useful arrival times.",
  },
  "kickoff.speed": {
    title: "Make your kickoff contact repeatable",
    queueRule: "Use one spawn-specific kickoff and judge it by contact position, not only by possession outcome.",
    practice: "Repeat each spawn in freeplay until arrival time and contact gap stay inside your target band.",
    successMetric: "Keep kickoff arrival and contact within the calibrated band over the next ten kickoffs.",
  },
  "possession.first_touch": {
    title: "Make the first touch preserve an option",
    queueRule: "Before contact, choose control, clear or pass; do not let the first touch choose for you.",
    practice: "Alternate catch, soft touch and purposeful clear from the same setup in freeplay.",
    successMetric: "Increase first touches that retain possession or create a deliberate next action.",
  },
  "challenge.dive": {
    title: "Challenge without removing yourself from the play",
    queueRule: "If you cannot win cleanly and coverage is weak, fake, shadow or force instead of diving.",
    practice: "In three matches, label every approach win, force or contain before pressing the challenge.",
    successMetric: "Reduce avoidable commitments that leave no useful recovery or teammate coverage.",
  },
  "rotation.spacing_too_close": {
    title: "Restore layered teammate spacing",
    queueRule: "Support the next play from a different lane and depth than the teammate on the ball.",
    practice: "Use teammate nameplates as a trigger: if lanes overlap, widen or delay before committing.",
    successMetric: "Reduce sustained spacing windows that duplicate the same coverage.",
  },
  "teamplay.double_commit": {
    title: "Keep one layer behind the challenge",
    queueRule: "When a teammate can touch first, cover the next outcome instead of joining the same ball.",
    practice: "Review ten contested balls and state first man, support and safety before playback continues.",
    successMetric: "Reduce simultaneous same-ball commitments across the next three matches.",
  },
  "recovery.momentum_loss": {
    title: "Recover into the next useful job",
    queueRule: "Land wheels-first toward the next lane and use the nearest small-pad route back into coverage.",
    practice: "Chain aerial, landing, half-flip and wavedash recoveries without stopping in freeplay.",
    successMetric: "Reduce avoidable low-speed time while far from the ball during live play.",
  },
});

function score(finding) {
  const recurrence = Math.min(1, Math.max(0, finding.recurrence ?? 0));
  const impact = Math.min(1, Math.max(0, finding.impact ?? 0));
  const confidence = Math.min(1, Math.max(0, finding.confidence ?? 0));
  const trainability = Math.min(1, Math.max(0, finding.trainability ?? 0.8));
  return recurrence * 0.35 + impact * 0.3 + confidence * 0.25 + trainability * 0.1;
}

/**
 * Turn calibrated deterministic findings into one deliberately narrow plan.
 * Language never upgrades a shadow observation into a public fact.
 */
export function composeCoachReport(findings, context = {}) {
  const eligible = (findings ?? []).filter((finding) => finding?.qualityGate?.eligible === true && prescriptions[finding.detectorId]);
  if (!eligible.length) {
    return {
      schemaVersion: COACH_REPORT_VERSION,
      status: "insufficient_evidence",
      public: false,
      reason: "No detector cleared the evidence quality gate for this replay.",
      limitations: ["The replay may contain useful patterns, but the current calibrated detectors cannot support a reliable coaching claim."],
    };
  }

  const ranked = eligible.map((finding) => ({ ...finding, priorityScore: score(finding) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const primary = ranked[0];
  const prescription = prescriptions[primary.detectorId];
  return {
    schemaVersion: COACH_REPORT_VERSION,
    status: "ready",
    public: true,
    game: "rocket-league",
    subject: context.subject ?? null,
    mode: context.mode ?? null,
    primaryFocus: {
      detectorId: primary.detectorId,
      detectorVersion: primary.detectorVersion,
      title: prescription.title,
      priorityScore: primary.priorityScore,
      confidence: primary.confidence,
      recurrence: primary.recurrence,
      evidence: (primary.evidence ?? []).slice(0, 3),
      queueRule: prescription.queueRule,
      practice: prescription.practice,
      successMetric: prescription.successMetric,
      reviewWindowMatches: 3,
    },
    supportingObservations: ranked.slice(1, 3).map((finding) => ({
      detectorId: finding.detectorId,
      title: prescriptions[finding.detectorId].title,
      confidence: finding.confidence,
    })),
    limitations: ["This report covers only calibrated, telemetry-supported behavior and may abstain from unmeasurable decisions."],
  };
}

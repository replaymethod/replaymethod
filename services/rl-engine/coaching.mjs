import { resolveFindings } from "./finding-policy.mjs";

export const COACH_REPORT_VERSION = "rocket-league-coach-report.v1";

const prescriptions = Object.freeze({
  "boost.zero_duration": {
    title: "Protect your usable boost reserve",
    queueRule: "Before committing, name the exit pad or keep enough boost to recover goal-side.",
    practice: "Play three matches while tracking only whether every commitment has an exit route.",
    successMetric: "Reduce costly zero-boost windows in live play across the next three matches.",
    dosage: "Three matches, then one replay review; do not extend the focus without new evidence.",
    exclude: "Do not also rebuild kickoff or shooting mechanics during this focus window.",
    returnToPlay: "Return to ranked after a short route rehearsal and carry only the exit-pad cue.",
    laterEvidence: "Comparable live-play commitments show fewer material zero-boost exposure windows.",
    failureEvidence: "Exposure stays flat or rises across three comparable matches despite following the cue.",
  },
  "boost.supersonic_waste": {
    title: "Stop paying boost for speed you already have",
    queueRule: "At supersonic speed, release boost unless it changes your line or preserves momentum through contact.",
    practice: "Run recovery routes while holding supersonic with throttle, flips and small pads instead of continuous boost.",
    successMetric: "Reduce boost spent while already supersonic without slowing useful arrival times.",
    dosage: "Five minutes of route rehearsal, then three matches using one throttle-versus-boost cue.",
    exclude: "Do not chase a lower boost number if it makes useful arrival later.",
    returnToPlay: "Queue when supersonic maintenance can be repeated without conscious button focus.",
    laterEvidence: "Wasted boost falls while useful arrival time and reserve do not degrade.",
    failureEvidence: "Boost use falls but the player arrives later or loses required speed through contact.",
  },
  "kickoff.speed": {
    title: "Make your kickoff contact repeatable",
    queueRule: "Use one spawn-specific kickoff and judge it by contact position, not only by possession outcome.",
    practice: "Repeat each spawn in freeplay until arrival time and contact gap stay inside your target band.",
    successMetric: "Keep kickoff arrival and contact within the calibrated band over the next ten kickoffs.",
    dosage: "Ten repetitions per spawn, then observe at least ten real kickoffs.",
    exclude: "Do not switch kickoff technique based on one possession outcome.",
    returnToPlay: "Queue after arrival and contact are repeatable in rehearsal, not necessarily perfect.",
    laterEvidence: "Spawn-specific arrival and contact remain inside the validated band across real matches.",
    failureEvidence: "Timing variance or contact error remains outside the band over the observation window.",
  },
  "possession.first_touch": {
    title: "Make the first touch preserve an option",
    queueRule: "Before contact, choose control, clear or pass; do not let the first touch choose for you.",
    practice: "Alternate catch, soft touch and purposeful clear from the same setup in freeplay.",
    successMetric: "Increase first touches that retain possession or create a deliberate next action.",
    dosage: "Five minutes alternating three touch intentions, then three matches naming the intention before contact.",
    exclude: "Do not optimize touch softness without considering pressure and available space.",
    returnToPlay: "Queue when control, clear and pass can each be chosen from the same setup.",
    laterEvidence: "Comparable first touches retain a deliberate next option more often.",
    failureEvidence: "The chosen touch still gives the opponent the next uncontested action in comparable space.",
  },
  "challenge.dive": {
    title: "Challenge without removing yourself from the play",
    queueRule: "If you cannot win cleanly and coverage is weak, fake, shadow or force instead of diving.",
    practice: "In three matches, label every approach win, force or contain before pressing the challenge.",
    successMetric: "Reduce avoidable commitments that leave no useful recovery or teammate coverage.",
    dosage: "Three matches classifying each approach as win, force or contain.",
    exclude: "Do not become passive; the target is commitment quality, not fewer challenges at any cost.",
    returnToPlay: "Queue after the win/force/contain decision can be stated quickly from varied setups.",
    laterEvidence: "Comparable approaches preserve coverage or recovery more often without conceding free pressure.",
    failureEvidence: "Fewer dives are offset by uncontested opponent control, or risky commitments continue.",
  },
  "rotation.spacing_too_close": {
    title: "Restore layered teammate spacing",
    queueRule: "Support the next play from a different lane and depth than the teammate on the ball.",
    practice: "Use teammate nameplates as a trigger: if lanes overlap, widen or delay before committing.",
    successMetric: "Reduce sustained spacing windows that duplicate the same coverage.",
    dosage: "Review ten teammate-ball moments, then three matches using the lane-and-depth cue.",
    exclude: "Do not maximize teammate distance; useful support can still be close.",
    returnToPlay: "Queue when the player can name their different lane or depth before joining the play.",
    laterEvidence: "Comparable team possessions show fewer sustained same-lane coverage overlaps.",
    failureEvidence: "Overlap falls but passes and challenge support disappear, or duplicate coverage persists.",
  },
  "teamplay.double_commit": {
    title: "Keep one layer behind the challenge",
    queueRule: "When a teammate can touch first, cover the next outcome instead of joining the same ball.",
    practice: "Review ten contested balls and state first man, support and safety before playback continues.",
    successMetric: "Reduce simultaneous same-ball commitments across the next three matches.",
    dosage: "Ten paused contested-ball reviews, then three matches carrying only the cover-next-outcome cue.",
    exclude: "Do not avoid every shared challenge; verify which player actually has first access.",
    returnToPlay: "Queue after first, support and safety roles can be named in varied clips.",
    laterEvidence: "Comparable contests retain a usable second layer more often.",
    failureEvidence: "Same-ball commitments persist or excessive hesitation gives away uncontested balls.",
  },
  "recovery.momentum_loss": {
    title: "Recover into the next useful job",
    queueRule: "Land wheels-first toward the next lane and use the nearest small-pad route back into coverage.",
    practice: "Chain aerial, landing, half-flip and wavedash recoveries without stopping in freeplay.",
    successMetric: "Reduce avoidable low-speed time while far from the ball during live play.",
    dosage: "Five recovery chains per side, then three matches using the next-useful-job cue.",
    exclude: "Do not maximize speed when a controlled defensive reset is the correct job.",
    returnToPlay: "Queue after landing direction and the nearest useful lane can be chosen consistently.",
    laterEvidence: "Comparable recoveries restore useful coverage faster without creating new overcommits.",
    failureEvidence: "Low-speed re-entry time persists or faster recovery creates worse positioning.",
  },
});

/**
 * Turn calibrated deterministic findings into one deliberately narrow plan.
 * Language never upgrades a shadow observation into a public fact.
 */
export function composeCoachReport(findings, context = {}) {
  const resolution = resolveFindings(findings, {
    context,
    history: context.history,
    enabledDetectorIds: context.enabledDetectorIds,
  });
  const eligible = resolution.selected.filter((finding) => prescriptions[finding.detectorId]);
  if (!eligible.length) {
    return {
      schemaVersion: COACH_REPORT_VERSION,
      status: "insufficient_evidence",
      public: false,
      reason: "No detector cleared the evidence quality gate for this replay.",
      limitations: ["The replay may contain useful patterns, but the current calibrated detectors cannot support a reliable coaching claim."],
      abstentions: resolution.suppressed,
    };
  }

  const ranked = eligible.map((finding) => ({ ...finding, priorityScore: finding.priority.score }));
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
      dosage: prescription.dosage,
      doNotFocusOn: prescription.exclude,
      returnToPlay: prescription.returnToPlay,
      successMetric: prescription.successMetric,
      laterEvidence: prescription.laterEvidence,
      interventionFailureEvidence: prescription.failureEvidence,
      reviewWindowMatches: 3,
      priorityRationale: primary.priority.components,
    },
    supportingObservations: ranked.slice(1, 3).map((finding) => ({
      detectorId: finding.detectorId,
      title: prescriptions[finding.detectorId].title,
      confidence: finding.confidence,
    })),
    limitations: ["This report covers only calibrated, telemetry-supported behavior and may abstain from unmeasurable decisions."],
    suppressedFindings: resolution.suppressed,
  };
}

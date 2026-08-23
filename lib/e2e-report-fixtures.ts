import type { PublicReportData } from "./report-data";

const ids = {
  loading: "11111111111111111111111111111111",
  blocked: "22222222222222222222222222222222",
  ready: "33333333333333333333333333333333",
  stale: "44444444444444444444444444444444",
  identity: "55555555555555555555555555555555",
  abstained: "66666666666666666666666666666666",
} as const;

function sqlTimestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function performanceFixture(): NonNullable<PublicReportData["performance"]> {
  const common = { status: "neutral" as const, version: "rocket-league-performance-snapshot@e2e", sampleCount: 3000 };
  return {
    version: "rocket-league-performance-snapshot@e2e",
    match: { teamScore: 3, opponentScore: 2, result: "win", overtime: true, durationSeconds: 327 },
    sample: { liveFrameCount: 3000, liveSeconds: 300, frameCoverage: { ball: 1, players: 1 } },
    strength: { title: "Defensive contribution", detail: "The scoreboard recorded 3 saves for you in this match.", kind: "verified_fact", limitation: "Saves do not describe every defensive decision." },
    metrics: [
      { ...common, id: "scoreboard_contribution", category: "offense_defense", label: "Scoreboard contribution", displayValue: "1 G · 1 A · 3 S · 4 shots", value: 640, unit: "score", status: "strong", kind: "verified_fact", whatHappened: "The replay scoreboard recorded direct contributions.", whyItMatters: "It confirms recorded match outcomes.", limitation: "It does not explain decision quality.", source: "replay_metadata.player_stats" },
      { ...common, id: "average_boost", category: "boost_economy", label: "Average boost reserve", displayValue: "42%", value: 42, unit: "percent", kind: "derived_metric", whatHappened: "Average sampled live-play boost.", whyItMatters: "Reserve affects available options.", limitation: "An average cannot judge each spend.", source: "frame_state.player_boost" },
      { ...common, id: "zero_boost_time", category: "boost_economy", label: "Time at zero boost", displayValue: "8.4s", value: 8.4, unit: "seconds", kind: "derived_metric", whatHappened: "Live-play time at zero boost.", whyItMatters: "Zero reserve can limit recovery options.", limitation: "Zero boost is not automatically a mistake.", source: "frame_state.player_boost" },
      { ...common, id: "average_speed", category: "movement_recovery", label: "Average live-play speed", displayValue: "1,452 uu/s", value: 1452, unit: "uu/s", kind: "derived_metric", whatHappened: "Mean car speed during live play.", whyItMatters: "It describes match tempo.", limitation: "Higher is not always better.", source: "frame_state.linear_velocity" },
      { ...common, id: "touches", category: "possession_touches", label: "Recorded touches", displayValue: "31", value: 31, unit: "touches", kind: "verified_telemetry", whatHappened: "The parser attributed 31 touches to Turtle.", whyItMatters: "Touches locate direct possession involvement.", limitation: "Count cannot classify touch quality.", source: "episode_timeline.touch" },
      { ...common, id: "average_ball_distance", category: "positioning", label: "Average distance to ball", displayValue: "2,640 uu", value: 2640, unit: "uu", kind: "derived_metric", whatHappened: "Mean live-play distance to the ball.", whyItMatters: "It describes depth relative to play.", limitation: "Distance alone cannot infer rotation role.", source: "frame_state.player_ball_distance" },
    ],
    moments: [
      { id: "goal:1", title: "Your goal changed the scoreline", context: "Overtime goal", observation: "The replay recorded your final touch as the scorer.", consequence: "Your team added one goal.", betterAlternative: null, limitation: "The goal does not prove every earlier decision was optimal.", timestampSeconds: 227, gameClockSeconds: 0, frameStart: 2270, frameEnd: 2270, evidenceKind: "verified_telemetry", source: "episode_timeline.goal_context", version: "rocket-league-performance-snapshot@e2e" },
      { id: "control:1", title: "Controlled possession", context: "Neutral third", observation: "Three touches remained connected in one controlled sequence.", consequence: "The play preserved another on-ball action.", betterAlternative: null, limitation: "Duration does not prove maximum threat.", timestampSeconds: 176, gameClockSeconds: 124, frameStart: 1760, frameEnd: 1800, evidenceKind: "verified_telemetry", source: "episode_timeline.controlled_play", version: "rocket-league-performance-snapshot@e2e" },
      { id: "pass:1", title: "Completed pass sequence", context: "Team possession", observation: "Your touch was linked to a teammate reception.", consequence: "Possession moved to a teammate.", betterAlternative: null, limitation: "Completion does not prove best choice.", timestampSeconds: 143, gameClockSeconds: 157, frameStart: 1430, frameEnd: 1450, evidenceKind: "verified_telemetry", source: "episode_timeline.pass", version: "rocket-league-performance-snapshot@e2e" },
      { id: "kickoff:1", title: "Kickoff contact", context: "Diagonal spawn", observation: "You reached the ball in 1.96 seconds.", consequence: "The immediate outcome was recorded as neutral.", betterAlternative: null, limitation: "One kickoff cannot establish repeatable quality.", timestampSeconds: 12, gameClockSeconds: 300, frameStart: 120, frameEnd: 125, evidenceKind: "verified_telemetry", source: "episode_timeline.kickoff", version: "rocket-league-performance-snapshot@e2e" },
    ],
  };
}

function base(publicId: string): PublicReportData {
  const now = new Date();
  return {
    publicId,
    game: "rocket-league",
    gameLabel: "Rocket League",
    currentRank: "Gold 3",
    targetRank: "Champion 1",
    status: "analyzing",
    createdAt: sqlTimestamp(now),
    readyAt: null,
    processing: {
      jobPublicId: publicId,
      status: "running",
      stage: "ingesting",
      stageLabel: "Reading match data",
      attempts: 1,
      errorCode: null,
      durationMs: null,
      estimatedCostMicros: 0,
      nextRetryAt: null,
      updatedAt: sqlTimestamp(now),
      candidatePlayers: [],
      replayContext: { mode: "Ranked Doubles", gameVersion: "test", occurredAt: null },
      versions: {
        parser: "rl-parser.e2e",
        analyzer: "decision-engine.e2e",
        detector: "spacing.e2e",
        coaching: "coaching.e2e",
        schema: "coaching.v1",
      },
    },
    report: null,
    verifiedFacts: null,
    performance: null,
    earlyAccess: null,
    feedbackScore: null,
  };
}

export function loadE2eReportFixture(publicId: string): PublicReportData | null {
  if (!Object.values(ids).includes(publicId as (typeof ids)[keyof typeof ids])) return null;
  const fixture = base(publicId);
  if (publicId === ids.blocked) {
    fixture.status = "blocked";
    if (fixture.processing) {
      fixture.processing.status = "blocked";
      fixture.processing.stage = "blocked";
      fixture.processing.stageLabel = "The replay could not be read safely.";
      fixture.processing.errorCode = "invalid_replay";
    }
  }
  if (publicId === ids.ready) {
    fixture.status = "ready";
    fixture.readyAt = fixture.createdAt;
    if (fixture.processing) {
      fixture.processing.status = "completed";
      fixture.processing.stage = "completed";
      fixture.processing.stageLabel = "Report ready";
      fixture.processing.durationMs = 42_000;
    }
    fixture.report = {
      highestImpactMistake: "You enter the same lane after your teammate commits.",
      whyItCosts: "Both players are removed from the defensive rotation at the same time.",
      evidenceMoments: ["Back-post coverage disappeared before the goal."],
      evidenceDetails: [{ label: "Match evidence", description: "At 3:47, both teammates cross the ball line while the net remains open.", timestamp: 227 }],
      nextQueueRule: "When your teammate crosses the ball line, protect back post until the play resets.",
      practicePlan: ["Pause each conceded goal five seconds early.", "Mark the first moment both players share a lane.", "Carry the back-post cue into three comparable matches."],
      coachNote: "Measure the decision before the outcome.",
      confidence: 0.91,
      confidenceLabel: "high",
      limitations: ["This illustrative fixture is used only by the local browser test suite."],
      analysisSource: "automated",
    };
    fixture.verifiedFacts = {
      subjectDisplayName: "Turtle",
      mode: "2v2",
      rank: "Gold 3",
      gameVersion: "test",
      occurredAt: fixture.createdAt,
      playerCount: 4,
      sampledFrames: 3000,
      parserEvents: 420,
      decisionEvents: 84,
      parserVersion: "rl-parser.e2e",
      rankProvenance: "player_submitted",
    };
    fixture.performance = performanceFixture();
    fixture.earlyAccess = {
      badge: "EARLY ACCESS BETA",
      heading: "Built from your real replay. Refined through expert validation.",
      body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard.",
      coachingStatus: "experimental_insight",
      formalValidationStatus: "not_validated",
      policyVersion: "early-access.e2e",
      assessments: [{ detectorId: "teamplay.double_commit", status: "experimental_insight", reason: "Three timestamped windows cleared the fixture policy." }],
    };
  }
  if (publicId === ids.stale && fixture.processing) {
    fixture.processing.updatedAt = sqlTimestamp(new Date(Date.now() - 4 * 60_000));
  }
  if (publicId === ids.identity && fixture.processing) {
    fixture.status = "blocked";
    fixture.processing.status = "blocked";
    fixture.processing.stage = "blocked";
    fixture.processing.stageLabel = "Choose the player found in this replay.";
    fixture.processing.errorCode = "subject_player_not_found";
    fixture.processing.candidatePlayers = ["GarrettG", "Turtle", "Moses"];
  }
  if (publicId === ids.abstained) {
    fixture.status = "ready";
    fixture.readyAt = fixture.createdAt;
    if (fixture.processing) {
      fixture.processing.status = "completed";
      fixture.processing.stage = "completed";
      fixture.processing.stageLabel = "Verified facts report ready";
      fixture.processing.errorCode = "early_access_no_supported_finding";
      fixture.processing.durationMs = 38_000;
    }
    fixture.verifiedFacts = {
      subjectDisplayName: "Turtle",
      mode: "2v2",
      rank: "Gold 3",
      gameVersion: "test",
      occurredAt: fixture.createdAt,
      playerCount: 4,
      sampledFrames: 2800,
      parserEvents: 390,
      decisionEvents: 76,
      parserVersion: "rl-parser.e2e",
      rankProvenance: "player_submitted",
    };
    fixture.performance = performanceFixture();
    fixture.earlyAccess = {
      badge: "EARLY ACCESS BETA",
      heading: "Built from your real replay. Refined through expert validation.",
      body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard.",
      coachingStatus: "abstained",
      formalValidationStatus: "not_validated",
      policyVersion: "early-access.e2e",
      assessments: [
        { detectorId: "boost.supersonic_waste", status: "abstained", reason: "Fewer than 3 independent evidence windows were observed." },
        { detectorId: "teamplay.double_commit", status: "abstained", reason: "No qualifying signal was observed in this replay." },
      ],
    };
  }
  return fixture;
}

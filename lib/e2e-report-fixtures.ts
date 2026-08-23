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
    };
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
    };
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

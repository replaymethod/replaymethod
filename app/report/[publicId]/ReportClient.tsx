"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CustomerFooter,
  CustomerHeader,
} from "../../components/CustomerChrome";
import { ReplayMark } from "../../components/ReplayMark";
import type { PublicReportData } from "../../../lib/report-data";
import { trackProductEvent } from "../../../lib/client-analytics";
import {
  canonicalUtcTimestamp,
  utcTimestampMillis,
} from "../../../lib/report-date.mjs";

const stages = [
  { key: "queued", label: "Received" },
  { key: "ingesting", label: "Read match" },
  { key: "normalizing", label: "Build timeline" },
  { key: "detecting", label: "Find patterns" },
  { key: "coaching", label: "Prioritize" },
  { key: "completed", label: "Report ready" },
] as const;

const stageOrder: Record<string, number> = {
  queued: 0,
  validating: 1,
  ingesting: 1,
  normalizing: 2,
  detecting: 3,
  coaching: 4,
  persisting: 4,
  completed: 5,
};

const rocketLeagueRanks = [
  "Gold I",
  "Gold II",
  "Gold III",
  "Platinum I",
  "Platinum II",
  "Platinum III",
  "Diamond I",
  "Diamond II",
  "Diamond III",
  "Champion I",
  "Champion II",
  "Champion III",
  "Grand Champion I",
  "Grand Champion II",
  "Grand Champion III",
];

function reportDate(value: string | null | undefined) {
  const canonical = canonicalUtcTimestamp(value);
  return canonical
    ? new Date(canonical).toLocaleDateString("en-GB", {
        dateStyle: "medium",
        timeZone: "UTC",
      })
    : "Date unavailable";
}

function stopCopy(data: PublicReportData) {
  const code = data.processing?.errorCode;
  if (
    [
      "rl_engine_unavailable",
      "rl_engine_timeout",
      "rl_engine_unreachable",
      "stale_running_lease",
    ].includes(code || "")
  )
    return {
      kicker:
        data.processing?.status === "retry"
          ? "AUTOMATIC RETRY SCHEDULED"
          : "REPLAY WORKER TEMPORARILY UNAVAILABLE",
      title: "Your original replay is preserved for an automatic retry.",
      body: "No new upload, allowance or duplicate analysis is needed. Keep this private report link; the same job will resume automatically when the worker responds.",
    };
  if (code === "rl_engine_not_configured")
    return {
      kicker: "AUTOMATION ACCESS PENDING",
      title:
        "Your replay is safe. The dedicated replay engine is not online yet.",
      body: "We preserved the original file and did not guess from incomplete data. This report can be reprocessed when the deterministic replay worker is connected.",
    };
  if (
    [
      "riot_production_access_required",
      "riot_rso_required",
      "riot_account_connection_required",
      "riot_match_ingestion_not_activated",
    ].includes(code || "")
  )
    return {
      kicker: "RIOT CONNECTION PENDING",
      title: "This match needs an approved Riot account connection.",
      body: "Replay Method will not infer private match behavior from an unverified profile link. Your submission is preserved until the official opt-in integration is available.",
    };
  if (
    [
      "unsupported_or_invalid_replay",
      "invalid_replay",
      "empty_replay",
      "file_too_large",
      "raw_input_missing",
    ].includes(code || "")
  )
    return {
      kicker: "Replay not verified",
      title: "We couldn’t read this replay.",
      body: "Nothing was invented. Upload a fresh .replay file from a completed match, or contact us if this file should be supported.",
    };
  if (code === "detectors_not_calibrated" || code === "public_output_disabled")
    return {
      kicker: "REAL REPLAY VERIFIED · COACHING GATED",
      title: "The replay engine worked. It stopped before inventing advice.",
      body: `${data.processing?.stageLabel || "The player and match data were identified successfully."} This submission can be reprocessed when the coaching checks are ready.`,
    };
  if (
    code === "subject_player_required" ||
    code === "subject_player_not_found" ||
    code === "subject_player_ambiguous" ||
    code === "replay_players_missing"
  )
    return {
      kicker: "Player identity needed",
      title: "Replay read. Which player is you?",
      body: data.processing?.candidatePlayers.length
        ? "Choose your exact in-game name below. Your original private replay is preserved and will be retried without another upload."
        : "Use the exact in-game player name shown in that replay. Your original file is preserved, so support can retry it without another upload.",
    };
  return data.status === "failed"
    ? {
        kicker: "ANALYSIS NEEDS ATTENTION",
        title: "We could not complete this analysis safely.",
        body: "Your submission is preserved. The failure is visible to Replay Method operations and can be retried without uploading the match again.",
      }
    : {
        kicker: "ANALYSIS PAUSED",
        title:
          data.processing?.stageLabel || "This analysis needs another attempt.",
        body: "Your submission is preserved and no unsupported coaching has been generated.",
      };
}

type ReportMoment = { label: string; text: string };

const performanceCategoryLabels: Record<string, string> = {
  offense_defense: "Offense & defense",
  kickoff: "Kickoffs",
  boost_economy: "Boost economy",
  movement_recovery: "Movement & recovery",
  possession_touches: "Possession & touches",
  positioning: "Positioning",
  positioning_teamplay: "Positioning & teamplay",
};

function gameClock(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const seconds = Math.max(0, Math.floor(Number(value)));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function compressMoments(moments: ReportMoment[]) {
  const grouped = new Map<string, ReportMoment & { count: number }>();
  for (const moment of moments) {
    const key = moment.text.trim().toLocaleLowerCase("en-US");
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, { ...moment, count: 1 });
  }
  return [...grouped.values()];
}

export default function ReportClient({
  initial,
  accessToken,
  delivery,
}: {
  initial: PublicReportData;
  accessToken: string;
  delivery: "email" | "link";
}) {
  const [data, setData] = useState(initial);
  const [feedbackScore] = useState(initial.feedbackScore || 0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSignals, setFeedbackSignals] = useState({
    observation: "",
    moment: "",
    advice: "",
    plan: "",
  });
  const [caseStudyConsent, setCaseStudyConsent] = useState(false);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "saving" | "saved" | "error"
  >(initial.feedbackScore ? "saved" : "idle");
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedRank, setSelectedRank] = useState("");
  const [identityRetryState, setIdentityRetryState] = useState<
    "idle" | "saving" | "queued" | "error"
  >("idle");
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => setInteractive(true), 0);
    const updateClock = () => setClock(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 10000);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem("replaymethod-report-ids") || "[]",
    ) as string[];
    localStorage.setItem(
      "replaymethod-report-ids",
      JSON.stringify(
        [data.publicId, ...stored.filter((id) => id !== data.publicId)].slice(
          0,
          20,
        ),
      ),
    );
    if (accessToken) {
      const access = JSON.parse(
        localStorage.getItem("replaymethod-report-access") || "{}",
      ) as Record<string, string>;
      localStorage.setItem(
        "replaymethod-report-access",
        JSON.stringify({ ...access, [data.publicId]: accessToken }),
      );
    }
    const eventKey = `replaymethod-report-view-${data.publicId}`;
    if (!sessionStorage.getItem(eventKey)) {
      sessionStorage.setItem(eventKey, "1");
      trackProductEvent(
        "report_view",
        data.game as "league" | "valorant" | "rocket-league",
        data.status,
      );
    }
    if (data.status === "ready") {
      const completionKey = `replaymethod-analysis-completed-${data.publicId}`;
      if (!sessionStorage.getItem(completionKey)) {
        sessionStorage.setItem(completionKey, "1");
        trackProductEvent(
          "analysis_completed",
          data.game as "league" | "valorant" | "rocket-league",
          "report_ready",
        );
        trackProductEvent(
          "evidence_viewed",
          data.game as "league" | "valorant" | "rocket-league",
          "report_reveal",
        );
      }
    }
    const stopCode = data.processing?.errorCode || "";
    if (
      [
        "subject_player_required",
        "subject_player_not_found",
        "subject_player_ambiguous",
        "detectors_not_calibrated",
        "public_output_disabled",
      ].includes(stopCode)
    ) {
      const parseKey = `replaymethod-parse-complete-${data.publicId}`;
      if (!sessionStorage.getItem(parseKey)) {
        sessionStorage.setItem(parseKey, "1");
        trackProductEvent(
          "parse_complete",
          data.game as "league" | "valorant" | "rocket-league",
          "replay_verified",
        );
        if (data.processing?.replayContext.mode)
          trackProductEvent(
            "mode_detected",
            data.game as "league" | "valorant" | "rocket-league",
            data.processing.replayContext.mode,
          );
      }
    }
    if (
      ["detectors_not_calibrated", "public_output_disabled"].includes(stopCode)
    ) {
      const abstentionKey = `replaymethod-abstention-${data.publicId}`;
      if (!sessionStorage.getItem(abstentionKey)) {
        sessionStorage.setItem(abstentionKey, "1");
        trackProductEvent(
          "abstention",
          data.game as "league" | "valorant" | "rocket-league",
          stopCode,
        );
      }
    }
    if (data.earlyAccess?.coachingStatus === "abstained") {
      const abstentionKey = `replaymethod-early-access-abstention-${data.publicId}`;
      if (!sessionStorage.getItem(abstentionKey)) {
        sessionStorage.setItem(abstentionKey, "1");
        trackProductEvent(
          "abstention",
          data.game as "league" | "valorant" | "rocket-league",
          "early_access_no_supported_finding",
        );
      }
    }
  }, [
    accessToken,
    data.earlyAccess?.coachingStatus,
    data.game,
    data.processing?.errorCode,
    data.processing?.replayContext.mode,
    data.publicId,
    data.status,
  ]);

  useEffect(() => {
    if (["ready", "blocked", "failed"].includes(data.status)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/analyses/${data.publicId}`, {
          cache: "no-store",
          headers: accessToken ? { "X-Report-Access": accessToken } : undefined,
        });
        if (response.ok && !cancelled)
          setData((await response.json()) as PublicReportData);
      } catch {
        /* next poll retries */
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, data.publicId, data.status]);

  const copyLink = async () => {
    trackProductEvent(
      "share_started",
      data.game as "league" | "valorant" | "rocket-league",
      "private_link",
    );
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const scrollToFocusPlan = () => scrollToSection("action-plan");

  const saveFeedback = async () => {
    const score =
      feedbackScore ||
      (feedbackSignals.observation === "yes"
        ? 5
        : feedbackSignals.observation === "not_sure"
          ? 3
          : feedbackSignals.observation === "no"
            ? 1
            : 0);
    if (!score) return;
    setFeedbackState("saving");
    const structuredFeedback = [
      `Observation matched: ${feedbackSignals.observation || "not answered"}`,
      `Moment was correct: ${feedbackSignals.moment || "not answered"}`,
      `Advice was clear: ${feedbackSignals.advice || "not answered"}`,
      `Will test the rule: ${feedbackSignals.plan || "not answered"}`,
      feedbackText.trim() ? `Comment: ${feedbackText.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const response = await fetch(`/api/analyses/${data.publicId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "X-Report-Access": accessToken } : {}),
      },
      body: JSON.stringify({
        score,
        text: structuredFeedback,
        caseStudyConsent,
      }),
    });
    setFeedbackState(response.ok ? "saved" : "error");
    if (response.ok) {
      trackProductEvent(
        "feedback",
        data.game as "league" | "valorant" | "rocket-league",
        `score_${score}`,
      );
    }
  };

  const retryWithPlayer = async () => {
    if (!selectedPlayer) return;
    setIdentityRetryState("saving");
    try {
      trackProductEvent(
        "player_pick",
        data.game as "league" | "valorant" | "rocket-league",
        data.processing?.replayContext.mode || "unknown_mode",
      );
      const response = await fetch(`/api/analyses/${data.publicId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "X-Report-Access": accessToken } : {}),
        },
        body: JSON.stringify({ player: selectedPlayer, rank: selectedRank }),
      });
      if (!response.ok) {
        setIdentityRetryState("error");
        return;
      }
      setIdentityRetryState("queued");
      setData((previous) => ({
        ...previous,
        status: "received",
        processing: previous.processing
          ? {
              ...previous.processing,
              status: "queued",
              stage: "queued",
              stageLabel: "Player selected · replay preserved",
              attempts: 0,
              errorCode: null,
              nextRetryAt: null,
              updatedAt: new Date().toISOString(),
              candidatePlayers: [],
            }
          : null,
      }));
    } catch {
      setIdentityRetryState("error");
    }
  };

  const statusIndex =
    data.status === "ready"
      ? stages.length - 1
      : (stageOrder[data.processing?.stage || "queued"] ?? 0);
  const processingTime = utcTimestampMillis(data.processing?.updatedAt) || 0;
  const stale =
    clock !== null &&
    processingTime > 0 &&
    !["ready", "blocked", "failed"].includes(data.status) &&
    clock - processingTime >= 180_000;
  const stopped =
    data.status === "blocked" || data.status === "failed" || stale;
  const stoppedCopy = stale
    ? {
        kicker: "AUTOMATIC RECOVERY STARTED",
        title: "This analysis took too long. We are restarting it safely.",
        body: "You do not need to upload the replay again. Keep this private link open; the next status check will either continue the analysis or show a concrete reason it stopped.",
      }
    : stopped
      ? stopCopy(data)
      : null;
  const identityResolvable =
    stopped &&
    [
      "subject_player_required",
      "subject_player_not_found",
      "subject_player_ambiguous",
    ].includes(data.processing?.errorCode || "") &&
    Boolean(data.processing?.candidatePlayers.length);
  const freshReplayRequired =
    stopped &&
    [
      "unsupported_or_invalid_replay",
      "invalid_replay",
      "empty_replay",
      "file_too_large",
      "raw_input_missing",
    ].includes(data.processing?.errorCode || "");
  const evidence = data.report?.evidenceDetails.length
    ? data.report.evidenceDetails.map((item) => ({
        label:
          item.round != null
            ? `ROUND · ${item.round}`
            : item.timestamp != null
              ? `MATCH TIME · ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, "0")}`
              : item.label,
        text: item.description,
      }))
    : (data.report?.evidenceMoments || []).map((text, index) => ({
        label: `Evidence ${index + 1}`,
        text,
      }));
  const groupedEvidence = compressMoments(evidence);
  const experimental =
    data.earlyAccess?.coachingStatus === "experimental_insight";
  const isBatch = Boolean(data.batch);
  const batchMatches = data.batch?.validMatches || 10;
  const recurringMatches = data.batch?.recurrence[0]?.matches || 0;
  const playlist =
    data.verifiedFacts?.mode ||
    data.processing?.replayContext.mode ||
    "the same playlist";
  const performanceGroups = Object.entries(
    (data.performance?.metrics || []).reduce<
      Record<string, NonNullable<typeof data.performance>["metrics"]>
    >((groups, metric) => {
      (groups[metric.category] ||= []).push(metric);
      return groups;
    }, {}),
  );
  const momentFeed = [
    ...groupedEvidence.slice(0, 2).map((moment, index) => ({
      id: `coaching-${index}`,
      title: data.report?.highestImpactMistake || "Coaching evidence",
      timing: moment.label,
      context: isBatch
        ? "Example from your ten matches"
        : "Example from this match",
      observation: moment.text,
      consequence:
        data.report?.whyItCosts ||
        "This window contributed to the selected match-specific focus.",
      betterAlternative: data.report?.nextQueueRule || null,
      limitation:
        data.report?.limitations[0] ||
        "This moment describes one match and cannot establish a stable habit.",
      kind: experimental ? "EARLY ACCESS EXAMPLE" : "SUPPORTED EXAMPLE",
    })),
    ...(data.performance?.moments || []).map((moment) => ({
      id: moment.id,
      title: moment.title,
      timing: gameClock(moment.gameClockSeconds)
        ? `GAME CLOCK · ${gameClock(moment.gameClockSeconds)}`
        : `ELAPSED · ${gameClock(moment.timestampSeconds)}`,
      context: moment.context,
      observation: moment.observation,
      consequence: moment.consequence,
      betterAlternative: moment.betterAlternative,
      limitation: moment.limitation,
      kind:
        moment.evidenceKind === "verified_telemetry"
          ? "VERIFIED TELEMETRY"
          : "DERIVED METRIC",
    })),
  ]
    .filter(
      (moment, index, moments) =>
        moments.findIndex((candidate) => candidate.id === moment.id) === index,
    )
    .slice(0, 5);
  const strongestMoments = momentFeed.slice(0, 3);
  const reportSections: [string, string][] = [
    isBatch ? ["report-summary", "Pattern"] : ["report-strength", "What worked"],
    ["decision-first", data.report ? (isBatch ? "Why" : "Decision") : "Honest result"],
    ...(momentFeed.length ? ([["moments", "Examples"]] as [string, string][]) : []),
    ...(data.report ? ([["action-plan", "Next 3"]] as [string, string][]) : []),
    ["performance", "Match facts"],
    ["confidence", "Confidence"],
  ];
  const feedbackQuestions = data.report
    ? ([
        [
          "observation",
          isBatch
            ? "Did the recurring observation fit these ten matches?"
            : "Did the main observation fit what happened?",
        ],
        [
          "moment",
          isBatch
            ? "Were the cross-match evidence moments useful?"
            : "Were the highlighted moments correct?",
        ],
        ["advice", "Was the advice easy to understand?"],
        ["plan", "Does the next-three-match plan feel doable?"],
      ] as const)
    : ([
        ["observation", "Were the verified match facts clear?"],
        ["moment", "Were the highlighted telemetry moments useful?"],
        ["advice", "Was it clear why coaching was withheld?"],
        ["plan", "Do you know what kind of replay to submit next?"],
      ] as const);
  const matchScore =
    data.performance?.match.teamScore != null &&
    data.performance.match.opponentScore != null
      ? `${data.performance.match.teamScore}–${data.performance.match.opponentScore}`
      : "Score unavailable";
  const matchResult =
    data.performance?.match.result === "win"
      ? "WIN"
      : data.performance?.match.result === "loss"
        ? "LOSS"
        : data.performance?.match.result === "draw"
          ? "DRAW"
          : "MATCH";
  const factEntries = data.verifiedFacts
    ? [
        ["PLAYER", data.verifiedFacts.subjectDisplayName],
        ["PLAYLIST", data.verifiedFacts.mode],
        [
          data.verifiedFacts.rankProvenance === "verified_replay"
            ? "VERIFIED REPLAY RANK"
            : "PLAYER-SUBMITTED RANK",
          data.verifiedFacts.rank,
        ],
        [
          "PLAYERS",
          data.verifiedFacts.playerCount == null
            ? null
            : String(data.verifiedFacts.playerCount),
        ],
        [
          "SAMPLED FRAMES",
          data.verifiedFacts.sampledFrames == null
            ? null
            : data.verifiedFacts.sampledFrames.toLocaleString("en-US"),
        ],
        [
          "DECISION EVENTS",
          data.verifiedFacts.decisionEvents == null
            ? null
            : data.verifiedFacts.decisionEvents.toLocaleString("en-US"),
        ],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];

  return (
    <main className="report-page">
      <CustomerHeader
        right={
          <>
            <Link href="/reports">My reports</Link>
            <button className="rm-header-cta" type="button" onClick={copyLink} aria-label={copied ? "Private report link copied" : "Copy private report link"}>
              {copied ? "Copied ✓" : "Copy link"}
              <span aria-hidden="true">↗</span>
            </button>
          </>
        }
      />
      <section className="report-shell shell">
        <header className="report-top">
          <div>
            <span>
              {isBatch
                ? "PRIVATE · TEN-MATCH BASELINE"
                : "PRIVATE · VERIFIED REPORT ACCESS"}
            </span>
            <h1>{data.verifiedFacts?.subjectDisplayName || data.gameLabel}</h1>
            <p>
              {data.verifiedFacts?.mode ||
                data.processing?.replayContext.mode ||
                "Playlist reading"}
              {data.verifiedFacts?.rank
                ? ` · ${data.verifiedFacts.rank} (${data.verifiedFacts.rankProvenance === "verified_replay" ? "verified" : "player-submitted"})`
                : ""}{" "}
              ·{" "}
              {isBatch
                ? "10 verified matches"
                : reportDate(data.verifiedFacts?.occurredAt || data.createdAt)}
            </p>
          </div>
          <i className={data.status}>
            {data.status === "ready"
              ? "READY"
              : stopped
                ? "PAUSED"
                : "PROCESSING"}
          </i>
        </header>

        {data.status !== "ready" ? (
          <div className={`report-pending ${stopped ? "stopped" : ""}`}>
            <div className="scan-orb">
              <i />
              <b><ReplayMark /></b>
            </div>
            <span>
              {stoppedCopy?.kicker ||
                (data.processing?.stageLabel
                  ? "AUTOMATED MATCH ANALYSIS"
                  : "MATCH SECURED")}
            </span>
            <h2>
              {stoppedCopy?.title ||
                data.processing?.stageLabel ||
                "Your match is queued."}
            </h2>
            <p>
              {stoppedCopy?.body ||
                "Replay Method is reading the submitted match, measuring repeated patterns and selecting one evidence-backed coaching focus."}
            </p>
            {freshReplayRequired && (
              <div className="report-recovery-actions" aria-label="Replay recovery options">
                <Link href="/analyze">Choose a fresh replay set →</Link>
                <a href="mailto:contact@replaymethod.xyz?subject=Replay%20Method%20replay%20support">Ask about this file</a>
              </div>
            )}
            {identityResolvable && (
              <section
                className="player-resolution"
                aria-labelledby="player-resolution-title"
              >
                <div>
                  <span>
                    {data.processing?.replayContext.mode
                      ? `${data.processing.replayContext.mode.toUpperCase()} · PLAYERS FOUND`
                      : "PLAYERS FOUND IN THIS REPLAY"}
                  </span>
                  <h3 id="player-resolution-title">Which one is you?</h3>
                  <p>
                    Choose your exact player and current playlist rank. The
                    original private replay is reused automatically.
                  </p>
                </div>
                <div
                  className="player-resolution-options"
                  role="radiogroup"
                  aria-label="Players identified in the replay"
                >
                  {data.processing?.candidatePlayers.map((player) => (
                    <button
                      type="button"
                      role="radio"
                      disabled={!interactive}
                      aria-checked={selectedPlayer === player}
                      className={selectedPlayer === player ? "active" : ""}
                      key={player}
                      onClick={() => {
                        setSelectedPlayer(player);
                        setIdentityRetryState("idle");
                      }}
                    >
                      {player}
                    </button>
                  ))}
                </div>
                <label className="player-resolution-rank">
                  <span>
                    Your current{" "}
                    {data.processing?.replayContext.mode || "playlist"} rank
                  </span>
                  <select
                    value={selectedRank}
                    onChange={(event) => {
                      setSelectedRank(event.target.value);
                      setIdentityRetryState("idle");
                    }}
                  >
                    <option value="">Choose rank</option>
                    {rocketLeagueRanks.map((rank) => (
                      <option value={rank} key={rank}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="player-resolution-submit"
                  type="button"
                  disabled={
                    !interactive ||
                    !selectedPlayer ||
                    !selectedRank ||
                    identityRetryState === "saving"
                  }
                  onClick={retryWithPlayer}
                >
                  {identityRetryState === "saving"
                    ? "Starting…"
                    : identityRetryState === "queued"
                      ? "Analysis queued ✓"
                      : "Analyze this saved replay →"}
                </button>
                {identityRetryState === "error" && (
                  <p role="alert">
                    The replay could not be queued. Refresh this private report
                    and try again.
                  </p>
                )}
              </section>
            )}
            <div className="status-track">
              {stages.map((stage, index) => (
                <div
                  className={
                    index <= statusIndex && !stopped
                      ? "active"
                      : index < statusIndex
                        ? "complete"
                        : ""
                  }
                  key={stage.key}
                >
                  <i>{index < statusIndex ? "✓" : index + 1}</i>
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
            <aside>
              {stopped ? (
                <>
                  <b>No fake certainty.</b>
                  <span>
                    We stop when the available data cannot support a reliable
                    report.
                  </span>
                </>
              ) : delivery === "email" ? (
                <>
                  <b>Confirmation sent.</b>
                  <span>
                    We’ll send another email when the report is ready.
                  </span>
                </>
              ) : (
                <>
                  <b>Keep this private link.</b>
                  <span>
                    Your report will appear here automatically when it is ready.
                  </span>
                </>
              )}
            </aside>
          </div>
        ) : (
          (data.report || data.earlyAccess || data.performance) && (
            <>
              <section
                className={`match-in-20 ${data.report ? "has-focus" : "facts-only"}`}
                id="report-summary"
                aria-labelledby="report-reveal-title"
              >
                <div className="match-in-20-main">
                  <div className="marcel-badges">
                    <span>
                      {isBatch
                        ? data.report
                          ? "YOUR CLEAREST REPEATED PATTERN"
                          : "YOUR TEN MATCHES · VERIFIED RESULT"
                        : data.report
                          ? "YOUR MATCH · ONE CLEAR FOCUS"
                          : "YOUR MATCH · VERIFIED RESULT"}
                    </span>
                    {data.earlyAccess && <em>{data.earlyAccess.badge}</em>}
                  </div>
                  <h2 id="report-reveal-title">
                    {data.report?.highestImpactMistake ||
                      (isBatch
                        ? "No repeated habit was clear enough to coach."
                        : "No reliable coaching pattern was found.")}
                  </h2>
                  <p className="match-result">
                    <b>
                      {isBatch
                        ? `${batchMatches}/10 VERIFIED · ${data.batch?.record.wins}W–${data.batch?.record.losses}L${data.batch?.record.draws ? `–${data.batch.record.draws}D` : ""} · ${data.batch?.confidence.toUpperCase()} CONFIDENCE`
                        : `${matchResult} · ${matchScore}`}
                    </b>
                    {!isBatch && data.performance?.match.overtime && (
                      <em>OVERTIME</em>
                    )}
                    <span>{playlist}</span>
                  </p>
                  <div
                    className="report-sandbox-tabs"
                    aria-label="Report overview"
                  >
                    <span className="active">Overview</span>
                    <span>{data.report ? "Evidence" : "Verified facts"}</span>
                    <span>{data.report ? "Next 3" : "Why no answer"}</span>
                    <small>
                      {isBatch ? "10 verified replays" : "Private replay"}
                    </small>
                  </div>
                  {isBatch ? (
                    <div className="match-in-20-grid">
                      <article>
                        <small>WHAT KEPT HAPPENING</small>
                        <b>
                          {data.report
                            ? `${recurringMatches} of ${batchMatches} matches showed the same pattern`
                            : "No pattern repeated strongly enough"}
                        </b>
                        <p>
                          {data.report?.highestImpactMistake ||
                            "All ten matches were verified, but the evidence did not support one recurring habit."}
                        </p>
                      </article>
                      <article>
                        <small>WHY IT COSTS YOU</small>
                        <b>
                          {data.report?.whyItCosts ||
                            "There is not enough evidence to make that claim."}
                        </b>
                        <p>
                          {data.report
                            ? "This is the supported consequence across the matched examples below."
                            : "One-off moments remain visible in the facts, but they are not promoted into coaching."}
                        </p>
                      </article>
                      <article>
                        <small>YOUR NEXT 3 MATCHES</small>
                        <b>
                          {data.report?.nextQueueRule ||
                            "No coaching rule was released"}
                        </b>
                        <p>
                          {data.report
                            ? "Use this one cue for three representative matches, then check the replays again."
                            : "Your neutral facts remain available below. A correct abstention does not use the free review allowance."}
                        </p>
                      </article>
                    </div>
                  ) : (
                    <div className="match-in-20-grid">
                      <article>
                        <small>WHAT WORKED</small>
                        <b>
                          {data.performance?.strength?.title ||
                            "No positive claim was strong enough"}
                        </b>
                        <p>
                          {data.performance?.strength?.detail ||
                            "The replay was measured, but Replay Method will not manufacture praise from incomplete evidence."}
                        </p>
                      </article>
                      <article>
                        <small>WHY THIS MATTERS</small>
                        <b>
                          {data.report?.whyItCosts ||
                            "No consequence was strong enough to claim."}
                        </b>
                        <p>
                          {data.report
                            ? "The replay-linked evidence behind this reading is shown below."
                            : "You still receive the verified match review; unsupported coaching stays withheld."}
                        </p>
                      </article>
                      <article>
                        <small>DO THIS NEXT</small>
                        <b>
                          {data.report?.nextQueueRule ||
                            "Do not turn one inconclusive replay into a habit claim."}
                        </b>
                        <p>
                          {data.report
                            ? "Use this one cue in your next three representative matches."
                            : "Use another representative replay for an independent reading."}
                        </p>
                      </article>
                    </div>
                  )}
                  <button
                    className="baseline-primary"
                    type="button"
                    disabled={!interactive}
                    onClick={scrollToFocusPlan}
                  >
                    <span>
                      {data.report
                        ? "SEE MY 3-MATCH PLAN"
                        : "REVIEW MY VERIFIED PERFORMANCE"}
                    </span>
                    <b>↓</b>
                  </button>
                </div>
                <aside
                  className="marcel-strength"
                  aria-label="Evidence status and sample size"
                >
                  <small>EVIDENCE STATUS</small>
                  <b>
                    {data.report
                      ? experimental
                        ? "EXPERIMENTAL COACHING"
                        : "SUPPORTED COACHING"
                      : "FACTS ONLY"}
                  </b>
                  <span>
                    {isBatch
                      ? "Ten verified matches · cross-match recurrence"
                      : "One replay · within-match evidence"}
                  </span>
                  <div>
                    <strong>{isBatch ? "10" : "1"}</strong>
                    <small>{isBatch ? "REPLAYS" : "REPLAY"}</small>
                  </div>
                  <p>
                    {isBatch
                      ? `${data.batch?.excludedFiles || 0} excluded file${data.batch?.excludedFiles === 1 ? "" : "s"} did not consume a valid slot. One-off signals are separated from recurring patterns.`
                      : "No rank benchmark, stable-habit claim or calibrated precision is inferred from this single match."}
                  </p>
                </aside>
              </section>

              <nav className="report-section-nav" aria-label="Report sections">
                {reportSections.map(([id, label], index) => (
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => scrollToSection(id)}
                    key={id}
                  >
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    {label}
                  </button>
                ))}
              </nav>

              {data.earlyAccess?.analysisCoverage && (
                <section
                  className="engine-analysis-map"
                  aria-labelledby="engine-analysis-title"
                >
                  <header>
                    <div>
                      <span>FULL-MATCH ANALYSIS MAP</span>
                      <h2 id="engine-analysis-title">
                        The whole game. Not one stat.
                      </h2>
                      <p>
                        {data.earlyAccess.analysisCoverage.totalDetectors}{" "}
                        versioned checks scan nine parts of your play. A check
                        only becomes advice when its evidence is strong enough.
                      </p>
                    </div>
                    <aside>
                      <b>
                        {data.earlyAccess.analysisCoverage.measuringDetectors}
                      </b>
                      <span>DATA-BACKED LANES</span>
                      <small>
                        {data.earlyAccess.analysisCoverage.capabilityAbstained}{" "}
                        protected by abstention
                      </small>
                    </aside>
                  </header>
                  <div>
                    {data.earlyAccess.analysisCoverage.categories.map(
                      (category) => (
                        <article key={category.id}>
                          <i>{category.label.slice(0, 1)}</i>
                          <div>
                            <b>{category.label}</b>
                            <span>
                              {category.total} checks · {category.measuring}{" "}
                              measuring now
                            </span>
                          </div>
                          <em>
                            {category.observed
                              ? `${category.observed} signal${category.observed === 1 ? "" : "s"}`
                              : "checked"}
                          </em>
                        </article>
                      ),
                    )}
                  </div>
                  <footer>
                    <span>✓ Checked</span>
                    <span>≈ Measured</span>
                    <span>— Withheld when uncertain</span>
                  </footer>
                </section>
              )}

              {!isBatch && (
                <section className="report-strength" id="report-strength">
                  <span>WHAT YOU DID WELL</span>
                  <h2>
                    {data.performance?.strength?.title ||
                      "No claim released without support."}
                  </h2>
                  <p>
                    {data.performance?.strength?.detail ||
                      "An honest analysis can withhold a strength claim when this replay does not provide enough direct evidence."}
                  </p>
                  {data.performance?.strength?.limitation && (
                    <small>{data.performance.strength.limitation}</small>
                  )}
                </section>
              )}

              {data.report && (
                <section className="report-deep-dive" id="decision-first">
                  <header>
                    <span>
                      {isBatch
                        ? "THE HABIT TO CHANGE FIRST"
                        : "THE DECISION TO FIX FIRST"}
                    </span>
                    <h2>{data.report.highestImpactMistake}</h2>
                  </header>
                  <div>
                    <article>
                      <small>WHY IT COSTS YOU</small>
                      <p>{data.report.whyItCosts}</p>
                    </article>
                    <article>
                      <small>WHEN IT MAY BE OKAY</small>
                      <p>
                        {data.report.limitations[0] ||
                          "The same visible behavior can be correct in another game state; this finding applies only to the replay-linked evidence below."}
                      </p>
                    </article>
                  </div>
                  <aside>
                    {experimental
                      ? "Experimental interpretation—not expert ground truth."
                      : isBatch
                        ? "Supported by a repeated pattern across these matches—not a permanent player trait."
                        : "Supported within this match—not a stable player profile."}
                  </aside>
                </section>
              )}

              {momentFeed.length > 0 && (
                <section className="report-evidence" id="moments">
                  <header>
                    <span>
                      {isBatch
                        ? "EXAMPLES FROM YOUR MATCHES"
                        : "MOMENTS THAT PROVE IT"}
                    </span>
                    <h2>
                      {isBatch
                        ? "See it happen in different matches."
                        : "See the decision in the match."}
                    </h2>
                    <p>
                      Three priority moments first. Open the rest only when the
                      verified evidence supports more.
                    </p>
                  </header>
                  <div className="moment-list">
                    {strongestMoments.map((moment, index) => (
                      <article key={moment.id}>
                        <i>{String(index + 1).padStart(2, "0")}</i>
                        <div>
                          <small>
                            {moment.kind} · {moment.timing}
                          </small>
                          <b>{moment.title}</b>
                          <p>
                            <strong>Context:</strong> {moment.context}
                          </p>
                          <p>
                            <strong>Evidence:</strong> {moment.observation}
                          </p>
                          <p>
                            <strong>Likely consequence:</strong>{" "}
                            {moment.consequence}
                          </p>
                          {moment.betterAlternative && (
                            <p>
                              <strong>Better alternative:</strong>{" "}
                              {moment.betterAlternative}
                            </p>
                          )}
                          <em>{moment.limitation}</em>
                        </div>
                      </article>
                    ))}
                  </div>
                  {momentFeed.length > 3 && (
                    <details className="moment-disclosure">
                      <summary>
                        Show all {momentFeed.length} supported moments
                      </summary>
                      <div>
                        {momentFeed.map((moment) => (
                          <article key={`${moment.id}-all`}>
                            <small>
                              {moment.kind} · {moment.timing}
                            </small>
                            <b>{moment.title}</b>
                            <p>
                              <strong>Context:</strong> {moment.context}
                            </p>
                            <p>
                              <strong>Evidence:</strong> {moment.observation}
                            </p>
                            <p>
                              <strong>Likely consequence:</strong>{" "}
                              {moment.consequence}
                            </p>
                            {moment.betterAlternative && (
                              <p>
                                <strong>Better alternative:</strong>{" "}
                                {moment.betterAlternative}
                              </p>
                            )}
                            <em>{moment.limitation}</em>
                          </article>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              )}

              {data.report ? (
                <section className="one-focus-plan" id="action-plan">
                  <header>
                    <span>YOUR NEXT 3 MATCHES</span>
                    <h2>{data.report.nextQueueRule}</h2>
                    <p>
                      Use one cue for the next three representative {playlist}{" "}
                      matches. Leave everything else alone for now.
                    </p>
                  </header>
                  <div className="one-focus-grid">
                    <article>
                      <small>IF–THEN RULE</small>
                      <b>{data.report.nextQueueRule}</b>
                    </article>
                    <article>
                      <small>5–10 MINUTE DRILL</small>
                      <b>
                        {data.report.practicePlan[0] ||
                          "No drill was defensibly linked to this finding."}
                      </b>
                    </article>
                    <article>
                      <small>WHAT TO NOTICE</small>
                      <b>
                        {data.report.practicePlan[1] ||
                          "Notice the same game state before the decision—not only the final outcome."}
                      </b>
                    </article>
                    <article>
                      <small>WHAT THE NEXT REPLAY CHECKS</small>
                      <b>
                        {data.report.practicePlan[2] ||
                          data.report.coachNote ||
                          "Whether the same replay-linked decision appears again under comparable conditions."}
                      </b>
                    </article>
                  </div>
                  {data.report.coachNote && (
                    <aside>
                      <span>COACH NOTE</span>
                      <p>{data.report.coachNote}</p>
                    </aside>
                  )}
                </section>
              ) : (
                <section
                  className="one-focus-plan abstained"
                  id="decision-first"
                >
                  <header>
                    <span>HONEST RESULT</span>
                    <h2>
                      {isBatch
                        ? "No repeated habit was clear enough to coach."
                        : "No coaching plan was released from this replay."}
                    </h2>
                    <p>
                      {isBatch
                        ? "All ten matches were verified. Your match facts and examples remain below, but Replay Method did not turn one-off moments into a made-up habit. This result does not use the free review allowance."
                        : "The verified review remains the complete result. Replay Method did not turn neutral measurements into a fake mistake or generic drill."}
                    </p>
                  </header>
                  <span id="action-plan" />
                </section>
              )}

              {data.performance ? (
                <section className="performance-review" id="performance">
                  <header>
                    <span>
                      {isBatch ? "WHAT WE COULD MEASURE" : "FULL MATCH STATS"}
                    </span>
                    <h2>
                      {isBatch
                        ? "The neutral facts across all ten matches."
                        : "What happened—and what each measure can tell you."}
                    </h2>
                    <p>
                      {data.performance.metrics.length} explained measures
                      across {performanceGroups.length} applicable categories.
                      Open a metric for meaning and limits.
                    </p>
                  </header>
                  <div className="performance-groups">
                    {performanceGroups.map(([category, metrics]) => (
                      <article className="performance-category" key={category}>
                        <h3>
                          {performanceCategoryLabels[category] ||
                            category.replaceAll("_", " ")}
                        </h3>
                        <div>
                          {metrics.map((metric) => (
                            <details
                              className={`performance-metric ${metric.status}`}
                              key={metric.id}
                            >
                              <summary>
                                <span>
                                  <small>
                                    {metric.kind.replaceAll("_", " ")}
                                  </small>
                                  <b>{metric.label}</b>
                                </span>
                                <strong>{metric.displayValue}</strong>
                              </summary>
                              <div>
                                <p>
                                  <b>What happened:</b> {metric.whatHappened}
                                </p>
                                <p>
                                  <b>Why it matters:</b> {metric.whyItMatters}
                                </p>
                                <p>
                                  <b>What it does not prove:</b>{" "}
                                  {metric.limitation}
                                </p>
                                <small>
                                  SOURCE · {metric.source} · {metric.version}
                                  {metric.sampleCount != null
                                    ? ` · N=${metric.sampleCount}`
                                    : ""}
                                </small>
                              </div>
                            </details>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                <section
                  className="performance-review unavailable"
                  id="performance"
                >
                  <header>
                    <span>FULL MATCH STATS · UNAVAILABLE</span>
                    <h2>
                      Detailed match measures were not available for this
                      replay.
                    </h2>
                    <p>
                      The verified moments and report remain intact. Replay
                      Method did not estimate or fill in missing metrics.
                    </p>
                  </header>
                </section>
              )}

              <section className="report-confidence" id="confidence">
                <header>
                  <span>HOW SURE IS THIS?</span>
                  <h2>
                    What is solid, what is interpreted, and what these matches
                    cannot prove.
                  </h2>
                  <p>
                    The plain answer comes first. Technical versions and
                    internal checks stay inside Advanced details.
                  </p>
                </header>
                <div className="confidence-status">
                  <article>
                    <i>✓</i>
                    <div>
                      <b>Verified replay facts</b>
                      <p>
                        Player, playlist, timestamps and direct telemetry come
                        from the original {isBatch ? "ten files" : "file"}.
                      </p>
                    </div>
                  </article>
                  <article
                    className={data.performance ? undefined : "abstained"}
                  >
                    <i>{data.performance ? "≈" : "—"}</i>
                    <div>
                      <b>
                        {data.performance
                          ? "Derived match measures"
                          : "Detailed measures unavailable"}
                      </b>
                      <p>
                        {data.performance
                          ? "Calculated values describe this match; they do not establish a long-term habit."
                          : "No missing match measures were estimated or presented as facts."}
                      </p>
                    </div>
                  </article>
                  <article
                    className={data.report ? "experimental" : "abstained"}
                  >
                    <i>{data.report ? "β" : "—"}</i>
                    <div>
                      <b>
                        {data.report
                          ? "Early Access coaching"
                          : "Coaching withheld"}
                      </b>
                      <p>
                        {data.report
                          ? isBatch
                            ? "A pattern repeated across these matches and was strong enough to show, while expert validation continues."
                            : "This match supported one useful interpretation, while expert validation continues."
                          : "The available evidence did not support a defensible coaching claim."}
                      </p>
                    </div>
                  </article>
                </div>
                {factEntries.length > 0 && (
                  <div className="verified-match-facts">
                    <header>
                      <span>VERIFIED MATCH CONTEXT</span>
                      <h3>What the replay itself established.</h3>
                    </header>
                    <div>
                      {factEntries.map(([label, value]) => (
                        <article key={label}>
                          <small>{label}</small>
                          <b title={value}>{value}</b>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                <details className="report-method">
                  <summary>
                    <span>Advanced details</span>
                    <small>
                      Technical evidence, versions and detector decisions
                    </small>
                  </summary>
                  <div className="report-method-grid">
                    <div>
                      <span>METHOD</span>
                      <h2>Traceable coaching, not a black box.</h2>
                      <p>
                        {data.earlyAccess
                          ? "Verified facts come from the replay parser. Any coaching insight is a separately marked deterministic Early Access interpretation; no language model may add gameplay facts, and expert validation is still in progress."
                          : data.report?.analysisSource === "automated"
                            ? "This report was generated from versioned structured findings. The language layer can explain and prioritize them, but it cannot create new gameplay facts."
                            : "This beta report was quality-reviewed. Automated engine metadata appears for reports produced by the structured pipeline."}
                      </p>
                    </div>
                    <aside>
                      <b>
                        {data.processing?.versions.parser ||
                          "Parser unavailable"}
                      </b>
                      <span>Parser</span>
                      <b>
                        {data.processing?.versions.detector ||
                          "Quality-reviewed beta"}
                      </b>
                      <span>Detector</span>
                      <b>
                        {data.processing?.versions.schema ||
                          "Legacy report schema"}
                      </b>
                      <span>Schema</span>
                      <b>{data.verifiedFacts?.gameVersion || "Unavailable"}</b>
                      <span>Game version</span>
                    </aside>
                    {data.earlyAccess && (
                      <div className="method-decisions">
                        <b>LOCAL DETECTOR DECISIONS</b>
                        {data.earlyAccess.assessments.map((item) => (
                          <article
                            className={item.status}
                            key={item.detectorId}
                          >
                            <strong>{item.detectorId}</strong>
                            <span>
                              {item.status === "experimental_insight"
                                ? `EXPERIMENTAL · ${item.reason}`
                                : `ABSTAINED · ${item.reason}`}
                            </span>
                          </article>
                        ))}
                      </div>
                    )}
                    <div className="report-limitations">
                      <b>KNOWN LIMITATIONS</b>
                      {data.report?.limitations.length ? (
                        <ul>
                          {data.report.limitations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          {data.earlyAccess
                            ? "No coaching finding passed for this replay. Formal detector validation remains pending."
                            : "No additional detector-specific limitations were recorded for this finding."}
                        </p>
                      )}
                    </div>
                  </div>
                </details>
                {data.earlyAccess && (
                  <aside className="early-access-compact">
                    <span>{data.earlyAccess.badge}</span>
                    <p>{data.earlyAccess.body}</p>
                    <small>
                      Expert validation is still in progress · This individual
                      report has not been human-reviewed.
                    </small>
                  </aside>
                )}
              </section>

              <aside className="premium-bridge">
                <div>
                  <span>THE REPLAY METHOD LOOP</span>
                  <h2>Find the pattern. Fix it. Prove it changed.</h2>
                  <p>
                    This free report gives you the focus. Premium is designed to
                    compare up to 35 representative replays per week and show
                    whether the pattern improves, returns or needs a different
                    plan.
                  </p>
                </div>
                <Link href="/#pricing">
                  See how Premium will work <b>→</b>
                </Link>
                <small>
                  COMING LATER · NOT FOR SALE · The complete report above is
                  free; there is no checkout or locked evidence here.
                </small>
              </aside>

              <section className="report-feedback" id="feedback">
                <span>
                  {data.earlyAccess
                    ? "EARLY ACCESS PRODUCT FEEDBACK"
                    : "REPORT FEEDBACK"}
                </span>
                <h2>
                  {data.report
                    ? "Was this useful?"
                    : "Were the verified facts clear?"}
                </h2>
                <p className="feedback-boundary">
                  A quick answer helps improve the product. It never changes
                  what the replay itself proved.
                </p>
                {feedbackState === "saved" ? (
                  <div className="feedback-saved" role="status">
                    <i>✓</i>
                    <b>Feedback saved separately from replay evidence.</b>
                  </div>
                ) : (
                  <>
                    <div className="feedback-questions">
                      {feedbackQuestions.map(([key, question]) => (
                        <fieldset key={key}>
                          <legend>{question}</legend>
                          <div>
                            {[
                              ["yes", "Yes"],
                              ["not_sure", "Not sure"],
                              ["no", "No"],
                            ].map(([value, label]) => (
                              <button
                                type="button"
                                aria-pressed={feedbackSignals[key] === value}
                                className={
                                  feedbackSignals[key] === value ? "active" : ""
                                }
                                key={value}
                                onClick={() =>
                                  setFeedbackSignals((previous) => ({
                                    ...previous,
                                    [key]: value,
                                  }))
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                    <textarea
                      aria-label="Optional report feedback"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="What was missing, wrong, or unclear?"
                      maxLength={1000}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={caseStudyConsent}
                        onChange={(e) => setCaseStudyConsent(e.target.checked)}
                      />
                      <span>
                        You may quote this feedback anonymously as an Early
                        Access product review.
                      </span>
                    </label>
                    <button
                      type="button"
                      className="save-feedback"
                      disabled={
                        !Object.values(feedbackSignals).some(Boolean) ||
                        feedbackState === "saving"
                      }
                      onClick={saveFeedback}
                    >
                      {feedbackState === "saving" ? "Saving…" : "Save feedback"}
                    </button>
                    {feedbackState === "error" && (
                      <p role="alert">Could not save feedback. Try again.</p>
                    )}
                  </>
                )}
              </section>
            </>
          )
        )}
      </section>
      <CustomerFooter />
    </main>
  );
}

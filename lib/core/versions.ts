import type { AnalyzerVersions } from "./contracts";

export const CORE_SCHEMA_VERSION = "coaching.v1" as const;
export const NORMALIZED_SCHEMA_VERSION = "game-data.v1" as const;
export const FINDING_SCHEMA_VERSION = "finding.v1" as const;

export const RIOT_ADAPTER_VERSIONS: AnalyzerVersions = {
  parser: "riot-api.pending-production-access",
  normalizer: "replaymethod-riot-normalizer.0.1.0",
  analyzer: "replaymethod-riot-analyzer.0.1.0",
  detector: "replaymethod-riot-detectors.0.1.0",
  coaching: "replaymethod-coach.1.0.0",
  schema: CORE_SCHEMA_VERSION
};

export const ROCKET_LEAGUE_ADAPTER_VERSIONS: AnalyzerVersions = {
  parser: "boxcars.0.11.5+subtr-actor.1.2.0",
  normalizer: "replaymethod-rl-normalizer.0.1.0",
  analyzer: "replaymethod-rl-analyzer.0.1.0",
  detector: "replaymethod-rl-detectors.0.1.0",
  coaching: "replaymethod-coach.1.0.0",
  schema: CORE_SCHEMA_VERSION
};

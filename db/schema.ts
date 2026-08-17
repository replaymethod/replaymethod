import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const waitlist = sqliteTable("waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  game: text("game").notNull().default("general"),
  source: text("source").notNull().default("direct"),
  campaign: text("campaign"),
  consentAt: text("consent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  privacyVersion: text("privacy_version").notNull().default("2026-08-15"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [uniqueIndex("waitlist_email_game_unique").on(table.email, table.game)]);

export const funnelEvents = sqliteTable("funnel_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  event: text("event").notNull(),
  game: text("game").notNull().default("general"),
  placement: text("placement").notNull().default("unknown"),
  path: text("path").notNull().default("/"),
  source: text("source").notNull().default("direct"),
  campaign: text("campaign"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index("funnel_events_created_at_idx").on(table.createdAt),
  index("funnel_events_event_idx").on(table.event),
  index("funnel_events_game_idx").on(table.game)
]);

export const analysisRequests = sqliteTable("analysis_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  email: text("email").notNull(),
  game: text("game").notNull(),
  currentRank: text("current_rank").notNull(),
  targetRank: text("target_rank"),
  playerContext: text("player_context"),
  evidenceType: text("evidence_type").notNull(),
  evidenceUrl: text("evidence_url"),
  fileKey: text("file_key"),
  originalFileName: text("original_file_name"),
  fileSize: integer("file_size"),
  goal: text("goal").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("received"),
  highestImpactMistake: text("highest_impact_mistake"),
  whyItCosts: text("why_it_costs"),
  evidenceMoments: text("evidence_moments"),
  nextQueueRule: text("next_queue_rule"),
  practicePlan: text("practice_plan"),
  coachNote: text("coach_note"),
  feedbackScore: integer("feedback_score"),
  feedbackText: text("feedback_text"),
  caseStudyConsent: integer("case_study_consent").notNull().default(0),
  source: text("source").notNull().default("direct"),
  campaign: text("campaign"),
  privacyVersion: text("privacy_version").notNull().default("2026-08-16-beta"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  readyAt: text("ready_at")
}, table => [
  uniqueIndex("analysis_requests_public_id_unique").on(table.publicId),
  index("analysis_requests_status_idx").on(table.status),
  index("analysis_requests_email_idx").on(table.email),
  index("analysis_requests_created_at_idx").on(table.createdAt)
]);

/**
 * One Replay Method identity can own data from every supported game. Public IDs
 * are used outside the database; normalized email is only used for the current
 * passwordless beta identity until dedicated account authentication ships.
 */
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("players_public_id_unique").on(table.publicId),
  uniqueIndex("players_email_unique").on(table.email)
]);

export const gameAccounts = sqliteTable("game_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id),
  game: text("game").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  displayName: text("display_name"),
  region: text("region"),
  connectionStatus: text("connection_status").notNull().default("unverified"),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("game_accounts_public_id_unique").on(table.publicId),
  uniqueIndex("game_accounts_player_game_provider_unique").on(table.playerId, table.game, table.provider),
  index("game_accounts_player_idx").on(table.playerId)
]);

export const analysisJobs = sqliteTable("analysis_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  playerId: integer("player_id").references(() => players.id),
  game: text("game").notNull(),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  stageLabel: text("stage_label").notNull().default("Upload received"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  parserVersion: text("parser_version"),
  analyzerVersion: text("analyzer_version"),
  detectorVersion: text("detector_version"),
  coachingVersion: text("coaching_version"),
  schemaVersion: text("schema_version").notNull().default("coaching.v1"),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  durationMs: integer("duration_ms"),
  scheduledAt: text("scheduled_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  nextRetryAt: text("next_retry_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("analysis_jobs_public_id_unique").on(table.publicId),
  uniqueIndex("analysis_jobs_request_unique").on(table.analysisRequestId),
  index("analysis_jobs_status_idx").on(table.status),
  index("analysis_jobs_game_idx").on(table.game),
  index("analysis_jobs_created_at_idx").on(table.createdAt)
]);

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  playerId: integer("player_id").references(() => players.id),
  game: text("game").notNull(),
  ingestionSource: text("ingestion_source").notNull(),
  externalMatchId: text("external_match_id"),
  rawObjectKey: text("raw_object_key"),
  normalizedObjectKey: text("normalized_object_key"),
  mode: text("mode"),
  rank: text("rank"),
  gameVersion: text("game_version"),
  occurredAt: text("occurred_at"),
  parserVersion: text("parser_version"),
  normalizedSchemaVersion: text("normalized_schema_version").notNull().default("game-data.v1"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("matches_public_id_unique").on(table.publicId),
  uniqueIndex("matches_request_unique").on(table.analysisRequestId),
  index("matches_player_game_idx").on(table.playerId, table.game),
  index("matches_external_id_idx").on(table.externalMatchId)
]);

export const analysisFindings = sqliteTable("analysis_findings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  matchId: integer("match_id").references(() => matches.id),
  playerId: integer("player_id").references(() => players.id),
  game: text("game").notNull(),
  priority: integer("priority").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  severity: text("severity").notNull(),
  confidence: real("confidence").notNull(),
  confidenceLabel: text("confidence_label").notNull(),
  frequency: integer("frequency"),
  estimatedImpact: text("estimated_impact"),
  evidenceJson: text("evidence_json").notNull(),
  metricsJson: text("metrics_json").notNull(),
  recommendationJson: text("recommendation_json").notNull(),
  limitationsJson: text("limitations_json").notNull(),
  detectorVersion: text("detector_version").notNull(),
  schemaVersion: text("schema_version").notNull().default("finding.v1"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("analysis_findings_public_id_unique").on(table.publicId),
  index("analysis_findings_request_priority_idx").on(table.analysisRequestId, table.priority),
  index("analysis_findings_player_game_idx").on(table.playerId, table.game)
]);

export const playerFocuses = sqliteTable("player_focuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id),
  game: text("game").notNull(),
  findingId: integer("finding_id").references(() => analysisFindings.id),
  status: text("status").notNull().default("active"),
  title: text("title").notNull(),
  successMetric: text("success_metric"),
  baselineValue: real("baseline_value"),
  latestValue: real("latest_value"),
  targetValue: real("target_value"),
  unit: text("unit"),
  matchesObserved: integer("matches_observed").notNull().default(0),
  assignedAt: text("assigned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_focuses_public_id_unique").on(table.publicId),
  index("player_focuses_player_game_status_idx").on(table.playerId, table.game, table.status)
]);

export const analysisReviews = sqliteTable("analysis_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  findingId: integer("finding_id").references(() => analysisFindings.id),
  reviewerEmail: text("reviewer_email").notNull(),
  verdict: text("verdict").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index("analysis_reviews_request_idx").on(table.analysisRequestId),
  index("analysis_reviews_finding_idx").on(table.findingId)
]);

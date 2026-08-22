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

export const rlBetaSubmissions = sqliteTable("rl_beta_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  email: text("email").notNull(),
  playerName: text("player_name").notNull(),
  rankCohort: text("rank_cohort").notNull(),
  mode: text("mode").notNull().default("unknown"),
  replayFingerprint: text("replay_fingerprint").notNull(),
  fileKey: text("file_key").notNull(),
  originalFileName: text("original_file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("received"),
  parserStatus: text("parser_status").notNull().default("pending"),
  parserVersion: text("parser_version"),
  parsedMode: text("parsed_mode"),
  attributionStatus: text("attribution_status").notNull().default("pending"),
  usabilityStatus: text("usability_status").notNull().default("pending"),
  processingErrorCode: text("processing_error_code"),
  processingMetadataJson: text("processing_metadata_json"),
  reviewState: text("review_state").notNull().default("not_started"),
  detectorSetVersion: text("detector_set_version"),
  source: text("source").notNull().default("direct"),
  campaign: text("campaign"),
  consentVersion: text("consent_version").notNull(),
  consentAt: text("consent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  rightsConfirmedAt: text("rights_confirmed_at"),
  updatesConsentAt: text("updates_consent_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("rl_beta_submissions_public_id_unique").on(table.publicId),
  uniqueIndex("rl_beta_submissions_replay_email_unique").on(table.replayFingerprint, table.email),
  index("rl_beta_submissions_email_created_idx").on(table.email, table.createdAt),
  index("rl_beta_submissions_status_created_idx").on(table.status, table.createdAt)
]);

/**
 * Product truth for each Rocket League playlist and rank cohort. A supported
 * parser is not the same thing as validated coaching, so each layer is stored
 * independently and can be queried without inferring capability from flags.
 */
export const rlCapabilities = sqliteTable("rl_capabilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mode: text("mode").notNull(),
  rankCohort: text("rank_cohort").notNull(),
  uploadState: text("upload_state").notNull(),
  parseState: text("parse_state").notNull(),
  processState: text("process_state").notNull(),
  detectorState: text("detector_state").notNull(),
  coachingState: text("coaching_state").notNull(),
  reason: text("reason").notNull(),
  sourceVersion: text("source_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("rl_capabilities_mode_cohort_unique").on(table.mode, table.rankCohort),
  index("rl_capabilities_coaching_state_idx").on(table.coachingState)
]);

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
  platform: text("platform").notNull().default("pc"),
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

export const playerClaims = sqliteTable("player_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_claims_token_hash_unique").on(table.tokenHash),
  index("player_claims_player_idx").on(table.playerId),
  index("player_claims_expires_at_idx").on(table.expiresAt)
]);

export const playerSessions = sqliteTable("player_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_sessions_token_hash_unique").on(table.tokenHash),
  index("player_sessions_player_idx").on(table.playerId),
  index("player_sessions_expires_at_idx").on(table.expiresAt)
]);

export const billingCustomers = sqliteTable("billing_customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("billing_customers_player_unique").on(table.playerId),
  uniqueIndex("billing_customers_stripe_unique").on(table.stripeCustomerId)
]);

export const billingSubscriptions = sqliteTable("billing_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  planKey: text("plan_key").notNull(),
  status: text("status").notNull(),
  currentPeriodStart: text("current_period_start").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  canceledAt: text("canceled_at"),
  endedAt: text("ended_at"),
  graceUntil: text("grace_until"),
  latestInvoiceId: text("latest_invoice_id"),
  checkoutSessionId: text("checkout_session_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("billing_subscriptions_stripe_unique").on(table.stripeSubscriptionId),
  index("billing_subscriptions_player_status_idx").on(table.playerId, table.status),
  index("billing_subscriptions_customer_idx").on(table.stripeCustomerId)
]);

export const billingEvents = sqliteTable("billing_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stripeEventId: text("stripe_event_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("processing"),
  errorMessage: text("error_message"),
  processedAt: text("processed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("billing_events_stripe_unique").on(table.stripeEventId),
  index("billing_events_status_idx").on(table.status)
]);

export const analysisUsage = sqliteTable("analysis_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  analysisPublicId: text("analysis_public_id").notNull(),
  analysisRequestId: integer("analysis_request_id").references(() => analysisRequests.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  accessKind: text("access_kind").notNull(),
  planKey: text("plan_key"),
  windowStart: text("window_start").notNull(),
  windowEnd: text("window_end").notNull(),
  slot: integer("slot").notNull(),
  status: text("status").notNull().default("reserved"),
  consumedAt: text("consumed_at"),
  releasedAt: text("released_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("analysis_usage_public_id_unique").on(table.publicId),
  uniqueIndex("analysis_usage_analysis_unique").on(table.analysisPublicId),
  uniqueIndex("analysis_usage_active_slot_unique").on(table.playerId, table.accessKind, table.windowStart, table.slot)
    .where(sql`${table.status} IN ('reserved', 'consumed')`),
  index("analysis_usage_player_window_idx").on(table.playerId, table.windowStart, table.status),
  index("analysis_usage_request_idx").on(table.analysisRequestId)
]);

export const replayUploadSessions = sqliteTable("replay_upload_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  email: text("email").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  chunkSize: integer("chunk_size").notNull(),
  expectedParts: integer("expected_parts").notNull(),
  status: text("status").notNull().default("pending"),
  objectKey: text("object_key"),
  fileSha256: text("file_sha256"),
  analysisRequestId: integer("analysis_request_id").references(() => analysisRequests.id),
  expiresAt: text("expires_at").notNull(),
  completedAt: text("completed_at"),
  claimedAt: text("claimed_at"),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("replay_upload_sessions_public_id_unique").on(table.publicId),
  uniqueIndex("replay_upload_sessions_analysis_unique").on(table.analysisRequestId),
  index("replay_upload_sessions_email_created_idx").on(table.email, table.createdAt),
  index("replay_upload_sessions_status_expiry_idx").on(table.status, table.expiresAt)
]);

export const replayUploadParts = sqliteTable("replay_upload_parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uploadSessionId: integer("upload_session_id").notNull().references(() => replayUploadSessions.id, { onDelete: "cascade" }),
  partNumber: integer("part_number").notNull(),
  objectKey: text("object_key").notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("replay_upload_parts_session_part_unique").on(table.uploadSessionId, table.partNumber),
  index("replay_upload_parts_session_idx").on(table.uploadSessionId)
]);

export const analysisReportAccess = sqliteTable("analysis_report_access", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull(),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("analysis_report_access_token_unique").on(table.tokenHash),
  index("analysis_report_access_request_idx").on(table.analysisRequestId),
  index("analysis_report_access_expiry_idx").on(table.expiresAt)
]);

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  kind: text("kind").notNull(),
  provider: text("provider").notNull().default("resend"),
  status: text("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  providerMessageId: text("provider_message_id"),
  lastErrorCode: text("last_error_code"),
  nextRetryAt: text("next_retry_at"),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("email_deliveries_public_id_unique").on(table.publicId),
  uniqueIndex("email_deliveries_request_kind_unique").on(table.analysisRequestId, table.kind),
  uniqueIndex("email_deliveries_idempotency_unique").on(table.idempotencyKey),
  index("email_deliveries_retry_idx").on(table.status, table.nextRetryAt)
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
  detectorId: text("detector_id").notNull().default("legacy.unknown"),
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
  detectorId: text("detector_id").notNull().default("legacy.unknown"),
  baselineAnalysisRequestId: integer("baseline_analysis_request_id").references(() => analysisRequests.id),
  latestAnalysisRequestId: integer("latest_analysis_request_id").references(() => analysisRequests.id),
  status: text("status").notNull().default("active"),
  title: text("title").notNull(),
  successMetric: text("success_metric"),
  metricKey: text("metric_key"),
  metricLabel: text("metric_label"),
  baselineValue: real("baseline_value"),
  latestValue: real("latest_value"),
  targetValue: real("target_value"),
  unit: text("unit"),
  targetDirection: text("target_direction"),
  minimumMatches: integer("minimum_matches").notNull().default(3),
  matchesObserved: integer("matches_observed").notNull().default(0),
  assignedAt: text("assigned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  completionReason: text("completion_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_focuses_public_id_unique").on(table.publicId),
  uniqueIndex("player_focuses_active_unique").on(table.playerId, table.game).where(sql`${table.status} = 'active'`),
  index("player_focuses_player_game_status_idx").on(table.playerId, table.game, table.status)
]);

export const playerFocusObservations = sqliteTable("player_focus_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  focusId: integer("focus_id").notNull().references(() => playerFocuses.id),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  findingId: integer("finding_id").notNull().references(() => analysisFindings.id),
  detectorId: text("detector_id").notNull(),
  confidence: real("confidence").notNull(),
  metricKey: text("metric_key"),
  metricLabel: text("metric_label"),
  metricValue: real("metric_value"),
  unit: text("unit"),
  recurrenceValue: real("recurrence_value"),
  evidenceJson: text("evidence_json").notNull(),
  limitationsJson: text("limitations_json").notNull(),
  observedAt: text("observed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_focus_observations_public_id_unique").on(table.publicId),
  uniqueIndex("player_focus_observations_focus_request_unique").on(table.focusId, table.analysisRequestId),
  index("player_focus_observations_focus_observed_idx").on(table.focusId, table.observedAt),
  index("player_focus_observations_player_request_idx").on(table.analysisRequestId)
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

export const rlReviewCandidates = sqliteTable("rl_review_candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateKey: text("candidate_key").notNull(),
  replayFingerprint: text("replay_fingerprint").notNull(),
  mode: text("mode"),
  rankCohort: text("rank_cohort"),
  contextKey: text("context_key"),
  metadataProvenance: text("metadata_provenance"),
  gameVersion: text("game_version"),
  detectorId: text("detector_id").notNull(),
  detectorVersion: text("detector_version").notNull(),
  reviewQuestion: text("review_question").notNull(),
  timestampSeconds: real("timestamp_seconds"),
  frame: integer("frame"),
  observationJson: text("observation_json").notNull(),
  momentObjectKey: text("moment_object_key"),
  verdict: text("verdict").notNull().default("unreviewed"),
  timestampVerified: integer("timestamp_verified", { mode: "boolean" }),
  notes: text("notes"),
  reviewerEmail: text("reviewer_email"),
  labelSetVersion: text("label_set_version"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("rl_review_candidates_key_unique").on(table.candidateKey),
  index("rl_review_candidates_detector_verdict_idx").on(table.detectorId, table.verdict),
  index("rl_review_candidates_replay_idx").on(table.replayFingerprint),
  index("rl_review_candidates_moment_key_idx").on(table.momentObjectKey),
  index("rl_review_candidates_reviewed_at_idx").on(table.reviewedAt)
]);

export const rlReviewers = sqliteTable("rl_reviewers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  qualification: text("qualification").notNull(),
  playlistQualificationsJson: text("playlist_qualifications_json").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("rl_reviewers_public_id_unique").on(table.publicId),
  uniqueIndex("rl_reviewers_user_id_unique").on(table.userId),
  uniqueIndex("rl_reviewers_email_unique").on(table.email),
  index("rl_reviewers_status_idx").on(table.status)
]);

export const rlReviewLabels = sqliteTable("rl_review_labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").notNull().references(() => rlReviewCandidates.id),
  reviewerId: integer("reviewer_id").references(() => rlReviewers.id),
  reviewerEmail: text("reviewer_email").notNull(),
  reviewerQualification: text("reviewer_qualification").notNull().default("unverified"),
  reviewerScopeJson: text("reviewer_scope_json").notNull().default("{}"),
  verdict: text("verdict").notNull(),
  timestampVerified: integer("timestamp_verified", { mode: "boolean" }),
  notes: text("notes"),
  labelSetVersion: text("label_set_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index("rl_review_labels_candidate_idx").on(table.candidateId),
  index("rl_review_labels_reviewer_candidate_idx").on(table.reviewerId, table.candidateId),
  index("rl_review_labels_created_at_idx").on(table.createdAt)
]);

export const detectorQualitySnapshots = sqliteTable("detector_quality_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  detectorId: text("detector_id").notNull(),
  detectorVersion: text("detector_version").notNull(),
  corpusFingerprint: text("corpus_fingerprint").notNull(),
  labelSetVersion: text("label_set_version").notNull(),
  evidenceSource: text("evidence_source").notNull(),
  metricsJson: text("metrics_json").notNull(),
  gateJson: text("gate_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("detector_quality_snapshots_public_id_unique").on(table.publicId),
  index("detector_quality_snapshots_detector_created_idx").on(table.detectorId, table.createdAt)
]);

export const detectorLifecycleEvents = sqliteTable("detector_lifecycle_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  detectorId: text("detector_id").notNull(),
  detectorVersion: text("detector_version").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  reason: text("reason").notNull(),
  activationFingerprint: text("activation_fingerprint"),
  actorEmail: text("actor_email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("detector_lifecycle_events_public_id_unique").on(table.publicId),
  index("detector_lifecycle_events_detector_created_idx").on(table.detectorId, table.createdAt)
]);

export const playerFocusEvaluations = sqliteTable("player_focus_evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id").notNull(),
  focusId: integer("focus_id").notNull().references(() => playerFocuses.id),
  analysisRequestId: integer("analysis_request_id").notNull().references(() => analysisRequests.id),
  detectorId: text("detector_id").notNull(),
  detectorVersion: text("detector_version").notNull(),
  contextKey: text("context_key"),
  detectorEvaluated: integer("detector_evaluated", { mode: "boolean" }).notNull(),
  opportunityCount: integer("opportunity_count").notNull().default(0),
  fired: integer("fired", { mode: "boolean" }).notNull(),
  metricValue: real("metric_value"),
  evidenceSource: text("evidence_source").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex("player_focus_evaluations_public_id_unique").on(table.publicId),
  uniqueIndex("player_focus_evaluations_focus_request_detector_unique").on(table.focusId, table.analysisRequestId, table.detectorId),
  index("player_focus_evaluations_focus_created_idx").on(table.focusId, table.createdAt)
]);

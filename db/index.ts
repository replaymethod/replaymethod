import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { ensureConfiguredOwnerQaEntitlement } from "../lib/owner-qa-entitlement.mjs";

let productSchemaReady: Promise<void> | null = null;

async function ensureColumn(database: D1Database, table: string, column: string, definition: string) {
  const info = await database.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!(info.results || []).some(item => item.name === column)) {
    await database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export async function ensureProductSchema(database: D1Database) {
  if (!productSchemaReady) {
    productSchemaReady = database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS waitlist (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        email text NOT NULL,
        game text DEFAULT 'general' NOT NULL,
        source text DEFAULT 'direct' NOT NULL,
        campaign text,
        consent_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        privacy_version text DEFAULT '2026-08-15' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_game_unique ON waitlist (email, game)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS funnel_events (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        visitor_id text NOT NULL,
        event text NOT NULL,
        game text DEFAULT 'general' NOT NULL,
        placement text DEFAULT 'unknown' NOT NULL,
        path text DEFAULT '/' NOT NULL,
        source text DEFAULT 'direct' NOT NULL,
        campaign text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS funnel_events_created_at_idx ON funnel_events (created_at)"),
      database.prepare("CREATE INDEX IF NOT EXISTS funnel_events_event_idx ON funnel_events (event)"),
      database.prepare("CREATE INDEX IF NOT EXISTS funnel_events_game_idx ON funnel_events (game)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_beta_submissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        email text NOT NULL,
        player_name text NOT NULL,
        rank_cohort text NOT NULL,
        mode text DEFAULT 'unknown' NOT NULL,
        replay_fingerprint text NOT NULL,
        file_key text NOT NULL,
        original_file_name text NOT NULL,
        file_size integer NOT NULL,
        status text DEFAULT 'received' NOT NULL,
        parser_status text DEFAULT 'pending' NOT NULL,
        parser_version text,
        parsed_mode text,
        attribution_status text DEFAULT 'pending' NOT NULL,
        usability_status text DEFAULT 'pending' NOT NULL,
        processing_error_code text,
        processing_metadata_json text,
        review_state text DEFAULT 'not_started' NOT NULL,
        detector_set_version text,
        source text DEFAULT 'direct' NOT NULL,
        campaign text,
        consent_version text NOT NULL,
        consent_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        rights_confirmed_at text,
        updates_consent_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_beta_submissions_public_id_unique ON rl_beta_submissions (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_beta_submissions_replay_email_unique ON rl_beta_submissions (replay_fingerprint, email)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_beta_submissions_email_created_idx ON rl_beta_submissions (email, created_at)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_beta_submissions_status_created_idx ON rl_beta_submissions (status, created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_capabilities (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        mode text NOT NULL,
        rank_cohort text NOT NULL,
        upload_state text NOT NULL,
        parse_state text NOT NULL,
        process_state text NOT NULL,
        detector_state text NOT NULL,
        coaching_state text NOT NULL,
        reason text NOT NULL,
        source_version text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_capabilities_mode_cohort_unique ON rl_capabilities (mode, rank_cohort)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_capabilities_coaching_state_idx ON rl_capabilities (coaching_state)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_requests (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        email text NOT NULL,
        game text NOT NULL,
        platform text DEFAULT 'pc' NOT NULL,
        current_rank text NOT NULL,
        target_rank text,
        player_context text,
        evidence_type text NOT NULL,
        evidence_url text,
        file_key text,
        original_file_name text,
        file_size integer,
        goal text NOT NULL,
        notes text,
        status text DEFAULT 'received' NOT NULL,
        highest_impact_mistake text,
        why_it_costs text,
        evidence_moments text,
        next_queue_rule text,
        practice_plan text,
        coach_note text,
        feedback_score integer,
        feedback_text text,
        case_study_consent integer DEFAULT 0 NOT NULL,
        reporting_scope text DEFAULT 'product' NOT NULL,
        calibration_opt_in integer DEFAULT 0 NOT NULL,
        source text DEFAULT 'direct' NOT NULL,
        campaign text,
        privacy_version text DEFAULT '2026-08-16-beta' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ready_at text
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_requests_public_id_unique ON analysis_requests (public_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_requests_status_idx ON analysis_requests (status)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_requests_email_idx ON analysis_requests (email)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_requests_created_at_idx ON analysis_requests (created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS players (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        email text NOT NULL,
        display_name text,
        status text DEFAULT 'active' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS players_public_id_unique ON players (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS players_email_unique ON players (email)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_entitlements (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        player_id integer NOT NULL,
        entitlement_key text NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        granted_by text NOT NULL,
        granted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        revoked_at text,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_entitlements_public_id_unique ON player_entitlements (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_entitlements_player_key_unique ON player_entitlements (player_id, entitlement_key)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_entitlements_status_idx ON player_entitlements (entitlement_key, status)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_entitlement_audit (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        event_key text NOT NULL,
        player_id integer NOT NULL,
        entitlement_key text NOT NULL,
        action text NOT NULL,
        analysis_public_id text,
        actor text NOT NULL,
        metadata_json text DEFAULT '{}' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_entitlement_audit_event_unique ON player_entitlement_audit (event_key)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_entitlement_audit_player_created_idx ON player_entitlement_audit (player_id, created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_claims (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        token_hash text NOT NULL,
        player_id integer NOT NULL,
        analysis_request_id integer NOT NULL,
        expires_at text NOT NULL,
        consumed_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_claims_token_hash_unique ON player_claims (token_hash)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_claims_player_idx ON player_claims (player_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_claims_expires_at_idx ON player_claims (expires_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_sessions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        token_hash text NOT NULL,
        player_id integer NOT NULL,
        expires_at text NOT NULL,
        last_seen_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        revoked_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_sessions_token_hash_unique ON player_sessions (token_hash)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_sessions_player_idx ON player_sessions (player_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_sessions_expires_at_idx ON player_sessions (expires_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS owner_qa_identities (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        provider text DEFAULT 'chatgpt' NOT NULL,
        provider_user_id text NOT NULL,
        player_id integer NOT NULL,
        bound_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_verified_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        revoked_at text,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS owner_qa_identities_provider_user_unique ON owner_qa_identities (provider, provider_user_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS owner_qa_identities_player_unique ON owner_qa_identities (player_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS billing_customers (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        player_id integer NOT NULL,
        stripe_customer_id text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_customers_player_unique ON billing_customers (player_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_customers_stripe_unique ON billing_customers (stripe_customer_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS billing_subscriptions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        player_id integer NOT NULL,
        stripe_customer_id text NOT NULL,
        stripe_subscription_id text NOT NULL,
        stripe_price_id text NOT NULL,
        plan_key text NOT NULL,
        status text NOT NULL,
        current_period_start text NOT NULL,
        current_period_end text NOT NULL,
        cancel_at_period_end integer DEFAULT 0 NOT NULL,
        canceled_at text,
        ended_at text,
        grace_until text,
        latest_invoice_id text,
        checkout_session_id text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_stripe_unique ON billing_subscriptions (stripe_subscription_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS billing_subscriptions_player_status_idx ON billing_subscriptions (player_id, status)"),
      database.prepare("CREATE INDEX IF NOT EXISTS billing_subscriptions_customer_idx ON billing_subscriptions (stripe_customer_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS billing_events (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        stripe_event_id text NOT NULL,
        type text NOT NULL,
        status text DEFAULT 'processing' NOT NULL,
        error_message text,
        processed_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_events_stripe_unique ON billing_events (stripe_event_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS billing_events_status_idx ON billing_events (status)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_usage (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        analysis_public_id text NOT NULL,
        analysis_request_id integer,
        player_id integer NOT NULL,
        access_kind text NOT NULL,
        plan_key text,
        window_start text NOT NULL,
        window_end text NOT NULL,
        slot integer NOT NULL,
        status text DEFAULT 'reserved' NOT NULL,
        consumed_at text,
        released_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_usage_public_id_unique ON analysis_usage (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_usage_analysis_unique ON analysis_usage (analysis_public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_usage_active_slot_unique ON analysis_usage (player_id, access_kind, window_start, slot) WHERE status IN ('reserved', 'consumed')"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_usage_player_window_idx ON analysis_usage (player_id, window_start, status)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_usage_request_idx ON analysis_usage (analysis_request_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS replay_upload_sessions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        token_hash text NOT NULL,
        email text NOT NULL,
        file_name text NOT NULL,
        file_size integer NOT NULL,
        chunk_size integer NOT NULL,
        expected_parts integer NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        object_key text,
        file_sha256 text,
        analysis_request_id integer,
        expires_at text NOT NULL,
        completed_at text,
        claimed_at text,
        error_code text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS replay_upload_sessions_public_id_unique ON replay_upload_sessions (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS replay_upload_sessions_analysis_unique ON replay_upload_sessions (analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS replay_upload_sessions_email_created_idx ON replay_upload_sessions (email, created_at)"),
      database.prepare("CREATE INDEX IF NOT EXISTS replay_upload_sessions_status_expiry_idx ON replay_upload_sessions (status, expires_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS replay_upload_parts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        upload_session_id integer NOT NULL,
        part_number integer NOT NULL,
        object_key text NOT NULL,
        byte_size integer NOT NULL,
        sha256 text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (upload_session_id) REFERENCES replay_upload_sessions(id) ON DELETE CASCADE
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS replay_upload_parts_session_part_unique ON replay_upload_parts (upload_session_id, part_number)"),
      database.prepare("CREATE INDEX IF NOT EXISTS replay_upload_parts_session_idx ON replay_upload_parts (upload_session_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_report_access (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        token_hash text NOT NULL,
        analysis_request_id integer NOT NULL,
        expires_at text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE CASCADE
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_report_access_token_unique ON analysis_report_access (token_hash)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_report_access_request_idx ON analysis_report_access (analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_report_access_expiry_idx ON analysis_report_access (expires_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS email_deliveries (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        analysis_request_id integer NOT NULL,
        kind text NOT NULL,
        provider text DEFAULT 'resend' NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        idempotency_key text NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        max_attempts integer DEFAULT 3 NOT NULL,
        provider_message_id text,
        last_error_code text,
        next_retry_at text,
        accepted_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_public_id_unique ON email_deliveries (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_request_kind_unique ON email_deliveries (analysis_request_id, kind)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_idempotency_unique ON email_deliveries (idempotency_key)"),
      database.prepare("CREATE INDEX IF NOT EXISTS email_deliveries_retry_idx ON email_deliveries (status, next_retry_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS game_accounts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        player_id integer NOT NULL,
        game text NOT NULL,
        provider text NOT NULL,
        external_id text,
        display_name text,
        region text,
        connection_status text DEFAULT 'unverified' NOT NULL,
        last_synced_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS game_accounts_public_id_unique ON game_accounts (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS game_accounts_player_game_provider_unique ON game_accounts (player_id, game, provider)"),
      database.prepare("CREATE INDEX IF NOT EXISTS game_accounts_player_idx ON game_accounts (player_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_jobs (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        analysis_request_id integer NOT NULL,
        player_id integer,
        game text NOT NULL,
        status text DEFAULT 'queued' NOT NULL,
        stage text DEFAULT 'queued' NOT NULL,
        stage_label text DEFAULT 'Upload received' NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        max_attempts integer DEFAULT 3 NOT NULL,
        error_code text,
        error_message text,
        parser_version text,
        analyzer_version text,
        detector_version text,
        coaching_version text,
        schema_version text DEFAULT 'coaching.v1' NOT NULL,
        estimated_cost_micros integer DEFAULT 0 NOT NULL,
        duration_ms integer,
        scheduled_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        started_at text,
        completed_at text,
        next_retry_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_jobs_public_id_unique ON analysis_jobs (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_jobs_request_unique ON analysis_jobs (analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs (status)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_jobs_game_idx ON analysis_jobs (game)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_jobs_created_at_idx ON analysis_jobs (created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS matches (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        analysis_request_id integer NOT NULL,
        player_id integer,
        game text NOT NULL,
        ingestion_source text NOT NULL,
        external_match_id text,
        raw_object_key text,
        normalized_object_key text,
        mode text,
        rank text,
        game_version text,
        occurred_at text,
        parser_version text,
        normalized_schema_version text DEFAULT 'game-data.v1' NOT NULL,
        metadata_json text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS matches_public_id_unique ON matches (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS matches_request_unique ON matches (analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS matches_player_game_idx ON matches (player_id, game)"),
      database.prepare("CREATE INDEX IF NOT EXISTS matches_external_id_idx ON matches (external_match_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_findings (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        analysis_request_id integer NOT NULL,
        match_id integer,
        player_id integer,
        game text NOT NULL,
        priority integer NOT NULL,
        category text NOT NULL,
        title text NOT NULL,
        summary text NOT NULL,
        severity text NOT NULL,
        confidence real NOT NULL,
        confidence_label text NOT NULL,
        frequency integer,
        estimated_impact text,
        evidence_json text NOT NULL,
        metrics_json text NOT NULL,
        recommendation_json text NOT NULL,
        limitations_json text NOT NULL,
        detector_id text DEFAULT 'legacy.unknown' NOT NULL,
        detector_version text NOT NULL,
        schema_version text DEFAULT 'finding.v1' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS analysis_findings_public_id_unique ON analysis_findings (public_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_findings_request_priority_idx ON analysis_findings (analysis_request_id, priority)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_findings_player_game_idx ON analysis_findings (player_id, game)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_focuses (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        player_id integer NOT NULL,
        game text NOT NULL,
        finding_id integer,
        detector_id text DEFAULT 'legacy.unknown' NOT NULL,
        baseline_analysis_request_id integer,
        latest_analysis_request_id integer,
        status text DEFAULT 'active' NOT NULL,
        title text NOT NULL,
        success_metric text,
        metric_key text,
        metric_label text,
        baseline_value real,
        latest_value real,
        target_value real,
        unit text,
        target_direction text,
        minimum_matches integer DEFAULT 3 NOT NULL,
        matches_observed integer DEFAULT 0 NOT NULL,
        assigned_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at text,
        completion_reason text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (finding_id) REFERENCES analysis_findings(id),
        FOREIGN KEY (baseline_analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (latest_analysis_request_id) REFERENCES analysis_requests(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focuses_public_id_unique ON player_focuses (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focuses_active_unique ON player_focuses (player_id, game) WHERE status = 'active'"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_focuses_player_game_status_idx ON player_focuses (player_id, game, status)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_focus_observations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        focus_id integer NOT NULL,
        analysis_request_id integer NOT NULL,
        finding_id integer NOT NULL,
        detector_id text NOT NULL,
        confidence real NOT NULL,
        metric_key text,
        metric_label text,
        metric_value real,
        unit text,
        recurrence_value real,
        evidence_json text NOT NULL,
        limitations_json text NOT NULL,
        observed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (focus_id) REFERENCES player_focuses(id),
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (finding_id) REFERENCES analysis_findings(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focus_observations_public_id_unique ON player_focus_observations (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focus_observations_focus_request_unique ON player_focus_observations (focus_id, analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_focus_observations_focus_observed_idx ON player_focus_observations (focus_id, observed_at)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_focus_observations_player_request_idx ON player_focus_observations (analysis_request_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_reviews (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        analysis_request_id integer NOT NULL,
        finding_id integer,
        reviewer_email text NOT NULL,
        verdict text NOT NULL,
        notes text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id),
        FOREIGN KEY (finding_id) REFERENCES analysis_findings(id)
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_reviews_request_idx ON analysis_reviews (analysis_request_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_reviews_finding_idx ON analysis_reviews (finding_id)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_review_candidates (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        candidate_key text NOT NULL,
        replay_fingerprint text NOT NULL,
        mode text,
        rank_cohort text,
        context_key text,
        metadata_provenance text,
        game_version text,
        detector_id text NOT NULL,
        detector_version text NOT NULL,
        review_question text NOT NULL,
        timestamp_seconds real,
        frame integer,
        observation_json text NOT NULL,
        moment_object_key text,
        review_set_id text,
        active integer DEFAULT 0 NOT NULL,
        verdict text DEFAULT 'unreviewed' NOT NULL,
        timestamp_verified integer,
        notes text,
        reviewer_email text,
        label_set_version text,
        reviewed_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_review_candidates_key_unique ON rl_review_candidates (candidate_key)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_candidates_detector_verdict_idx ON rl_review_candidates (detector_id, verdict)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_candidates_replay_idx ON rl_review_candidates (replay_fingerprint)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_candidates_reviewed_at_idx ON rl_review_candidates (reviewed_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_reviewers (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        user_id text NOT NULL,
        email text NOT NULL,
        display_name text,
        qualification text NOT NULL,
        playlist_qualifications_json text DEFAULT '{}' NOT NULL,
        platform text,
        qualification_notes text,
        identity_verified_at text,
        status text DEFAULT 'pending' NOT NULL,
        approved_by text,
        approved_at text,
        revoked_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_reviewers_public_id_unique ON rl_reviewers (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_reviewers_user_id_unique ON rl_reviewers (user_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_reviewers_email_unique ON rl_reviewers (email)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_reviewers_status_idx ON rl_reviewers (status)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_review_labels (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        candidate_id integer NOT NULL,
        reviewer_id integer,
        reviewer_email text NOT NULL,
        reviewer_qualification text DEFAULT 'unverified' NOT NULL,
        reviewer_scope_json text DEFAULT '{}' NOT NULL,
        verdict text NOT NULL,
        timestamp_verified integer,
        gameplay_truth text,
        context_correct integer,
        coaching_relevance text,
        notes text,
        label_set_version text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES rl_review_candidates(id),
        FOREIGN KEY (reviewer_id) REFERENCES rl_reviewers(id)
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_labels_candidate_idx ON rl_review_labels (candidate_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_labels_created_at_idx ON rl_review_labels (created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_review_imports (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        import_id text NOT NULL,
        review_set_id text NOT NULL,
        queue_sha256 text NOT NULL,
        moments_sha256 text NOT NULL,
        corpus_manifest_sha256 text NOT NULL,
        holdout_report_sha256 text NOT NULL,
        holdout_reproducibility_fingerprint text NOT NULL,
        candidate_count integer NOT NULL,
        replay_count integer NOT NULL,
        holdout_overlap_count integer DEFAULT 0 NOT NULL,
        object_prefix text NOT NULL,
        imported_by text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_review_imports_import_id_unique ON rl_review_imports (import_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rl_review_imports_set_id_unique ON rl_review_imports (review_set_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_imports_created_at_idx ON rl_review_imports (created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS product_reviewers (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        user_id text NOT NULL,
        email text NOT NULL,
        display_name text,
        review_kind text,
        status text DEFAULT 'pending' NOT NULL,
        approved_by text,
        approved_at text,
        revoked_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_reviewers_public_id_unique ON product_reviewers (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_reviewers_user_id_unique ON product_reviewers (user_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_reviewers_email_unique ON product_reviewers (email)"),
      database.prepare("CREATE INDEX IF NOT EXISTS product_reviewers_status_idx ON product_reviewers (status)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS product_review_submissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        reviewer_id integer NOT NULL,
        review_kind text NOT NULL,
        state text DEFAULT 'draft' NOT NULL,
        checklist_json text DEFAULT '{}' NOT NULL,
        issues_json text DEFAULT '[]' NOT NULL,
        evidence_keys_json text DEFAULT '[]' NOT NULL,
        overall_recommendation text,
        session_notes text,
        submitted_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (reviewer_id) REFERENCES product_reviewers(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_review_submissions_public_id_unique ON product_review_submissions (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_review_submissions_reviewer_kind_unique ON product_review_submissions (reviewer_id, review_kind)"),
      database.prepare("CREATE INDEX IF NOT EXISTS product_review_submissions_state_idx ON product_review_submissions (state)"),
      database.prepare("CREATE INDEX IF NOT EXISTS product_review_submissions_updated_at_idx ON product_review_submissions (updated_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS detector_quality_snapshots (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        detector_id text NOT NULL,
        detector_version text NOT NULL,
        corpus_fingerprint text NOT NULL,
        label_set_version text NOT NULL,
        evidence_source text NOT NULL,
        metrics_json text NOT NULL,
        gate_json text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS detector_quality_snapshots_public_id_unique ON detector_quality_snapshots (public_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS detector_quality_snapshots_detector_created_idx ON detector_quality_snapshots (detector_id, created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS detector_lifecycle_events (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        detector_id text NOT NULL,
        detector_version text NOT NULL,
        from_state text NOT NULL,
        to_state text NOT NULL,
        reason text NOT NULL,
        activation_fingerprint text,
        actor_email text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS detector_lifecycle_events_public_id_unique ON detector_lifecycle_events (public_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS detector_lifecycle_events_detector_created_idx ON detector_lifecycle_events (detector_id, created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS player_focus_evaluations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        focus_id integer NOT NULL,
        analysis_request_id integer NOT NULL,
        detector_id text NOT NULL,
        detector_version text NOT NULL,
        context_key text,
        detector_evaluated integer NOT NULL,
        opportunity_count integer DEFAULT 0 NOT NULL,
        fired integer NOT NULL,
        metric_value real,
        evidence_source text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (focus_id) REFERENCES player_focuses(id),
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focus_evaluations_public_id_unique ON player_focus_evaluations (public_id)"),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focus_evaluations_focus_request_detector_unique ON player_focus_evaluations (focus_id, analysis_request_id, detector_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_focus_evaluations_focus_created_idx ON player_focus_evaluations (focus_id, created_at)")
    ]).then(async () => {
      // Existing beta D1 databases predate the longitudinal focus columns.
      // Checked migrations remain canonical; these guarded additions keep
      // local/preview databases compatible when they are opened directly.
      await ensureColumn(database, "analysis_requests", "platform", "text DEFAULT 'pc' NOT NULL");
      await ensureColumn(database, "analysis_requests", "reporting_scope", "text DEFAULT 'product' NOT NULL");
      await ensureColumn(database, "analysis_requests", "calibration_opt_in", "integer DEFAULT 0 NOT NULL");
      await ensureColumn(database, "analysis_findings", "detector_id", "text DEFAULT 'legacy.unknown' NOT NULL");
      await ensureColumn(database, "player_focuses", "detector_id", "text DEFAULT 'legacy.unknown' NOT NULL");
      await ensureColumn(database, "player_focuses", "baseline_analysis_request_id", "integer");
      await ensureColumn(database, "player_focuses", "latest_analysis_request_id", "integer");
      await ensureColumn(database, "player_focuses", "metric_key", "text");
      await ensureColumn(database, "player_focuses", "metric_label", "text");
      await ensureColumn(database, "player_focuses", "target_direction", "text");
      await ensureColumn(database, "player_focuses", "minimum_matches", "integer DEFAULT 3 NOT NULL");
      await ensureColumn(database, "player_focuses", "completion_reason", "text");
      await ensureColumn(database, "rl_review_candidates", "rank_cohort", "text");
      await ensureColumn(database, "rl_review_candidates", "context_key", "text");
      await ensureColumn(database, "rl_review_candidates", "metadata_provenance", "text");
      await ensureColumn(database, "rl_review_candidates", "moment_object_key", "text");
      await ensureColumn(database, "rl_review_candidates", "review_set_id", "text");
      await ensureColumn(database, "rl_review_candidates", "active", "integer DEFAULT 0 NOT NULL");
      await database.prepare("CREATE INDEX IF NOT EXISTS rl_review_candidates_moment_key_idx ON rl_review_candidates (moment_object_key)").run();
      await database.prepare("CREATE INDEX IF NOT EXISTS rl_review_candidates_set_active_idx ON rl_review_candidates (review_set_id, active)").run();
      await ensureColumn(database, "rl_beta_submissions", "parser_status", "text DEFAULT 'pending' NOT NULL");
      await ensureColumn(database, "rl_beta_submissions", "parser_version", "text");
      await ensureColumn(database, "rl_beta_submissions", "parsed_mode", "text");
      await ensureColumn(database, "rl_beta_submissions", "attribution_status", "text DEFAULT 'pending' NOT NULL");
      await ensureColumn(database, "rl_beta_submissions", "usability_status", "text DEFAULT 'pending' NOT NULL");
      await ensureColumn(database, "rl_beta_submissions", "processing_error_code", "text");
      await ensureColumn(database, "rl_beta_submissions", "processing_metadata_json", "text");
      await ensureColumn(database, "rl_beta_submissions", "review_state", "text DEFAULT 'not_started' NOT NULL");
      await ensureColumn(database, "rl_beta_submissions", "detector_set_version", "text");
      await ensureColumn(database, "rl_beta_submissions", "rights_confirmed_at", "text");
      await ensureColumn(database, "rl_beta_submissions", "updates_consent_at", "text");
      await ensureColumn(database, "rl_review_labels", "reviewer_qualification", "text DEFAULT 'unverified' NOT NULL");
      await ensureColumn(database, "rl_review_labels", "reviewer_id", "integer");
      await ensureColumn(database, "rl_review_labels", "reviewer_scope_json", "text DEFAULT '{}' NOT NULL");
      await ensureColumn(database, "rl_review_labels", "gameplay_truth", "text");
      await ensureColumn(database, "rl_review_labels", "context_correct", "integer");
      await ensureColumn(database, "rl_review_labels", "coaching_relevance", "text");
      await ensureColumn(database, "rl_reviewers", "playlist_qualifications_json", "text DEFAULT '{}' NOT NULL");
      await ensureColumn(database, "rl_reviewers", "platform", "text");
      await ensureColumn(database, "rl_reviewers", "qualification_notes", "text");
      await ensureColumn(database, "rl_reviewers", "identity_verified_at", "text");
      await database.prepare("CREATE INDEX IF NOT EXISTS rl_review_labels_reviewer_candidate_idx ON rl_review_labels (reviewer_id, candidate_id)").run();
      const capabilityRows = [
        ["1v1", "gold-platinum", "verified", 3], ["1v1", "diamond-champion", "verified", 6], ["1v1", "grand-champion-ssl", "verified", 1],
        ["2v2", "gold-platinum", "verified", 8], ["2v2", "diamond-champion", "verified", 7], ["2v2", "grand-champion-ssl", "verified", 2],
        ["3v3", "gold-platinum", "verified", 8], ["3v3", "diamond-champion", "verified", 5], ["3v3", "grand-champion-ssl", "calibration-verified", 0],
      ];
      await database.batch(capabilityRows.map(([mode, rankCohort, processingState, holdoutReplays]) => database.prepare(`INSERT INTO rl_capabilities (
          mode, rank_cohort, upload_state, parse_state, process_state, detector_state, coaching_state, reason, source_version, updated_at
        ) VALUES (?, ?, 'enabled', ?, ?, 'shadow-only', 'abstention-only', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(mode, rank_cohort) DO UPDATE SET upload_state = excluded.upload_state,
          parse_state = excluded.parse_state, process_state = excluded.process_state,
          detector_state = excluded.detector_state, coaching_state = excluded.coaching_state,
          reason = excluded.reason, source_version = excluded.source_version, updated_at = CURRENT_TIMESTAMP`)
        .bind(
          mode,
          rankCohort,
          processingState,
          processingState,
          `Replay parsing and mode attribution passed calibration; this exact cell contains ${holdoutReplays} locked holdout replays. No exact detector scope has passed two-reviewer quality gates.`,
          `rl-parser-validation.2026-08-22.holdout-${holdoutReplays}`,
        )));
    }).catch((error) => {
      productSchemaReady = null;
      throw error;
    });
  }

  await productSchemaReady;
}

export async function getDatabase() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  const database = env.DB as D1Database;
  await ensureProductSchema(database);
  await ensureConfiguredOwnerQaEntitlement(database, (env as unknown as { OWNER_QA_PLAYER_ID?: string }).OWNER_QA_PLAYER_ID);
  return database;
}

export async function getDb() {
  const database = await getDatabase();
  return drizzle(database, { schema });
}

import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

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
      database.prepare(`CREATE TABLE IF NOT EXISTS rl_review_labels (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        candidate_id integer NOT NULL,
        reviewer_email text NOT NULL,
        reviewer_qualification text DEFAULT 'unverified' NOT NULL,
        verdict text NOT NULL,
        timestamp_verified integer,
        notes text,
        label_set_version text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES rl_review_candidates(id)
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_labels_candidate_idx ON rl_review_labels (candidate_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS rl_review_labels_created_at_idx ON rl_review_labels (created_at)"),
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
      await ensureColumn(database, "rl_review_labels", "reviewer_qualification", "text DEFAULT 'unverified' NOT NULL");
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
  return database;
}

export async function getDb() {
  const database = await getDatabase();
  return drizzle(database, { schema });
}

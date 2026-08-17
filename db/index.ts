import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let productSchemaReady: Promise<void> | null = null;

export async function ensureProductSchema(database: D1Database) {
  if (!productSchemaReady) {
    productSchemaReady = database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS analysis_requests (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id text NOT NULL,
        email text NOT NULL,
        game text NOT NULL,
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
        status text DEFAULT 'active' NOT NULL,
        title text NOT NULL,
        success_metric text,
        baseline_value real,
        latest_value real,
        target_value real,
        unit text,
        matches_observed integer DEFAULT 0 NOT NULL,
        assigned_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (finding_id) REFERENCES analysis_findings(id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS player_focuses_public_id_unique ON player_focuses (public_id)"),
      database.prepare("CREATE INDEX IF NOT EXISTS player_focuses_player_game_status_idx ON player_focuses (player_id, game, status)"),
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
      database.prepare("CREATE INDEX IF NOT EXISTS analysis_reviews_finding_idx ON analysis_reviews (finding_id)")
    ]).then(() => undefined).catch((error) => {
      productSchemaReady = null;
      throw error;
    });
  }

  await productSchemaReady;
}

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  const database = env.DB as D1Database;
  await ensureProductSchema(database);
  return drizzle(database, { schema });
}

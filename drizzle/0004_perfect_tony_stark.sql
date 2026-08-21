CREATE TABLE `analysis_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`email` text NOT NULL,
	`game` text NOT NULL,
	`platform` text DEFAULT 'pc' NOT NULL,
	`current_rank` text NOT NULL,
	`target_rank` text,
	`player_context` text,
	`evidence_type` text NOT NULL,
	`evidence_url` text,
	`file_key` text,
	`original_file_name` text,
	`file_size` integer,
	`goal` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'received' NOT NULL,
	`highest_impact_mistake` text,
	`why_it_costs` text,
	`evidence_moments` text,
	`next_queue_rule` text,
	`practice_plan` text,
	`coach_note` text,
	`feedback_score` integer,
	`feedback_text` text,
	`case_study_consent` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`campaign` text,
	`privacy_version` text DEFAULT '2026-08-16-beta' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ready_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_requests_public_id_unique` ON `analysis_requests` (`public_id`);--> statement-breakpoint
CREATE INDEX `analysis_requests_status_idx` ON `analysis_requests` (`status`);--> statement-breakpoint
CREATE INDEX `analysis_requests_email_idx` ON `analysis_requests` (`email`);--> statement-breakpoint
CREATE INDEX `analysis_requests_created_at_idx` ON `analysis_requests` (`created_at`);

CREATE TABLE `detector_lifecycle_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`detector_id` text NOT NULL,
	`detector_version` text NOT NULL,
	`from_state` text NOT NULL,
	`to_state` text NOT NULL,
	`reason` text NOT NULL,
	`activation_fingerprint` text,
	`actor_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `detector_lifecycle_events_public_id_unique` ON `detector_lifecycle_events` (`public_id`);--> statement-breakpoint
CREATE INDEX `detector_lifecycle_events_detector_created_idx` ON `detector_lifecycle_events` (`detector_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `detector_quality_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`detector_id` text NOT NULL,
	`detector_version` text NOT NULL,
	`corpus_fingerprint` text NOT NULL,
	`label_set_version` text NOT NULL,
	`evidence_source` text NOT NULL,
	`metrics_json` text NOT NULL,
	`gate_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `detector_quality_snapshots_public_id_unique` ON `detector_quality_snapshots` (`public_id`);--> statement-breakpoint
CREATE INDEX `detector_quality_snapshots_detector_created_idx` ON `detector_quality_snapshots` (`detector_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_focus_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`focus_id` integer NOT NULL,
	`analysis_request_id` integer NOT NULL,
	`detector_id` text NOT NULL,
	`detector_version` text NOT NULL,
	`context_key` text,
	`detector_evaluated` integer NOT NULL,
	`opportunity_count` integer DEFAULT 0 NOT NULL,
	`fired` integer NOT NULL,
	`metric_value` real,
	`evidence_source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`focus_id`) REFERENCES `player_focuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_focus_evaluations_public_id_unique` ON `player_focus_evaluations` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_focus_evaluations_focus_request_detector_unique` ON `player_focus_evaluations` (`focus_id`,`analysis_request_id`,`detector_id`);--> statement-breakpoint
CREATE INDEX `player_focus_evaluations_focus_created_idx` ON `player_focus_evaluations` (`focus_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `rl_review_candidates` ADD `rank_cohort` text;--> statement-breakpoint
ALTER TABLE `rl_review_candidates` ADD `context_key` text;--> statement-breakpoint
ALTER TABLE `rl_review_candidates` ADD `metadata_provenance` text;--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `reviewer_qualification` text DEFAULT 'unverified' NOT NULL;
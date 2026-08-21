CREATE TABLE `rl_beta_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`email` text NOT NULL,
	`player_name` text NOT NULL,
	`rank_cohort` text NOT NULL,
	`mode` text DEFAULT '2v2' NOT NULL,
	`replay_fingerprint` text NOT NULL,
	`file_key` text NOT NULL,
	`original_file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`campaign` text,
	`consent_version` text NOT NULL,
	`consent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_beta_submissions_public_id_unique` ON `rl_beta_submissions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rl_beta_submissions_replay_email_unique` ON `rl_beta_submissions` (`replay_fingerprint`,`email`);--> statement-breakpoint
CREATE INDEX `rl_beta_submissions_email_created_idx` ON `rl_beta_submissions` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `rl_beta_submissions_status_created_idx` ON `rl_beta_submissions` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `analysis_requests` ADD `platform` text DEFAULT 'pc' NOT NULL;
CREATE TABLE `rl_reviewers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`qualification` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_reviewers_public_id_unique` ON `rl_reviewers` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rl_reviewers_user_id_unique` ON `rl_reviewers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rl_reviewers_email_unique` ON `rl_reviewers` (`email`);--> statement-breakpoint
CREATE INDEX `rl_reviewers_status_idx` ON `rl_reviewers` (`status`);--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `parser_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `parser_version` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `parsed_mode` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `attribution_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `usability_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `processing_error_code` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `processing_metadata_json` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `review_state` text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `detector_set_version` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `rights_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `rl_beta_submissions` ADD `updates_consent_at` text;--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `reviewer_id` integer REFERENCES rl_reviewers(id);--> statement-breakpoint
CREATE INDEX `rl_review_labels_reviewer_candidate_idx` ON `rl_review_labels` (`reviewer_id`,`candidate_id`);
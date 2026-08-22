ALTER TABLE `rl_review_candidates` ADD `moment_object_key` text;--> statement-breakpoint
CREATE INDEX `rl_review_candidates_moment_key_idx` ON `rl_review_candidates` (`moment_object_key`);--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `reviewer_scope_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `rl_reviewers` ADD `playlist_qualifications_json` text DEFAULT '{}' NOT NULL;

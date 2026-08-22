CREATE TABLE `rl_review_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` text NOT NULL,
	`review_set_id` text NOT NULL,
	`queue_sha256` text NOT NULL,
	`moments_sha256` text NOT NULL,
	`corpus_manifest_sha256` text NOT NULL,
	`holdout_report_sha256` text NOT NULL,
	`holdout_reproducibility_fingerprint` text NOT NULL,
	`candidate_count` integer NOT NULL,
	`replay_count` integer NOT NULL,
	`holdout_overlap_count` integer DEFAULT 0 NOT NULL,
	`object_prefix` text NOT NULL,
	`imported_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_review_imports_import_id_unique` ON `rl_review_imports` (`import_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rl_review_imports_set_id_unique` ON `rl_review_imports` (`review_set_id`);--> statement-breakpoint
CREATE INDEX `rl_review_imports_created_at_idx` ON `rl_review_imports` (`created_at`);--> statement-breakpoint
ALTER TABLE `rl_review_candidates` ADD `review_set_id` text;--> statement-breakpoint
ALTER TABLE `rl_review_candidates` ADD `active` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `rl_review_candidates_set_active_idx` ON `rl_review_candidates` (`review_set_id`,`active`);--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `gameplay_truth` text;--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `context_correct` integer;--> statement-breakpoint
ALTER TABLE `rl_review_labels` ADD `coaching_relevance` text;--> statement-breakpoint
ALTER TABLE `rl_reviewers` ADD `platform` text;--> statement-breakpoint
ALTER TABLE `rl_reviewers` ADD `qualification_notes` text;--> statement-breakpoint
ALTER TABLE `rl_reviewers` ADD `identity_verified_at` text;
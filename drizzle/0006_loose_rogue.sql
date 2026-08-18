CREATE TABLE `rl_review_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_key` text NOT NULL,
	`replay_fingerprint` text NOT NULL,
	`mode` text,
	`game_version` text,
	`detector_id` text NOT NULL,
	`detector_version` text NOT NULL,
	`review_question` text NOT NULL,
	`timestamp_seconds` real,
	`frame` integer,
	`observation_json` text NOT NULL,
	`verdict` text DEFAULT 'unreviewed' NOT NULL,
	`timestamp_verified` integer,
	`notes` text,
	`reviewer_email` text,
	`label_set_version` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_review_candidates_key_unique` ON `rl_review_candidates` (`candidate_key`);--> statement-breakpoint
CREATE INDEX `rl_review_candidates_detector_verdict_idx` ON `rl_review_candidates` (`detector_id`,`verdict`);--> statement-breakpoint
CREATE INDEX `rl_review_candidates_replay_idx` ON `rl_review_candidates` (`replay_fingerprint`);--> statement-breakpoint
CREATE INDEX `rl_review_candidates_reviewed_at_idx` ON `rl_review_candidates` (`reviewed_at`);--> statement-breakpoint
CREATE TABLE `rl_review_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`reviewer_email` text NOT NULL,
	`verdict` text NOT NULL,
	`timestamp_verified` integer,
	`notes` text,
	`label_set_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `rl_review_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rl_review_labels_candidate_idx` ON `rl_review_labels` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `rl_review_labels_created_at_idx` ON `rl_review_labels` (`created_at`);
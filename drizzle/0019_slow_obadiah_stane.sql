CREATE TABLE `product_review_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`reviewer_id` integer NOT NULL,
	`review_kind` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`checklist_json` text DEFAULT '{}' NOT NULL,
	`issues_json` text DEFAULT '[]' NOT NULL,
	`evidence_keys_json` text DEFAULT '[]' NOT NULL,
	`overall_recommendation` text,
	`session_notes` text,
	`submitted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reviewer_id`) REFERENCES `product_reviewers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_review_submissions_public_id_unique` ON `product_review_submissions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_review_submissions_reviewer_kind_unique` ON `product_review_submissions` (`reviewer_id`,`review_kind`);--> statement-breakpoint
CREATE INDEX `product_review_submissions_state_idx` ON `product_review_submissions` (`state`);--> statement-breakpoint
CREATE INDEX `product_review_submissions_updated_at_idx` ON `product_review_submissions` (`updated_at`);--> statement-breakpoint
CREATE TABLE `product_reviewers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`review_kind` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_reviewers_public_id_unique` ON `product_reviewers` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_reviewers_user_id_unique` ON `product_reviewers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_reviewers_email_unique` ON `product_reviewers` (`email`);--> statement-breakpoint
CREATE INDEX `product_reviewers_status_idx` ON `product_reviewers` (`status`);
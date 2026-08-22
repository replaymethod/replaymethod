CREATE TABLE `replay_upload_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`upload_session_id` integer NOT NULL,
	`part_number` integer NOT NULL,
	`object_key` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`upload_session_id`) REFERENCES `replay_upload_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `replay_upload_parts_session_part_unique` ON `replay_upload_parts` (`upload_session_id`,`part_number`);--> statement-breakpoint
CREATE INDEX `replay_upload_parts_session_idx` ON `replay_upload_parts` (`upload_session_id`);--> statement-breakpoint
CREATE TABLE `replay_upload_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`chunk_size` integer NOT NULL,
	`expected_parts` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`object_key` text,
	`file_sha256` text,
	`analysis_request_id` integer,
	`expires_at` text NOT NULL,
	`completed_at` text,
	`claimed_at` text,
	`error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `replay_upload_sessions_public_id_unique` ON `replay_upload_sessions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `replay_upload_sessions_analysis_unique` ON `replay_upload_sessions` (`analysis_request_id`);--> statement-breakpoint
CREATE INDEX `replay_upload_sessions_email_created_idx` ON `replay_upload_sessions` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `replay_upload_sessions_status_expiry_idx` ON `replay_upload_sessions` (`status`,`expires_at`);
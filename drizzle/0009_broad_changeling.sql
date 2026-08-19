CREATE TABLE `email_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`analysis_request_id` integer NOT NULL,
	`kind` text NOT NULL,
	`provider` text DEFAULT 'resend' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`provider_message_id` text,
	`last_error_code` text,
	`next_retry_at` text,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_public_id_unique` ON `email_deliveries` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_request_kind_unique` ON `email_deliveries` (`analysis_request_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_idempotency_unique` ON `email_deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `email_deliveries_retry_idx` ON `email_deliveries` (`status`,`next_retry_at`);
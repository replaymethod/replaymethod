CREATE TABLE `analysis_report_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`analysis_request_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_report_access_token_unique` ON `analysis_report_access` (`token_hash`);--> statement-breakpoint
CREATE INDEX `analysis_report_access_request_idx` ON `analysis_report_access` (`analysis_request_id`);--> statement-breakpoint
CREATE INDEX `analysis_report_access_expiry_idx` ON `analysis_report_access` (`expires_at`);
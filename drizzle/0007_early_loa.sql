CREATE TABLE `player_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`player_id` integer NOT NULL,
	`analysis_request_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_claims_token_hash_unique` ON `player_claims` (`token_hash`);--> statement-breakpoint
CREATE INDEX `player_claims_player_idx` ON `player_claims` (`player_id`);--> statement-breakpoint
CREATE INDEX `player_claims_expires_at_idx` ON `player_claims` (`expires_at`);--> statement-breakpoint
CREATE TABLE `player_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`player_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_sessions_token_hash_unique` ON `player_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `player_sessions_player_idx` ON `player_sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `player_sessions_expires_at_idx` ON `player_sessions` (`expires_at`);
CREATE TABLE `player_focus_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`focus_id` integer NOT NULL,
	`analysis_request_id` integer NOT NULL,
	`finding_id` integer NOT NULL,
	`detector_id` text NOT NULL,
	`confidence` real NOT NULL,
	`metric_key` text,
	`metric_label` text,
	`metric_value` real,
	`unit` text,
	`recurrence_value` real,
	`evidence_json` text NOT NULL,
	`limitations_json` text NOT NULL,
	`observed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`focus_id`) REFERENCES `player_focuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`finding_id`) REFERENCES `analysis_findings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_focus_observations_public_id_unique` ON `player_focus_observations` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_focus_observations_focus_request_unique` ON `player_focus_observations` (`focus_id`,`analysis_request_id`);--> statement-breakpoint
CREATE INDEX `player_focus_observations_focus_observed_idx` ON `player_focus_observations` (`focus_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `player_focus_observations_player_request_idx` ON `player_focus_observations` (`analysis_request_id`);--> statement-breakpoint
ALTER TABLE `analysis_findings` ADD `detector_id` text DEFAULT 'legacy.unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `detector_id` text DEFAULT 'legacy.unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `baseline_analysis_request_id` integer REFERENCES analysis_requests(id);--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `latest_analysis_request_id` integer REFERENCES analysis_requests(id);--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `metric_key` text;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `metric_label` text;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `target_direction` text;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `minimum_matches` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_focuses` ADD `completion_reason` text;--> statement-breakpoint
CREATE UNIQUE INDEX `player_focuses_active_unique` ON `player_focuses` (`player_id`,`game`) WHERE "player_focuses"."status" = 'active';
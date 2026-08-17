CREATE TABLE `funnel_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`event` text NOT NULL,
	`game` text DEFAULT 'general' NOT NULL,
	`placement` text DEFAULT 'unknown' NOT NULL,
	`path` text DEFAULT '/' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`campaign` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `funnel_events_created_at_idx` ON `funnel_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `funnel_events_event_idx` ON `funnel_events` (`event`);--> statement-breakpoint
CREATE INDEX `funnel_events_game_idx` ON `funnel_events` (`game`);--> statement-breakpoint
ALTER TABLE `waitlist` ADD `source` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `campaign` text;
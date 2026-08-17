DROP INDEX `waitlist_email_unique`;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `game` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_game_unique` ON `waitlist` (`email`,`game`);
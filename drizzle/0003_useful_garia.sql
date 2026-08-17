ALTER TABLE `waitlist` ADD `consent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `privacy_version` text DEFAULT '2026-08-15' NOT NULL;
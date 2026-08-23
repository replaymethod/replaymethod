CREATE TABLE `player_entitlement_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`player_id` integer NOT NULL,
	`entitlement_key` text NOT NULL,
	`action` text NOT NULL,
	`analysis_public_id` text,
	`actor` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_entitlement_audit_event_unique` ON `player_entitlement_audit` (`event_key`);--> statement-breakpoint
CREATE INDEX `player_entitlement_audit_player_created_idx` ON `player_entitlement_audit` (`player_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_entitlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`player_id` integer NOT NULL,
	`entitlement_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_entitlements_public_id_unique` ON `player_entitlements` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_entitlements_player_key_unique` ON `player_entitlements` (`player_id`,`entitlement_key`);--> statement-breakpoint
CREATE INDEX `player_entitlements_status_idx` ON `player_entitlements` (`entitlement_key`,`status`);--> statement-breakpoint
ALTER TABLE `analysis_requests` ADD `reporting_scope` text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_requests` ADD `calibration_opt_in` integer DEFAULT false NOT NULL;
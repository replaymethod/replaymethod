CREATE TABLE `rl_capabilities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`rank_cohort` text NOT NULL,
	`upload_state` text NOT NULL,
	`parse_state` text NOT NULL,
	`process_state` text NOT NULL,
	`detector_state` text NOT NULL,
	`coaching_state` text NOT NULL,
	`reason` text NOT NULL,
	`source_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_capabilities_mode_cohort_unique` ON `rl_capabilities` (`mode`,`rank_cohort`);--> statement-breakpoint
CREATE INDEX `rl_capabilities_coaching_state_idx` ON `rl_capabilities` (`coaching_state`);
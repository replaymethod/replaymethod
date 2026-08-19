CREATE TABLE `analysis_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`analysis_public_id` text NOT NULL,
	`analysis_request_id` integer,
	`player_id` integer NOT NULL,
	`access_kind` text NOT NULL,
	`plan_key` text,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`slot` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`consumed_at` text,
	`released_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`analysis_request_id`) REFERENCES `analysis_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_usage_public_id_unique` ON `analysis_usage` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_usage_analysis_unique` ON `analysis_usage` (`analysis_public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_usage_active_slot_unique` ON `analysis_usage` (`player_id`,`access_kind`,`window_start`,`slot`) WHERE "analysis_usage"."status" IN ('reserved', 'consumed');--> statement-breakpoint
CREATE INDEX `analysis_usage_player_window_idx` ON `analysis_usage` (`player_id`,`window_start`,`status`);--> statement-breakpoint
CREATE INDEX `analysis_usage_request_idx` ON `analysis_usage` (`analysis_request_id`);--> statement-breakpoint
CREATE TABLE `billing_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customers_player_unique` ON `billing_customers` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customers_stripe_unique` ON `billing_customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stripe_event_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`error_message` text,
	`processed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_events_stripe_unique` ON `billing_events` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `billing_events_status_idx` ON `billing_events` (`status`);--> statement-breakpoint
CREATE TABLE `billing_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`stripe_price_id` text NOT NULL,
	`plan_key` text NOT NULL,
	`status` text NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`canceled_at` text,
	`ended_at` text,
	`grace_until` text,
	`latest_invoice_id` text,
	`checkout_session_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_subscriptions_stripe_unique` ON `billing_subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `billing_subscriptions_player_status_idx` ON `billing_subscriptions` (`player_id`,`status`);--> statement-breakpoint
CREATE INDEX `billing_subscriptions_customer_idx` ON `billing_subscriptions` (`stripe_customer_id`);
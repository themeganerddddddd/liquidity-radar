CREATE TABLE `person_liquidity_summary` (
	`person_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`company` text,
	`country` text,
	`state` text,
	`city` text,
	`location_basis` text,
	`industry` text,
	`market_class` text DEFAULT 'UNKNOWN' NOT NULL,
	`latest_event_id` text NOT NULL,
	`latest_event_title` text NOT NULL,
	`latest_stage` text NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`first_signal_at` text,
	`latest_signal_at` text,
	`latest_close_at` text,
	`estimated_liquidity_low` integer,
	`estimated_liquidity_high` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`highest_confidence` integer DEFAULT 0 NOT NULL,
	`actionability` integer DEFAULT 0 NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`open_pre_liquidity_count` integer DEFAULT 0 NOT NULL,
	`closed_event_count` integer DEFAULT 0 NOT NULL,
	`lead_days_to_close` integer,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`uncertainties_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `person_liquidity_amount_idx` ON `person_liquidity_summary` (`estimated_liquidity_high`);--> statement-breakpoint
CREATE INDEX `person_liquidity_actionability_idx` ON `person_liquidity_summary` (`actionability`);--> statement-breakpoint
CREATE INDEX `person_liquidity_signal_idx` ON `person_liquidity_summary` (`latest_signal_at`);--> statement-breakpoint
CREATE INDEX `person_liquidity_location_idx` ON `person_liquidity_summary` (`state`,`city`);--> statement-breakpoint
ALTER TABLE `source_health` ADD `error_type` text;--> statement-breakpoint
ALTER TABLE `source_health` ADD `watermark` text;--> statement-breakpoint
ALTER TABLE `source_health` ADD `next_retry_at` text;--> statement-breakpoint
ALTER TABLE `source_health` ADD `requests` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `cache_hits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `rate_limit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `successful_queries` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `private_company_transactions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `named_people_resolved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `ownership_evidence_events` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `reported_valuation_events` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `estimates_generated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `pre_liquidity_signals` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_health` ADD `median_lead_days` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `first_signal_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `first_pre_sale_signal_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `regulatory_filing_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `lead_days_to_announcement` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `lead_days_to_close` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `independent_source_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `actionability` integer DEFAULT 0 NOT NULL;
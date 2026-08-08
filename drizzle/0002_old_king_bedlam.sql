CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`entity_type` text NOT NULL,
	`market_classification` text DEFAULT 'UNKNOWN' NOT NULL,
	`industry` text,
	`primary_location_id` text,
	`suppression_status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_slug_idx` ON `entities` (`slug`);--> statement-breakpoint
CREATE INDEX `entities_name_idx` ON `entities` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `entities` (`entity_type`);--> statement-breakpoint
CREATE TABLE `entity_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`alias_type` text NOT NULL,
	`source_record_id` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_alias_unique_idx` ON `entity_aliases` (`entity_id`,`normalized_alias`,`alias_type`);--> statement-breakpoint
CREATE INDEX `entity_alias_lookup_idx` ON `entity_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `entity_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`source_record_id` text NOT NULL,
	`source_name` text NOT NULL,
	`matched_entity_id` text,
	`matched_person_id` text,
	`match_method` text NOT NULL,
	`match_score` integer NOT NULL,
	`match_status` text NOT NULL,
	`explanation` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `entity_matches_source_idx` ON `entity_matches` (`source_record_id`);--> statement-breakpoint
CREATE INDEX `entity_matches_status_idx` ON `entity_matches` (`match_status`,`match_score`);--> statement-breakpoint
CREATE TABLE `evidence_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_record_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`relationship` text NOT NULL,
	`classification` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_links_unique_idx` ON `evidence_links` (`source_record_id`,`subject_type`,`subject_id`,`relationship`);--> statement-breakpoint
CREATE INDEX `evidence_links_subject_idx` ON `evidence_links` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`input_cursor` text,
	`input_hash` text,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_accepted` integer DEFAULT 0 NOT NULL,
	`records_rejected` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_information` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_source_idx` ON `ingestion_runs` (`source_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_runs_idempotency_idx` ON `ingestion_runs` (`source_id`,`input_hash`);--> statement-breakpoint
CREATE TABLE `ownership_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`person_id` text,
	`entity_id` text,
	`ownership_low` real,
	`ownership_high` real,
	`classification` text NOT NULL,
	`methodology` text NOT NULL,
	`source_record_id` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `ownership_transaction_idx` ON `ownership_evidence` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `ownership_person_idx` ON `ownership_evidence` (`person_id`);--> statement-breakpoint
CREATE TABLE `person_entity_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`ownership_percentage_low` real,
	`ownership_percentage_high` real,
	`effective_from` text,
	`effective_through` text,
	`evidence_claim_id` text,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `person_entity_person_idx` ON `person_entity_roles` (`person_id`);--> statement-breakpoint
CREATE INDEX `person_entity_entity_idx` ON `person_entity_roles` (`entity_id`);--> statement-breakpoint
CREATE TABLE `signal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text,
	`source_record_id` text NOT NULL,
	`signal_type` text NOT NULL,
	`signal_stage` text NOT NULL,
	`occurred_at` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `signal_events_stage_idx` ON `signal_events` (`signal_stage`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `signal_events_transaction_idx` ON `signal_events` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `source_health` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`mode` text NOT NULL,
	`cadence` text NOT NULL,
	`last_attempt_at` text,
	`last_success_at` text,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_accepted` integer DEFAULT 0 NOT NULL,
	`records_rejected` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer,
	`current_error` text,
	`disabled_reason` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_health_source_idx` ON `source_health` (`source_id`);--> statement-breakpoint
CREATE INDEX `source_health_mode_idx` ON `source_health` (`mode`);--> statement-breakpoint
CREATE TABLE `source_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`source_type` text NOT NULL,
	`external_record_id` text NOT NULL,
	`source_url` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`published_at` text,
	`event_date` text,
	`event_type` text NOT NULL,
	`event_stage` text NOT NULL,
	`raw_title` text NOT NULL,
	`raw_text` text,
	`seller_entity` text,
	`buyer_entity` text,
	`subject_person` text,
	`subject_company` text,
	`asset` text,
	`location` text,
	`reported_transaction_value` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`ownership_percentage_low` real,
	`ownership_percentage_high` real,
	`status` text NOT NULL,
	`metadata` text,
	`raw_payload_hash` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_records_external_idx` ON `source_records` (`source_id`,`external_record_id`);--> statement-breakpoint
CREATE INDEX `source_records_event_idx` ON `source_records` (`event_type`,`event_stage`,`event_date`);--> statement-breakpoint
CREATE INDEX `source_records_hash_idx` ON `source_records` (`raw_payload_hash`);--> statement-breakpoint
CREATE TABLE `transaction_parties` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`entity_id` text,
	`person_id` text,
	`party_name` text NOT NULL,
	`party_role` text NOT NULL,
	`identity_classification` text DEFAULT 'UNKNOWN' NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `transaction_parties_transaction_idx` ON `transaction_parties` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_parties_entity_idx` ON `transaction_parties` (`entity_id`);--> statement-breakpoint
CREATE INDEX `transaction_parties_person_idx` ON `transaction_parties` (`person_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`cluster_key` text NOT NULL,
	`event_type` text NOT NULL,
	`event_stage` text NOT NULL,
	`event_date` text NOT NULL,
	`announced_at` text,
	`closed_at` text,
	`title` text NOT NULL,
	`summary` text,
	`asset` text,
	`location_id` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`reported_value_low` integer,
	`reported_value_high` integer,
	`value_classification` text DEFAULT 'UNKNOWN' NOT NULL,
	`confidence` integer NOT NULL,
	`publication_state` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_cluster_idx` ON `transactions` (`cluster_key`);--> statement-breakpoint
CREATE INDEX `transactions_stage_date_idx` ON `transactions` (`event_stage`,`event_date`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`event_type`);--> statement-breakpoint
CREATE TABLE `valuation_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`amount_low` integer,
	`amount_high` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`classification` text NOT NULL,
	`methodology` text NOT NULL,
	`calculation` text,
	`source_record_id` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `valuation_transaction_idx` ON `valuation_evidence` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `transaction_id` text;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `gross_attributable_low` integer;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `gross_attributable_high` integer;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `potentially_deployable_low` integer;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `potentially_deployable_high` integer;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `classification` text;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `methodology` text;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `calculation` text;--> statement-breakpoint
ALTER TABLE `liquidity_estimates` ADD `uncertainty` text;--> statement-breakpoint
CREATE INDEX `estimates_transaction_idx` ON `liquidity_estimates` (`transaction_id`);
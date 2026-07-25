CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`actor_email` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text,
	`request_id` text,
	`metadata` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_idx` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `deployment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`organization_id` text,
	`deployment_type` text NOT NULL,
	`event_date` text NOT NULL,
	`amount_low` integer,
	`amount_median` integer,
	`amount_high` integer,
	`destination_location_id` text,
	`confidence` integer NOT NULL,
	`source_document_id` text,
	`publication_state` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `deployments_person_idx` ON `deployment_events` (`person_id`);--> statement-breakpoint
CREATE INDEX `deployments_date_idx` ON `deployment_events` (`event_date`);--> statement-breakpoint
CREATE TABLE `evidence_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_entity_type` text NOT NULL,
	`subject_entity_id` text NOT NULL,
	`predicate` text NOT NULL,
	`value_type` text NOT NULL,
	`structured_value` text,
	`display_value` text NOT NULL,
	`classification` text NOT NULL,
	`source_document_id` text NOT NULL,
	`source_excerpt` text,
	`source_location` text,
	`reliability_score` integer NOT NULL,
	`analyst_status` text NOT NULL,
	`valid_from` text,
	`valid_through` text,
	`public_visibility` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `claims_subject_idx` ON `evidence_claims` (`subject_entity_type`,`subject_entity_id`);--> statement-breakpoint
CREATE INDEX `claims_source_idx` ON `evidence_claims` (`source_document_id`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`status` text NOT NULL,
	`input_hash` text,
	`records_processed` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`error_information` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `job_runs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_idx` ON `job_runs` (`job_type`,`input_hash`);--> statement-breakpoint
CREATE TABLE `liquidity_estimates` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`remaining_low` integer NOT NULL,
	`remaining_median` integer NOT NULL,
	`remaining_high` integer NOT NULL,
	`created_low` integer NOT NULL,
	`created_median` integer NOT NULL,
	`created_high` integer NOT NULL,
	`known_deployment_low` integer NOT NULL,
	`known_deployment_median` integer NOT NULL,
	`known_deployment_high` integer NOT NULL,
	`unobserved_deployment_low` integer NOT NULL,
	`unobserved_deployment_median` integer NOT NULL,
	`unobserved_deployment_high` integer NOT NULL,
	`confidence_score` integer NOT NULL,
	`radar_score` integer NOT NULL,
	`model_run_id` text NOT NULL,
	`estimate_date` text NOT NULL,
	`recalculate_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `estimates_person_idx` ON `liquidity_estimates` (`person_id`);--> statement-breakpoint
CREATE INDEX `estimates_median_idx` ON `liquidity_estimates` (`remaining_median`);--> statement-breakpoint
CREATE INDEX `estimates_confidence_idx` ON `liquidity_estimates` (`confidence_score`);--> statement-breakpoint
CREATE TABLE `liquidity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`organization_id` text,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`announcement_date` text,
	`completion_date` text,
	`status` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`gross_low` integer,
	`gross_median` integer,
	`gross_high` integer,
	`net_low` integer,
	`net_median` integer,
	`net_high` integer,
	`confidence` integer NOT NULL,
	`event_location_id` text,
	`review_state` text NOT NULL,
	`publication_state` text NOT NULL,
	`calculation_method` text,
	`model_run_id` text,
	`external_identifier` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_external_idx` ON `liquidity_events` (`external_identifier`);--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `liquidity_events` (`event_date`);--> statement-breakpoint
CREATE INDEX `events_publication_idx` ON `liquidity_events` (`publication_state`);--> statement-breakpoint
CREATE INDEX `events_confidence_idx` ON `liquidity_events` (`confidence`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`geographic_type` text NOT NULL,
	`parent_location_id` text,
	`fips_code` text,
	`longitude` real,
	`latitude` real,
	`population` integer,
	`metadata_source` text,
	`effective_from` text,
	`effective_through` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `locations_type_idx` ON `locations` (`geographic_type`);--> statement-breakpoint
CREATE INDEX `locations_fips_idx` ON `locations` (`fips_code`);--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`model_name` text NOT NULL,
	`model_version` text NOT NULL,
	`random_seed` integer NOT NULL,
	`input_snapshot` text NOT NULL,
	`configuration_snapshot` text NOT NULL,
	`sample_count` integer NOT NULL,
	`output_percentiles` text,
	`confidence_components` text,
	`sensitivity_analysis` text,
	`code_version` text,
	`status` text NOT NULL,
	`error_information` text,
	`executed_at` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `model_runs_model_idx` ON `model_runs` (`model_name`,`model_version`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`legal_name` text NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`organization_type` text NOT NULL,
	`cik` text,
	`website` text,
	`industry` text,
	`naics` text,
	`headquarters_location_id` text,
	`public_classification` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_idx` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `organizations_cik_idx` ON `organizations` (`cik`);--> statement-breakpoint
CREATE INDEX `organizations_name_idx` ON `organizations` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`primary_role` text,
	`biography` text,
	`profile_status` text DEFAULT 'active' NOT NULL,
	`publication_status` text DEFAULT 'draft' NOT NULL,
	`privacy_status` text DEFAULT 'standard' NOT NULL,
	`primary_location_id` text,
	`primary_organization_id` text,
	`current_liquidity_estimate_id` text,
	`source_count` integer DEFAULT 0 NOT NULL,
	`last_meaningful_event_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_slug_idx` ON `people` (`slug`);--> statement-breakpoint
CREATE INDEX `people_normalized_name_idx` ON `people` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `people_publication_idx` ON `people` (`publication_status`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_email` text NOT NULL,
	`relationship_to_subject` text NOT NULL,
	`subject_entity_type` text NOT NULL,
	`subject_entity_id` text,
	`request_type` text NOT NULL,
	`explanation` text NOT NULL,
	`jurisdiction` text,
	`status` text NOT NULL,
	`assigned_to` text,
	`due_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `privacy_status_idx` ON `privacy_requests` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`publisher` text,
	`title` text NOT NULL,
	`original_url` text,
	`canonical_url` text,
	`filing_accession_number` text,
	`sec_form_type` text,
	`cik` text,
	`published_at` text,
	`retrieved_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`mime_type` text,
	`object_storage_key` text,
	`retrieval_status` text NOT NULL,
	`reliability_tier` integer NOT NULL,
	`license_notes` text,
	`superseded_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_hash_idx` ON `source_documents` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_accession_idx` ON `source_documents` (`filing_accession_number`);--> statement-breakpoint
CREATE TABLE `workspace_records` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_email` text NOT NULL,
	`record_type` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `workspace_records_owner_idx` ON `workspace_records` (`workspace_id`,`record_type`);--> statement-breakpoint
CREATE INDEX `workspace_records_user_idx` ON `workspace_records` (`user_email`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text NOT NULL,
	`seats` integer NOT NULL,
	`restricted_use_acknowledged_at` text,
	`billing_customer_reference` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);

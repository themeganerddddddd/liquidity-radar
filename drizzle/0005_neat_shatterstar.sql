CREATE TABLE `professional_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`company` text NOT NULL,
	`contact_type` text NOT NULL,
	`contact_value` text NOT NULL,
	`source_url` text NOT NULL,
	`source_name` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`verification_status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_contacts_person_value_idx` ON `professional_contacts` (`person_id`,`contact_type`,`contact_value`);--> statement-breakpoint
CREATE INDEX `professional_contacts_person_idx` ON `professional_contacts` (`person_id`,`verification_status`);--> statement-breakpoint
CREATE TABLE `weekly_contact_history` (
	`id` text PRIMARY KEY NOT NULL,
	`recommendation_id` text NOT NULL,
	`person_id` text NOT NULL,
	`week_start` text NOT NULL,
	`geography_id` text NOT NULL,
	`previous_workflow_status` text,
	`workflow_status` text NOT NULL,
	`previous_recommendation_status` text,
	`recommendation_status` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weekly_contact_history_recommendation_idx` ON `weekly_contact_history` (`recommendation_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `weekly_contact_history_person_idx` ON `weekly_contact_history` (`person_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `weekly_contact_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`geography_id` text NOT NULL,
	`rank` integer NOT NULL,
	`person_id` text NOT NULL,
	`primary_event_id` text NOT NULL,
	`contact_priority_score` integer NOT NULL,
	`estimated_proceeds_low` integer,
	`estimated_proceeds_high` integer,
	`location` text NOT NULL,
	`why_now` text NOT NULL,
	`contactability_status` text NOT NULL,
	`workflow_status` text DEFAULT 'NOT_REVIEWED' NOT NULL,
	`recommendation_status` text DEFAULT 'ACTIVE' NOT NULL,
	`skip_reason` text DEFAULT '' NOT NULL,
	`last_material_event_at` text NOT NULL,
	`payload_json` text NOT NULL,
	`generated_at` text NOT NULL,
	`last_updated_at` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_contacts_week_geo_person_idx` ON `weekly_contact_recommendations` (`week_start`,`geography_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `weekly_contacts_week_geo_rank_idx` ON `weekly_contact_recommendations` (`week_start`,`geography_id`,`rank`);--> statement-breakpoint
CREATE INDEX `weekly_contacts_person_status_idx` ON `weekly_contact_recommendations` (`person_id`,`workflow_status`,`last_updated_at`);--> statement-breakpoint
PRAGMA optimize;

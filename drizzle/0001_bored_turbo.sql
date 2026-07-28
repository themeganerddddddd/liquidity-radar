CREATE TABLE `person_geographic_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`location_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`evidence_claim_id` text,
	`relationship_date` text,
	`confidence` integer DEFAULT 65 NOT NULL,
	`public_visibility` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_geo_unique_idx` ON `person_geographic_relationships` (`person_id`,`location_id`,`relationship_type`,`evidence_claim_id`);--> statement-breakpoint
CREATE INDEX `person_geo_person_idx` ON `person_geographic_relationships` (`person_id`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `person_geo_location_idx` ON `person_geographic_relationships` (`location_id`,`relationship_type`);--> statement-breakpoint
ALTER TABLE `locations` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `state_code` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `metro_name` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `county_name` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `city_name` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `normalized_lookup` text;--> statement-breakpoint
CREATE UNIQUE INDEX `locations_slug_idx` ON `locations` (`slug`);--> statement-breakpoint
CREATE INDEX `locations_parent_idx` ON `locations` (`parent_location_id`);--> statement-breakpoint
CREATE INDEX `locations_lookup_idx` ON `locations` (`normalized_lookup`);--> statement-breakpoint
ALTER TABLE `workspace_records` ADD `region_id` text;--> statement-breakpoint
CREATE INDEX `workspace_records_region_idx` ON `workspace_records` (`workspace_id`,`user_email`,`region_id`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `home_region_id` text;--> statement-breakpoint
CREATE INDEX `events_person_region_idx` ON `liquidity_events` (`person_id`,`event_location_id`);--> statement-breakpoint
CREATE INDEX `events_org_region_idx` ON `liquidity_events` (`organization_id`,`event_location_id`);--> statement-breakpoint
CREATE INDEX `events_type_status_idx` ON `liquidity_events` (`event_type`,`status`);
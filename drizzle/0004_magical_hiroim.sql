CREATE TABLE `seller_manual_records` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_key` text NOT NULL,
	`entity_legal_name` text NOT NULL,
	`illinois_file_number` text,
	`entity_type` text,
	`entity_status` text,
	`formation_date` text,
	`president` text,
	`secretary` text,
	`managers_json` text DEFAULT '[]' NOT NULL,
	`registered_agent` text,
	`source_url` text NOT NULL,
	`lookup_date` text NOT NULL,
	`checked_by` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `seller_manual_records_seller_idx` ON `seller_manual_records` (`seller_key`,`lookup_date`);--> statement-breakpoint
CREATE INDEX `seller_manual_records_file_idx` ON `seller_manual_records` (`illinois_file_number`);
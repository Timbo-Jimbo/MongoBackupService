ALTER TABLE `mongo_databases` ADD `reference_color_hex` text DEFAULT '#000000' NOT NULL;--> statement-breakpoint
ALTER TABLE `mongo_databases` DROP COLUMN `reference_color`;
ALTER TABLE `tasks` ADD `cancellation_type` text DEFAULT 'not_cancellable' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `can_be_cancelled`;
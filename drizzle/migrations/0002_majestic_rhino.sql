CREATE TABLE `mongo_database_task_involvements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `mongo_database_id`;
CREATE TABLE `backup_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer NOT NULL,
	`backup_interval_cron` text NOT NULL,
	`backup_retention_days` integer NOT NULL,
	`backup_mode` text(4) NOT NULL,
	`last_backup_at` integer,
	`next_backup_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer,
	`source_metadata` text NOT NULL,
	`format` text(4) NOT NULL,
	`mode` text(4) NOT NULL,
	`archive_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mongo_databases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reference_name` text NOT NULL,
	`reference_color_hex` text DEFAULT '#0394fc' NOT NULL,
	`connection_uri` text NOT NULL,
	`database_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mongo_database_to_backup_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer NOT NULL,
	`backup_policy_id` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mongo_databases_to_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`state` text DEFAULT 'running' NOT NULL,
	`cancellation_type` text DEFAULT 'not_cancellable' NOT NULL,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`progress` text,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);

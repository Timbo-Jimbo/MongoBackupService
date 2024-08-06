CREATE TABLE `backups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer,
	`source_metadata` text NOT NULL,
	`archive_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
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
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer NOT NULL,
	`type` text NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`state` text DEFAULT 'running' NOT NULL,
	`can_be_cancelled` integer DEFAULT false NOT NULL,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`progress` text,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);

CREATE TABLE `mongo_databases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reference_name` text NOT NULL,
	`reference_color_hex` text DEFAULT '#000000' NOT NULL,
	`connection_uri` text NOT NULL,
	`database_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mongo_database_id` integer,
	`type` text NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`completion_type` text DEFAULT 'not-complete' NOT NULL,
	`can_be_cancelled` integer DEFAULT false NOT NULL,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`progress` text DEFAULT '{"hasProgressValues":false,"message":"Initialising"}',
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);

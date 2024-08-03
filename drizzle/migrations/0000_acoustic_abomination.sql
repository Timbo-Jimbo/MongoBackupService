CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`description` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL
);

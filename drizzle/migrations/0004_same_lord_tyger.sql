CREATE TABLE `mongo_databases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reference_name` text NOT NULL,
	`reference_color` text NOT NULL,
	`connection_uri` text NOT NULL,
	`database_name` text NOT NULL
);

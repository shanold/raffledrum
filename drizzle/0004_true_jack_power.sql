CREATE TABLE `display_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`control_key_hash` text NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text NOT NULL
);

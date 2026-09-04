CREATE TABLE `verified_raffles` (
	`id` text PRIMARY KEY NOT NULL,
	`host_secret_hash` text NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`entries_text` text NOT NULL,
	`first_ticket` integer NOT NULL,
	`ticket_count` integer NOT NULL,
	`manifest_hash` text NOT NULL,
	`target_round` integer NOT NULL,
	`drand_randomness` text,
	`drand_signature` text,
	`winner_name` text,
	`winner_masked` text,
	`winner_number` integer,
	`winner_index` integer,
	`created_at` text NOT NULL,
	`locked_at` text NOT NULL,
	`drawn_at` text
);

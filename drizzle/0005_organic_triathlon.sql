CREATE TABLE `morice_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`object_key` text NOT NULL,
	`job_id` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_morice_files_owner` ON `morice_files` (`user_id`,`job_id`);
--> statement-breakpoint
CREATE TRIGGER morice_files_claim BEFORE UPDATE OF job_id ON morice_files WHEN OLD.job_id <> '' AND NEW.job_id <> OLD.job_id BEGIN SELECT RAISE(ABORT, 'attachment already claimed'); END;

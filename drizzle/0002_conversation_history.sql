CREATE TABLE `morice_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `text` text NOT NULL,
  `action` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_morice_messages_user_id` ON `morice_messages` (`user_id`, `id`);

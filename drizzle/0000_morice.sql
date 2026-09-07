CREATE TABLE `morice_items` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL,
  `title` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_morice_items_user_kind` ON `morice_items` (`user_id`,`kind`);
--> statement-breakpoint
CREATE TABLE `morice_settings` (
  `user_id` text NOT NULL,
  `key` text NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `morice_push_subscriptions` (
  `endpoint` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `p256dh` text DEFAULT '' NOT NULL,
  `auth` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_morice_push_user` ON `morice_push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `morice_system` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL
);

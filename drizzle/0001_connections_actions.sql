CREATE TABLE `morice_connections` (
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `expires_at` text NOT NULL,
  `account_email` text DEFAULT '' NOT NULL,
  `scopes` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'connected' NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`user_id`, `provider`)
);
--> statement-breakpoint
CREATE INDEX `idx_morice_connections_user_status` ON `morice_connections` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `morice_action_payloads` (
  `item_id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `operation` text NOT NULL,
  `payload` text NOT NULL,
  `result` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  `executed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_morice_actions_user_provider` ON `morice_action_payloads` (`user_id`,`provider`);

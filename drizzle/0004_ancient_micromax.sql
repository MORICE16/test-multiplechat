CREATE TABLE `morice_microsoft_accounts` (
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`account_email` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `account_id`)
);

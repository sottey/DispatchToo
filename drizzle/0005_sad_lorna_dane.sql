CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`lastUsedAt` text,
	`createdAt` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_key_unique` ON `api_key` (`key`);--> statement-breakpoint
CREATE INDEX `api_key_userId_idx` ON `api_key` (`userId`);--> statement-breakpoint
CREATE INDEX `api_key_key_idx` ON `api_key` (`key`);
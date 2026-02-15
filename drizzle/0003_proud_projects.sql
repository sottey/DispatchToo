CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	`createdAt` text DEFAULT (current_timestamp) NOT NULL,
	`updatedAt` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `task` ADD COLUMN `projectId` text REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `project_userId_idx` ON `project` (`userId`);
--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `project` (`status`);
--> statement-breakpoint
CREATE INDEX `task_projectId_idx` ON `task` (`projectId`);

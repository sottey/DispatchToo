CREATE TABLE `dispatch_task` (
	`dispatchId` text NOT NULL,
	`taskId` text NOT NULL,
	PRIMARY KEY(`dispatchId`, `taskId`),
	FOREIGN KEY (`dispatchId`) REFERENCES `dispatch`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`taskId`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dispatch` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`date` text NOT NULL,
	`summary` text,
	`finalized` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT (current_timestamp) NOT NULL,
	`updatedAt` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dispatch_userId_idx` ON `dispatch` (`userId`);--> statement-breakpoint
CREATE INDEX `dispatch_date_idx` ON `dispatch` (`userId`,`date`);
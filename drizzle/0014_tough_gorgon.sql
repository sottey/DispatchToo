ALTER TABLE `note` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `note` ADD `type` text;--> statement-breakpoint
ALTER TABLE `note` ADD `folderId` text;--> statement-breakpoint
ALTER TABLE `note` ADD `projectId` text REFERENCES project(id);--> statement-breakpoint
ALTER TABLE `note` ADD `dispatchDate` text;--> statement-breakpoint
ALTER TABLE `note` ADD `hasRecurrence` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `note_userId_type_idx` ON `note` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `note_userId_folderId_idx` ON `note` (`userId`,`folderId`);--> statement-breakpoint
CREATE INDEX `note_userId_projectId_idx` ON `note` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `note_userId_dispatchDate_idx` ON `note` (`userId`,`dispatchDate`);--> statement-breakpoint
CREATE INDEX `note_userId_hasRecurrence_idx` ON `note` (`userId`,`hasRecurrence`);

CREATE TABLE `characterRelationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`sourceCharacterId` int NOT NULL,
	`targetCharacterId` int NOT NULL,
	`relationshipType` varchar(64) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `characterRelationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `characters` ADD `gender` enum('male','female','other') DEFAULT 'male';
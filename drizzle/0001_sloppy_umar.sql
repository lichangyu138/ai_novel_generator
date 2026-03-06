CREATE TABLE `chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`title` varchar(255),
	`content` text,
	`wordCount` int DEFAULT 0,
	`status` enum('draft','pending_review','approved','rejected') NOT NULL DEFAULT 'draft',
	`reviewNotes` text,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`role` varchar(64),
	`personality` text,
	`background` text,
	`appearance` text,
	`abilities` text,
	`relationships` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `detailedOutlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`outlineId` int NOT NULL,
	`groupIndex` int NOT NULL,
	`startChapter` int NOT NULL,
	`endChapter` int NOT NULL,
	`content` text,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `detailedOutlines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('outline','detailed_outline','chapter','revision') NOT NULL,
	`targetId` int,
	`prompt` text,
	`result` text,
	`modelUsed` varchar(128),
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modelConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`apiKey` text,
	`apiBase` varchar(512),
	`modelName` varchar(128),
	`temperature` varchar(10) DEFAULT '0.7',
	`topP` varchar(10) DEFAULT '0.9',
	`maxTokens` int DEFAULT 4096,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modelConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `novels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`genre` varchar(64),
	`style` varchar(64),
	`description` text,
	`prompt` text,
	`worldSetting` text,
	`status` enum('draft','writing','completed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `novels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`content` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outlines_id` PRIMARY KEY(`id`)
);

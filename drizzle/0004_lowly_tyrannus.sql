CREATE TABLE `contentVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`contentType` enum('chapter','outline','detailed_outline') NOT NULL,
	`contentId` int NOT NULL,
	`version` int NOT NULL,
	`content` text,
	`changeDescription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contentVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('character','event','location','item','setting','other') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sourceChapterId` int,
	`relatedCharacterIds` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storyEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`timePoint` varchar(128),
	`chapterId` int,
	`relatedCharacterIds` text,
	`eventType` enum('plot','character','world','conflict','resolution') DEFAULT 'plot',
	`importance` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storyEvents_id` PRIMARY KEY(`id`)
);

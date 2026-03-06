CREATE TABLE `chapterOutlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`previousSummary` text,
	`plotDevelopment` text,
	`characterDynamics` text,
	`sceneDescription` text,
	`dialoguePoints` text,
	`foreshadowing` text,
	`fullContent` text,
	`wordCount` int DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapterOutlines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chapterReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`chapterId` int NOT NULL,
	`qualityScore` int DEFAULT 0,
	`outlineConsistencyScore` int DEFAULT 0,
	`chapterOutlineConsistencyScore` int DEFAULT 0,
	`outlineDeviationAnalysis` text,
	`chapterOutlineDeviationAnalysis` text,
	`qualityComment` text,
	`futureSuggestions` text,
	`foreshadowingMarkers` text,
	`resolvedForeshadowing` text,
	`characterConsistencyAnalysis` text,
	`plotCoherenceAnalysis` text,
	`overallComment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapterReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `foreshadowing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`setupChapterId` int NOT NULL,
	`plannedResolutionChapter` int,
	`actualResolutionChapterId` int,
	`resolutionContent` text,
	`status` enum('pending','resolved','abandoned') NOT NULL DEFAULT 'pending',
	`importance` int DEFAULT 3,
	`relatedCharacterIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `foreshadowing_id` PRIMARY KEY(`id`)
);

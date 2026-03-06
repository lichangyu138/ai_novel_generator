ALTER TABLE `modelConfigs` ADD `displayName` varchar(128);--> statement-breakpoint
ALTER TABLE `novels` ADD `customGenre` varchar(128);--> statement-breakpoint
ALTER TABLE `novels` ADD `customStyle` varchar(128);--> statement-breakpoint
ALTER TABLE `novels` ADD `writerStyle` varchar(128);--> statement-breakpoint
ALTER TABLE `novels` ADD `writerStylePrompt` text;--> statement-breakpoint
ALTER TABLE `novels` ADD `removeAiTone` int DEFAULT 0;
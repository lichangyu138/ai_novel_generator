-- Add missing fields to chapterreviews table
ALTER TABLE `chapterreviews`
ADD COLUMN `plotSummary` text AFTER `qualityScore`,
ADD COLUMN `openingDescription` text AFTER `plotSummary`,
ADD COLUMN `middleDescription` text AFTER `openingDescription`,
ADD COLUMN `endingDescription` text AFTER `middleDescription`,
ADD COLUMN `keyIssues` text AFTER `endingDescription`;


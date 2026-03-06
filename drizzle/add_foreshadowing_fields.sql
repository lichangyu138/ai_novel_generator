-- Add plannedResolutionChapter field to foreshadowing table
ALTER TABLE `foreshadowing`
ADD COLUMN `planned_resolution_chapter` int AFTER `chapter_id`;


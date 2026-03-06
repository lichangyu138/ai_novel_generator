-- Add synced_to_worldbuilding field to knowledge entries
ALTER TABLE `knowledgeentries`
ADD COLUMN `synced_to_worldbuilding` tinyint(1) DEFAULT 0 AFTER `is_auto_extracted`,
ADD COLUMN `worldbuilding_id` int DEFAULT NULL AFTER `synced_to_worldbuilding`,
ADD COLUMN `metadata` text AFTER `worldbuilding_id`;


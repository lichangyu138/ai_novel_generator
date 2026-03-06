-- ============================================================
-- 修复数据库表结构 - 将驼峰命名改为下划线命名以匹配Python模型
-- ============================================================

USE ai_novel_generator;

-- 修复 users 表
ALTER TABLE `users` 
    CHANGE COLUMN `passwordHash` `password_hash` VARCHAR(255) COMMENT '密码哈希',
    CHANGE COLUMN `openId` `open_id` VARCHAR(64) COMMENT 'OAuth标识符（可选）',
    CHANGE COLUMN `loginMethod` `login_method` VARCHAR(64) DEFAULT 'local' COMMENT '登录方式：local/oauth',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CHANGE COLUMN `lastSignedIn` `last_signed_in` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
    ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN DEFAULT TRUE COMMENT '账户是否激活';

-- 修复 novels 表
ALTER TABLE `novels`
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `worldSetting` `world_setting` TEXT COMMENT '世界观设定',
    CHANGE COLUMN `writerStyle` `writer_style` TEXT COMMENT '作家风格模板',
    CHANGE COLUMN `removeAiTaste` `remove_ai_taste` INT DEFAULT 0 COMMENT '是否去AI味（0否1是）',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    DROP INDEX IF EXISTS `idx_novels_userId`,
    ADD INDEX `idx_novels_user_id` (`user_id`);

-- 修复 characters 表
ALTER TABLE `characters`
    CHANGE COLUMN `novelId` `novel_id` INT NOT NULL COMMENT '所属小说ID',
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    DROP INDEX IF EXISTS `idx_characters_novelId`,
    DROP INDEX IF EXISTS `idx_characters_userId`,
    ADD INDEX `idx_characters_novel_id` (`novel_id`),
    ADD INDEX `idx_characters_user_id` (`user_id`);

-- 修复 characterRelationships 表
ALTER TABLE `characterRelationships`
    CHANGE COLUMN `novelId` `novel_id` INT NOT NULL COMMENT '所属小说ID',
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `sourceCharacterId` `source_character_id` INT NOT NULL COMMENT '源人物ID',
    CHANGE COLUMN `targetCharacterId` `target_character_id` INT NOT NULL COMMENT '目标人物ID',
    CHANGE COLUMN `relationshipType` `relationship_type` VARCHAR(64) NOT NULL COMMENT '关系类型',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 修复 outlines 表
ALTER TABLE `outlines`
    CHANGE COLUMN `novelId` `novel_id` INT NOT NULL COMMENT '所属小说ID',
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `isActive` `is_active` INT NOT NULL DEFAULT 1 COMMENT '是否当前版本',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 修复 detailedOutlines 表
ALTER TABLE `detailedOutlines`
    CHANGE COLUMN `novelId` `novel_id` INT NOT NULL COMMENT '所属小说ID',
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `outlineId` `outline_id` INT NOT NULL COMMENT '关联大纲ID',
    CHANGE COLUMN `groupIndex` `group_index` INT NOT NULL COMMENT '分组索引',
    CHANGE COLUMN `startChapter` `start_chapter` INT NOT NULL COMMENT '起始章节号',
    CHANGE COLUMN `endChapter` `end_chapter` INT NOT NULL COMMENT '结束章节号',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 修复 chapters 表
ALTER TABLE `chapters`
    CHANGE COLUMN `novelId` `novel_id` INT NOT NULL COMMENT '所属小说ID',
    CHANGE COLUMN `userId` `user_id` INT NOT NULL COMMENT '所属用户ID',
    CHANGE COLUMN `chapterNumber` `chapter_number` INT NOT NULL COMMENT '章节序号',
    CHANGE COLUMN `wordCount` `word_count` INT DEFAULT 0 COMMENT '字数统计',
    CHANGE COLUMN `reviewNotes` `review_notes` TEXT COMMENT '审核备注',
    CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 创建默认管理员账户（如果不存在）
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`)
VALUES (
    'admin',
    'admin@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYn1ePMm/Wy6',  -- admin123 的 bcrypt 哈希
    'admin',
    TRUE,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

SELECT '数据库表结构修复完成！' AS message;
SELECT '默认管理员账户: admin / admin123' AS info;


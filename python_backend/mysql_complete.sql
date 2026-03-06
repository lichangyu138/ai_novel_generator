-- ============================================================
-- AI小说生成系统 - 完整MySQL数据库脚本
-- 包含所有表结构定义
-- 生成时间: 2025-12-12
-- ============================================================

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. 用户表 (users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` int AUTO_INCREMENT NOT NULL,
    `username` varchar(64) NOT NULL COMMENT '用户名，用于本地认证',
    `passwordHash` varchar(255) COMMENT '密码哈希',
    `openId` varchar(64) COMMENT 'OAuth标识符（可选）',
    `name` text COMMENT '显示名称',
    `email` varchar(320) COMMENT '邮箱地址',
    `loginMethod` varchar(64) DEFAULT 'local' COMMENT '登录方式：local/oauth',
    `role` enum('user','admin') NOT NULL DEFAULT 'user' COMMENT '用户角色',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
    CONSTRAINT `users_id` PRIMARY KEY(`id`),
    CONSTRAINT `users_username_unique` UNIQUE(`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 2. 小说表 (novels)
-- ============================================================
CREATE TABLE IF NOT EXISTS `novels` (
    `id` int AUTO_INCREMENT NOT NULL,
    `userId` int NOT NULL COMMENT '所属用户ID',
    `title` varchar(255) NOT NULL COMMENT '小说标题',
    `genre` varchar(64) COMMENT '小说类型（玄幻、都市、言情等）',
    `style` varchar(64) COMMENT '写作风格',
    `description` text COMMENT '小说简介',
    `prompt` text COMMENT '创作提示词',
    `worldSetting` text COMMENT '世界观设定',
    `writerStyle` text COMMENT '作家风格模板',
    `removeAiTaste` int DEFAULT 0 COMMENT '是否去AI味（0否1是）',
    `status` enum('draft','writing','completed') NOT NULL DEFAULT 'draft' COMMENT '状态',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `novels_id` PRIMARY KEY(`id`),
    INDEX `idx_novels_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说表';

-- ============================================================
-- 3. 人物表 (characters)
-- ============================================================
CREATE TABLE IF NOT EXISTS `characters` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `name` varchar(128) NOT NULL COMMENT '人物名称',
    `gender` enum('male','female','other') DEFAULT 'male' COMMENT '性别',
    `role` varchar(64) COMMENT '角色定位（主角、配角、反派等）',
    `personality` text COMMENT '性格特点',
    `background` text COMMENT '背景故事',
    `appearance` text COMMENT '外貌描述',
    `abilities` text COMMENT '能力技能',
    `relationships` text COMMENT '人物关系描述',
    `notes` text COMMENT '备注',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `characters_id` PRIMARY KEY(`id`),
    INDEX `idx_characters_novelId` (`novelId`),
    INDEX `idx_characters_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物设定表';

-- ============================================================
-- 4. 人物关系表 (characterRelationships)
-- ============================================================
CREATE TABLE IF NOT EXISTS `characterRelationships` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `sourceCharacterId` int NOT NULL COMMENT '源人物ID',
    `targetCharacterId` int NOT NULL COMMENT '目标人物ID',
    `relationshipType` varchar(64) NOT NULL COMMENT '关系类型（父母、恋人、朋友、敌人等）',
    `description` text COMMENT '关系描述',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `characterRelationships_id` PRIMARY KEY(`id`),
    INDEX `idx_charRel_novelId` (`novelId`),
    INDEX `idx_charRel_source` (`sourceCharacterId`),
    INDEX `idx_charRel_target` (`targetCharacterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物关系表';

-- ============================================================
-- 5. 大纲表 (outlines)
-- ============================================================
CREATE TABLE IF NOT EXISTS `outlines` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `version` int NOT NULL DEFAULT 1 COMMENT '版本号',
    `content` text COMMENT '大纲内容',
    `isActive` int NOT NULL DEFAULT 1 COMMENT '是否当前版本',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `outlines_id` PRIMARY KEY(`id`),
    INDEX `idx_outlines_novelId` (`novelId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大纲表';

-- ============================================================
-- 6. 细纲表 (detailedOutlines)
-- ============================================================
CREATE TABLE IF NOT EXISTS `detailedOutlines` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `outlineId` int NOT NULL COMMENT '关联大纲ID',
    `groupIndex` int NOT NULL COMMENT '分组索引',
    `startChapter` int NOT NULL COMMENT '起始章节号',
    `endChapter` int NOT NULL COMMENT '结束章节号',
    `content` text COMMENT '细纲内容',
    `version` int NOT NULL DEFAULT 1 COMMENT '版本号',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `detailedOutlines_id` PRIMARY KEY(`id`),
    INDEX `idx_detailedOutlines_novelId` (`novelId`),
    INDEX `idx_detailedOutlines_outlineId` (`outlineId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='细纲表';

-- ============================================================
-- 7. 章节表 (chapters)
-- ============================================================
CREATE TABLE IF NOT EXISTS `chapters` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `chapterNumber` int NOT NULL COMMENT '章节序号',
    `title` varchar(255) COMMENT '章节标题',
    `content` text COMMENT '章节内容',
    `wordCount` int DEFAULT 0 COMMENT '字数统计',
    `status` enum('draft','pending_review','approved','rejected') NOT NULL DEFAULT 'draft' COMMENT '状态',
    `reviewNotes` text COMMENT '审核备注',
    `version` int NOT NULL DEFAULT 1 COMMENT '版本号',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `chapters_id` PRIMARY KEY(`id`),
    INDEX `idx_chapters_novelId` (`novelId`),
    INDEX `idx_chapters_number` (`novelId`, `chapterNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';

-- ============================================================
-- 8. 章节细纲表 (chapterOutlines)
-- ============================================================
CREATE TABLE IF NOT EXISTS `chapterOutlines` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `chapterId` int COMMENT '关联章节ID',
    `chapterNumber` int NOT NULL COMMENT '章节序号',
    `previousSummary` text COMMENT '前文总结',
    `plotDevelopment` text COMMENT '剧情发展',
    `characterDynamics` text COMMENT '人物动态',
    `sceneDescription` text COMMENT '场景描述',
    `keyPoints` text COMMENT '关键要点',
    `fullContent` text COMMENT '完整细纲内容',
    `version` int NOT NULL DEFAULT 1 COMMENT '版本号',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `chapterOutlines_id` PRIMARY KEY(`id`),
    INDEX `idx_chapterOutlines_novelId` (`novelId`),
    INDEX `idx_chapterOutlines_chapterId` (`chapterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节细纲表';

-- ============================================================
-- 9. AI评论表 (chapterReviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS `chapterReviews` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `chapterId` int NOT NULL COMMENT '关联章节ID',
    `qualityScore` int COMMENT '质量评分（1-10）',
    `qualityAnalysis` text COMMENT '质量分析',
    `outlineDeviation` text COMMENT '与大纲偏差分析',
    `detailedOutlineDeviation` text COMMENT '与细纲偏差分析',
    `futureSuggestions` text COMMENT '未来建议',
    `foreshadowingNotes` text COMMENT '伏笔标记',
    `overallComment` text COMMENT '总体评论',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `chapterReviews_id` PRIMARY KEY(`id`),
    INDEX `idx_chapterReviews_chapterId` (`chapterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI评论表';

-- ============================================================
-- 10. 伏笔表 (foreshadowing)
-- ============================================================
CREATE TABLE IF NOT EXISTS `foreshadowing` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `chapterId` int COMMENT '埋下伏笔的章节ID',
    `title` varchar(255) NOT NULL COMMENT '伏笔标题',
    `description` text COMMENT '伏笔描述',
    `status` enum('pending','resolved') NOT NULL DEFAULT 'pending' COMMENT '状态',
    `resolvedChapterId` int COMMENT '回收伏笔的章节ID',
    `resolvedDescription` text COMMENT '回收描述',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `foreshadowing_id` PRIMARY KEY(`id`),
    INDEX `idx_foreshadowing_novelId` (`novelId`),
    INDEX `idx_foreshadowing_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='伏笔表';

-- ============================================================
-- 11. 知识库条目表 (knowledgeEntries)
-- ============================================================
CREATE TABLE IF NOT EXISTS `knowledgeEntries` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `category` varchar(64) NOT NULL COMMENT '类别（character/location/item/event/concept）',
    `title` varchar(255) NOT NULL COMMENT '标题',
    `content` text COMMENT '内容',
    `sourceChapterId` int COMMENT '来源章节ID',
    `isAutoExtracted` int DEFAULT 0 COMMENT '是否AI自动提取',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `knowledgeEntries_id` PRIMARY KEY(`id`),
    INDEX `idx_knowledge_novelId` (`novelId`),
    INDEX `idx_knowledge_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库条目表';

-- ============================================================
-- 12. 事件表 (events)
-- ============================================================
CREATE TABLE IF NOT EXISTS `events` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `title` varchar(255) NOT NULL COMMENT '事件标题',
    `description` text COMMENT '事件描述',
    `chapterId` int COMMENT '发生章节ID',
    `eventTime` varchar(128) COMMENT '事件时间（故事内时间）',
    `importance` int DEFAULT 5 COMMENT '重要性（1-10）',
    `relatedCharacterIds` text COMMENT '相关人物ID列表（JSON）',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `events_id` PRIMARY KEY(`id`),
    INDEX `idx_events_novelId` (`novelId`),
    INDEX `idx_events_chapterId` (`chapterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='事件表';

-- ============================================================
-- 13. 版本历史表 (versionHistory)
-- ============================================================
CREATE TABLE IF NOT EXISTS `versionHistory` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `entityType` varchar(64) NOT NULL COMMENT '实体类型（outline/chapter/character等）',
    `entityId` int NOT NULL COMMENT '实体ID',
    `version` int NOT NULL COMMENT '版本号',
    `content` text COMMENT '版本内容快照',
    `changeDescription` text COMMENT '变更描述',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CONSTRAINT `versionHistory_id` PRIMARY KEY(`id`),
    INDEX `idx_version_entity` (`entityType`, `entityId`),
    INDEX `idx_version_novelId` (`novelId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版本历史表';

-- ============================================================
-- 14. 生成历史表 (generationHistory)
-- ============================================================
CREATE TABLE IF NOT EXISTS `generationHistory` (
    `id` int AUTO_INCREMENT NOT NULL,
    `novelId` int NOT NULL COMMENT '所属小说ID',
    `userId` int NOT NULL COMMENT '所属用户ID',
    `type` enum('outline','detailed_outline','chapter','revision') NOT NULL COMMENT '生成类型',
    `targetId` int COMMENT '目标实体ID',
    `prompt` text COMMENT '使用的提示词',
    `result` text COMMENT '生成结果',
    `modelUsed` varchar(128) COMMENT '使用的模型',
    `tokensUsed` int COMMENT '消耗的token数',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    CONSTRAINT `generationHistory_id` PRIMARY KEY(`id`),
    INDEX `idx_genHistory_novelId` (`novelId`),
    INDEX `idx_genHistory_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='生成历史表';

-- ============================================================
-- 15. AI模型配置表 (modelConfigs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `modelConfigs` (
    `id` int AUTO_INCREMENT NOT NULL,
    `userId` int NOT NULL COMMENT '所属用户ID',
    `name` varchar(128) NOT NULL COMMENT '配置名称',
    `displayName` varchar(128) COMMENT '显示名称',
    `provider` varchar(64) NOT NULL COMMENT '提供商（openai/anthropic/local等）',
    `apiKey` text COMMENT 'API密钥（加密存储）',
    `apiBase` varchar(512) COMMENT 'API基础URL',
    `modelName` varchar(128) COMMENT '模型名称',
    `temperature` varchar(10) DEFAULT '0.7' COMMENT '温度参数',
    `topP` varchar(10) DEFAULT '0.9' COMMENT 'Top-P参数',
    `maxTokens` int DEFAULT 4096 COMMENT '最大token数',
    `isDefault` int NOT NULL DEFAULT 0 COMMENT '是否默认配置',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `modelConfigs_id` PRIMARY KEY(`id`),
    INDEX `idx_modelConfigs_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- ============================================================
-- 16. 权限配置表 (permissionConfigs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `permissionConfigs` (
    `id` int AUTO_INCREMENT NOT NULL,
    `userId` int NOT NULL COMMENT '用户ID',
    `permissionType` varchar(64) NOT NULL COMMENT '权限类型',
    `permissionValue` text COMMENT '权限值（JSON）',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `permissionConfigs_id` PRIMARY KEY(`id`),
    INDEX `idx_permission_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限配置表';

-- ============================================================
-- 17. 嵌入模型配置表 (embeddingConfigs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `embeddingConfigs` (
    `id` int AUTO_INCREMENT NOT NULL,
    `name` varchar(128) NOT NULL COMMENT '配置名称',
    `provider` varchar(64) NOT NULL COMMENT '提供商',
    `modelName` varchar(128) COMMENT '模型名称',
    `apiKey` text COMMENT 'API密钥',
    `apiBase` varchar(512) COMMENT 'API基础URL',
    `dimensions` int DEFAULT 1536 COMMENT '向量维度',
    `isDefault` int NOT NULL DEFAULT 0 COMMENT '是否默认',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `embeddingConfigs_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='嵌入模型配置表';

-- ============================================================
-- 18. 重排模型配置表 (rerankConfigs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `rerankConfigs` (
    `id` int AUTO_INCREMENT NOT NULL,
    `name` varchar(128) NOT NULL COMMENT '配置名称',
    `provider` varchar(64) NOT NULL COMMENT '提供商',
    `modelName` varchar(128) COMMENT '模型名称',
    `apiKey` text COMMENT 'API密钥',
    `apiBase` varchar(512) COMMENT 'API基础URL',
    `isDefault` int NOT NULL DEFAULT 0 COMMENT '是否默认',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT `rerankConfigs_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='重排模型配置表';

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '数据库表结构创建完成！' AS message;

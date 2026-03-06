-- ============================================
-- 幻写次元 - AI小说生成系统
-- MySQL数据库完整建表脚本
-- 版本: 2.0
-- 包含: 基础表 + 高级功能表（伏笔、事件、时间线等）
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS ai_novel_generator 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ai_novel_generator;

-- ============================================
-- 第一部分：核心业务表
-- ============================================

-- --------------------------------------------
-- 1. 用户表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(255) COMMENT '密码哈希（bcrypt）',
    name TEXT COMMENT '昵称/显示名',
    open_id VARCHAR(64) UNIQUE COMMENT 'OAuth OpenID（可选）',
    email VARCHAR(320) COMMENT '邮箱',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    login_method VARCHAR(64) DEFAULT 'local' COMMENT '登录方式: local/oauth',
    role ENUM('user', 'admin') DEFAULT 'user' NOT NULL COMMENT '用户角色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '账户是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    last_signed_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_open_id (open_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- --------------------------------------------
-- 2. 小说项目表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS novels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户ID',
    title VARCHAR(255) NOT NULL COMMENT '小说标题',
    genre VARCHAR(100) COMMENT '小说类型（玄幻/都市/科幻等）',
    style VARCHAR(100) COMMENT '写作风格（轻松/严肃/热血等）',
    description TEXT COMMENT '小说简介',
    prompt TEXT COMMENT '全局生成提示词',
    world_setting LONGTEXT COMMENT '世界观设定',
    target_word_count INT DEFAULT 0 COMMENT '目标总字数',
    current_word_count INT DEFAULT 0 COMMENT '当前总字数',
    chapter_count INT DEFAULT 0 COMMENT '章节数量',
    status ENUM('draft', 'writing', 'paused', 'completed', 'abandoned') DEFAULT 'draft' COMMENT '项目状态',
    cover_url VARCHAR(500) COMMENT '封面图片URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_genre (genre),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说项目表';

-- --------------------------------------------
-- 3. 人物设定表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    name VARCHAR(100) NOT NULL COMMENT '人物名称',
    aliases VARCHAR(255) COMMENT '别名/称号（逗号分隔）',
    role ENUM('protagonist', 'deuteragonist', 'antagonist', 'supporting', 'minor', 'mentioned') DEFAULT 'supporting' COMMENT '角色定位',
    gender VARCHAR(20) COMMENT '性别',
    age VARCHAR(50) COMMENT '年龄/年龄段',
    personality TEXT COMMENT '性格特点',
    background LONGTEXT COMMENT '背景故事',
    appearance TEXT COMMENT '外貌描述',
    abilities TEXT COMMENT '能力/技能',
    weaknesses TEXT COMMENT '弱点/缺陷',
    goals TEXT COMMENT '目标/动机',
    speech_style TEXT COMMENT '说话风格/口头禅',
    relationships TEXT COMMENT '人物关系描述',
    notes TEXT COMMENT '备注',
    avatar_url VARCHAR(500) COMMENT '人物头像URL',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否在当前剧情中活跃',
    first_appearance INT COMMENT '首次出场章节',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role (role),
    INDEX idx_name (name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物设定表';

-- --------------------------------------------
-- 4. 人物动态状态表（追踪人物在剧情中的实时状态）
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS character_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT NOT NULL COMMENT '人物ID',
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    chapter_number INT NOT NULL COMMENT '章节号',
    location VARCHAR(255) COMMENT '当前位置',
    emotional_state VARCHAR(100) COMMENT '情绪状态',
    physical_state VARCHAR(100) COMMENT '身体状态（健康/受伤/疲惫等）',
    power_level VARCHAR(100) COMMENT '能力等级/境界',
    inventory TEXT COMMENT '持有物品（JSON格式）',
    knowledge TEXT COMMENT '已知信息（JSON格式）',
    secrets TEXT COMMENT '隐藏信息/秘密',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_character_id (character_id),
    INDEX idx_novel_id (novel_id),
    INDEX idx_chapter_number (chapter_number),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物动态状态表';

-- --------------------------------------------
-- 5. 人物关系表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS character_relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    character_id_1 INT NOT NULL COMMENT '人物1 ID',
    character_id_2 INT NOT NULL COMMENT '人物2 ID',
    relationship_type VARCHAR(50) NOT NULL COMMENT '关系类型',
    relationship_detail TEXT COMMENT '关系详情',
    strength INT DEFAULT 50 COMMENT '关系强度（0-100）',
    is_mutual BOOLEAN DEFAULT TRUE COMMENT '是否双向关系',
    start_chapter INT COMMENT '关系开始章节',
    end_chapter INT COMMENT '关系结束章节（如有）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_character_1 (character_id_1),
    INDEX idx_character_2 (character_id_2),
    INDEX idx_relationship_type (relationship_type),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id_1) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id_2) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物关系表';

-- --------------------------------------------
-- 6. 大纲表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS outlines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    content LONGTEXT COMMENT '大纲内容',
    structure_type VARCHAR(50) DEFAULT 'linear' COMMENT '结构类型: linear/multi-line/nested',
    total_chapters INT COMMENT '规划总章节数',
    version INT DEFAULT 1 COMMENT '版本号',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否为当前激活版本',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大纲表';

-- --------------------------------------------
-- 7. 细纲表（每5章一组）
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS detailed_outlines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    outline_id INT NOT NULL COMMENT '所属大纲ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    group_index INT NOT NULL COMMENT '组序号（第几组细纲）',
    start_chapter INT NOT NULL COMMENT '起始章节号',
    end_chapter INT NOT NULL COMMENT '结束章节号',
    content LONGTEXT COMMENT '细纲内容',
    key_events TEXT COMMENT '关键事件列表（JSON格式）',
    involved_characters TEXT COMMENT '涉及人物ID列表（JSON格式）',
    version INT DEFAULT 1 COMMENT '版本号',
    status ENUM('draft', 'approved', 'generating', 'completed') DEFAULT 'draft' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_outline_id (outline_id),
    INDEX idx_user_id (user_id),
    INDEX idx_group_index (group_index),
    INDEX idx_status (status),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='细纲表';

-- --------------------------------------------
-- 8. 章节表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    detailed_outline_id INT COMMENT '关联的细纲ID',
    chapter_number INT NOT NULL COMMENT '章节序号',
    title VARCHAR(255) COMMENT '章节标题',
    content LONGTEXT COMMENT '章节内容',
    summary TEXT COMMENT '章节摘要（AI生成）',
    word_count INT DEFAULT 0 COMMENT '字数统计',
    status ENUM('draft', 'generating', 'pending_review', 'approved', 'rejected', 'published') DEFAULT 'draft' COMMENT '状态',
    review_notes TEXT COMMENT '审核意见/修改建议',
    emotional_tone VARCHAR(50) COMMENT '情感基调',
    key_events TEXT COMMENT '关键事件（JSON格式）',
    involved_characters TEXT COMMENT '出场人物ID列表（JSON格式）',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_chapter_number (chapter_number),
    INDEX idx_status (status),
    UNIQUE KEY uk_novel_chapter (novel_id, chapter_number),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (detailed_outline_id) REFERENCES detailed_outlines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';

-- --------------------------------------------
-- 9. 章节版本历史表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS chapter_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL COMMENT '章节ID',
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    version INT NOT NULL COMMENT '版本号',
    content LONGTEXT COMMENT '该版本的内容',
    word_count INT DEFAULT 0 COMMENT '字数',
    change_type ENUM('ai_generated', 'ai_revised', 'manual_edit', 'rollback') COMMENT '变更类型',
    change_notes TEXT COMMENT '变更说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_novel_id (novel_id),
    INDEX idx_version (version),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节版本历史表';

-- ============================================
-- 第二部分：高级功能表
-- ============================================

-- --------------------------------------------
-- 10. 伏笔管理表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS foreshadowing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    title VARCHAR(255) NOT NULL COMMENT '伏笔标题/简述',
    content TEXT NOT NULL COMMENT '伏笔详细内容',
    planted_chapter INT NOT NULL COMMENT '埋设章节',
    target_chapter INT COMMENT '计划回收章节',
    actual_resolved_chapter INT COMMENT '实际回收章节',
    related_characters TEXT COMMENT '关联人物ID（JSON格式）',
    related_events TEXT COMMENT '关联事件ID（JSON格式）',
    importance ENUM('critical', 'major', 'minor') DEFAULT 'minor' COMMENT '重要程度',
    status ENUM('planted', 'hinted', 'partially_resolved', 'resolved', 'abandoned') DEFAULT 'planted' COMMENT '状态',
    resolution_notes TEXT COMMENT '回收方式说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_planted_chapter (planted_chapter),
    INDEX idx_target_chapter (target_chapter),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='伏笔管理表';

-- --------------------------------------------
-- 11. 事件表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    name VARCHAR(255) NOT NULL COMMENT '事件名称',
    description TEXT COMMENT '事件描述',
    event_type ENUM('main_plot', 'sub_plot', 'character_event', 'world_event', 'flashback') DEFAULT 'main_plot' COMMENT '事件类型',
    chapter_number INT COMMENT '发生章节',
    timeline_position INT COMMENT '时间线位置（用于排序）',
    participants TEXT COMMENT '参与人物ID（JSON格式）',
    location VARCHAR(255) COMMENT '发生地点',
    consequences TEXT COMMENT '事件后果/影响',
    status ENUM('planned', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_chapter_number (chapter_number),
    INDEX idx_timeline_position (timeline_position),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='事件表';

-- --------------------------------------------
-- 12. 事件因果关系表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS event_causality (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    cause_event_id INT NOT NULL COMMENT '原因事件ID',
    effect_event_id INT NOT NULL COMMENT '结果事件ID',
    causality_type ENUM('direct', 'indirect', 'conditional') DEFAULT 'direct' COMMENT '因果类型',
    description TEXT COMMENT '因果关系说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_cause_event (cause_event_id),
    INDEX idx_effect_event (effect_event_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (cause_event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (effect_event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='事件因果关系表';

-- --------------------------------------------
-- 13. 地点/场景表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    name VARCHAR(255) NOT NULL COMMENT '地点名称',
    location_type VARCHAR(50) COMMENT '地点类型（城市/建筑/自然等）',
    description TEXT COMMENT '地点描述',
    parent_location_id INT COMMENT '上级地点ID（用于层级结构）',
    coordinates VARCHAR(100) COMMENT '坐标/位置标识',
    atmosphere TEXT COMMENT '氛围描述',
    notable_features TEXT COMMENT '显著特征',
    first_appearance INT COMMENT '首次出现章节',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_location (parent_location_id),
    INDEX idx_name (name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地点/场景表';

-- --------------------------------------------
-- 14. 物品/道具表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    name VARCHAR(255) NOT NULL COMMENT '物品名称',
    item_type VARCHAR(50) COMMENT '物品类型（武器/装备/消耗品等）',
    description TEXT COMMENT '物品描述',
    abilities TEXT COMMENT '物品能力/效果',
    rarity VARCHAR(50) COMMENT '稀有度',
    current_owner_id INT COMMENT '当前持有者（人物ID）',
    origin TEXT COMMENT '来源/背景',
    first_appearance INT COMMENT '首次出现章节',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_current_owner (current_owner_id),
    INDEX idx_name (name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_owner_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物品/道具表';

-- --------------------------------------------
-- 15. 组织/势力表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    name VARCHAR(255) NOT NULL COMMENT '组织名称',
    org_type VARCHAR(50) COMMENT '组织类型（门派/国家/公司等）',
    description TEXT COMMENT '组织描述',
    hierarchy TEXT COMMENT '组织架构',
    goals TEXT COMMENT '组织目标',
    leader_id INT COMMENT '领导者（人物ID）',
    headquarters VARCHAR(255) COMMENT '总部位置',
    founding_story TEXT COMMENT '创立背景',
    first_appearance INT COMMENT '首次出现章节',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_leader (leader_id),
    INDEX idx_name (name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leader_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组织/势力表';

-- --------------------------------------------
-- 16. 时间线表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS timeline (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '小说ID',
    user_id INT NOT NULL COMMENT '用户ID',
    event_name VARCHAR(255) NOT NULL COMMENT '事件名称',
    event_description TEXT COMMENT '事件描述',
    timeline_date VARCHAR(100) COMMENT '时间线日期（小说内时间）',
    timeline_order INT NOT NULL COMMENT '时间顺序（用于排序）',
    chapter_number INT COMMENT '对应章节',
    event_id INT COMMENT '关联事件ID',
    is_flashback BOOLEAN DEFAULT FALSE COMMENT '是否为回忆/闪回',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_timeline_order (timeline_order),
    INDEX idx_chapter_number (chapter_number),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='时间线表';

-- ============================================
-- 第三部分：系统配置表
-- ============================================

-- --------------------------------------------
-- 17. AI模型配置表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS model_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户ID',
    name VARCHAR(100) NOT NULL COMMENT '配置名称',
    provider VARCHAR(50) NOT NULL COMMENT '模型提供商',
    api_key VARCHAR(500) COMMENT 'API密钥（建议加密存储）',
    api_base VARCHAR(500) COMMENT '自定义API Base URL',
    model_name VARCHAR(100) COMMENT '模型名称',
    temperature VARCHAR(10) DEFAULT '0.7' COMMENT '温度参数',
    top_p VARCHAR(10) COMMENT 'Top P参数',
    max_tokens INT COMMENT '最大token数',
    frequency_penalty VARCHAR(10) COMMENT '频率惩罚',
    presence_penalty VARCHAR(10) COMMENT '存在惩罚',
    is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认配置',
    usage_type ENUM('outline', 'chapter', 'revision', 'summary', 'all') DEFAULT 'all' COMMENT '用途类型',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_is_default (is_default),
    INDEX idx_provider (provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- --------------------------------------------
-- 18. 生成历史记录表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS generation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    type ENUM('outline', 'detailed_outline', 'chapter', 'revision', 'summary', 'character', 'other') NOT NULL COMMENT '生成类型',
    target_id INT COMMENT '目标ID（章节ID/大纲ID等）',
    prompt TEXT COMMENT '使用的提示词',
    context_used TEXT COMMENT '使用的上下文（JSON格式）',
    result LONGTEXT COMMENT '生成结果',
    model_config_id INT COMMENT '使用的模型配置ID',
    model_used VARCHAR(100) COMMENT '使用的模型名称',
    tokens_input INT COMMENT '输入token数',
    tokens_output INT COMMENT '输出token数',
    tokens_total INT COMMENT '总token数',
    generation_time_ms INT COMMENT '生成耗时（毫秒）',
    status ENUM('success', 'failed', 'cancelled') DEFAULT 'success' COMMENT '状态',
    error_message TEXT COMMENT '错误信息（如有）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='生成历史记录表';

-- --------------------------------------------
-- 19. 知识库条目表（向量检索元数据）
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    type ENUM('character', 'plot', 'setting', 'chapter', 'event', 'location', 'item', 'custom') NOT NULL COMMENT '知识类型',
    source_type VARCHAR(50) COMMENT '来源类型',
    source_id INT COMMENT '来源ID',
    title VARCHAR(255) COMMENT '标题/摘要',
    content TEXT NOT NULL COMMENT '知识内容',
    vector_id VARCHAR(100) COMMENT 'Milvus中的向量ID',
    embedding_model VARCHAR(100) COMMENT '使用的Embedding模型',
    metadata JSON COMMENT '额外元数据',
    chapter_range VARCHAR(50) COMMENT '相关章节范围',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否有效',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_vector_id (vector_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库条目表';

-- --------------------------------------------
-- 20. 参考资料表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS reference_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT COMMENT '关联小说ID（可为空表示全局资料）',
    user_id INT NOT NULL COMMENT '用户ID',
    title VARCHAR(255) NOT NULL COMMENT '资料标题',
    material_type ENUM('worldbuilding', 'style_reference', 'research', 'inspiration', 'other') DEFAULT 'other' COMMENT '资料类型',
    content LONGTEXT COMMENT '资料内容',
    source_url VARCHAR(500) COMMENT '来源URL',
    file_path VARCHAR(500) COMMENT '文件路径',
    is_vectorized BOOLEAN DEFAULT FALSE COMMENT '是否已向量化',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_material_type (material_type),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='参考资料表';

-- --------------------------------------------
-- 21. Prompt模板表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    name VARCHAR(100) NOT NULL COMMENT '模板名称',
    template_type ENUM('outline', 'detailed_outline', 'chapter', 'revision', 'summary', 'character', 'custom') NOT NULL COMMENT '模板类型',
    content LONGTEXT NOT NULL COMMENT '模板内容',
    variables TEXT COMMENT '可用变量列表（JSON格式）',
    description TEXT COMMENT '模板描述',
    is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认模板',
    is_system BOOLEAN DEFAULT FALSE COMMENT '是否为系统模板',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_template_type (template_type),
    INDEX idx_is_default (is_default),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Prompt模板表';

-- ============================================
-- 第四部分：初始数据
-- ============================================

-- 创建默认管理员账户
-- 密码: admin123 (bcrypt哈希)
INSERT INTO users (username, password_hash, name, email, role, is_active)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYn1ePMm/Wy6', '系统管理员', 'admin@example.com', 'admin', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入默认Prompt模板
INSERT INTO prompt_templates (user_id, name, template_type, content, variables, description, is_default, is_system)
VALUES 
(1, '大纲生成模板', 'outline', 
'你是一位资深的{{genre}}小说作家。请根据以下信息生成一份详细的小说大纲：

【小说标题】{{title}}
【小说类型】{{genre}}
【写作风格】{{style}}
【小说简介】{{description}}
【世界观设定】{{world_setting}}
【用户要求】{{prompt}}

请生成包含以下内容的大纲：
1. 故事主线概述
2. 主要人物介绍
3. 分卷/分部结构
4. 每卷主要情节点
5. 高潮和结局设计
6. 主要伏笔规划',
'["title", "genre", "style", "description", "world_setting", "prompt"]',
'用于生成小说总体大纲的默认模板', TRUE, TRUE),

(1, '细纲生成模板', 'detailed_outline',
'你是一位资深的{{genre}}小说作家。请根据以下信息生成第{{start_chapter}}章到第{{end_chapter}}章的细纲：

【小说标题】{{title}}
【总体大纲】{{outline}}
【前情摘要】{{previous_summary}}
【涉及人物】{{characters}}

请为每一章生成：
1. 章节标题
2. 主要场景
3. 情节要点（3-5个）
4. 人物互动
5. 情感基调
6. 伏笔/悬念',
'["title", "genre", "start_chapter", "end_chapter", "outline", "previous_summary", "characters"]',
'用于生成章节细纲的默认模板', TRUE, TRUE),

(1, '章节生成模板', 'chapter',
'你是一位资深的{{genre}}小说作家，擅长{{style}}风格的创作。

【写作规范】
1. 保持人物性格一致，对话符合人物设定
2. 情节发展自然流畅，与前文呼应
3. 适当使用环境描写和心理描写
4. 控制节奏，张弛有度

【人物档案】
{{character_profiles}}

【近期情节摘要】
{{recent_summaries}}

【相关历史内容】
{{rag_context}}

【待回收伏笔】
{{pending_foreshadowing}}

【本章细纲】
{{chapter_outline}}

请根据以上信息，续写第{{chapter_number}}章"{{chapter_title}}"。
要求字数：{{word_count}}字左右
情感基调：{{emotional_tone}}',
'["genre", "style", "character_profiles", "recent_summaries", "rag_context", "pending_foreshadowing", "chapter_outline", "chapter_number", "chapter_title", "word_count", "emotional_tone"]',
'用于生成章节正文的默认模板', TRUE, TRUE);

-- ============================================
-- 完成提示
-- ============================================
SELECT '========================================' AS '';
SELECT '数据库初始化完成！' AS message;
SELECT '========================================' AS '';
SELECT '默认管理员账户: admin / admin123' AS info;
SELECT '共创建 21 张数据表' AS tables;
SELECT '========================================' AS '';

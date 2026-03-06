-- ============================================
-- 幻写次元 - AI小说生成系统
-- MySQL数据库初始化脚本
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS ai_novel_generator 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ai_novel_generator;

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(255) COMMENT '密码哈希',
    name TEXT COMMENT '昵称',
    open_id VARCHAR(64) UNIQUE COMMENT 'OAuth OpenID',
    email VARCHAR(320) COMMENT '邮箱',
    login_method VARCHAR(64) DEFAULT 'local' COMMENT '登录方式: local/oauth',
    role ENUM('user', 'admin') DEFAULT 'user' NOT NULL COMMENT '用户角色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '账户是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    last_signed_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_open_id (open_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 小说项目表
-- ============================================
CREATE TABLE IF NOT EXISTS novels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户ID',
    title VARCHAR(255) NOT NULL COMMENT '小说标题',
    genre VARCHAR(100) COMMENT '小说类型',
    style VARCHAR(100) COMMENT '写作风格',
    description TEXT COMMENT '小说简介',
    prompt TEXT COMMENT '生成提示词',
    world_setting TEXT COMMENT '世界观设定',
    status ENUM('draft', 'writing', 'completed') DEFAULT 'draft' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说项目表';

-- ============================================
-- 人物设定表
-- ============================================
CREATE TABLE IF NOT EXISTS characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    name VARCHAR(100) NOT NULL COMMENT '人物名称',
    role VARCHAR(50) COMMENT '角色定位: 主角/配角/反派等',
    personality TEXT COMMENT '性格特点',
    background TEXT COMMENT '背景故事',
    appearance TEXT COMMENT '外貌描述',
    abilities TEXT COMMENT '能力/技能',
    relationships TEXT COMMENT '人物关系',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人物设定表';

-- ============================================
-- 大纲表
-- ============================================
CREATE TABLE IF NOT EXISTS outlines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    content LONGTEXT COMMENT '大纲内容',
    version INT DEFAULT 1 COMMENT '版本号',
    is_active TINYINT DEFAULT 1 COMMENT '是否为当前激活版本',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大纲表';

-- ============================================
-- 细纲表（每5章一组）
-- ============================================
CREATE TABLE IF NOT EXISTS detailed_outlines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    outline_id INT NOT NULL COMMENT '所属大纲ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    group_index INT NOT NULL COMMENT '组序号（第几组细纲）',
    start_chapter INT NOT NULL COMMENT '起始章节号',
    end_chapter INT NOT NULL COMMENT '结束章节号',
    content LONGTEXT COMMENT '细纲内容',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_outline_id (outline_id),
    INDEX idx_user_id (user_id),
    INDEX idx_group_index (group_index),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='细纲表';

-- ============================================
-- 章节表
-- ============================================
CREATE TABLE IF NOT EXISTS chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    chapter_number INT NOT NULL COMMENT '章节序号',
    title VARCHAR(255) COMMENT '章节标题',
    content LONGTEXT COMMENT '章节内容',
    word_count INT DEFAULT 0 COMMENT '字数统计',
    status ENUM('draft', 'pending_review', 'approved', 'rejected') DEFAULT 'draft' COMMENT '审核状态',
    review_notes TEXT COMMENT '审核意见',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_chapter_number (chapter_number),
    INDEX idx_status (status),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';

-- ============================================
-- 生成历史记录表
-- ============================================
CREATE TABLE IF NOT EXISTS generation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    type ENUM('outline', 'detailed_outline', 'chapter', 'revision') NOT NULL COMMENT '生成类型',
    target_id INT COMMENT '目标ID（章节ID/大纲ID等）',
    prompt TEXT COMMENT '使用的提示词',
    result LONGTEXT COMMENT '生成结果',
    model_used VARCHAR(100) COMMENT '使用的模型',
    tokens_used INT COMMENT '消耗的token数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='生成历史记录表';

-- ============================================
-- AI模型配置表
-- ============================================
CREATE TABLE IF NOT EXISTS model_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户ID',
    name VARCHAR(100) NOT NULL COMMENT '配置名称',
    provider VARCHAR(50) NOT NULL COMMENT '模型提供商: openai/anthropic/deepseek/custom等',
    api_key VARCHAR(500) COMMENT 'API密钥（加密存储）',
    api_base VARCHAR(500) COMMENT '自定义API Base URL',
    model_name VARCHAR(100) COMMENT '模型名称',
    temperature VARCHAR(10) DEFAULT '0.7' COMMENT '温度参数',
    top_p VARCHAR(10) COMMENT 'Top P参数',
    max_tokens INT COMMENT '最大token数',
    is_default TINYINT DEFAULT 0 COMMENT '是否为默认配置',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_is_default (is_default),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- ============================================
-- 知识库条目表（用于向量检索的元数据）
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL COMMENT '所属小说ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    type ENUM('character', 'plot', 'setting', 'chapter', 'custom') NOT NULL COMMENT '知识类型',
    source_id INT COMMENT '来源ID（如章节ID、人物ID等）',
    title VARCHAR(255) COMMENT '标题/摘要',
    content TEXT NOT NULL COMMENT '知识内容',
    vector_id VARCHAR(100) COMMENT 'Milvus中的向量ID',
    metadata JSON COMMENT '额外元数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_vector_id (vector_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库条目表';

-- ============================================
-- 创建默认管理员账户
-- 密码: admin123 (使用bcrypt哈希)
-- ============================================
INSERT INTO users (username, password_hash, name, email, role, is_active)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYn1ePMm/Wy6', '系统管理员', 'admin@example.com', 'admin', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 完成提示
-- ============================================
SELECT '数据库初始化完成！' AS message;
SELECT '默认管理员账户: admin / admin123' AS info;

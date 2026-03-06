-- 添加 ai_summary 字段到 chapters 表
ALTER TABLE chapters ADD COLUMN ai_summary TEXT NULL COMMENT 'AI生成的章节摘要';


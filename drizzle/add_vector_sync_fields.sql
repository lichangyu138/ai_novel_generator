-- 添加向量同步标记字段（vector_id）

-- 角色表
ALTER TABLE characters ADD COLUMN vector_id BIGINT NULL COMMENT '向量库ID';

-- 地点表
ALTER TABLE worldbuilding_locations ADD COLUMN vector_id BIGINT NULL COMMENT '向量库ID';

-- 物品表
ALTER TABLE worldbuilding_items ADD COLUMN vector_id BIGINT NULL COMMENT '向量库ID';

-- 组织表
ALTER TABLE worldbuilding_organizations ADD COLUMN vector_id BIGINT NULL COMMENT '向量库ID';


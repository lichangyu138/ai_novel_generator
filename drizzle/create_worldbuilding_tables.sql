-- 世界观管理独立表

-- 地点表
CREATE TABLE IF NOT EXISTS `worldbuilding_locations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `novel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_novel_user` (`novel_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 物品表
CREATE TABLE IF NOT EXISTS `worldbuilding_items` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `novel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_novel_user` (`novel_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 组织表
CREATE TABLE IF NOT EXISTS `worldbuilding_organizations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `novel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_novel_user` (`novel_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


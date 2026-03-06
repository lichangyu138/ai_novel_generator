#!/usr/bin/env python3
"""
修复数据库表结构 - 将驼峰命名改为下划线命名
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.mysql import engine
from app.config.settings import get_settings
from sqlalchemy import text

settings = get_settings()

def fix_database_fields():
    """修复数据库字段名"""
    print("=" * 50)
    print("修复数据库表结构")
    print("=" * 50)
    print()
    
    with engine.connect() as conn:
        # 开始事务
        trans = conn.begin()
        try:
            print("1. 修复 users 表...")
            
            # 检查字段是否存在
            check_sql = """
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'users' AND COLUMN_NAME = 'passwordHash'
            """
            result = conn.execute(text(check_sql), (settings.MYSQL_DATABASE,))
            if result.fetchone():
                # 修复 users 表字段
                alter_sqls = [
                    "ALTER TABLE `users` CHANGE COLUMN `passwordHash` `password_hash` VARCHAR(255) COMMENT '密码哈希'",
                    "ALTER TABLE `users` CHANGE COLUMN `openId` `open_id` VARCHAR(64) COMMENT 'OAuth标识符（可选）'",
                    "ALTER TABLE `users` CHANGE COLUMN `loginMethod` `login_method` VARCHAR(64) DEFAULT 'local' COMMENT '登录方式'",
                    "ALTER TABLE `users` CHANGE COLUMN `createdAt` `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'",
                    "ALTER TABLE `users` CHANGE COLUMN `updatedAt` `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'",
                    "ALTER TABLE `users` CHANGE COLUMN `lastSignedIn` `last_signed_in` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间'",
                ]
                
                for sql in alter_sqls:
                    try:
                        conn.execute(text(sql))
                        print(f"   [OK] {sql.split('CHANGE COLUMN')[1].split('`')[1]}")
                    except Exception as e:
                        print(f"   [WARN] {sql.split('CHANGE COLUMN')[1].split('`')[1]}: {e}")
                
                # 添加 is_active 字段（如果不存在）
                try:
                    conn.execute(text("ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN DEFAULT TRUE COMMENT '账户是否激活'"))
                    print("   [OK] 添加 is_active 字段")
                except Exception as e:
                    if "Duplicate column name" in str(e):
                        print("   [INFO] is_active 字段已存在")
                    else:
                        print(f"   [WARN] 添加 is_active 字段失败: {e}")
            else:
                print("   [INFO] users 表字段已经是下划线命名")
            
            print()
            print("2. 创建/更新管理员账户...")
            
            # 创建管理员账户（使用正确的字段名）
            admin_sql = """
            INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`)
            VALUES (
                'admin',
                'admin@example.com',
                '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYn1ePMm/Wy6',
                'admin',
                TRUE,
                NOW(),
                NOW()
            )
            ON DUPLICATE KEY UPDATE 
                `password_hash` = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYn1ePMm/Wy6',
                `is_active` = TRUE,
                `updated_at` = NOW()
            """
            
            try:
                conn.execute(text(admin_sql))
                print("   [OK] 管理员账户已创建/更新")
                print("   用户名: admin")
                print("   密码: admin123")
            except Exception as e:
                print(f"   [ERROR] 创建管理员账户失败: {e}")
            
            # 提交事务
            trans.commit()
            print()
            print("=" * 50)
            print("数据库修复完成！")
            print("=" * 50)
            
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] 修复失败，已回滚: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == "__main__":
    fix_database_fields()


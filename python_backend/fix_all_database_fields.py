#!/usr/bin/env python3
"""
修复所有数据库表字段名 - 将驼峰命名改为下划线命名
使用pymysql直接连接，避免导入其他模块
"""
import pymysql
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

# 数据库配置
MYSQL_HOST = os.getenv('MYSQL_HOST', '10.8.6.45')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 13306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '4BTFesFsCtjAWX5D')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'ai_novel_generator')

# 字段映射配置
FIELD_MAPPINGS = {
    'users': [
        ('passwordHash', 'password_hash', 'VARCHAR(255)'),
        ('openId', 'open_id', 'VARCHAR(64)'),
        ('loginMethod', 'login_method', "VARCHAR(64) DEFAULT 'local'"),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        ('lastSignedIn', 'last_signed_in', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
    ],
    'novels': [
        ('userId', 'user_id', 'INT NOT NULL'),
        ('worldSetting', 'world_setting', 'TEXT'),
        ('writerStyle', 'writer_style', 'TEXT'),
        ('removeAiTaste', 'remove_ai_taste', 'INT DEFAULT 0'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'characters': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'characterRelationships': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('sourceCharacterId', 'source_character_id', 'INT NOT NULL'),
        ('targetCharacterId', 'target_character_id', 'INT NOT NULL'),
        ('relationshipType', 'relationship_type', 'VARCHAR(64) NOT NULL'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'outlines': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('isActive', 'is_active', 'INT NOT NULL DEFAULT 1'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'detailedOutlines': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('outlineId', 'outline_id', 'INT NOT NULL'),
        ('groupIndex', 'group_index', 'INT NOT NULL'),
        ('startChapter', 'start_chapter', 'INT NOT NULL'),
        ('endChapter', 'end_chapter', 'INT NOT NULL'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'chapters': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('chapterNumber', 'chapter_number', 'INT NOT NULL'),
        ('wordCount', 'word_count', 'INT DEFAULT 0'),
        ('reviewNotes', 'review_notes', 'TEXT'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'generationHistory': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('targetId', 'target_id', 'INT'),
        ('modelUsed', 'model_used', 'VARCHAR(128)'),
        ('tokensUsed', 'tokens_used', 'INT'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
    ],
    'modelConfigs': [
        ('userId', 'user_id', 'INT NOT NULL'),
        ('displayName', 'display_name', 'VARCHAR(128)'),
        ('apiKey', 'api_key', 'TEXT'),
        ('apiBase', 'api_base', 'VARCHAR(512)'),
        ('modelName', 'model_name', 'VARCHAR(128)'),
        ('topP', 'top_p', "VARCHAR(10) DEFAULT '0.9'"),
        ('maxTokens', 'max_tokens', 'INT DEFAULT 4096'),
        ('isDefault', 'is_default', 'INT NOT NULL DEFAULT 0'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'knowledgeEntries': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('sourceChapterId', 'source_chapter_id', 'INT'),
        ('isAutoExtracted', 'is_auto_extracted', 'INT DEFAULT 0'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'events': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('chapterId', 'chapter_id', 'INT'),
        ('eventTime', 'event_time', 'VARCHAR(128)'),
        ('relatedCharacterIds', 'related_character_ids', 'TEXT'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
    'foreshadowing': [
        ('novelId', 'novel_id', 'INT NOT NULL'),
        ('userId', 'user_id', 'INT NOT NULL'),
        ('chapterId', 'chapter_id', 'INT'),
        ('resolvedChapterId', 'resolved_chapter_id', 'INT'),
        ('resolvedDescription', 'resolved_description', 'TEXT'),
        ('createdAt', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        ('updatedAt', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    ],
}

def fix_database_fields():
    """修复数据库字段名"""
    print("=" * 70)
    print("修复数据库表字段名（驼峰 -> 下划线）")
    print("=" * 70)
    print()
    print(f"数据库: {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}")
    print()
    
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        print("[OK] 数据库连接成功")
        print()
    except Exception as e:
        print(f"[ERROR] 数据库连接失败: {e}")
        return
    
    total_fixed = 0
    total_errors = 0
    
    for table_name, mappings in FIELD_MAPPINGS.items():
        print(f"处理表: {table_name}")
        print("-" * 70)
        
        # 检查表是否存在
        cursor.execute(f"""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """, (MYSQL_DATABASE, table_name))
        
        if cursor.fetchone()[0] == 0:
            print(f"  [SKIP] 表 {table_name} 不存在，跳过")
            print()
            continue
        
        fixed_count = 0
        for old_name, new_name, column_type in mappings:
            try:
                # 检查字段是否存在
                cursor.execute(f"""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
                """, (MYSQL_DATABASE, table_name, old_name))
                
                if cursor.fetchone():
                    # 字段存在，需要重命名
                    alter_sql = f"ALTER TABLE `{table_name}` CHANGE COLUMN `{old_name}` `{new_name}` {column_type}"
                    cursor.execute(alter_sql)
                    print(f"  [OK] {old_name} -> {new_name}")
                    fixed_count += 1
                else:
                    # 检查新字段名是否已存在
                    cursor.execute(f"""
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
                    """, (MYSQL_DATABASE, table_name, new_name))
                    
                    if cursor.fetchone():
                        print(f"  [SKIP] {new_name} 已存在，跳过")
                    else:
                        print(f"  [WARN] {old_name} 不存在，无法重命名")
                        
            except Exception as e:
                print(f"  [ERROR] {old_name} -> {new_name}: {e}")
                total_errors += 1
        
        # 特殊处理：添加缺失的字段
        if table_name == 'users':
            try:
                # 检查 is_active 字段
                cursor.execute(f"""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active'
                """, (MYSQL_DATABASE,))
                
                if not cursor.fetchone():
                    cursor.execute("ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN DEFAULT TRUE COMMENT '账户是否激活'")
                    print(f"  [OK] 添加 is_active 字段")
                    fixed_count += 1
            except Exception as e:
                if "Duplicate column name" not in str(e):
                    print(f"  [ERROR] 添加 is_active 字段失败: {e}")
        
        total_fixed += fixed_count
        print(f"  完成: 修复 {fixed_count} 个字段")
        print()
    
    # 创建/更新管理员账户
    print("创建/更新管理员账户...")
    print("-" * 70)
    try:
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
        cursor.execute(admin_sql)
        conn.commit()
        print("  [OK] 管理员账户已创建/更新")
        print("  用户名: admin")
        print("  密码: admin123")
    except Exception as e:
        print(f"  [ERROR] 创建管理员账户失败: {e}")
        conn.rollback()
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print()
    print("=" * 70)
    print("修复完成")
    print("=" * 70)
    print(f"总共修复: {total_fixed} 个字段")
    if total_errors > 0:
        print(f"错误: {total_errors} 个")
    print()

if __name__ == "__main__":
    fix_database_fields()


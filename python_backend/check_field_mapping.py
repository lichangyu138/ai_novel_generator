#!/usr/bin/env python3
"""
检查数据库字段与Python模型的匹配情况
"""
import pymysql
from app.config.settings import get_settings

settings = get_settings()

def check_field_mapping():
    """检查字段映射"""
    print("=" * 70)
    print("数据库字段与Python模型匹配检查")
    print("=" * 70)
    print()
    
    # 连接数据库
    try:
        conn = pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        print("[OK] 数据库连接成功")
        print()
    except Exception as e:
        print(f"[ERROR] 数据库连接失败: {e}")
        return
    
    # 定义表名和字段映射
    tables_to_check = {
        'users': {
            'sql_fields': ['passwordHash', 'openId', 'loginMethod', 'createdAt', 'updatedAt', 'lastSignedIn'],
            'python_fields': ['password_hash', 'open_id', 'login_method', 'created_at', 'updated_at', 'last_signed_in'],
            'required_python': ['password_hash', 'email', 'is_active', 'created_at', 'updated_at']
        },
        'novels': {
            'sql_fields': ['userId', 'worldSetting', 'writerStyle', 'removeAiTaste', 'createdAt', 'updatedAt'],
            'python_fields': ['user_id', 'world_setting', 'writer_style', 'remove_ai_taste', 'created_at', 'updated_at'],
            'required_python': ['user_id', 'created_at', 'updated_at']
        },
        'characters': {
            'sql_fields': ['novelId', 'userId', 'createdAt', 'updatedAt'],
            'python_fields': ['novel_id', 'user_id', 'created_at', 'updated_at'],
            'required_python': ['novel_id', 'user_id', 'created_at', 'updated_at']
        },
        'chapters': {
            'sql_fields': ['novelId', 'userId', 'chapterNumber', 'wordCount', 'reviewNotes', 'createdAt', 'updatedAt'],
            'python_fields': ['novel_id', 'user_id', 'chapter_number', 'word_count', 'review_notes', 'created_at', 'updated_at'],
            'required_python': ['novel_id', 'user_id', 'chapter_number', 'created_at', 'updated_at']
        },
        'outlines': {
            'sql_fields': ['novelId', 'userId', 'isActive', 'createdAt', 'updatedAt'],
            'python_fields': ['novel_id', 'user_id', 'is_active', 'created_at', 'updated_at'],
            'required_python': ['novel_id', 'user_id', 'created_at', 'updated_at']
        },
        'detailedOutlines': {
            'sql_fields': ['novelId', 'userId', 'outlineId', 'groupIndex', 'startChapter', 'endChapter', 'createdAt', 'updatedAt'],
            'python_fields': ['novel_id', 'user_id', 'outline_id', 'group_index', 'start_chapter', 'end_chapter', 'created_at', 'updated_at'],
            'required_python': ['novel_id', 'user_id', 'outline_id', 'created_at', 'updated_at']
        },
        'generationHistory': {
            'sql_fields': ['novelId', 'userId', 'targetId', 'modelUsed', 'tokensUsed', 'createdAt'],
            'python_fields': ['novel_id', 'user_id', 'target_id', 'model_used', 'tokens_used', 'created_at'],
            'required_python': ['novel_id', 'user_id', 'created_at']
        },
        'modelConfigs': {
            'sql_fields': ['userId', 'displayName', 'apiKey', 'apiBase', 'modelName', 'topP', 'maxTokens', 'isDefault', 'createdAt', 'updatedAt'],
            'python_fields': ['user_id', 'display_name', 'api_key', 'api_base', 'model_name', 'top_p', 'max_tokens', 'is_default', 'created_at', 'updated_at'],
            'required_python': ['user_id', 'created_at', 'updated_at']
        }
    }
    
    issues = []
    
    for table_name, mapping in tables_to_check.items():
        print(f"检查表: {table_name}")
        print("-" * 70)
        
        # 获取实际数据库字段
        cursor.execute(f"""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """, (settings.MYSQL_DATABASE, table_name))
        
        db_columns = [row[0] for row in cursor.fetchall()]
        
        if not db_columns:
            print(f"  [WARN] 表 {table_name} 不存在")
            print()
            continue
        
        print(f"  数据库字段 ({len(db_columns)}): {', '.join(db_columns[:10])}{'...' if len(db_columns) > 10 else ''}")
        
        # 检查必需字段
        missing_required = []
        for req_field in mapping.get('required_python', []):
            if req_field not in db_columns:
                missing_required.append(req_field)
        
        if missing_required:
            issues.append({
                'table': table_name,
                'type': 'missing_required',
                'fields': missing_required
            })
            print(f"  [ERROR] 缺少必需字段: {', '.join(missing_required)}")
        
        # 检查字段名不匹配
        mismatches = []
        for sql_field, python_field in zip(mapping['sql_fields'], mapping['python_fields']):
            if sql_field in db_columns and python_field not in db_columns:
                mismatches.append((sql_field, python_field))
        
        if mismatches:
            issues.append({
                'table': table_name,
                'type': 'field_mismatch',
                'fields': mismatches
            })
            print(f"  [ERROR] 字段名不匹配:")
            for sql_f, py_f in mismatches:
                print(f"    {sql_f} (数据库) -> {py_f} (Python模型)")
        
        if not missing_required and not mismatches:
            print(f"  [OK] 字段匹配正确")
        
        print()
    
    # 总结
    print("=" * 70)
    print("检查总结")
    print("=" * 70)
    
    if issues:
        print(f"发现 {len(issues)} 个问题:")
        for issue in issues:
            print(f"  - {issue['table']}: {issue['type']}")
        print()
        print("需要运行修复脚本: fix_database_fields.py")
    else:
        print("[OK] 所有字段匹配正确！")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_field_mapping()


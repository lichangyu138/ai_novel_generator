#!/usr/bin/env python3
"""
检查所有数据库表的字段名
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# 数据库配置
MYSQL_HOST = os.getenv('MYSQL_HOST', '10.8.6.45')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 13306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '4BTFesFsCtjAWX5D')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'ai_novel_generator')

def check_all_tables():
    """检查所有表的字段"""
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
        
        # 获取所有表名
        cursor.execute("SHOW TABLES")
        tables = [t[0] for t in cursor.fetchall()]
        
        print("=" * 70)
        print("数据库表字段检查")
        print("=" * 70)
        print()
        
        table_info = {}
        
        for table_name in sorted(tables):
            cursor.execute(f"DESCRIBE {table_name}")
            columns = cursor.fetchall()
            
            print(f"表: {table_name}")
            print("-" * 70)
            fields = []
            for col in columns:
                field_name = col[0]
                field_type = col[1]
                fields.append(field_name)
                print(f"  {field_name:30} {field_type}")
            
            table_info[table_name] = fields
            print()
        
        cursor.close()
        conn.close()
        
        # 生成 JSON 输出供后续使用
        import json
        print("=" * 70)
        print("JSON 格式输出（供代码使用）")
        print("=" * 70)
        print(json.dumps(table_info, indent=2, ensure_ascii=False))
        
        return table_info
        
    except Exception as e:
        print(f"错误: {e}")
        return None

if __name__ == "__main__":
    check_all_tables()


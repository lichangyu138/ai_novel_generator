#!/usr/bin/env python3
"""
生成 Drizzle schema 字段映射更新
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

def camel_to_snake(name):
    """将驼峰命名转换为下划线命名"""
    import re
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

def get_table_columns(table_name):
    """获取表的字段列表"""
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
        cursor.execute(f'DESCRIBE {table_name}')
        columns = cursor.fetchall()
        cursor.close()
        conn.close()
        return [col[0] for col in columns]
    except Exception as e:
        print(f"Error getting columns for {table_name}: {e}")
        return []

# 需要更新的表
tables_to_check = ['users', 'novels', 'characters', 'chapters', 'outlines']

print("=" * 70)
print("Drizzle Schema 字段映射检查")
print("=" * 70)
print()

for table_name in tables_to_check:
    columns = get_table_columns(table_name)
    if columns:
        print(f"表: {table_name}")
        print("  字段映射:")
        for col in columns:
            # 假设 TypeScript 属性名是驼峰格式
            ts_name = col.replace('_', ' ').title().replace(' ', '')
            ts_name = ts_name[0].lower() + ts_name[1:] if ts_name else col
            print(f"    {ts_name}: {col}")
        print()


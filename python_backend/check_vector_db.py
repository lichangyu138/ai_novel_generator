#!/usr/bin/env python3
"""
检查向量库数据
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

MYSQL_HOST = os.getenv('MYSQL_HOST', '10.8.6.45')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 13306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '4BTFesFsCtjAWX5D')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'ai_novel_generator')

conn = pymysql.connect(
    host=MYSQL_HOST,
    port=MYSQL_PORT,
    user=MYSQL_USER,
    password=MYSQL_PASSWORD,
    database=MYSQL_DATABASE
)

cursor = conn.cursor()

# 检查vector_documents表
cursor.execute("SELECT COUNT(*) FROM vector_documents")
total = cursor.fetchone()[0]
print(f"向量文档总数: {total}")

if total > 0:
    cursor.execute("""
        SELECT source_type, COUNT(*) as cnt 
        FROM vector_documents 
        GROUP BY source_type
    """)
    print("\n按类型统计:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    cursor.execute("""
        SELECT id, source_type, source_id, LEFT(text, 50) as preview
        FROM vector_documents
        ORDER BY created_at DESC
        LIMIT 5
    """)
    print("\n最新5条记录:")
    for row in cursor.fetchall():
        print(f"  ID:{row[0]} | {row[1]} | source_id:{row[2]} | {row[3]}...")

cursor.close()
conn.close()


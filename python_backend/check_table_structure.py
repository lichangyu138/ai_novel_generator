#!/usr/bin/env python3
"""
检查 users 表结构
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# 连接数据库
conn = pymysql.connect(
    host=os.getenv('MYSQL_HOST', 'localhost'),
    port=int(os.getenv('MYSQL_PORT', 3306)),
    user=os.getenv('MYSQL_USER', 'root'),
    password=os.getenv('MYSQL_PASSWORD', ''),
    database=os.getenv('MYSQL_DATABASE', 'ai_novel'),
    charset='utf8mb4'
)

try:
    with conn.cursor() as cursor:
        # 查看表结构
        cursor.execute("SHOW CREATE TABLE users")
        result = cursor.fetchone()
        print("Users 表结构:")
        print("=" * 80)
        print(result[1])
        print("=" * 80)
        
finally:
    conn.close()


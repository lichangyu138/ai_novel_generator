#!/usr/bin/env python3
"""
检查用户数据
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
        # 查询用户表
        cursor.execute("SELECT id, username, role, is_active FROM users LIMIT 5")
        users = cursor.fetchall()
        
        print("用户列表:")
        print("-" * 60)
        for user in users:
            print(f"ID: {user[0]}, Username: {user[1]}, Role: {user[2]}, Active: {user[3]}")
        print("-" * 60)
        
finally:
    conn.close()


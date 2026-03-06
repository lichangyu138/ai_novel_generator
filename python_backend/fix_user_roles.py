#!/usr/bin/env python3
"""
修复用户角色字段 - 将小写转换为大写
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
        # 更新 role 字段为大写
        print("更新用户角色字段...")
        cursor.execute("UPDATE users SET role = 'ADMIN' WHERE role = 'admin'")
        admin_count = cursor.rowcount
        
        cursor.execute("UPDATE users SET role = 'USER' WHERE role = 'user'")
        user_count = cursor.rowcount
        
        conn.commit()
        
        print(f"✓ 更新了 {admin_count} 个 ADMIN 用户")
        print(f"✓ 更新了 {user_count} 个 USER 用户")
        
        # 验证更新
        cursor.execute("SELECT id, username, role FROM users")
        users = cursor.fetchall()
        
        print("\n更新后的用户列表:")
        print("-" * 60)
        for user in users:
            print(f"ID: {user[0]}, Username: {user[1]}, Role: {user[2]}")
        print("-" * 60)
        
finally:
    conn.close()


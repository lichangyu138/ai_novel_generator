#!/usr/bin/env python3
"""
修改 users 表的 role 字段 ENUM 定义
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
        print("修改 users 表的 role 字段...")
        
        # 修改 ENUM 定义为大写
        sql = """
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('USER', 'ADMIN') 
        COLLATE utf8mb4_unicode_ci 
        NOT NULL DEFAULT 'USER' 
        COMMENT '用户角色'
        """
        
        cursor.execute(sql)
        conn.commit()
        
        print("✓ role 字段已更新为 ENUM('USER', 'ADMIN')")
        
        # 更新现有数据
        print("\n更新现有用户数据...")
        cursor.execute("UPDATE users SET role = 'ADMIN' WHERE role = 'admin'")
        admin_count = cursor.rowcount
        
        cursor.execute("UPDATE users SET role = 'USER' WHERE role = 'user'")
        user_count = cursor.rowcount
        
        conn.commit()
        
        print(f"✓ 更新了 {admin_count} 个 ADMIN 用户")
        print(f"✓ 更新了 {user_count} 个 USER 用户")
        
        # 验证
        cursor.execute("SELECT id, username, role FROM users")
        users = cursor.fetchall()
        
        print("\n更新后的用户列表:")
        print("-" * 60)
        for user in users:
            print(f"ID: {user[0]}, Username: {user[1]}, Role: {user[2]}")
        print("-" * 60)
        
except Exception as e:
    print(f"✗ 错误: {e}")
    conn.rollback()
finally:
    conn.close()


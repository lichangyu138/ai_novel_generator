#!/usr/bin/env python3
"""
快速重置admin密码为admin123
"""
import pymysql
import hashlib
import secrets
import os
from dotenv import load_dotenv

load_dotenv()

# 数据库配置
MYSQL_HOST = os.getenv('MYSQL_HOST', '10.8.6.45')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 13306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '4BTFesFsCtjAWX5D')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'ai_novel_generator')

def hash_password_pbkdf2(password: str) -> str:
    """使用 pbkdf2 哈希密码（与 Node.js 后端一致）"""
    salt = secrets.token_hex(16)
    hash_value = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000, 64)
    hash_hex = hash_value.hex()
    return f"{salt}:{hash_hex}"

def main():
    print("=" * 70)
    print("重置admin密码")
    print("=" * 70)
    
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE
    )
    
    cursor = conn.cursor()
    
    # 重置admin密码
    new_password = "admin123"
    new_hash = hash_password_pbkdf2(new_password)
    
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE username = 'admin'",
        (new_hash,)
    )
    conn.commit()
    
    print(f"[OK] admin密码已重置为: {new_password}")
    print(f"[OK] 新哈希: {new_hash[:50]}...")
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print("完成")
    print("=" * 70)

if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
创建测试用户test/test123
"""
import pymysql
import hashlib
import secrets
import os
from dotenv import load_dotenv

load_dotenv()

MYSQL_HOST = os.getenv('MYSQL_HOST', '10.8.6.45')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 13306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '4BTFesFsCtjAWX5D')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'ai_novel_generator')

def hash_password_pbkdf2(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_value = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000, 64)
    hash_hex = hash_value.hex()
    return f"{salt}:{hash_hex}"

conn = pymysql.connect(
    host=MYSQL_HOST,
    port=MYSQL_PORT,
    user=MYSQL_USER,
    password=MYSQL_PASSWORD,
    database=MYSQL_DATABASE
)

cursor = conn.cursor()

# 删除旧的test用户
cursor.execute("DELETE FROM users WHERE username = 'test'")

# 创建新的test用户
password_hash = hash_password_pbkdf2('test123')
cursor.execute("""
    INSERT INTO users (username, password_hash, email, role, name, login_method)
    VALUES ('test', %s, 'test@example.com', 'user', 'Test User', 'local')
""", (password_hash,))

conn.commit()

print("✓ 测试用户创建成功")
print("  用户名: test")
print("  密码: test123")

cursor.close()
conn.close()


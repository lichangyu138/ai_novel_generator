#!/usr/bin/env python3
"""
查询admin用户信息
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
cursor.execute("SELECT id, username, password_hash, email, role, name FROM users WHERE username = 'admin'")
result = cursor.fetchone()

if result:
    print("Admin用户信息:")
    print(f"  ID: {result[0]}")
    print(f"  Username: {result[1]}")
    print(f"  Password Hash: {result[2][:50]}...")
    print(f"  Email: {result[3]}")
    print(f"  Role: {result[4]}")
    print(f"  Name: {result[5]}")
else:
    print("Admin用户不存在")

cursor.close()
conn.close()


#!/usr/bin/env python3
"""
检查 embedding 配置
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
        # 检查是否有 embedding_model_configs 表
        cursor.execute("SHOW TABLES LIKE 'embedding_model_configs'")
        if cursor.fetchone():
            cursor.execute("SELECT * FROM embedding_model_configs WHERE is_default = 1 AND is_active = 1")
            configs = cursor.fetchall()
            
            if configs:
                print("找到默认 embedding 配置:")
                for config in configs:
                    print(config)
            else:
                print("没有找到默认的 embedding 配置")
        else:
            print("embedding_model_configs 表不存在")
        
finally:
    conn.close()


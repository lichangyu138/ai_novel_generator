#!/usr/bin/env python3
"""
将数据库中的密码哈希从 bcrypt 转换为 Node.js 后端期望的 pbkdf2 格式
"""
import pymysql
import hashlib
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
    import secrets
    salt = secrets.token_hex(16)  # 32 字符的十六进制字符串
    hash_value = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000, 64)
    hash_hex = hash_value.hex()
    return f"{salt}:{hash_hex}"

def fix_passwords():
    """修复所有用户的密码哈希格式"""
    print("=" * 70)
    print("修复密码哈希格式（bcrypt -> pbkdf2）")
    print("=" * 70)
    print()
    
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
        print("[OK] 数据库连接成功")
        print()
    except Exception as e:
        print(f"[ERROR] 数据库连接失败: {e}")
        return
    
    # 获取所有用户
    cursor.execute("SELECT id, username, password_hash FROM users")
    users = cursor.fetchall()
    
    print(f"找到 {len(users)} 个用户")
    print()
    
    # 默认密码映射
    default_passwords = {
        'admin': 'admin123',
        'ai': 'admin123',  # 如果存在 ai 用户
    }
    
    fixed_count = 0
    for user_id, username, password_hash in users:
        print(f"处理用户: {username} (ID: {user_id})")
        
        # 检查密码哈希格式
        if password_hash and ':' in password_hash and len(password_hash.split(':')) == 2:
            # 已经是 pbkdf2 格式
            salt, hash_part = password_hash.split(':')
            if len(salt) == 32 and len(hash_part) == 128:  # pbkdf2 格式
                print(f"  [SKIP] 密码哈希已经是 pbkdf2 格式")
                continue
        
        # 需要重新设置密码
        if username in default_passwords:
            new_password = default_passwords[username]
        else:
            # 对于其他用户，使用默认密码
            new_password = 'admin123'
            print(f"  [WARN] 用户 {username} 没有预设密码，将设置为 admin123")
        
        # 生成新的 pbkdf2 哈希
        new_hash = hash_password_pbkdf2(new_password)
        
        # 更新数据库
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (new_hash, user_id)
        )
        conn.commit()
        
        print(f"  [OK] 密码已重置为: {new_password}")
        print(f"  新哈希: {new_hash[:50]}...")
        fixed_count += 1
        print()
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print(f"修复完成！共修复 {fixed_count} 个用户")
    print("=" * 70)
    print()
    print("现在可以使用以下账户登录:")
    print("  用户名: admin")
    print("  密码: admin123")
    print()

if __name__ == "__main__":
    fix_passwords()


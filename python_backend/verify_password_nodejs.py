#!/usr/bin/env python3
"""
验证密码哈希格式是否符合 Node.js 后端的要求
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

def verify_password_pbkdf2(password: str, stored_hash: str) -> bool:
    """验证密码（与 Node.js 后端一致）"""
    try:
        parts = stored_hash.split(':')
        if len(parts) != 2:
            return False
        salt, hash_part = parts
        
        # 使用相同的参数：pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        verify_hash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000, 64)
        verify_hash_hex = verify_hash.hex()
        
        return verify_hash_hex == hash_part
    except Exception as e:
        print(f"验证出错: {e}")
        return False

def test_passwords():
    """测试所有用户的密码"""
    print("=" * 70)
    print("验证密码哈希格式")
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
    
    test_passwords_list = {
        'admin': 'admin123',
        'ai': 'admin123',
    }
    
    for user_id, username, password_hash in users:
        print(f"用户: {username} (ID: {user_id})")
        print(f"密码哈希: {password_hash[:60]}..." if password_hash else "密码哈希: None")
        
        if not password_hash:
            print("  [ERROR] 密码哈希为空")
            continue
        
        # 检查格式
        if ':' not in password_hash:
            print("  [ERROR] 密码哈希格式错误（缺少冒号）")
            continue
        
        parts = password_hash.split(':')
        if len(parts) != 2:
            print(f"  [ERROR] 密码哈希格式错误（分割后不是2部分）")
            continue
        
        salt, hash_part = parts
        print(f"  Salt长度: {len(salt)}")
        print(f"  Hash长度: {len(hash_part)}")
        
        # 验证格式
        if len(salt) != 32:
            print(f"  [WARN] Salt长度应该是32，实际是{len(salt)}")
        if len(hash_part) != 128:
            print(f"  [WARN] Hash长度应该是128，实际是{len(hash_part)}")
        
        # 测试密码验证
        test_password = test_passwords_list.get(username, 'admin123')
        is_valid = verify_password_pbkdf2(test_password, password_hash)
        
        if is_valid:
            print(f"  [OK] 密码验证成功 (密码: {test_password})")
        else:
            print(f"  [ERROR] 密码验证失败 (测试密码: {test_password})")
            print(f"  正在重新生成密码哈希...")
            
            # 重新生成
            import secrets
            new_salt = secrets.token_hex(16)
            new_hash = hashlib.pbkdf2_hmac('sha512', test_password.encode('utf-8'), new_salt.encode('utf-8'), 1000, 64)
            new_hash_hex = new_hash.hex()
            new_stored_hash = f"{new_salt}:{new_hash_hex}"
            
            # 验证新哈希
            if verify_password_pbkdf2(test_password, new_stored_hash):
                print(f"  [OK] 新哈希验证成功")
                # 更新数据库
                cursor.execute(
                    "UPDATE users SET password_hash = %s WHERE id = %s",
                    (new_stored_hash, user_id)
                )
                conn.commit()
                print(f"  [OK] 数据库已更新")
            else:
                print(f"  [ERROR] 新哈希验证失败")
        
        print()
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print("验证完成")
    print("=" * 70)

if __name__ == "__main__":
    test_passwords()


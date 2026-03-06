#!/usr/bin/env python3
"""
全面调试登录问题
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
            print(f"  [ERROR] 哈希格式错误: 分割后不是2部分")
            return False
        salt, hash_part = parts
        
        # 使用相同的参数：pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        verify_hash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 1000, 64)
        verify_hash_hex = verify_hash.hex()
        
        return verify_hash_hex == hash_part
    except Exception as e:
        print(f"  [ERROR] 验证出错: {e}")
        return False

def debug_login():
    """全面调试登录问题"""
    print("=" * 70)
    print("全面调试登录问题")
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
    
    # 1. 检查用户是否存在
    print("1. 检查用户 'admin' 是否存在...")
    cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = 'admin'")
    user = cursor.fetchone()
    
    if not user:
        print("  [ERROR] 用户 'admin' 不存在")
        cursor.close()
        conn.close()
        return
    
    user_id, username, password_hash, role = user
    print(f"  [OK] 用户存在")
    print(f"  ID: {user_id}")
    print(f"  用户名: {username}")
    print(f"  角色: {role}")
    print(f"  密码哈希: {password_hash[:50]}..." if password_hash else "  [ERROR] 密码哈希为空")
    print()
    
    # 2. 检查密码哈希格式
    print("2. 检查密码哈希格式...")
    if not password_hash:
        print("  [ERROR] 密码哈希为空")
        cursor.close()
        conn.close()
        return
    
    if ':' not in password_hash:
        print("  [ERROR] 密码哈希格式错误（缺少冒号分隔符）")
        cursor.close()
        conn.close()
        return
    
    parts = password_hash.split(':')
    if len(parts) != 2:
        print(f"  [ERROR] 密码哈希格式错误（分割后不是2部分，实际是{len(parts)}部分）")
        cursor.close()
        conn.close()
        return
    
    salt, hash_part = parts
    print(f"  Salt: {salt} (长度: {len(salt)})")
    print(f"  Hash: {hash_part[:50]}... (长度: {len(hash_part)})")
    
    if len(salt) != 32:
        print(f"  [WARN] Salt长度应该是32，实际是{len(salt)}")
    if len(hash_part) != 128:
        print(f"  [WARN] Hash长度应该是128，实际是{len(hash_part)}")
    print()
    
    # 3. 测试密码验证
    print("3. 测试密码验证...")
    test_password = "admin123"
    print(f"  测试密码: {test_password}")
    
    is_valid = verify_password_pbkdf2(test_password, password_hash)
    
    if is_valid:
        print("  [OK] 密码验证成功")
    else:
        print("  [ERROR] 密码验证失败")
        print("  正在重新生成密码哈希...")
        
        # 重新生成
        import secrets
        new_salt = secrets.token_hex(16)
        new_hash = hashlib.pbkdf2_hmac('sha512', test_password.encode('utf-8'), new_salt.encode('utf-8'), 1000, 64)
        new_hash_hex = new_hash.hex()
        new_stored_hash = f"{new_salt}:{new_hash_hex}"
        
        print(f"  新Salt: {new_salt} (长度: {len(new_salt)})")
        print(f"  新Hash: {new_hash_hex[:50]}... (长度: {len(new_hash_hex)})")
        
        # 验证新哈希
        if verify_password_pbkdf2(test_password, new_stored_hash):
            print("  [OK] 新哈希验证成功")
            # 更新数据库
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (new_stored_hash, user_id)
            )
            conn.commit()
            print("  [OK] 数据库已更新")
        else:
            print("  [ERROR] 新哈希验证失败")
    print()
    
    # 4. 检查所有字段名
    print("4. 检查 users 表的所有字段名...")
    cursor.execute("DESCRIBE users")
    columns = cursor.fetchall()
    print("  数据库字段名:")
    for col in columns:
        print(f"    - {col[0]} ({col[1]})")
    print()
    
    # 5. 模拟 Node.js 后端的查询
    print("5. 模拟 Node.js 后端的查询...")
    print("  查询: SELECT * FROM users WHERE username = 'admin'")
    cursor.execute("SELECT * FROM users WHERE username = 'admin'")
    all_cols = cursor.fetchone()
    
    # 获取列名
    cursor.execute("SHOW COLUMNS FROM users")
    col_names = [col[0] for col in cursor.fetchall()]
    
    print("  查询结果:")
    for i, col_name in enumerate(col_names):
        if i < len(all_cols):
            value = all_cols[i]
            if col_name == 'password_hash':
                print(f"    {col_name}: {str(value)[:50]}... (长度: {len(str(value))})")
            else:
                print(f"    {col_name}: {value}")
    print()
    
    # 6. 检查 Drizzle 可能使用的字段名
    print("6. 检查可能的字段名映射问题...")
    print("  Drizzle schema 使用: passwordHash")
    print("  数据库字段名: password_hash")
    print("  需要确保 Drizzle 配置正确映射")
    print()
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print("调试完成")
    print("=" * 70)
    print()
    print("建议:")
    print("1. 确保 Node.js 后端已重启")
    print("2. 检查 Drizzle schema 字段映射是否正确")
    print("3. 检查 Node.js 后端的数据库连接配置")
    print()

if __name__ == "__main__":
    debug_login()


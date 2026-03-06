#!/usr/bin/env python3
"""
检查数据库表结构和数据
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.mysql import SessionLocal, engine
from app.models.database import User
from app.services.auth import verify_password, get_password_hash
from sqlalchemy import inspect, text

def check_database():
    """检查数据库"""
    print("=" * 50)
    print("检查数据库表结构和数据")
    print("=" * 50)
    print()
    
    # 检查表结构
    print("1. 检查表结构...")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"   找到 {len(tables)} 个表: {', '.join(tables)}")
    print()
    
    # 检查 users 表结构
    if 'users' in tables:
        print("2. 检查 users 表结构...")
        columns = inspector.get_columns('users')
        column_names = [col['name'] for col in columns]
        print(f"   字段: {', '.join(column_names)}")
        
        # 检查关键字段
        required_fields = ['id', 'username', 'email', 'password_hash', 'role', 'is_active']
        missing_fields = [f for f in required_fields if f not in column_names]
        if missing_fields:
            print(f"   [WARN] 缺少字段: {', '.join(missing_fields)}")
        else:
            print("   [OK] 所有必需字段都存在")
        print()
    
    # 检查用户数据
    db = SessionLocal()
    try:
        print("3. 检查用户数据...")
        users = db.query(User).all()
        print(f"   共有 {len(users)} 个用户")
        
        for user in users:
            print(f"   - ID: {user.id}, 用户名: {user.username}, 邮箱: {user.email}, 角色: {user.role}")
        
        # 检查管理员账户
        admin = db.query(User).filter(User.username == 'admin').first()
        if admin:
            print()
            print("4. 检查管理员账户...")
            print(f"   [OK] 管理员账户存在")
            print(f"   用户名: {admin.username}")
            print(f"   邮箱: {admin.email}")
            print(f"   角色: {admin.role}")
            print(f"   是否激活: {admin.is_active}")
            
            # 测试密码
            test_password = "admin123"
            if hasattr(admin, 'password_hash') and admin.password_hash:
                # 尝试验证密码
                try:
                    is_valid = verify_password(test_password, admin.password_hash)
                    if is_valid:
                        print(f"   [OK] 密码验证成功 (admin123)")
                    else:
                        print(f"   [WARN] 密码验证失败，可能需要重置密码")
                except Exception as e:
                    print(f"   [ERROR] 密码验证出错: {e}")
            else:
                print(f"   [WARN] 密码哈希为空，需要设置密码")
        else:
            print()
            print("4. 检查管理员账户...")
            print("   [WARN] 管理员账户不存在")
            print("   正在创建管理员账户...")
            
            try:
                from app.services.auth import register_user
                from app.models.database import UserRole
                
                admin = register_user(
                    db=db,
                    username='admin',
                    email='admin@example.com',
                    password='admin123',
                    role=UserRole.ADMIN
                )
                print(f"   [OK] 管理员账户创建成功")
            except Exception as e:
                print(f"   [ERROR] 创建管理员账户失败: {e}")
        
    finally:
        db.close()
    
    print()
    print("=" * 50)
    print("检查完成")
    print("=" * 50)

if __name__ == "__main__":
    check_database()


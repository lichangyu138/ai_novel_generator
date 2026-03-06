#!/usr/bin/env python3
"""
数据库初始化脚本
用于创建数据库表和初始数据
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# 加载环境变量
env_file = project_root / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    # 如果没有.env文件，尝试加载生产环境配置
    prod_env = project_root / "env.production"
    if prod_env.exists():
        load_dotenv(prod_env)

from sqlalchemy import create_engine, text
from app.models.database import Base
from app.config.settings import get_settings

settings = get_settings()


def init_mysql_database():
    """初始化MySQL数据库"""
    print("=" * 50)
    print("AI小说生成系统 - 数据库初始化")
    print("=" * 50)
    print()
    
    print(f"MySQL配置:")
    print(f"  主机: {settings.MYSQL_HOST}:{settings.MYSQL_PORT}")
    print(f"  用户: {settings.MYSQL_USER}")
    print(f"  数据库: {settings.MYSQL_DATABASE}")
    print()
    
    try:
        # 创建引擎（不指定数据库，用于创建数据库）
        admin_engine = create_engine(
            f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/",
            pool_pre_ping=True
        )
        
        # 创建数据库（如果不存在）
        with admin_engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
        
        print("[OK] 数据库创建成功")
        
        # 创建应用引擎（连接到指定数据库）
        engine = create_engine(
            settings.MYSQL_URL,
            pool_pre_ping=True
        )
        
        # 创建所有表
        print("正在创建数据库表...")
        Base.metadata.create_all(bind=engine)
        print("[OK] 数据库表创建完成")
        print()
        
        # 创建默认管理员账户
        from app.services.auth import get_password_hash
        from app.models.database import User
        from app.db.mysql import SessionLocal
        
        db = SessionLocal()
        try:
            # 检查是否已存在管理员
            admin = db.query(User).filter(User.username == "admin").first()
            if admin:
                print(f"[INFO] 管理员用户已存在: {admin.username}")
            else:
                # 创建管理员用户
                admin_user = User(
                    username="admin",
                    email="admin@example.com",
                    password_hash=get_password_hash("admin123"),
                    role="admin",
                    is_active=True
                )
                db.add(admin_user)
                db.commit()
                print("[OK] 管理员用户创建成功")
                print("  用户名: admin")
                print("  密码: admin123")
                print("  请登录后立即修改密码！")
        finally:
            db.close()
        
        print()
        print("=" * 50)
        print("MySQL数据库初始化完成！")
        print("=" * 50)
        return True
        
    except Exception as e:
        print(f"[ERROR] MySQL数据库初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def init_neo4j():
    """初始化Neo4j约束和索引"""
    try:
        from app.db.neo4j import neo4j_client
        
        print("初始化Neo4j知识图谱...")
        print(f"  URI: {settings.NEO4J_URI}")
        print(f"  用户: {settings.NEO4J_USER}")
        print()
        
        neo4j_client.connect()
        neo4j_client.init_constraints()
        print("[OK] Neo4j知识图谱初始化完成")
        print()
        return True
    except Exception as e:
        print(f"[WARN] Neo4j初始化跳过（可选功能）: {e}")
        print()
        return False


def init_milvus():
    """初始化Milvus集合"""
    try:
        from app.db.milvus import milvus_client
        
        print("初始化Milvus向量数据库...")
        print(f"  主机: {settings.MILVUS_HOST}:{settings.MILVUS_PORT}")
        print()
        
        milvus_client.connect()
        milvus_client.init_collection()
        print("[OK] Milvus向量数据库初始化完成")
        print()
        return True
    except Exception as e:
        print(f"[WARN] Milvus初始化跳过（可选功能）: {e}")
        print()
        return False


if __name__ == "__main__":
    success = True
    
    # 初始化MySQL
    if not init_mysql_database():
        success = False
    
    # 初始化Neo4j（可选）
    init_neo4j()
    
    # 初始化Milvus（可选）
    init_milvus()
    
    if success:
        print("=" * 50)
        print("数据库初始化完成！")
        print("=" * 50)
        print("默认管理员账户: admin / admin123")
        print()
    else:
        print("=" * 50)
        print("数据库初始化失败，请检查错误信息")
        print("=" * 50)
        sys.exit(1)


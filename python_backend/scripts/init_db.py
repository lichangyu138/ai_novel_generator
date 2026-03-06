#!/usr/bin/env python3
"""
数据库初始化脚本
用于创建数据库表和初始数据
"""
import asyncio
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.mysql import engine, async_session
from app.models.database import Base
from app.services.auth import get_password_hash


async def init_database():
    """初始化数据库表"""
    print("正在创建数据库表...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("数据库表创建完成！")


async def create_admin_user():
    """创建管理员用户"""
    from app.models.database import User
    from sqlalchemy import select
    
    async with async_session() as session:
        # 检查是否已存在管理员
        result = await session.execute(
            select(User).where(User.role == "admin")
        )
        admin = result.scalar_one_or_none()
        
        if admin:
            print(f"管理员用户已存在: {admin.username}")
            return
        
        # 创建管理员用户
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        session.add(admin_user)
        await session.commit()
        
        print("管理员用户创建成功！")
        print("用户名: admin")
        print("密码: admin123")
        print("请登录后立即修改密码！")


async def init_milvus():
    """初始化Milvus集合"""
    try:
        from app.db.milvus import MilvusClient
        
        print("正在初始化Milvus集合...")
        client = MilvusClient()
        await client.init_collections()
        print("Milvus集合初始化完成！")
    except Exception as e:
        print(f"Milvus初始化跳过（可选功能）: {e}")


async def init_neo4j():
    """初始化Neo4j约束和索引"""
    try:
        from app.db.neo4j import Neo4jClient
        
        print("正在初始化Neo4j约束和索引...")
        client = Neo4jClient()
        await client.init_constraints()
        print("Neo4j初始化完成！")
    except Exception as e:
        print(f"Neo4j初始化跳过（可选功能）: {e}")


async def main():
    """主函数"""
    print("=" * 50)
    print("AI小说生成系统 - 数据库初始化")
    print("=" * 50)
    print()
    
    # 初始化MySQL
    await init_database()
    print()
    
    # 创建管理员用户
    await create_admin_user()
    print()
    
    # 初始化Milvus（可选）
    await init_milvus()
    print()
    
    # 初始化Neo4j（可选）
    await init_neo4j()
    print()
    
    print("=" * 50)
    print("初始化完成！")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())

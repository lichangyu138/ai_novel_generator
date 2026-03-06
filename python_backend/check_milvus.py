#!/usr/bin/env python3
"""
检查Milvus连接
"""
from pymilvus import connections, utility
import os
from dotenv import load_dotenv

load_dotenv()

MILVUS_HOST = os.getenv('MILVUS_HOST', '10.8.6.45')
MILVUS_PORT = int(os.getenv('MILVUS_PORT', 19530))

try:
    print(f"连接Milvus: {MILVUS_HOST}:{MILVUS_PORT}")
    connections.connect(
        alias="default",
        host=MILVUS_HOST,
        port=MILVUS_PORT
    )
    print("✓ Milvus连接成功")
    
    # 列出所有集合
    collections = utility.list_collections()
    print(f"\n集合列表: {collections}")
    
    if 'novel_knowledge_base' in collections:
        from pymilvus import Collection
        col = Collection('novel_knowledge_base')
        print(f"\nnovel_knowledge_base 集合:")
        print(f"  实体数量: {col.num_entities}")
    
    connections.disconnect("default")
except Exception as e:
    print(f"✗ 连接失败: {e}")


#!/usr/bin/env python3
"""
幻写次元 - AI小说生成系统
Milvus向量库初始化脚本

功能：
1. 创建小说知识库集合
2. 创建索引
3. 提供向量操作工具函数

使用方法：
    python init_milvus.py

依赖：
    pip install pymilvus
"""

import os
import sys
from typing import List, Dict, Any, Optional

try:
    from pymilvus import (
        connections,
        Collection,
        CollectionSchema,
        FieldSchema,
        DataType,
        utility,
    )
except ImportError:
    print("请先安装pymilvus: pip install pymilvus")
    sys.exit(1)


# ============================================
# 配置
# ============================================
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")
MILVUS_USER = os.getenv("MILVUS_USER", "")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD", "")

# 向量维度（根据使用的Embedding模型调整）
# OpenAI text-embedding-ada-002: 1536
# OpenAI text-embedding-3-small: 1536
# OpenAI text-embedding-3-large: 3072
# 智谱 embedding-2: 1024
EMBEDDING_DIM = 1536

# 集合名称
COLLECTION_NAME = "novel_knowledge"


def connect_milvus():
    """连接到Milvus服务器"""
    print(f"正在连接Milvus服务器 {MILVUS_HOST}:{MILVUS_PORT}...")
    
    try:
        if MILVUS_USER and MILVUS_PASSWORD:
            connections.connect(
                alias="default",
                host=MILVUS_HOST,
                port=MILVUS_PORT,
                user=MILVUS_USER,
                password=MILVUS_PASSWORD,
            )
        else:
            connections.connect(
                alias="default",
                host=MILVUS_HOST,
                port=MILVUS_PORT,
            )
        print("✓ Milvus连接成功")
        return True
    except Exception as e:
        print(f"✗ Milvus连接失败: {e}")
        return False


def create_collection():
    """创建小说知识库集合"""
    
    # 检查集合是否已存在
    if utility.has_collection(COLLECTION_NAME):
        print(f"集合 {COLLECTION_NAME} 已存在")
        collection = Collection(COLLECTION_NAME)
        print(f"  - 实体数量: {collection.num_entities}")
        return collection
    
    print(f"正在创建集合 {COLLECTION_NAME}...")
    
    # 定义字段
    fields = [
        # 主键ID
        FieldSchema(
            name="id",
            dtype=DataType.INT64,
            is_primary=True,
            auto_id=True,
            description="自增主键ID"
        ),
        # 用户ID（用于数据隔离）
        FieldSchema(
            name="user_id",
            dtype=DataType.INT64,
            description="所属用户ID"
        ),
        # 小说ID
        FieldSchema(
            name="novel_id",
            dtype=DataType.INT64,
            description="所属小说ID"
        ),
        # 知识类型
        FieldSchema(
            name="knowledge_type",
            dtype=DataType.VARCHAR,
            max_length=50,
            description="知识类型: character/plot/setting/chapter/custom"
        ),
        # 来源ID
        FieldSchema(
            name="source_id",
            dtype=DataType.INT64,
            description="来源ID（如章节ID、人物ID等）"
        ),
        # 标题/摘要
        FieldSchema(
            name="title",
            dtype=DataType.VARCHAR,
            max_length=500,
            description="标题或摘要"
        ),
        # 原始文本内容
        FieldSchema(
            name="content",
            dtype=DataType.VARCHAR,
            max_length=65535,
            description="原始文本内容"
        ),
        # 章节号（可选）
        FieldSchema(
            name="chapter_number",
            dtype=DataType.INT64,
            description="章节号（如果适用）"
        ),
        # 向量嵌入
        FieldSchema(
            name="embedding",
            dtype=DataType.FLOAT_VECTOR,
            dim=EMBEDDING_DIM,
            description="文本向量嵌入"
        ),
    ]
    
    # 创建Schema
    schema = CollectionSchema(
        fields=fields,
        description="小说知识库向量集合，用于RAG检索"
    )
    
    # 创建集合
    collection = Collection(
        name=COLLECTION_NAME,
        schema=schema,
        using="default"
    )
    
    print(f"✓ 集合 {COLLECTION_NAME} 创建成功")
    return collection


def create_index(collection: Collection):
    """创建向量索引"""
    
    print("正在创建向量索引...")
    
    # 检查是否已有索引
    if collection.has_index():
        print("  - 索引已存在，跳过创建")
        return
    
    # 创建IVF_FLAT索引（适合中等规模数据）
    # 其他选项：IVF_SQ8, IVF_PQ, HNSW, ANNOY
    index_params = {
        "metric_type": "COSINE",  # 使用余弦相似度
        "index_type": "IVF_FLAT",
        "params": {"nlist": 128}  # 聚类中心数量
    }
    
    collection.create_index(
        field_name="embedding",
        index_params=index_params
    )
    
    print("✓ 向量索引创建成功")
    print(f"  - 索引类型: {index_params['index_type']}")
    print(f"  - 相似度度量: {index_params['metric_type']}")


def create_scalar_index(collection: Collection):
    """创建标量字段索引"""
    
    print("正在创建标量索引...")
    
    # 为user_id创建索引（用于数据隔离过滤）
    collection.create_index(
        field_name="user_id",
        index_name="idx_user_id"
    )
    
    # 为novel_id创建索引
    collection.create_index(
        field_name="novel_id",
        index_name="idx_novel_id"
    )
    
    # 为knowledge_type创建索引
    collection.create_index(
        field_name="knowledge_type",
        index_name="idx_knowledge_type"
    )
    
    print("✓ 标量索引创建成功")


def load_collection(collection: Collection):
    """加载集合到内存"""
    
    print("正在加载集合到内存...")
    collection.load()
    print("✓ 集合加载成功")


def insert_test_data(collection: Collection):
    """插入测试数据"""
    
    print("正在插入测试数据...")
    
    import random
    
    # 生成测试数据
    test_data = [
        {
            "user_id": 1,
            "novel_id": 1,
            "knowledge_type": "character",
            "source_id": 1,
            "title": "主角 - 李云飞",
            "content": "李云飞，男，二十岁，青云宗外门弟子。性格正直勇敢，为人仗义。身世坎坷，父母早亡，被青云宗长老收养。拥有罕见的五行灵根，修炼天赋极高。",
            "chapter_number": 0,
            "embedding": [random.random() for _ in range(EMBEDDING_DIM)]
        },
        {
            "user_id": 1,
            "novel_id": 1,
            "knowledge_type": "character",
            "source_id": 2,
            "title": "女主 - 苏婉儿",
            "content": "苏婉儿，女，十八岁，青云宗内门弟子。温柔聪慧，精通炼丹术。是宗门长老的亲传弟子，与主角在一次意外中相识。",
            "chapter_number": 0,
            "embedding": [random.random() for _ in range(EMBEDDING_DIM)]
        },
        {
            "user_id": 1,
            "novel_id": 1,
            "knowledge_type": "setting",
            "source_id": 0,
            "title": "青云宗",
            "content": "青云宗是东域三大宗门之一，位于青云山脉。宗门历史悠久，传承三千年，以剑道闻名天下。宗门分为外门、内门、核心弟子三个层级。",
            "chapter_number": 0,
            "embedding": [random.random() for _ in range(EMBEDDING_DIM)]
        },
        {
            "user_id": 1,
            "novel_id": 1,
            "knowledge_type": "chapter",
            "source_id": 1,
            "title": "第一章 - 命运的开始",
            "content": "清晨的阳光洒在青云山上，李云飞像往常一样早起修炼。今天是宗门大比的日子，他要证明自己的实力...",
            "chapter_number": 1,
            "embedding": [random.random() for _ in range(EMBEDDING_DIM)]
        },
        {
            "user_id": 1,
            "novel_id": 1,
            "knowledge_type": "plot",
            "source_id": 0,
            "title": "主线剧情 - 复仇之路",
            "content": "主角发现父母之死另有隐情，幕后黑手是魔道势力。为了查明真相，主角踏上了修炼和复仇的道路。",
            "chapter_number": 0,
            "embedding": [random.random() for _ in range(EMBEDDING_DIM)]
        },
    ]
    
    # 准备插入数据
    entities = [
        [d["user_id"] for d in test_data],
        [d["novel_id"] for d in test_data],
        [d["knowledge_type"] for d in test_data],
        [d["source_id"] for d in test_data],
        [d["title"] for d in test_data],
        [d["content"] for d in test_data],
        [d["chapter_number"] for d in test_data],
        [d["embedding"] for d in test_data],
    ]
    
    # 插入数据
    collection.insert(entities)
    collection.flush()
    
    print(f"✓ 测试数据插入成功，共 {len(test_data)} 条")


def search_example(collection: Collection):
    """搜索示例"""
    
    print("\n执行搜索示例...")
    
    import random
    
    # 生成随机查询向量（实际使用时应该用Embedding模型生成）
    query_vector = [[random.random() for _ in range(EMBEDDING_DIM)]]
    
    # 搜索参数
    search_params = {
        "metric_type": "COSINE",
        "params": {"nprobe": 10}
    }
    
    # 执行搜索
    results = collection.search(
        data=query_vector,
        anns_field="embedding",
        param=search_params,
        limit=3,
        expr="user_id == 1 and novel_id == 1",  # 数据隔离过滤
        output_fields=["title", "content", "knowledge_type"]
    )
    
    print("搜索结果:")
    for hits in results:
        for hit in hits:
            print(f"  - ID: {hit.id}, 相似度: {hit.score:.4f}")
            print(f"    标题: {hit.entity.get('title')}")
            print(f"    类型: {hit.entity.get('knowledge_type')}")
            print()


def print_collection_info(collection: Collection):
    """打印集合信息"""
    
    print("\n集合信息:")
    print(f"  - 名称: {collection.name}")
    print(f"  - 描述: {collection.description}")
    print(f"  - 实体数量: {collection.num_entities}")
    print(f"  - 字段:")
    for field in collection.schema.fields:
        print(f"    - {field.name}: {field.dtype}")


def main():
    """主函数"""
    
    print("=" * 50)
    print("幻写次元 - Milvus向量库初始化")
    print("=" * 50)
    print()
    
    # 连接Milvus
    if not connect_milvus():
        print("\n请确保Milvus服务已启动")
        print("启动命令: docker-compose up -d milvus")
        sys.exit(1)
    
    # 创建集合
    collection = create_collection()
    
    # 创建索引
    create_index(collection)
    create_scalar_index(collection)
    
    # 加载集合
    load_collection(collection)
    
    # 插入测试数据
    insert_test_data(collection)
    
    # 打印集合信息
    print_collection_info(collection)
    
    # 搜索示例
    search_example(collection)
    
    print("\n" + "=" * 50)
    print("✓ Milvus向量库初始化完成！")
    print("=" * 50)


if __name__ == "__main__":
    main()

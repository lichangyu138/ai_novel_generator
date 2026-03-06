#!/usr/bin/env python3
"""
重新初始化 Milvus 集合（使用 1024 维度）
"""
from pymilvus import connections, utility, Collection, FieldSchema, CollectionSchema, DataType
import os
from dotenv import load_dotenv

load_dotenv()

MILVUS_HOST = os.getenv('MILVUS_HOST', 'localhost')
MILVUS_PORT = int(os.getenv('MILVUS_PORT', 19530))
COLLECTION_NAME = 'novel_knowledge_base'
EMBEDDING_DIM = 1024  # bge-large:335m 维度

print(f"连接 Milvus: {MILVUS_HOST}:{MILVUS_PORT}")
connections.connect(host=MILVUS_HOST, port=MILVUS_PORT)

# 删除旧集合
if utility.has_collection(COLLECTION_NAME):
    print(f"删除旧集合: {COLLECTION_NAME}")
    utility.drop_collection(COLLECTION_NAME)

# 创建新集合
print(f"创建新集合（维度: {EMBEDDING_DIM}）")
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="user_id", dtype=DataType.INT64),
    FieldSchema(name="novel_id", dtype=DataType.INT64),
    FieldSchema(name="entry_type", dtype=DataType.VARCHAR, max_length=64),
    FieldSchema(name="source_id", dtype=DataType.INT64),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM)
]

schema = CollectionSchema(fields, description="Novel knowledge base")
collection = Collection(COLLECTION_NAME, schema)

# 创建索引
index_params = {
    "metric_type": "L2",
    "index_type": "IVF_FLAT",
    "params": {"nlist": 128}
}
collection.create_index("embedding", index_params)
collection.load()

print(f"✓ 集合创建成功！维度: {EMBEDDING_DIM}")
connections.disconnect("default")


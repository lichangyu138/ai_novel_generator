"""
向量同步API - 将世界观数据同步到Milvus
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List
import hashlib
from datetime import datetime

from app.db.mysql import get_db
from app.db.milvus import get_milvus_client
from app.services.langchain.embedding_service import get_embedding_service
from app.models.database import User
from app.services.auth import get_current_active_user

router = APIRouter(prefix="/vector", tags=["Vector"])

class SyncItem(BaseModel):
    source_type: str  # character, location, item, organization
    source_id: int
    name: str
    content: str

class SyncRequest(BaseModel):
    novel_id: int
    items: List[SyncItem]

class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    total: int
    deleted_count: int = 0
    updated_count: int = 0

class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    total: int
    synced: int
    need_sync: int
    items: List[dict]

def calculate_content_hash(content: str) -> str:
    """计算内容哈希"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def get_table_name(source_type: str) -> str:
    """获取表名"""
    table_map = {
        "character": "characters",
        "location": "worldbuilding_locations",
        "item": "worldbuilding_items",
        "organization": "worldbuilding_organizations"
    }
    return table_map.get(source_type, "")

@router.get("/sync/status/{novel_id}", response_model=SyncStatusResponse)
async def get_sync_status(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取向量同步状态"""
    items = []
    total = 0
    synced = 0

    # 检查各个表的同步状态
    for source_type in ["character", "location", "item", "organization"]:
        table_name = get_table_name(source_type)
        if not table_name:
            continue

        # 查询该类型的所有数据
        query = text(f"""
            SELECT id, name, vector_synced, vector_synced_at, content_hash
            FROM {table_name}
            WHERE novel_id = :novel_id AND user_id = :user_id
        """)

        result = db.execute(query, {"novel_id": novel_id, "user_id": current_user.id})
        rows = result.fetchall()

        for row in rows:
            total += 1
            is_synced = bool(row[2])  # vector_synced
            if is_synced:
                synced += 1

            items.append({
                "source_type": source_type,
                "source_id": row[0],
                "name": row[1],
                "synced": is_synced,
                "synced_at": row[3].isoformat() if row[3] else None,
                "content_hash": row[4]
            })

    return SyncStatusResponse(
        total=total,
        synced=synced,
        need_sync=total - synced,
        items=items
    )

@router.post("/sync", response_model=SyncResponse)
async def sync_to_milvus(
    request: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """同步数据到Milvus向量库（智能增量更新）"""
    milvus_client = get_milvus_client()
    embedding_service = get_embedding_service(refresh=True)

    synced_count = 0
    updated_count = 0
    skipped_count = 0
    entries_to_sync = []

    for item in request.items:
        try:
            # 计算内容哈希
            content_hash = calculate_content_hash(item.content)

            # 查询数据库中的同步状态
            table_name = get_table_name(item.source_type)
            if not table_name:
                continue

            query = text(f"""
                SELECT vector_id, content_hash, vector_synced
                FROM {table_name}
                WHERE id = :source_id AND user_id = :user_id
            """)
            result = db.execute(query, {
                "source_id": item.source_id,
                "user_id": current_user.id
            })
            row = result.fetchone()

            # 检查是否需要同步
            need_sync = False
            vector_id = None

            if row:
                vector_id = row[0]
                old_hash = row[1]
                is_synced = row[2]

                # 如果内容变更或未同步过，则需要同步
                # 如果 old_hash 为空，说明是旧数据，也需要同步
                if not is_synced or not old_hash or old_hash != content_hash:
                    need_sync = True
            else:
                # 新数据，需要同步
                need_sync = True

            if not need_sync:
                skipped_count += 1
                continue

            # 生成 embedding
            embedding = embedding_service.embed_text_sync(item.content)

            entries_to_sync.append({
                "entry_type": item.source_type,
                "source_id": item.source_id,
                "content": item.content,
                "embedding": embedding,
                "content_hash": content_hash,
                "vector_id": vector_id  # 如果有旧的 vector_id，用于更新
            })

        except Exception as e:
            print(f"Failed to process {item.source_type} {item.source_id}: {e}")

    # 批量同步到 Milvus
    if entries_to_sync:
        try:
            # 先删除旧数据（如果有 vector_id）
            for entry in entries_to_sync:
                if entry.get("vector_id"):
                    try:
                        collection = milvus_client.get_collection()
                        collection.delete(f"id == {entry['vector_id']}")
                    except Exception as e:
                        print(f"Failed to delete old vector {entry['vector_id']}: {e}")

            # 插入新数据
            result = milvus_client.insert_vectors(
                user_id=current_user.id,
                novel_id=request.novel_id,
                entries=entries_to_sync
            )

            # 更新数据库标记
            for i, entry in enumerate(entries_to_sync):
                if i < len(result):
                    vector_id = result[i]
                    table_name = get_table_name(entry["entry_type"])
                    if table_name:
                        update_query = text(f"""
                            UPDATE {table_name}
                            SET vector_id = :vector_id,
                                vector_synced = TRUE,
                                vector_synced_at = NOW(),
                                content_hash = :content_hash
                            WHERE id = :source_id AND user_id = :user_id
                        """)
                        db.execute(update_query, {
                            "vector_id": vector_id,
                            "content_hash": entry["content_hash"],
                            "source_id": entry["source_id"],
                            "user_id": current_user.id
                        })

            db.commit()
            synced_count = len(entries_to_sync)
            updated_count = len([e for e in entries_to_sync if e.get("vector_id")])

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Milvus同步失败: {str(e)}")

    return SyncResponse(
        success=True,
        synced_count=synced_count,
        total=len(request.items),
        deleted_count=skipped_count,  # 使用 deleted_count 字段传递跳过数量
        updated_count=updated_count
    )


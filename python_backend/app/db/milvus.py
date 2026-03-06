"""
Milvus Vector Database Connection and Operations
Data isolation: Each user's vectors are stored in separate partitions
"""
from pymilvus import (
    connections,
    Collection,
    FieldSchema,
    CollectionSchema,
    DataType,
    utility
)
from typing import List, Dict, Any, Optional
import logging

from app.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Collection name for novel knowledge base
COLLECTION_NAME = "novel_knowledge_base"
EMBEDDING_DIM = 1536  # OpenAI embedding dimension


class MilvusClient:
    """Milvus client with user/project data isolation"""
    
    def __init__(self):
        self._connected = False
    
    def connect(self):
        """Connect to Milvus server"""
        if self._connected:
            return
        
        try:
            connections.connect(
                alias="default",
                host=settings.MILVUS_HOST,
                port=settings.MILVUS_PORT,
                user=settings.MILVUS_USER if settings.MILVUS_USER else None,
                password=settings.MILVUS_PASSWORD if settings.MILVUS_PASSWORD else None
            )
            self._connected = True
            logger.info("Connected to Milvus successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Milvus: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from Milvus"""
        if self._connected:
            connections.disconnect("default")
            self._connected = False
    
    def init_collection(self):
        """Initialize the knowledge base collection"""
        self.connect()
        
        if utility.has_collection(COLLECTION_NAME):
            logger.info(f"Collection {COLLECTION_NAME} already exists")
            return Collection(COLLECTION_NAME)
        
        # Define schema
        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="user_id", dtype=DataType.INT64),
            FieldSchema(name="novel_id", dtype=DataType.INT64),
            FieldSchema(name="entry_type", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="source_id", dtype=DataType.INT64),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM)
        ]
        
        schema = CollectionSchema(
            fields=fields,
            description="Novel knowledge base for RAG"
        )
        
        collection = Collection(
            name=COLLECTION_NAME,
            schema=schema
        )
        
        # Create index for vector search
        index_params = {
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 1024}
        }
        collection.create_index(
            field_name="embedding",
            index_params=index_params
        )
        
        logger.info(f"Created collection {COLLECTION_NAME}")
        return collection
    
    def get_collection(self) -> Collection:
        """Get the knowledge base collection"""
        self.connect()
        return Collection(COLLECTION_NAME)
    
    def delete_by_source(
        self,
        user_id: int,
        novel_id: int,
        entry_type: str,
        source_id: int
    ) -> int:
        """
        Delete existing vectors by source

        Args:
            user_id: User ID
            novel_id: Novel project ID
            entry_type: Entry type (character, location, etc.)
            source_id: Source ID

        Returns:
            Number of deleted entities
        """
        collection = self.get_collection()

        # Build delete expression
        expr = f"user_id == {user_id} && novel_id == {novel_id} && entry_type == '{entry_type}' && source_id == {source_id}"

        try:
            result = collection.delete(expr)
            collection.flush()
            logger.info(f"Deleted vectors: {expr}")
            return 1  # Milvus doesn't return count, assume success
        except Exception as e:
            logger.warning(f"Failed to delete vectors: {e}")
            return 0

    def upsert_vectors(
        self,
        user_id: int,
        novel_id: int,
        entries: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """
        Upsert vectors with deduplication (delete old, insert new)

        Args:
            user_id: User ID for data isolation
            novel_id: Novel project ID
            entries: List of {entry_type, source_id, content, embedding}

        Returns:
            Dict with counts: {deleted: int, inserted: int}
        """
        collection = self.get_collection()

        deleted_count = 0
        inserted_count = 0

        # Group entries by (entry_type, source_id) for deduplication
        unique_entries = {}
        for entry in entries:
            key = (entry["entry_type"], entry["source_id"])
            unique_entries[key] = entry

        # Delete existing entries
        for (entry_type, source_id), entry in unique_entries.items():
            deleted_count += self.delete_by_source(
                user_id, novel_id, entry_type, source_id
            )

        # Insert new entries
        if unique_entries:
            entries_list = list(unique_entries.values())
            data = [
                [user_id] * len(entries_list),
                [novel_id] * len(entries_list),
                [e["entry_type"] for e in entries_list],
                [e["source_id"] for e in entries_list],
                [e["content"][:65535] for e in entries_list],
                [e["embedding"] for e in entries_list]
            ]

            result = collection.insert(data)
            collection.flush()
            inserted_count = len(result.primary_keys)

        logger.info(f"Upserted vectors: deleted={deleted_count}, inserted={inserted_count}")
        return {"deleted": deleted_count, "inserted": inserted_count}

    def insert_vectors(
        self,
        user_id: int,
        novel_id: int,
        entries: List[Dict[str, Any]]
    ) -> List[int]:
        """
        Insert vectors with user/project isolation (deprecated, use upsert_vectors)

        Args:
            user_id: User ID for data isolation
            novel_id: Novel project ID
            entries: List of {entry_type, source_id, content, embedding}

        Returns:
            List of inserted IDs
        """
        collection = self.get_collection()

        data = [
            [user_id] * len(entries),
            [novel_id] * len(entries),
            [e["entry_type"] for e in entries],
            [e["source_id"] for e in entries],
            [e["content"][:65535] for e in entries],
            [e["embedding"] for e in entries]
        ]

        result = collection.insert(data)
        collection.flush()

        return result.primary_keys
    
    def search_vectors(
        self,
        user_id: int,
        novel_id: int,
        query_embedding: List[float],
        entry_type: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search vectors with user/project isolation
        
        Args:
            user_id: User ID for data isolation
            novel_id: Novel project ID
            query_embedding: Query vector
            entry_type: Optional filter by entry type
            top_k: Number of results to return
        
        Returns:
            List of search results
        """
        collection = self.get_collection()
        collection.load()
        
        # Build filter expression for data isolation
        expr = f"user_id == {user_id} and novel_id == {novel_id}"
        if entry_type:
            expr += f' and entry_type == "{entry_type}"'
        
        search_params = {
            "metric_type": "L2",  # 改为 L2，与集合创建时一致
            "params": {"nprobe": 10}
        }
        
        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=["user_id", "novel_id", "entry_type", "source_id", "content"]
        )
        
        search_results = []
        for hits in results:
            for hit in hits:
                search_results.append({
                    "id": hit.id,
                    "score": hit.score,
                    "user_id": hit.entity.get("user_id"),
                    "novel_id": hit.entity.get("novel_id"),
                    "entry_type": hit.entity.get("entry_type"),
                    "source_id": hit.entity.get("source_id"),
                    "content": hit.entity.get("content")
                })
        
        return search_results
    
    def delete_by_novel(self, user_id: int, novel_id: int):
        """Delete all vectors for a specific novel"""
        collection = self.get_collection()
        expr = f"user_id == {user_id} and novel_id == {novel_id}"
        collection.delete(expr)
        collection.flush()
    
    def delete_by_user(self, user_id: int):
        """Delete all vectors for a specific user"""
        collection = self.get_collection()
        expr = f"user_id == {user_id}"
        collection.delete(expr)
        collection.flush()


# Global Milvus client instance
milvus_client = MilvusClient()


def get_milvus_client() -> MilvusClient:
    """Get Milvus client instance"""
    return milvus_client

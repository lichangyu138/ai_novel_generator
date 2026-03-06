"""
Knowledge Service - Manage knowledge base entries and sync with vector/graph databases
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import logging

from app.db.milvus import get_milvus_client
from app.db.neo4j import get_neo4j_client
from app.services.langchain.embedding_service import get_embedding_service
from app.models.database import (
    KnowledgeEntry, Character, Chapter, Novel, StoryEvent, ContentVersion
)

logger = logging.getLogger(__name__)


class KnowledgeService:
    """Service for managing knowledge base and graph data"""
    
    def __init__(self):
        self.milvus_client = get_milvus_client()
        self.neo4j_client = get_neo4j_client()
        self.embedding_service = get_embedding_service()
    
    async def sync_character_to_knowledge(
        self,
        db: Session,
        character: Character
    ):
        """
        Sync character data to both vector database and knowledge graph
        
        Args:
            db: Database session
            character: Character model instance
        """
        # Prepare content for embedding
        content = f"""
人物名称：{character.name}
角色定位：{character.role or ''}
性别：{character.gender or ''}
年龄：{character.age or ''}
性格特点：{character.personality or ''}
背景故事：{character.background or ''}
外貌描述：{character.appearance or ''}
能力技能：{character.abilities or ''}
"""
        
        # Generate embedding
        embedding = await self.embedding_service.embed_text(content)
        
        # Insert into Milvus
        milvus_ids = self.milvus_client.insert_vectors(
            user_id=character.user_id,
            novel_id=character.novel_id,
            entries=[{
                "entry_type": "character",
                "source_id": character.id,
                "content": content,
                "embedding": embedding
            }]
        )
        
        # Update knowledge entry in MySQL
        knowledge_entry = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == character.user_id,
            KnowledgeEntry.novel_id == character.novel_id,
            KnowledgeEntry.entry_type == "character",
            KnowledgeEntry.source_id == character.id
        ).first()
        
        if knowledge_entry:
            knowledge_entry.content = content
            knowledge_entry.milvus_id = str(milvus_ids[0]) if milvus_ids else None
        else:
            knowledge_entry = KnowledgeEntry(
                user_id=character.user_id,
                novel_id=character.novel_id,
                entry_type="character",
                source_id=character.id,
                content=content,
                milvus_id=str(milvus_ids[0]) if milvus_ids else None
            )
            db.add(knowledge_entry)
        
        # Sync to Neo4j
        self.neo4j_client.create_character(
            user_id=character.user_id,
            novel_id=character.novel_id,
            character_id=character.id,
            name=character.name,
            properties={
                "role": character.role,
                "gender": character.gender,
                "age": character.age,
                "personality": character.personality,
                "background": character.background,
                "abilities": character.abilities
            }
        )
        
        # Sync character relationships to Neo4j
        if character.relationships:
            for rel in character.relationships:
                if rel.get("character_id"):
                    self.neo4j_client.create_character_relationship(
                        user_id=character.user_id,
                        novel_id=character.novel_id,
                        from_character_id=character.id,
                        to_character_id=rel["character_id"],
                        relation_type=rel.get("relation_type", "RELATED"),
                        description=rel.get("description", "")
                    )
        
        db.commit()
        logger.info(f"Synced character {character.id} to knowledge base")
    
    async def sync_chapter_to_knowledge(
        self,
        db: Session,
        chapter: Chapter
    ):
        """
        Sync chapter content to vector database
        
        Args:
            db: Database session
            chapter: Chapter model instance
        """
        if not chapter.content:
            return
        
        # Prepare content for embedding
        content = f"""
第{chapter.chapter_number}章：{chapter.title or ''}

{chapter.content}
"""
        
        # Generate embedding
        embedding = await self.embedding_service.embed_text(content)
        
        # Insert into Milvus
        milvus_ids = self.milvus_client.insert_vectors(
            user_id=chapter.user_id,
            novel_id=chapter.novel_id,
            entries=[{
                "entry_type": "chapter_content",
                "source_id": chapter.id,
                "content": content[:65535],  # Milvus varchar limit
                "embedding": embedding
            }]
        )
        
        # Update knowledge entry in MySQL
        knowledge_entry = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == chapter.user_id,
            KnowledgeEntry.novel_id == chapter.novel_id,
            KnowledgeEntry.entry_type == "chapter_content",
            KnowledgeEntry.source_id == chapter.id
        ).first()
        
        if knowledge_entry:
            knowledge_entry.content = content[:65535]
            knowledge_entry.milvus_id = str(milvus_ids[0]) if milvus_ids else None
        else:
            knowledge_entry = KnowledgeEntry(
                user_id=chapter.user_id,
                novel_id=chapter.novel_id,
                entry_type="chapter_content",
                source_id=chapter.id,
                content=content[:65535],
                milvus_id=str(milvus_ids[0]) if milvus_ids else None
            )
            db.add(knowledge_entry)
        
        db.commit()
        logger.info(f"Synced chapter {chapter.id} to knowledge base")
    
    async def sync_novel_setting_to_knowledge(
        self,
        db: Session,
        novel: Novel
    ):
        """
        Sync novel world setting to vector database
        
        Args:
            db: Database session
            novel: Novel model instance
        """
        if not novel.world_setting:
            return
        
        content = f"""
小说：{novel.title}
世界观设定：
{novel.world_setting}
"""
        
        # Generate embedding
        embedding = await self.embedding_service.embed_text(content)
        
        # Insert into Milvus
        milvus_ids = self.milvus_client.insert_vectors(
            user_id=novel.user_id,
            novel_id=novel.id,
            entries=[{
                "entry_type": "setting",
                "source_id": novel.id,
                "content": content,
                "embedding": embedding
            }]
        )
        
        # Update knowledge entry
        knowledge_entry = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == novel.user_id,
            KnowledgeEntry.novel_id == novel.id,
            KnowledgeEntry.entry_type == "setting",
            KnowledgeEntry.source_id == novel.id
        ).first()
        
        if knowledge_entry:
            knowledge_entry.content = content
            knowledge_entry.milvus_id = str(milvus_ids[0]) if milvus_ids else None
        else:
            knowledge_entry = KnowledgeEntry(
                user_id=novel.user_id,
                novel_id=novel.id,
                entry_type="setting",
                source_id=novel.id,
                content=content,
                milvus_id=str(milvus_ids[0]) if milvus_ids else None
            )
            db.add(knowledge_entry)
        
        db.commit()
        logger.info(f"Synced novel {novel.id} setting to knowledge base")
    
    def delete_novel_knowledge(
        self,
        db: Session,
        user_id: int,
        novel_id: int
    ):
        """
        Delete all knowledge data for a novel
        
        Args:
            db: Database session
            user_id: User ID
            novel_id: Novel ID
        """
        # Delete from Milvus
        self.milvus_client.delete_by_novel(user_id, novel_id)
        
        # Delete from Neo4j
        self.neo4j_client.delete_novel_data(user_id, novel_id)
        
        # Delete from MySQL
        db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == user_id,
            KnowledgeEntry.novel_id == novel_id
        ).delete()
        
        db.commit()
        logger.info(f"Deleted all knowledge data for novel {novel_id}")
    
    async def sync_event_to_knowledge(
        self,
        db: Session,
        event: StoryEvent
    ):
        """
        Sync story event to vector database
        
        Args:
            db: Database session
            event: StoryEvent model instance
        """
        content = f"""
事件：{event.title}
类型：{event.event_type or ''}
描述：{event.description or ''}
地点：{event.location or ''}
重要程度：{event.importance or 5}/10
"""
        
        # Generate embedding
        embedding = await self.embedding_service.embed_text(content)
        
        # Insert into Milvus
        milvus_ids = self.milvus_client.insert_vectors(
            user_id=event.user_id,
            novel_id=event.novel_id,
            entries=[{
                "entry_type": "event",
                "source_id": event.id,
                "content": content,
                "embedding": embedding
            }]
        )
        
        # Update knowledge entry
        knowledge_entry = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == event.user_id,
            KnowledgeEntry.novel_id == event.novel_id,
            KnowledgeEntry.entry_type == "event",
            KnowledgeEntry.source_id == event.id
        ).first()
        
        if knowledge_entry:
            knowledge_entry.content = content
            knowledge_entry.milvus_id = str(milvus_ids[0]) if milvus_ids else None
        else:
            knowledge_entry = KnowledgeEntry(
                user_id=event.user_id,
                novel_id=event.novel_id,
                entry_type="event",
                source_id=event.id,
                content=content,
                milvus_id=str(milvus_ids[0]) if milvus_ids else None
            )
            db.add(knowledge_entry)
        
        # Sync to Neo4j timeline
        self.neo4j_client.create_timeline_event(
            user_id=event.user_id,
            novel_id=event.novel_id,
            event_id=event.id,
            name=event.title,
            properties={
                "description": event.description,
                "event_type": event.event_type,
                "importance": event.importance,
                "location": event.location,
                "characters_involved": event.characters_involved
            }
        )
        
        db.commit()
        logger.info(f"Synced event {event.id} to knowledge base")
    
    async def extract_knowledge_from_content(
        self,
        db: Session,
        user_id: int,
        novel_id: int,
        content: str,
        source_type: str,
        source_id: int
    ) -> Dict[str, Any]:
        """
        Extract knowledge from content using LLM and save to database
        
        Args:
            db: Database session
            user_id: User ID
            novel_id: Novel ID
            content: Content to extract from
            source_type: Type of source (chapter, outline, etc.)
            source_id: ID of the source
        
        Returns:
            Extracted knowledge summary
        """
        from app.services.langchain.llm_service import get_llm_service
        import json
        
        llm_service = get_llm_service()
        
        extraction_prompt = f"""请从以下小说内容中提取关键信息：

{content[:4000]}

请以JSON格式返回提取的信息：
{{
    "characters": [
        {{"name": "角色名", "action": "该角色在本段的主要行为", "state_change": "角色状态变化"}}
    ],
    "events": [
        {{"title": "事件标题", "description": "事件描述", "importance": 1-10, "event_type": "战斗/对话/转折/发现等"}}
    ],
    "locations": [
        {{"name": "地点名", "description": "地点描述"}}
    ],
    "items": [
        {{"name": "物品名", "description": "物品描述", "owner": "拥有者"}}
    ],
    "relationships": [
        {{"from": "角色A", "to": "角色B", "type": "关系类型", "change": "关系变化"}}
    ]
}}

只返回JSON，不要其他内容。"""
        
        try:
            result = await llm_service.generate(
                prompt=extraction_prompt,
                system_prompt="你是一个信息提取专家，擅长从小说内容中提取结构化信息。"
            )
            
            # Clean up JSON
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            
            data = json.loads(result)
            
            saved_count = {"events": 0, "knowledge": 0}
            
            # Save events
            for event_data in data.get("events", []):
                if event_data.get("title"):
                    event = StoryEvent(
                        novel_id=novel_id,
                        user_id=user_id,
                        chapter_id=source_id if source_type == "chapter" else None,
                        title=event_data["title"],
                        description=event_data.get("description", ""),
                        event_type=event_data.get("event_type", ""),
                        importance=event_data.get("importance", 5)
                    )
                    db.add(event)
                    saved_count["events"] += 1
            
            # Save character actions as knowledge entries
            for char in data.get("characters", []):
                if char.get("name") and (char.get("action") or char.get("state_change")):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="character_action",
                        source_id=source_id,
                        content=f"{char['name']}: {char.get('action', '')} {char.get('state_change', '')}",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
                    saved_count["knowledge"] += 1
            
            # Save locations
            for loc in data.get("locations", []):
                if loc.get("name"):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="location",
                        source_id=source_id,
                        content=f"{loc['name']}: {loc.get('description', '')}",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
                    saved_count["knowledge"] += 1
            
            # Save items
            for item in data.get("items", []):
                if item.get("name"):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="item",
                        source_id=source_id,
                        content=f"{item['name']}: {item.get('description', '')} (拥有者: {item.get('owner', '未知')})",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
                    saved_count["knowledge"] += 1
            
            # Save relationship changes
            for rel in data.get("relationships", []):
                if rel.get("from") and rel.get("to"):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="relationship",
                        source_id=source_id,
                        content=f"{rel['from']} 与 {rel['to']}: {rel.get('type', '')} - {rel.get('change', '')}",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
                    saved_count["knowledge"] += 1
            
            db.commit()
            logger.info(f"Extracted {saved_count} from {source_type} {source_id}")
            
            return {
                "success": True,
                "extracted": data,
                "saved": saved_count
            }
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse extraction result: {e}")
            return {"success": False, "error": "JSON parse error"}
        except Exception as e:
            logger.error(f"Knowledge extraction failed: {e}")
            return {"success": False, "error": str(e)}
    
    def get_knowledge_stats(
        self,
        db: Session,
        user_id: int,
        novel_id: int
    ) -> Dict[str, int]:
        """
        Get knowledge base statistics for a novel
        
        Args:
            db: Database session
            user_id: User ID
            novel_id: Novel ID
        
        Returns:
            Statistics dictionary
        """
        entries = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.user_id == user_id,
            KnowledgeEntry.novel_id == novel_id
        ).all()
        
        stats = {
            "total": len(entries),
            "character": 0,
            "chapter_content": 0,
            "setting": 0,
            "plot": 0
        }
        
        for entry in entries:
            if entry.entry_type in stats:
                stats[entry.entry_type] += 1
        
        return stats


# Global knowledge service instance
_knowledge_service: Optional[KnowledgeService] = None


def get_knowledge_service() -> KnowledgeService:
    """Get knowledge service instance"""
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService()
    return _knowledge_service

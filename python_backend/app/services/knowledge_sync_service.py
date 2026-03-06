"""
Knowledge to Worldbuilding Sync Service
Handles syncing knowledge entries to worldbuilding entities with deduplication
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.models.database import KnowledgeEntry, Character, StoryEvent
from difflib import SequenceMatcher


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate text similarity (0-1)"""
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


async def sync_knowledge_to_character(
    db: Session,
    knowledge_entry_id: int,
    user_id: int,
    novel_id: int,
    merge_strategy: str = "append"  # append, replace, skip
) -> Dict[str, Any]:
    """
    Sync knowledge entry to character
    Returns: {success: bool, character_id: int, action: str}
    """
    # Get knowledge entry
    entry = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.id == knowledge_entry_id,
        KnowledgeEntry.user_id == user_id
    ).first()
    
    if not entry or entry.category != "character":
        return {"success": False, "error": "Invalid knowledge entry"}
    
    # Find similar characters (deduplication)
    existing_chars = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == user_id
    ).all()
    
    best_match = None
    best_similarity = 0.0
    
    for char in existing_chars:
        similarity = calculate_similarity(entry.title, char.name)
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = char
    
    # If high similarity (>0.8), merge with existing
    if best_similarity > 0.8 and best_match:
        if merge_strategy == "skip":
            return {
                "success": True,
                "character_id": best_match.id,
                "action": "skipped",
                "message": f"已存在相似角色: {best_match.name}"
            }
        elif merge_strategy == "append":
            # Append new content
            if entry.content:
                if best_match.background:
                    best_match.background += f"\n\n[来自知识库]\n{entry.content}"
                else:
                    best_match.background = entry.content
            
            # Mark as synced
            entry.synced_to_worldbuilding = True
            entry.worldbuilding_id = best_match.id
            db.commit()
            
            return {
                "success": True,
                "character_id": best_match.id,
                "action": "merged",
                "message": f"已合并到角色: {best_match.name}"
            }
        else:  # replace
            if entry.content:
                best_match.background = entry.content
            entry.synced_to_worldbuilding = True
            entry.worldbuilding_id = best_match.id
            db.commit()
            
            return {
                "success": True,
                "character_id": best_match.id,
                "action": "replaced",
                "message": f"已替换角色: {best_match.name}"
            }
    
    # Create new character
    new_char = Character(
        novel_id=novel_id,
        user_id=user_id,
        name=entry.title,
        background=entry.content or ""
    )
    db.add(new_char)
    db.flush()
    
    entry.synced_to_worldbuilding = True
    entry.worldbuilding_id = new_char.id
    db.commit()
    
    return {
        "success": True,
        "character_id": new_char.id,
        "action": "created",
        "message": f"已创建新角色: {new_char.name}"
    }


async def sync_knowledge_to_event(
    db: Session,
    knowledge_entry_id: int,
    user_id: int,
    novel_id: int,
    merge_strategy: str = "append"
) -> Dict[str, Any]:
    """Sync knowledge entry to story event"""
    entry = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.id == knowledge_entry_id,
        KnowledgeEntry.user_id == user_id
    ).first()
    
    if not entry or entry.category != "event":
        return {"success": False, "error": "Invalid knowledge entry"}
    
    # Find similar events
    existing_events = db.query(StoryEvent).filter(
        StoryEvent.novel_id == novel_id,
        StoryEvent.user_id == user_id
    ).all()
    
    best_match = None
    best_similarity = 0.0
    
    for event in existing_events:
        similarity = calculate_similarity(entry.title, event.title)
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = event
    
    if best_similarity > 0.8 and best_match:
        if merge_strategy == "skip":
            return {"success": True, "event_id": best_match.id, "action": "skipped"}
        elif merge_strategy == "append":
            if entry.content:
                if best_match.description:
                    best_match.description += f"\n\n[来自知识库]\n{entry.content}"
                else:
                    best_match.description = entry.content
            entry.synced_to_worldbuilding = True
            entry.worldbuilding_id = best_match.id
            db.commit()
            return {"success": True, "event_id": best_match.id, "action": "merged"}
    
    # Create new event
    new_event = StoryEvent(
        novel_id=novel_id,
        user_id=user_id,
        title=entry.title,
        description=entry.content or ""
    )
    db.add(new_event)
    db.flush()
    
    entry.synced_to_worldbuilding = True
    entry.worldbuilding_id = new_event.id
    db.commit()
    
    return {"success": True, "event_id": new_event.id, "action": "created"}


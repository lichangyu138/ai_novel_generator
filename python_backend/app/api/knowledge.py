"""
Knowledge Base and Knowledge Graph API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.mysql import get_db
from app.db.neo4j import get_neo4j_client
from app.models.schemas import (
    GraphResponse,
    GraphNode,
    GraphEdge,
    TimelineResponse,
    TimelineEvent,
    KnowledgeStatsResponse
)
from app.models.database import Novel, User, KnowledgeEntry
from app.services.auth import get_current_active_user
from app.services.knowledge_service import get_knowledge_service

router = APIRouter(prefix="/novels/{novel_id}/knowledge", tags=["Knowledge"])


def get_novel_or_404(db: Session, novel_id: int, user_id: int) -> Novel:
    """Get novel or raise 404"""
    novel = db.query(Novel).filter(
        Novel.id == novel_id,
        Novel.user_id == user_id
    ).first()
    
    if not novel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novel not found"
        )
    
    return novel


@router.get("/stats", response_model=KnowledgeStatsResponse)
async def get_knowledge_stats(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get knowledge base statistics for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    knowledge_service = get_knowledge_service()
    stats = knowledge_service.get_knowledge_stats(db, current_user.id, novel_id)
    
    return KnowledgeStatsResponse(**stats)


@router.get("/graph/characters", response_model=GraphResponse)
async def get_character_graph(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get character relationship graph from Neo4j
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    neo4j_client = get_neo4j_client()
    graph_data = neo4j_client.get_character_graph(current_user.id, novel_id)
    
    nodes = [GraphNode(
        id=n["id"],
        name=n["name"],
        type=n.get("role", "character"),
        properties=n.get("properties")
    ) for n in graph_data.get("nodes", [])]
    
    edges = [GraphEdge(
        source=e["source"],
        target=e["target"],
        type=e["type"],
        description=e.get("description")
    ) for e in graph_data.get("edges", [])]
    
    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/graph/world", response_model=GraphResponse)
async def get_world_graph(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get world structure graph from Neo4j
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    neo4j_client = get_neo4j_client()
    graph_data = neo4j_client.get_world_graph(current_user.id, novel_id)
    
    nodes = [GraphNode(
        id=n["id"],
        name=n["name"],
        type=n.get("type", "element"),
        properties={"description": n.get("description")}
    ) for n in graph_data.get("nodes", [])]
    
    edges = [GraphEdge(
        source=e["source"],
        target=e["target"],
        type=e["type"]
    ) for e in graph_data.get("edges", [])]
    
    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get timeline events from Neo4j
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    neo4j_client = get_neo4j_client()
    events = neo4j_client.get_timeline(current_user.id, novel_id)
    
    timeline_events = [TimelineEvent(
        id=e["id"],
        name=e["name"],
        time_point=e["time_point"],
        description=e.get("description"),
        chapter_id=e.get("chapter_id")
    ) for e in events]
    
    return TimelineResponse(events=timeline_events)


@router.post("/timeline/event")
async def create_timeline_event(
    novel_id: int,
    event_name: str,
    time_point: str,
    description: str = "",
    chapter_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new timeline event
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    neo4j_client = get_neo4j_client()
    
    # Get next event ID
    events = neo4j_client.get_timeline(current_user.id, novel_id)
    next_id = max([e["id"] for e in events], default=0) + 1
    
    neo4j_client.create_timeline_event(
        user_id=current_user.id,
        novel_id=novel_id,
        event_id=next_id,
        event_name=event_name,
        time_point=time_point,
        description=description,
        chapter_id=chapter_id
    )
    
    return {"message": "Timeline event created", "event_id": next_id}


@router.get("/entries")
async def list_knowledge_entries(
    novel_id: int,
    entry_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List knowledge base entries
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    query = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.novel_id == novel_id,
        KnowledgeEntry.user_id == current_user.id
    )
    
    if entry_type:
        query = query.filter(KnowledgeEntry.entry_type == entry_type)
    
    entries = query.order_by(KnowledgeEntry.created_at.desc()).all()
    
    return [{
        "id": e.id,
        "entry_type": e.entry_type,
        "source_id": e.source_id,
        "content": e.content[:500] + "..." if len(e.content) > 500 else e.content,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat()
    } for e in entries]

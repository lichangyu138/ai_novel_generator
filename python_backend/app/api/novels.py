"""
Novel Project API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.db.mysql import get_db
from app.models.schemas import (
    NovelCreate,
    NovelUpdate,
    NovelResponse,
    NovelListResponse
)
from app.models.database import Novel, User
from app.services.auth import get_current_active_user
from app.services.knowledge_service import get_knowledge_service

router = APIRouter(prefix="/novels", tags=["Novels"])


@router.post("", response_model=NovelResponse)
async def create_novel(
    novel_data: NovelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new novel project
    """
    novel = Novel(
        user_id=current_user.id,
        title=novel_data.title,
        genre=novel_data.genre,
        style=novel_data.style,
        description=novel_data.description,
        prompt=novel_data.prompt,
        world_setting=novel_data.world_setting
    )
    
    db.add(novel)
    db.commit()
    db.refresh(novel)
    
    # Sync world setting to knowledge base if provided
    if novel.world_setting:
        knowledge_service = get_knowledge_service()
        await knowledge_service.sync_novel_setting_to_knowledge(db, novel)
    
    return NovelResponse.model_validate(novel)


@router.get("", response_model=NovelListResponse)
async def list_novels(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all novels for current user
    """
    # Query novels for current user only (data isolation)
    query = db.query(Novel).filter(Novel.user_id == current_user.id)
    
    total = query.count()
    novels = query.order_by(Novel.updated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return NovelListResponse(
        items=[NovelResponse.model_validate(n) for n in novels],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{novel_id}", response_model=NovelResponse)
async def get_novel(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific novel by ID
    """
    novel = db.query(Novel).filter(
        Novel.id == novel_id,
        Novel.user_id == current_user.id  # Data isolation
    ).first()
    
    if not novel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novel not found"
        )
    
    return NovelResponse.model_validate(novel)


@router.put("/{novel_id}", response_model=NovelResponse)
async def update_novel(
    novel_id: int,
    novel_data: NovelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a novel project
    """
    novel = db.query(Novel).filter(
        Novel.id == novel_id,
        Novel.user_id == current_user.id
    ).first()
    
    if not novel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novel not found"
        )
    
    # Update fields
    update_data = novel_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(novel, field, value)
    
    db.commit()
    db.refresh(novel)
    
    # Sync world setting if updated
    if "world_setting" in update_data and novel.world_setting:
        knowledge_service = get_knowledge_service()
        await knowledge_service.sync_novel_setting_to_knowledge(db, novel)
    
    return NovelResponse.model_validate(novel)


@router.delete("/{novel_id}")
async def delete_novel(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a novel project and all related data
    """
    novel = db.query(Novel).filter(
        Novel.id == novel_id,
        Novel.user_id == current_user.id
    ).first()
    
    if not novel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novel not found"
        )
    
    # Delete knowledge base data
    knowledge_service = get_knowledge_service()
    knowledge_service.delete_novel_knowledge(db, current_user.id, novel_id)
    
    # Delete novel (cascades to related tables)
    db.delete(novel)
    db.commit()
    
    return {"message": "Novel deleted successfully"}

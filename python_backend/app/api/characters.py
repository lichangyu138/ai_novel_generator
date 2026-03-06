"""
Character Management API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.mysql import get_db
from app.models.schemas import (
    CharacterCreate,
    CharacterUpdate,
    CharacterResponse
)
from app.models.database import Character, Novel, User
from app.services.auth import get_current_active_user
from app.services.knowledge_service import get_knowledge_service

router = APIRouter(prefix="/novels/{novel_id}/characters", tags=["Characters"])


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


@router.post("", response_model=CharacterResponse)
async def create_character(
    novel_id: int,
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new character for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    character = Character(
        novel_id=novel_id,
        user_id=current_user.id,
        name=character_data.name,
        role=character_data.role,
        gender=character_data.gender,
        age=character_data.age,
        personality=character_data.personality,
        background=character_data.background,
        appearance=character_data.appearance,
        abilities=character_data.abilities,
        relationships=[r.model_dump() for r in character_data.relationships] if character_data.relationships else None,
        extra_info=character_data.extra_info
    )
    
    db.add(character)
    db.commit()
    db.refresh(character)
    
    # Sync to knowledge base
    knowledge_service = get_knowledge_service()
    await knowledge_service.sync_character_to_knowledge(db, character)
    
    return CharacterResponse.model_validate(character)


@router.get("", response_model=List[CharacterResponse])
async def list_characters(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all characters for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).order_by(Character.created_at).all()
    
    return [CharacterResponse.model_validate(c) for c in characters]


@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(
    novel_id: int,
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific character
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )
    
    return CharacterResponse.model_validate(character)


@router.put("/{character_id}", response_model=CharacterResponse)
async def update_character(
    novel_id: int,
    character_id: int,
    character_data: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a character
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )
    
    # Update fields
    update_data = character_data.model_dump(exclude_unset=True)
    
    # Handle relationships specially
    if "relationships" in update_data and update_data["relationships"]:
        update_data["relationships"] = [r.model_dump() if hasattr(r, 'model_dump') else r for r in update_data["relationships"]]
    
    for field, value in update_data.items():
        setattr(character, field, value)
    
    db.commit()
    db.refresh(character)
    
    # Sync to knowledge base
    knowledge_service = get_knowledge_service()
    await knowledge_service.sync_character_to_knowledge(db, character)
    
    return CharacterResponse.model_validate(character)


@router.delete("/{character_id}")
async def delete_character(
    novel_id: int,
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a character
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )
    
    db.delete(character)
    db.commit()
    
    return {"message": "Character deleted successfully"}

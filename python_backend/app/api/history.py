"""
Generation History API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.mysql import get_db
from app.models.schemas import GenerationHistoryResponse
from app.models.database import GenerationHistory, Novel, User
from app.services.auth import get_current_active_user

router = APIRouter(prefix="/novels/{novel_id}/history", tags=["Generation History"])


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


@router.get("", response_model=List[GenerationHistoryResponse])
async def list_generation_history(
    novel_id: int,
    generation_type: Optional[str] = Query(None, description="Filter by type: outline, detailed_outline, chapter, chapter_revision"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List generation history for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    query = db.query(GenerationHistory).filter(
        GenerationHistory.novel_id == novel_id,
        GenerationHistory.user_id == current_user.id
    )
    
    if generation_type:
        query = query.filter(GenerationHistory.generation_type == generation_type)
    
    histories = query.order_by(
        GenerationHistory.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return [GenerationHistoryResponse.model_validate(h) for h in histories]


@router.get("/{history_id}", response_model=GenerationHistoryResponse)
async def get_generation_history(
    novel_id: int,
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific generation history entry
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.novel_id == novel_id,
        GenerationHistory.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found"
        )
    
    return GenerationHistoryResponse.model_validate(history)


@router.get("/stats/summary")
async def get_generation_stats(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get generation statistics summary for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    histories = db.query(GenerationHistory).filter(
        GenerationHistory.novel_id == novel_id,
        GenerationHistory.user_id == current_user.id
    ).all()
    
    stats = {
        "total_generations": len(histories),
        "by_type": {},
        "by_status": {},
        "total_duration_seconds": 0,
        "average_duration_seconds": 0
    }
    
    for h in histories:
        # Count by type
        if h.generation_type not in stats["by_type"]:
            stats["by_type"][h.generation_type] = 0
        stats["by_type"][h.generation_type] += 1
        
        # Count by status
        status_key = h.status.value if hasattr(h.status, 'value') else str(h.status)
        if status_key not in stats["by_status"]:
            stats["by_status"][status_key] = 0
        stats["by_status"][status_key] += 1
        
        # Sum duration
        if h.duration_seconds:
            stats["total_duration_seconds"] += h.duration_seconds
    
    if stats["total_generations"] > 0:
        stats["average_duration_seconds"] = stats["total_duration_seconds"] / stats["total_generations"]
    
    return stats

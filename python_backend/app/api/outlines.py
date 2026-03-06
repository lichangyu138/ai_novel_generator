"""
Outline Generation API Routes with Streaming Support
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import time

from app.db.mysql import get_db
from app.models.schemas import (
    OutlineUpdate,
    OutlineResponse,
    DetailedOutlineGenerate,
    DetailedOutlineUpdate,
    DetailedOutlineResponse
)
from app.models.database import (
    Outline, DetailedOutline, Novel, Character, User,
    GenerationStatus, GenerationHistory, AIModelConfig
)
from app.services.auth import get_current_active_user
from app.services.langgraph.novel_workflow import get_novel_workflow

router = APIRouter(prefix="/novels/{novel_id}/outlines", tags=["Outlines"])


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


def get_user_model_config(db: Session, user_id: int) -> AIModelConfig:
    """Get user's default model config"""
    return db.query(AIModelConfig).filter(
        AIModelConfig.user_id == user_id,
        AIModelConfig.is_default == True,
        AIModelConfig.is_active == True
    ).first()


@router.post("/generate")
async def generate_outline(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate novel outline with streaming response
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).all()
    
    # Get user's model config
    model_config = get_user_model_config(db, current_user.id)
    
    # Prepare novel info
    novel_info = {
        "title": novel.title,
        "genre": novel.genre,
        "style": novel.style,
        "description": novel.description,
        "prompt": novel.prompt,
        "world_setting": novel.world_setting
    }
    
    # Prepare character info
    char_list = [{
        "name": c.name,
        "role": c.role,
        "personality": c.personality,
        "background": c.background
    } for c in characters]
    
    # Create outline record
    outline = Outline(
        novel_id=novel_id,
        user_id=current_user.id,
        content="",
        status=GenerationStatus.GENERATING
    )
    db.add(outline)
    db.commit()
    db.refresh(outline)
    
    outline_id = outline.id
    start_time = time.time()
    
    async def generate_stream():
        """Stream generator"""
        workflow = get_novel_workflow(model_config)
        full_content = ""
        
        try:
            async for chunk in workflow.generate_outline(
                user_id=current_user.id,
                novel_id=novel_id,
                novel_info=novel_info,
                characters=char_list
            ):
                full_content += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # Update outline with full content
            with db.begin():
                db_outline = db.query(Outline).filter(Outline.id == outline_id).first()
                if db_outline:
                    db_outline.content = full_content
                    # Note: outlines table does not have a status column
                
                # Record generation history
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="outline",
                    target_id=outline_id,
                    input_prompt=novel.prompt,
                    output_content=full_content,
                    duration_seconds=time.time() - start_time,
                    status=GenerationStatus.COMPLETED
                )
                db.add(history)
            
            yield f"data: {json.dumps({'done': True, 'outline_id': outline_id})}\n\n"
            
        except Exception as e:
            with db.begin():
                db_outline = db.query(Outline).filter(Outline.id == outline_id).first()
                if db_outline:
                    # Note: outlines table does not have a status column
                    pass
                
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="outline",
                    target_id=outline_id,
                    error_message=str(e),
                    duration_seconds=time.time() - start_time,
                    status=GenerationStatus.FAILED
                )
                db.add(history)
            
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("", response_model=List[OutlineResponse])
async def list_outlines(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all outlines for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    outlines = db.query(Outline).filter(
        Outline.novel_id == novel_id,
        Outline.user_id == current_user.id
    ).order_by(Outline.version.desc()).all()
    
    return [OutlineResponse.model_validate(o) for o in outlines]


@router.get("/current", response_model=OutlineResponse)
async def get_current_outline(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current active outline
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    outline = db.query(Outline).filter(
        Outline.novel_id == novel_id,
        Outline.user_id == current_user.id,
        Outline.is_current == True
    ).first()
    
    if not outline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No outline found"
        )
    
    return OutlineResponse.model_validate(outline)


@router.put("/{outline_id}", response_model=OutlineResponse)
async def update_outline(
    novel_id: int,
    outline_id: int,
    outline_data: OutlineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update outline content
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    outline = db.query(Outline).filter(
        Outline.id == outline_id,
        Outline.novel_id == novel_id,
        Outline.user_id == current_user.id
    ).first()
    
    if not outline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outline not found"
        )
    
    # Create new version
    new_outline = Outline(
        novel_id=novel_id,
        user_id=current_user.id,
        content=outline_data.content,
        version=outline.version + 1,
        is_current=True,
        status=GenerationStatus.COMPLETED
    )
    
    # Mark old as not current
    outline.is_current = False
    
    db.add(new_outline)
    db.commit()
    db.refresh(new_outline)
    
    return OutlineResponse.model_validate(new_outline)


# Note: Detailed outline generation has been moved to chapters API
# for better integration with chapter management workflow

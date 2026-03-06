"""
Chapter Generation and Review API Routes with Streaming Support
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import time

from app.db.mysql import get_db
from app.models.schemas import (
    ChapterGenerate,
    ChapterUpdate,
    ChapterReview,
    ChapterRevise,
    ChapterResponse,
    DetailedOutlineGenerate,
    DetailedOutlineResponse
)
from app.models.database import (
    Chapter, Novel, Character, DetailedOutline, Outline, User,
    GenerationStatus, ReviewStatus, GenerationHistory, AIModelConfig
)
from app.services.auth import get_current_active_user
from app.services.langgraph.novel_workflow import get_novel_workflow
from app.services.knowledge_service import get_knowledge_service

router = APIRouter(prefix="/novels/{novel_id}/chapters", tags=["Chapters"])


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
async def generate_chapter(
    novel_id: int,
    request: ChapterGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate chapter content with RAG and streaming response
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    # Get detailed outline for this chapter
    detailed_outline = None
    if request.detailed_outline_id:
        detailed_outline = db.query(DetailedOutline).filter(
            DetailedOutline.id == request.detailed_outline_id,
            DetailedOutline.novel_id == novel_id,
            DetailedOutline.user_id == current_user.id
        ).first()
    else:
        # Find detailed outline containing this chapter
        detailed_outline = db.query(DetailedOutline).filter(
            DetailedOutline.novel_id == novel_id,
            DetailedOutline.user_id == current_user.id,
            DetailedOutline.start_chapter <= request.chapter_number,
            DetailedOutline.end_chapter >= request.chapter_number,
            DetailedOutline.is_current == True
        ).first()
    
    if not detailed_outline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No detailed outline found for this chapter. Please generate detailed outline first."
        )
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).all()

    # Get previous 10 chapters' AI summaries
    from app.models.database import ChapterReview
    previous_reviews = db.query(ChapterReview).filter(
        ChapterReview.novel_id == novel_id,
        ChapterReview.user_id == current_user.id
    ).join(
        Chapter,
        ChapterReview.chapter_id == Chapter.id
    ).filter(
        Chapter.chapter_number < request.chapter_number
    ).order_by(
        Chapter.chapter_number.desc()
    ).limit(10).all()

    # Get user's model config
    model_config = get_user_model_config(db, current_user.id)
    
    # Prepare data
    novel_info = {
        "title": novel.title,
        "genre": novel.genre,
        "style": novel.style
    }
    
    char_list = [{
        "name": c.name,
        "role": c.role,
        "personality": c.personality,
        "background": c.background
    } for c in characters]
    
    # Create or get chapter record
    chapter = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == request.chapter_number,
        Chapter.is_current == True
    ).first()
    
    if chapter:
        # Create new version
        chapter.is_current = False
        new_chapter = Chapter(
            novel_id=novel_id,
            user_id=current_user.id,
            chapter_number=request.chapter_number,
            content="",
            version=chapter.version + 1,
            generation_status=GenerationStatus.GENERATING
        )
        db.add(new_chapter)
    else:
        new_chapter = Chapter(
            novel_id=novel_id,
            user_id=current_user.id,
            chapter_number=request.chapter_number,
            content="",
            generation_status=GenerationStatus.GENERATING
        )
        db.add(new_chapter)
    
    db.commit()
    db.refresh(new_chapter)
    
    chapter_id = new_chapter.id
    start_time = time.time()
    
    async def generate_stream():
        """Stream generator"""
        workflow = get_novel_workflow(model_config)
        full_content = ""

        # Build previous summaries context
        previous_summaries = []
        for review in reversed(previous_reviews):
            summary = {
                "chapter_number": review.chapter_id,  # Will need to get actual chapter number
                "plot_summary": review.plot_summary or "",
                "opening": review.opening_description or "",
                "middle": review.middle_description or "",
                "ending": review.ending_description or "",
            }
            previous_summaries.append(summary)

        try:
            async for chunk in workflow.generate_chapter(
                user_id=current_user.id,
                novel_id=novel_id,
                novel_info=novel_info,
                characters=char_list,
                chapter_number=request.chapter_number,
                detailed_outline=detailed_outline.content,
                previous_summaries=previous_summaries
            ):
                full_content += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # Update chapter
            with db.begin():
                db_chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
                if db_chapter:
                    db_chapter.content = full_content
                    db_chapter.word_count = len(full_content)
                    db_chapter.generation_status = GenerationStatus.COMPLETED
                    db_chapter.review_status = ReviewStatus.PENDING
                
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="chapter",
                    target_id=chapter_id,
                    output_content=full_content,
                    duration_seconds=time.time() - start_time,
                    status=GenerationStatus.COMPLETED
                )
                db.add(history)
            
            # Sync to knowledge base
            knowledge_service = get_knowledge_service()
            db_chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
            if db_chapter:
                await knowledge_service.sync_chapter_to_knowledge(db, db_chapter)

            # Auto-generate AI summary after chapter generation
            try:
                from app.services.ai_summary_service import generate_chapter_summary
                summary = await generate_chapter_summary(
                    db=db,
                    user_id=current_user.id,
                    novel_id=novel_id,
                    chapter_id=chapter_id,
                    model_config=model_config
                )
                if summary:
                    yield f"data: {json.dumps({'summary_generated': True})}\\n\\n"
            except Exception as summary_error:
                # Log error but don't fail the chapter generation
                print(f"Warning: Failed to generate AI summary: {summary_error}")
                import traceback
                traceback.print_exc()

            yield f"data: {json.dumps({'done': True, 'chapter_id': chapter_id})}\n\n"
            
        except Exception as e:
            with db.begin():
                db_chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
                if db_chapter:
                    db_chapter.generation_status = GenerationStatus.FAILED
                
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="chapter",
                    target_id=chapter_id,
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


@router.get("", response_model=List[ChapterResponse])
async def list_chapters(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all chapters for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapters = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.is_current == True
    ).order_by(Chapter.chapter_number).all()
    
    return [ChapterResponse.model_validate(c) for c in chapters]


@router.get("/{chapter_number}", response_model=ChapterResponse)
async def get_chapter(
    novel_id: int,
    chapter_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific chapter
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapter = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == chapter_number,
        Chapter.is_current == True
    ).first()
    
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found"
        )
    
    return ChapterResponse.model_validate(chapter)


@router.put("/{chapter_number}", response_model=ChapterResponse)
async def update_chapter(
    novel_id: int,
    chapter_number: int,
    chapter_data: ChapterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update chapter content manually
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapter = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == chapter_number,
        Chapter.is_current == True
    ).first()
    
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found"
        )
    
    # Update fields
    if chapter_data.title is not None:
        chapter.title = chapter_data.title
    if chapter_data.content is not None:
        chapter.content = chapter_data.content
        chapter.word_count = len(chapter_data.content)
    
    db.commit()
    db.refresh(chapter)
    
    # Sync to knowledge base
    knowledge_service = get_knowledge_service()
    await knowledge_service.sync_chapter_to_knowledge(db, chapter)
    
    return ChapterResponse.model_validate(chapter)


@router.post("/{chapter_number}/review", response_model=ChapterResponse)
async def review_chapter(
    novel_id: int,
    chapter_number: int,
    review_data: ChapterReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Review a chapter (approve, reject, or request revision)
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapter = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == chapter_number,
        Chapter.is_current == True
    ).first()
    
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found"
        )
    
    chapter.review_status = review_data.status
    chapter.review_feedback = review_data.feedback
    
    db.commit()
    db.refresh(chapter)
    
    return ChapterResponse.model_validate(chapter)


@router.post("/{chapter_number}/revise")
async def revise_chapter(
    novel_id: int,
    chapter_number: int,
    revise_data: ChapterRevise,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Revise chapter based on feedback with streaming response
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapter = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == chapter_number,
        Chapter.is_current == True
    ).first()
    
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found"
        )
    
    if not chapter.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter has no content to revise"
        )
    
    # Get user's model config
    model_config = get_user_model_config(db, current_user.id)
    
    novel_info = {
        "title": novel.title,
        "style": novel.style
    }
    
    # Mark current as not current and create new version
    chapter.is_current = False
    new_chapter = Chapter(
        novel_id=novel_id,
        user_id=current_user.id,
        chapter_number=chapter_number,
        title=chapter.title,
        content="",
        version=chapter.version + 1,
        generation_status=GenerationStatus.GENERATING
    )
    db.add(new_chapter)
    db.commit()
    db.refresh(new_chapter)
    
    new_chapter_id = new_chapter.id
    original_content = chapter.content
    start_time = time.time()
    
    async def generate_stream():
        """Stream generator"""
        workflow = get_novel_workflow(model_config)
        full_content = ""
        
        try:
            async for chunk in workflow.revise_chapter(
                novel_info=novel_info,
                original_content=original_content,
                feedback=revise_data.feedback
            ):
                full_content += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # Update chapter
            with db.begin():
                db_chapter = db.query(Chapter).filter(Chapter.id == new_chapter_id).first()
                if db_chapter:
                    db_chapter.content = full_content
                    db_chapter.word_count = len(full_content)
                    db_chapter.generation_status = GenerationStatus.COMPLETED
                    db_chapter.review_status = ReviewStatus.PENDING
                
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="chapter_revision",
                    target_id=new_chapter_id,
                    input_prompt=revise_data.feedback,
                    output_content=full_content,
                    duration_seconds=time.time() - start_time,
                    status=GenerationStatus.COMPLETED
                )
                db.add(history)
            
            # Sync to knowledge base
            knowledge_service = get_knowledge_service()
            db_chapter = db.query(Chapter).filter(Chapter.id == new_chapter_id).first()
            if db_chapter:
                await knowledge_service.sync_chapter_to_knowledge(db, db_chapter)
            
            yield f"data: {json.dumps({'done': True, 'chapter_id': new_chapter_id})}\n\n"
            
        except Exception as e:
            with db.begin():
                db_chapter = db.query(Chapter).filter(Chapter.id == new_chapter_id).first()
                if db_chapter:
                    db_chapter.generation_status = GenerationStatus.FAILED
            
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


@router.get("/{chapter_number}/history", response_model=List[ChapterResponse])
async def get_chapter_history(
    novel_id: int,
    chapter_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all versions of a chapter
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    chapters = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == current_user.id,
        Chapter.chapter_number == chapter_number
    ).order_by(Chapter.version.desc()).all()
    
    return [ChapterResponse.model_validate(c) for c in chapters]


# Detailed Outline Routes (moved from outlines API)
@router.post("/detailed-outlines/generate")
async def generate_detailed_outlines(
    novel_id: int,
    request: DetailedOutlineGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate detailed outlines for selected chapters (max 5 at once)
    References: main outline, knowledge base, character graph, etc.
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    # Validate chapter range
    if request.end_chapter - request.start_chapter + 1 > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only generate up to 5 chapters at once"
        )
    
    # Get current outline
    outline = db.query(Outline).filter(
        Outline.novel_id == novel_id,
        Outline.user_id == current_user.id,
        Outline.is_current == True
    ).first()
    
    if not outline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No outline found. Please generate outline first."
        )
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).all()
    
    # Get user's model config
    model_config = get_user_model_config(db, current_user.id)
    
    # Prepare data
    novel_info = {
        "title": novel.title,
        "genre": novel.genre,
        "style": novel.style,
        "world_setting": novel.world_setting
    }
    
    char_list = [{
        "name": c.name,
        "role": c.role,
        "personality": c.personality,
        "background": c.background,
        "relationships": c.relationships
    } for c in characters]
    
    # Create detailed outline records for each chapter
    detailed_outline_ids = []
    for chapter_num in range(request.start_chapter, request.end_chapter + 1):
        # Check if already exists
        existing = db.query(DetailedOutline).filter(
            DetailedOutline.novel_id == novel_id,
            DetailedOutline.user_id == current_user.id,
            DetailedOutline.start_chapter == chapter_num,
            DetailedOutline.end_chapter == chapter_num,
            DetailedOutline.is_current == True
        ).first()
        
        if existing:
            # Mark as not current
            existing.is_current = False
        
        detailed_outline = DetailedOutline(
            outline_id=outline.id,
            novel_id=novel_id,
            user_id=current_user.id,
            group_index=request.group_index,
            start_chapter=chapter_num,
            end_chapter=chapter_num,
            content="",
            status=GenerationStatus.GENERATING
        )
        db.add(detailed_outline)
        db.commit()
        db.refresh(detailed_outline)
        detailed_outline_ids.append(detailed_outline.id)
    
    start_time = time.time()
    
    async def generate_stream():
        """Stream generator"""
        workflow = get_novel_workflow(model_config)
        
        try:
            # Generate for each chapter
            for idx, chapter_num in enumerate(range(request.start_chapter, request.end_chapter + 1)):
                detailed_outline_id = detailed_outline_ids[idx]
                full_content = ""
                
                yield f"data: {json.dumps({'chapter': chapter_num, 'status': 'generating'})}\n\n"
                
                # Get RAG context from knowledge base
                from app.services.langchain.rag_service import get_rag_service
                rag_service = get_rag_service(model_config)
                
                # Query knowledge base for relevant context
                knowledge_context = await rag_service.retrieve_context(
                    user_id=current_user.id,
                    novel_id=novel_id,
                    query=f"第{chapter_num}章相关的人物、情节、设定",
                    top_k=10
                )
                
                # Get previous chapters for context
                previous_chapters = db.query(Chapter).filter(
                    Chapter.novel_id == novel_id,
                    Chapter.user_id == current_user.id,
                    Chapter.chapter_number < chapter_num,
                    Chapter.is_current == True
                ).order_by(Chapter.chapter_number.desc()).limit(3).all()
                
                previous_summary = "\n\n".join([
                    f"第{ch.chapter_number}章：{ch.content[:500]}..."
                    for ch in reversed(previous_chapters)
                ]) if previous_chapters else "这是开篇章节"
                
                # IMPORTANT: Do not change these parameters!
                # The method signature requires: group_index, start_chapter, end_chapter
                async for chunk in workflow.generate_detailed_outline(
                    user_id=current_user.id,
                    novel_id=novel_id,
                    novel_info=novel_info,
                    characters=char_list,
                    outline=outline.content,
                    group_index=0,
                    start_chapter=chapter_num,
                    end_chapter=chapter_num
                ):
                    full_content += chunk
                    yield f"data: {json.dumps({'chapter': chapter_num, 'chunk': chunk})}\n\n"
                
                # Update detailed outline
                with db.begin():
                    db_detailed = db.query(DetailedOutline).filter(
                        DetailedOutline.id == detailed_outline_id
                    ).first()
                    if db_detailed:
                        db_detailed.content = full_content
                        db_detailed.status = GenerationStatus.COMPLETED
                    
                    history = GenerationHistory(
                        novel_id=novel_id,
                        user_id=current_user.id,
                        generation_type="detailed_outline",
                        target_id=detailed_outline_id,
                        output_content=full_content,
                        duration_seconds=time.time() - start_time,
                        status=GenerationStatus.COMPLETED
                    )
                    db.add(history)
                    
                    # Also save to chapteroutlines table for frontend compatibility
                    from app.models.database import ChapterOutline
                    try:
                        # Check if exists
                        existing_chapter_outline = db.query(ChapterOutline).filter(
                            ChapterOutline.novelId == novel_id,
                            ChapterOutline.chapterNumber == chapter_num
                        ).first()
                        
                        if existing_chapter_outline:
                            # Update existing
                            existing_chapter_outline.fullContent = full_content
                            existing_chapter_outline.version += 1
                            existing_chapter_outline.updatedAt = datetime.utcnow()
                        else:
                            # Create new
                            chapter_outline = ChapterOutline(
                                novelId=novel_id,
                                userId=current_user.id,
                                chapterNumber=chapter_num,
                                fullContent=full_content,
                                version=1
                            )
                            db.add(chapter_outline)
                        
                        print(f"✓ Saved chapter {chapter_num} outline to chapteroutlines table")
                    except Exception as e:
                        # Log error but don't fail the generation
                        print(f"Warning: Failed to sync to chapteroutlines table: {e}")
                        import traceback
                        traceback.print_exc()
                
                yield f"data: {json.dumps({'chapter': chapter_num, 'status': 'completed', 'detailed_outline_id': detailed_outline_id})}\n\n"
            
            yield f"data: {json.dumps({'done': True, 'total_chapters': request.end_chapter - request.start_chapter + 1})}\n\n"
            
        except Exception as e:
            # Mark all as failed
            with db.begin():
                for detailed_outline_id in detailed_outline_ids:
                    db_detailed = db.query(DetailedOutline).filter(
                        DetailedOutline.id == detailed_outline_id
                    ).first()
                    if db_detailed:
                        db_detailed.status = GenerationStatus.FAILED
                
                history = GenerationHistory(
                    novel_id=novel_id,
                    user_id=current_user.id,
                    generation_type="detailed_outline",
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


@router.get("/detailed-outlines", response_model=List[DetailedOutlineResponse])
async def list_detailed_outlines(
    novel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all detailed outlines for a novel
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    detailed_outlines = db.query(DetailedOutline).filter(
        DetailedOutline.novel_id == novel_id,
        DetailedOutline.user_id == current_user.id,
        DetailedOutline.is_current == True
    ).order_by(DetailedOutline.start_chapter).all()
    
    return [DetailedOutlineResponse.model_validate(d) for d in detailed_outlines]


@router.get("/detailed-outlines/{chapter_number}", response_model=DetailedOutlineResponse)
async def get_detailed_outline(
    novel_id: int,
    chapter_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get detailed outline for a specific chapter
    """
    novel = get_novel_or_404(db, novel_id, current_user.id)
    
    detailed_outline = db.query(DetailedOutline).filter(
        DetailedOutline.novel_id == novel_id,
        DetailedOutline.user_id == current_user.id,
        DetailedOutline.start_chapter == chapter_number,
        DetailedOutline.is_current == True
    ).first()
    
    if not detailed_outline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detailed outline not found"
        )
    
    return DetailedOutlineResponse.model_validate(detailed_outline)



# ============================================================================
# NEW SIMPLE DETAILED OUTLINE GENERATION - COMPLETELY REWRITTEN
# ============================================================================

@router.post("/detailed-outlines/generate-simple")
async def generate_detailed_outlines_simple(
    novel_id: int,
    request: DetailedOutlineGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Simple detailed outline generation - Non-streaming response
    Returns complete results after generation is finished
    """
    from datetime import datetime
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.config.settings import get_settings
    from app.models.database import ChapterOutline
    
    settings = get_settings()
    
    # Validate configuration
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY 未配置，请在环境变量或配置文件中设置")
    
    if not settings.OPENAI_API_BASE:
        raise HTTPException(status_code=400, detail="OPENAI_API_BASE 未配置，请在环境变量或配置文件中设置")
    
    # Get novel
    novel = db.query(Novel).filter(
        Novel.id == novel_id,
        Novel.user_id == current_user.id
    ).first()
    
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    
    # Get outline
    outline = db.query(Outline).filter(
        Outline.novel_id == novel_id,
        Outline.user_id == current_user.id,
        Outline.is_current == True
    ).first()
    
    if not outline:
        raise HTTPException(status_code=400, detail="No outline found. Please generate outline first.")
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == current_user.id
    ).all()
    
    # Validate chapter range
    if request.end_chapter - request.start_chapter + 1 > 5:
        raise HTTPException(status_code=400, detail="Can only generate up to 5 chapters at once")
    
    # Initialize LLM (non-streaming)
    llm = ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        model=settings.OPENAI_MODEL,
        temperature=0.7,
        streaming=False,
        timeout=120.0,
    )
    
    print(f"\n{'='*80}")
    print(f"开始生成细纲 - 小说: {novel.title}")
    print(f"章节范围: {request.start_chapter} - {request.end_chapter}")
    print(f"{'='*80}\n")

    results: list[dict] = []
    errors: list[dict] = []
    
    try:
        # Generate for each chapter
        for chapter_num in range(request.start_chapter, request.end_chapter + 1):
            print(f"\n--- 开始生成第{chapter_num}章 ---")
            
            try:
                # Get previous chapters
                previous_chapters = (
                    db.query(Chapter)
                    .filter(
                        Chapter.novel_id == novel_id,
                        Chapter.user_id == current_user.id,
                        Chapter.chapter_number < chapter_num,
                        Chapter.is_current == True,
                    )
                    .order_by(Chapter.chapter_number.desc())
                    .limit(3)
                    .all()
                )
                
                previous_summary = (
                    "\n\n".join(
                        [
                            f"第{ch.chapter_number}章：{ch.content[:300]}..."
                            for ch in reversed(previous_chapters)
                        ]
                    )
                    if previous_chapters
                    else "这是开篇章节"
                )
                
                # Build character description
                char_desc = "\n".join(
                    [
                        f"- {c.name}: {c.role or ''} - {c.personality or ''}"
                        for c in characters
                    ]
                )
                
                # Build comprehensive prompt
                system_prompt = """你是一位专业的小说细纲策划师。你的任务是根据大纲、人物设定和前文内容，创作详细的章节细纲。

细纲必须包含以下10个部分，每个部分都要详细展开：
1. 章节标题
2. 前文回顾
3. 本章主要场景
4. 出场人物
5. 详细情节发展（分5个阶段）
6. 人物关系变化
7. 关键对话要点
8. 情感基调
9. 伏笔设置
10. 与前后章节的衔接

请确保生成的细纲详细具体（严格要求：约2000字，不要超过2000字），便于后续章节内容的创作。"""
                user_prompt = f"""请为小说《{novel.title}》生成第{chapter_num}章的详细细纲。

【小说信息】
类型：{novel.genre or '未指定'}
风格：{novel.style or '未指定'}

【主要人物】
{char_desc if char_desc else '暂无人物设定'}

【总体大纲】
{outline.content}

【前文总结】
{previous_summary}

【任务要求】
请生成详细细纲（严格要求：约2000字，不要超过2000字），必须包含以下10个部分：

1. **章节标题**（简洁有力，10字以内）

2. **前文回顾**（200字）
   - 总结前面章节的关键情节
   - 主要人物的当前状态

3. **本章主要场景**（300字）
   - 场景设置（时间、地点）
   - 环境氛围描述
   - 场景转换

4. **出场人物**（150字）
   - 列出本章出场的主要人物
   - 每个人物的当前状态和目标

5. **详细情节发展**（1000字，分5个阶段）
   - 开场（200字）：如何开始
   - 发展（200字）：情节推进
   - 转折（200字）：出现变化
   - 高潮（200字）：冲突顶点
   - 结尾（200字）：如何收尾

6. **人物关系变化**（150字）
   - 人物之间关系的发展
   - 新的矛盾或和解

7. **关键对话要点**（150字）
   - 列出3-5个重要对话的主题
   - 对话要推动情节或展现人物性格

8. **情感基调**（100字）
   - 本章的整体氛围
   - 读者应该感受到的情绪

9. **伏笔设置**（100字）
   - 为后续章节埋下的伏笔
   - 未解之谜或悬念

10. **与前后章节的衔接**（100字）
    - 如何承接上一章
    - 如何引出下一章

要求：
- 每个部分都要详细展开，不要省略
- 内容要具体可操作，便于后续写作
- 符合人物性格和故事逻辑
- 与总体大纲保持一致
- 确保内容完整，总字数约2000字（严格要求：不要超过2000字）"""
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
                
                print("调用AI模型生成...")
                print(f"API Base: {settings.OPENAI_API_BASE}")
                print(f"Model: {settings.OPENAI_MODEL}")
                print(f"API Key: {'已设置' if settings.OPENAI_API_KEY else '未设置'}")
                
                # Generate with non-streaming call
                print("开始非流式调用...")
                response = await llm.ainvoke(messages)
                
                # Extract content from response
                if hasattr(response, "content"):
                    full_content = response.content
                elif isinstance(response, str):
                    full_content = response
                else:
                    full_content = str(response)
                
                print(f"\n生成完成！总长度: {len(full_content)} 字符")
                
                # 如果超过2000字，截断到2000字
                if len(full_content) > 2000:
                    print(f"警告：细纲过长 ({len(full_content)} 字)，截断到2000字")
                    full_content = full_content[:2000]
                
                # Validate content
                if not full_content or len(full_content.strip()) < 100:
                    error_msg = (
                        f"第{chapter_num}章生成的内容为空或过短（{len(full_content)} 字符），"
                        "请检查AI模型配置和网络连接"
                    )
                    print(f"✗ {error_msg}")
                    print(f"内容预览: {repr(full_content[:200])}")
                    errors.append(
                        {
                            "chapter": chapter_num,
                            "error": error_msg,
                        }
                    )
                    continue
                
                # Save to database
                try:
                    print(f"\n开始保存第{chapter_num}章到数据库...")
                    print(f"内容长度: {len(full_content)} 字符")
                    print(f"内容预览: {full_content[:100]}...")
                    
                    # Save to detailed_outlines
                    detailed_outline = DetailedOutline(
                        outline_id=outline.id,
                        novel_id=novel_id,
                        user_id=current_user.id,
                        group_index=request.group_index,
                        start_chapter=chapter_num,
                        end_chapter=chapter_num,
                        content=full_content,
                        status=GenerationStatus.COMPLETED,
                    )
                    db.add(detailed_outline)
                    db.flush()
                    print(f"✓ DetailedOutline 已添加，ID: {detailed_outline.id}")
                    
                    # Save to chapteroutlines for frontend
                    existing = (
                        db.query(ChapterOutline)
                        .filter(
                            ChapterOutline.novelId == novel_id,
                            ChapterOutline.chapterNumber == chapter_num,
                        )
                        .first()
                    )
                    
                    if existing:
                        print(f"找到现有记录 ID: {existing.id}，准备更新...")
                        existing.fullContent = full_content
                        existing.version += 1
                        existing.updatedAt = datetime.utcnow()
                        db.flush()
                        print(
                            f"✓ 更新现有细纲记录 ID: {existing.id}, version: {existing.version}"
                        )
                    else:
                        print("未找到现有记录，创建新记录...")
                        chapter_outline = ChapterOutline(
                            novelId=novel_id,
                            userId=current_user.id,
                            chapterNumber=chapter_num,
                            fullContent=full_content,
                            version=1,
                        )
                        db.add(chapter_outline)
                        db.flush()
                        print(f"✓ 创建新细纲记录 ID: {chapter_outline.id}")
                    
                    db.commit()
                    print("✓ 数据库提交成功！")
                    
                    # Verify save
                    verify = (
                        db.query(ChapterOutline)
                        .filter(
                            ChapterOutline.novelId == novel_id,
                            ChapterOutline.chapterNumber == chapter_num,
                        )
                        .first()
                    )
                    if verify:
                        print(
                            f"✓ 验证成功：记录 ID={verify.id}, "
                            f"内容长度={len(verify.fullContent or '')} 字符"
                        )
                        results.append(
                            {
                                "chapter": chapter_num,
                                "content": full_content,
                                "detailed_outline_id": detailed_outline.id,
                                "chapter_outline_id": verify.id,
                            }
                        )
                    else:
                        print("✗ 验证失败：保存后查询不到记录！")
                        errors.append(
                            {
                                "chapter": chapter_num,
                                "error": "保存后验证失败",
                            }
                        )
                
                except Exception as save_error:
                    db.rollback()
                    error_msg = f"第{chapter_num}章保存失败: {save_error}"
                    print(f"✗ {error_msg}")
                    import traceback
                    
                    traceback.print_exc()
                    errors.append(
                        {
                            "chapter": chapter_num,
                            "error": error_msg,
                        }
                    )
                    continue
            
            except Exception as chapter_error:
                print(f"\n✗ 第{chapter_num}章生成失败: {chapter_error}")
                import traceback
                
                traceback.print_exc()
                errors.append(
                    {
                        "chapter": chapter_num,
                        "error": str(chapter_error),
                    }
                )
                continue
            
            print(f"\n{'='*80}")
        
        print(f"全部生成完成！成功: {len(results)}, 失败: {len(errors)}")
        print(f"{'='*80}\n")
        
        # Return results
        return {
            "success": True,
            "total_chapters": request.end_chapter - request.start_chapter + 1,
            "successful": len(results),
            "failed": len(errors),
            "results": results,
            "errors": errors,
        }
    
    except Exception as e:
        print(f"\n✗ 生成失败: {e}")
        import traceback
        
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

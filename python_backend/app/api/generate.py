"""
Enhanced Generation API - Streaming generation with knowledge base integration
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import json
import time
import logging

from app.db.mysql import get_db
from app.models.database import (
    Novel, Chapter, Character, Outline, DetailedOutline, User,
    GenerationStatus, ReviewStatus, GenerationHistory, AIModelConfig,
    KnowledgeEntry, StoryEvent, ContentVersion
)
from app.services.auth import get_current_active_user
from app.services.langchain.rag_service import get_rag_service
from app.services.langchain.llm_service import get_llm_service
from app.services.langchain.rerank_service import get_rerank_service
from app.services.knowledge_service import get_knowledge_service

router = APIRouter(prefix="/generate", tags=["Generation"])
logger = logging.getLogger(__name__)


# ==================== Schemas ====================

class GenerateChapterRequest(BaseModel):
    novel_id: int
    chapter_number: int
    detailed_outline_id: Optional[int] = None
    target_word_count: int = 2000
    include_knowledge: bool = True
    include_characters: bool = True
    include_events: bool = True
    custom_prompt: Optional[str] = None


class GenerateOutlineRequest(BaseModel):
    novel_id: int
    custom_prompt: Optional[str] = None
    include_characters: bool = True


class GenerateDetailedOutlineRequest(BaseModel):
    novel_id: int
    outline_id: int
    group_index: int
    start_chapter: int
    end_chapter: int
    custom_prompt: Optional[str] = None


class AIModifyRequest(BaseModel):
    content: str
    instruction: str
    novel_id: int


class ConfirmGenerationRequest(BaseModel):
    novel_id: int
    content_type: str  # chapter, outline, detailed_outline
    content_id: int
    content: str
    extract_knowledge: bool = True


class KnowledgeContext(BaseModel):
    characters: List[dict] = []
    events: List[dict] = []
    knowledge_entries: List[dict] = []
    world_setting: Optional[str] = None
    previous_chapters: List[dict] = []
    foreshadowing: List[dict] = []
    previous_summaries: List[dict] = []


# ==================== Helper Functions ====================

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


def get_user_model_config(db: Session, user_id: int) -> Optional[AIModelConfig]:
    """Get user's default model config"""
    return db.query(AIModelConfig).filter(
        AIModelConfig.user_id == user_id,
        AIModelConfig.is_default == True,
        AIModelConfig.is_active == True
    ).first()


async def gather_knowledge_context(
    db: Session,
    user_id: int,
    novel_id: int,
    chapter_number: Optional[int] = None,
    query: Optional[str] = None
) -> KnowledgeContext:
    """Gather all relevant knowledge context for generation"""
    from app.models.database import Foreshadowing, ChapterReview
    context = KnowledgeContext()
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == user_id
    ).all()
    
    context.characters = [{
        "id": c.id,
        "name": c.name,
        "role": c.role,
        "gender": c.gender,
        "personality": c.personality,
        "background": c.background,
        "appearance": c.appearance,
        "abilities": c.abilities,
        "relationships": c.relationships
    } for c in characters]
    
    # Get events
    events = db.query(StoryEvent).filter(
        StoryEvent.novel_id == novel_id,
        StoryEvent.user_id == user_id
    ).order_by(StoryEvent.id).all()
    
    context.events = [{
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "event_type": e.event_type,
        "importance": e.importance,
        "characters_involved": e.characters_involved,
        "location": e.location
    } for e in events]
    
    # Get knowledge entries
    knowledge_entries = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.novel_id == novel_id,
        KnowledgeEntry.user_id == user_id
    ).order_by(KnowledgeEntry.id.desc()).limit(20).all()
    
    context.knowledge_entries = [{
        "id": k.id,
        "entry_type": k.entry_type,
        "content": k.content,
        "metadata": k.extra_metadata
    } for k in knowledge_entries]
    
    # Get novel world setting
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if novel:
        context.world_setting = novel.world_setting
    
    # Get previous chapters for context (full content)
    if chapter_number and chapter_number > 1:
        prev_chapters = db.query(Chapter).filter(
            Chapter.novel_id == novel_id,
            Chapter.user_id == user_id,
            Chapter.chapter_number < chapter_number,
            Chapter.is_current == True
        ).order_by(Chapter.chapter_number.desc()).limit(3).all()

        context.previous_chapters = [{
            "chapter_number": c.chapter_number,
            "title": c.title,
            "content": c.content or ""  # Full content
        } for c in prev_chapters]

    # Get pending foreshadowing (伏笔) - filter by planned resolution chapter
    if chapter_number:
        # Query foreshadowing that should be resolved around current chapter (±5 chapters)
        pending_foreshadowing = db.query(Foreshadowing).filter(
            Foreshadowing.novelId == novel_id,
            Foreshadowing.userId == user_id,
            Foreshadowing.status == 'pending',
            Foreshadowing.chapterId < chapter_number,
            # Include if planned resolution is near current chapter or not set
            (Foreshadowing.planned_resolution_chapter == None) |
            ((Foreshadowing.planned_resolution_chapter >= chapter_number - 5) &
             (Foreshadowing.planned_resolution_chapter <= chapter_number + 5))
        ).all()

        # Get chapters where foreshadowing was set up
        foreshadowing_chapters = {}
        for f in pending_foreshadowing:
            if f.chapterId and f.chapterId not in foreshadowing_chapters:
                chapter = db.query(Chapter).filter(
                    Chapter.novel_id == novel_id,
                    Chapter.chapter_number == f.chapterId,
                    Chapter.is_current == True
                ).first()
                if chapter:
                    foreshadowing_chapters[f.chapterId] = {
                        "chapter_number": chapter.chapter_number,
                        "title": chapter.title,
                        "content": chapter.content or ""
                    }

        # Add foreshadowing info to context
        context.foreshadowing = [{
            "content": f.description,
            "setup_chapter": f.chapterId,
            "planned_resolution": f.planned_resolution_chapter,
            "setup_chapter_content": foreshadowing_chapters.get(f.chapterId)
        } for f in pending_foreshadowing]

        # Get previous 10 chapters' AI summaries
        chapter_reviews = db.query(ChapterReview).join(
            Chapter, ChapterReview.chapterId == Chapter.id
        ).filter(
            ChapterReview.novelId == novel_id,
            ChapterReview.userId == user_id,
            Chapter.chapter_number < chapter_number
        ).order_by(Chapter.chapter_number.desc()).limit(10).all()

        context.previous_summaries = [{
            "chapter_number": db.query(Chapter).filter(Chapter.id == r.chapterId).first().chapter_number if r.chapterId else None,
            "plot_summary": r.plotSummary,
            "opening": r.openingDescription,
            "middle": r.middleDescription,
            "ending": r.endingDescription,
            "key_issues": r.keyIssues,
            "foreshadowing_markers": r.foreshadowingNotes,
            "resolved_foreshadowing": r.resolvedForeshadowing
        } for r in chapter_reviews]

    return context


def format_context_for_prompt(context: KnowledgeContext) -> str:
    """Format knowledge context into a prompt string"""
    parts = []
    
    # Characters
    if context.characters:
        parts.append("## 人物设定")
        for char in context.characters:
            char_info = f"### {char['name']}"
            if char.get('role'):
                char_info += f" ({char['role']})"
            if char.get('gender'):
                char_info += f" - {char['gender']}"
            parts.append(char_info)
            
            if char.get('personality'):
                parts.append(f"性格：{char['personality']}")
            if char.get('background'):
                parts.append(f"背景：{char['background']}")
            if char.get('relationships'):
                rels = char['relationships']
                if isinstance(rels, list):
                    for rel in rels:
                        parts.append(f"关系：与{rel.get('target_name', '未知')}是{rel.get('relation_type', '未知')}关系")
            parts.append("")
    
    # Events
    if context.events:
        parts.append("## 已发生的重要事件")
        for event in context.events[-10:]:  # Last 10 events
            parts.append(f"- **{event['title']}**: {event.get('description', '')[:200]}")
        parts.append("")
    
    # World setting
    if context.world_setting:
        parts.append("## 世界观设定")
        parts.append(context.world_setting[:1000])  # Truncate
        parts.append("")
    
    # Previous chapters (full content)
    if context.previous_chapters:
        parts.append("## 前文回顾（最近3章完整内容）")
        for ch in reversed(context.previous_chapters):
            parts.append(f"### 第{ch['chapter_number']}章 {ch.get('title', '')}")
            if ch.get('content'):
                parts.append(ch['content'][:2000])  # Truncate
            parts.append("")

    # Previous 10 chapters AI summaries
    if context.previous_summaries:
        parts.append("## 前10章AI总结")
        for summary in reversed(context.previous_summaries):
            if summary.get('chapter_number'):
                parts.append(f"### 第{summary['chapter_number']}章")
            if summary.get('plot_summary'):
                parts.append(f"**剧情总结**: {summary['plot_summary'][:300]}")
            if summary.get('key_issues'):
                parts.append(f"**重点问题**: {summary['key_issues'][:200]}")
            if summary.get('foreshadowing_markers'):
                parts.append(f"**本章伏笔**: {summary['foreshadowing_markers'][:200]}")
            if summary.get('resolved_foreshadowing'):
                parts.append(f"**已回收伏笔**: {summary['resolved_foreshadowing'][:200]}")
            parts.append("")

    # Foreshadowing (伏笔)
    if context.foreshadowing:
        parts.append("## 待回收的伏笔")
        for f in context.foreshadowing:
            parts.append(f"- **伏笔内容**: {f['content']}")
            parts.append(f"  **设置章节**: 第{f['setup_chapter']}章")
            if f.get('planned_resolution'):
                parts.append(f"  **计划回收**: 第{f['planned_resolution']}章")
            if f.get('setup_chapter_content'):
                setup_ch = f['setup_chapter_content']
                parts.append(f"  **设置时的章节内容**: 第{setup_ch['chapter_number']}章 {setup_ch.get('title', '')}")
                parts.append(f"  {setup_ch.get('content', '')[:300]}...")
            parts.append("")
    
    # Knowledge entries
    if context.knowledge_entries:
        parts.append("## 知识库参考")
        for entry in context.knowledge_entries[:10]:
            parts.append(f"- [{entry['entry_type']}] {entry['content'][:200]}")
        parts.append("")
    
    return "\n".join(parts)


# ==================== Endpoints ====================

@router.post("/chapter/context")
async def get_chapter_context(
    request: GenerateChapterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get knowledge context before generating a chapter
    Returns all relevant information that will be used for generation
    """
    novel = get_novel_or_404(db, request.novel_id, current_user.id)
    
    context = await gather_knowledge_context(
        db, current_user.id, request.novel_id, request.chapter_number
    )
    
    # Get detailed outline
    detailed_outline = None
    if request.detailed_outline_id:
        do = db.query(DetailedOutline).filter(
            DetailedOutline.id == request.detailed_outline_id
        ).first()
        if do:
            detailed_outline = do.content
    else:
        do = db.query(DetailedOutline).filter(
            DetailedOutline.novel_id == request.novel_id,
            DetailedOutline.start_chapter <= request.chapter_number,
            DetailedOutline.end_chapter >= request.chapter_number,
            DetailedOutline.is_current == True
        ).first()
        if do:
            detailed_outline = do.content
    
    return {
        "novel": {
            "title": novel.title,
            "genre": novel.genre,
            "style": novel.style
        },
        "detailed_outline": detailed_outline,
        "context": {
            "characters": context.characters,
            "events": context.events,
            "knowledge_entries": context.knowledge_entries,
            "world_setting": context.world_setting,
            "previous_chapters": context.previous_chapters
        }
    }


@router.post("/chapter/stream")
async def generate_chapter_stream(
    request: GenerateChapterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate chapter content with streaming response
    First queries knowledge base, then streams generation
    """
    novel = get_novel_or_404(db, request.novel_id, current_user.id)
    
    # Gather context
    context = await gather_knowledge_context(
        db, current_user.id, request.novel_id, request.chapter_number
    )
    
    # Get detailed outline
    detailed_outline_content = ""
    if request.detailed_outline_id:
        do = db.query(DetailedOutline).filter(
            DetailedOutline.id == request.detailed_outline_id
        ).first()
        if do:
            detailed_outline_content = do.content
    else:
        do = db.query(DetailedOutline).filter(
            DetailedOutline.novel_id == request.novel_id,
            DetailedOutline.start_chapter <= request.chapter_number,
            DetailedOutline.end_chapter >= request.chapter_number,
            DetailedOutline.is_current == True
        ).first()
        if do:
            detailed_outline_content = do.content
    
    # Get model config
    model_config = get_user_model_config(db, current_user.id)
    llm_service = get_llm_service(model_config)
    
    # Format context
    context_text = format_context_for_prompt(context)
    
    # Build system prompt
    system_prompt = f"""你是一位专业的小说作家，正在创作一部{novel.genre or ''}风格的小说《{novel.title}》。
你的写作风格是{novel.style or '生动有趣'}。

请根据提供的大纲、人物设定和前文内容，创作第{request.chapter_number}章的内容。

要求：
1. 字数约{request.target_word_count}字
2. 保持人物性格一致性
3. 情节要与前文衔接
4. 描写要生动，对话要自然
5. 注意伏笔和情节推进"""
    
    # Build user prompt
    user_prompt = f"""{context_text}

## 本章细纲
{detailed_outline_content}

{f'## 额外要求{chr(10)}{request.custom_prompt}' if request.custom_prompt else ''}

请开始创作第{request.chapter_number}章的内容："""
    
    start_time = time.time()
    
    async def generate_stream():
        """Stream generator with context info"""
        # First send context info
        yield f"data: {json.dumps({'type': 'context', 'data': {'characters_count': len(context.characters), 'events_count': len(context.events), 'knowledge_count': len(context.knowledge_entries)}})}\n\n"
        
        full_content = ""
        try:
            async for chunk in llm_service.generate_stream(
                prompt=user_prompt,
                system_prompt=system_prompt,
                max_tokens=request.target_word_count * 2
            ):
                full_content += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'data': chunk})}\n\n"
            
            # Send completion
            yield f"data: {json.dumps({'type': 'done', 'data': {'content': full_content, 'word_count': len(full_content), 'duration': time.time() - start_time}})}\n\n"
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/confirm")
async def confirm_generation(
    request: ConfirmGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Confirm generated content and save to database
    Optionally extract knowledge for future reference
    """
    novel = get_novel_or_404(db, request.novel_id, current_user.id)
    
    if request.content_type == "chapter":
        # Save chapter
        chapter = db.query(Chapter).filter(
            Chapter.id == request.content_id,
            Chapter.user_id == current_user.id
        ).first()
        
        if chapter:
            # Save version history
            version = ContentVersion(
                content_type="chapter",
                content_id=chapter.id,
                novel_id=request.novel_id,
                user_id=current_user.id,
                version_number=chapter.version,
                content=chapter.content or "",
                change_summary="AI生成确认",
                created_by="ai"
            )
            db.add(version)
            
            # Update chapter
            chapter.content = request.content
            chapter.word_count = len(request.content)
            chapter.generation_status = GenerationStatus.COMPLETED
            chapter.review_status = ReviewStatus.PENDING
            chapter.version += 1
        else:
            # Create new chapter
            chapter = Chapter(
                novel_id=request.novel_id,
                user_id=current_user.id,
                chapter_number=request.content_id,
                content=request.content,
                word_count=len(request.content),
                generation_status=GenerationStatus.COMPLETED,
                review_status=ReviewStatus.PENDING
            )
            db.add(chapter)
        
        db.commit()
        db.refresh(chapter)
        
        # Extract knowledge if requested
        if request.extract_knowledge:
            await extract_and_save_knowledge(
                db, current_user.id, request.novel_id, 
                chapter.id, "chapter", request.content
            )
        
        return {"success": True, "id": chapter.id, "type": "chapter"}
    
    elif request.content_type == "outline":
        outline = db.query(Outline).filter(
            Outline.id == request.content_id,
            Outline.user_id == current_user.id
        ).first()
        
        if outline:
            # Save version
            version = ContentVersion(
                content_type="outline",
                content_id=outline.id,
                novel_id=request.novel_id,
                user_id=current_user.id,
                version_number=outline.version,
                content=outline.content,
                change_summary="AI生成确认",
                created_by="ai"
            )
            db.add(version)
            
            outline.content = request.content
            outline.version += 1
        else:
            outline = Outline(
                novel_id=request.novel_id,
                user_id=current_user.id,
                content=request.content
            )
            db.add(outline)
        
        db.commit()
        db.refresh(outline)
        
        return {"success": True, "id": outline.id, "type": "outline"}
    
    elif request.content_type == "detailed_outline":
        do = db.query(DetailedOutline).filter(
            DetailedOutline.id == request.content_id,
            DetailedOutline.user_id == current_user.id
        ).first()
        
        if do:
            version = ContentVersion(
                content_type="detailed_outline",
                content_id=do.id,
                novel_id=request.novel_id,
                user_id=current_user.id,
                version_number=do.version,
                content=do.content,
                change_summary="AI生成确认",
                created_by="ai"
            )
            db.add(version)
            
            do.content = request.content
            do.version += 1
            db.commit()
            db.refresh(do)
            
            return {"success": True, "id": do.id, "type": "detailed_outline"}
    
    raise HTTPException(status_code=400, detail="Invalid content type")


@router.post("/ai-modify/stream")
async def ai_modify_stream(
    request: AIModifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    AI modify content with streaming response
    """
    novel = get_novel_or_404(db, request.novel_id, current_user.id)
    
    model_config = get_user_model_config(db, current_user.id)
    llm_service = get_llm_service(model_config)
    
    system_prompt = f"""你是一位专业的小说编辑，正在帮助作者修改《{novel.title}》的内容。
请根据用户的修改指令，对提供的内容进行修改。
保持原有的写作风格和人物特点，只按照指令进行必要的修改。"""
    
    user_prompt = f"""## 原始内容
{request.content}

## 修改指令
{request.instruction}

请输出修改后的完整内容："""
    
    async def generate_stream():
        full_content = ""
        try:
            async for chunk in llm_service.generate_stream(
                prompt=user_prompt,
                system_prompt=system_prompt
            ):
                full_content += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'data': chunk})}\n\n"
            
            yield f"data: {json.dumps({'type': 'done', 'data': {'content': full_content}})}\n\n"
            
        except Exception as e:
            logger.error(f"AI modify error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


async def extract_and_save_knowledge(
    db: Session,
    user_id: int,
    novel_id: int,
    source_id: int,
    source_type: str,
    content: str
):
    """Extract knowledge from content and save to database"""
    try:
        # Get LLM service
        llm_service = get_llm_service()
        
        # Extract knowledge using LLM
        extraction_prompt = f"""请从以下小说内容中提取关键信息：

{content[:3000]}

请以JSON格式返回提取的信息：
{{
    "characters": [
        {{"name": "角色名", "action": "该角色在本段的主要行为", "state": "角色状态变化"}}
    ],
    "events": [
        {{"title": "事件标题", "description": "事件描述", "importance": 1-10}}
    ],
    "locations": [
        {{"name": "地点名", "description": "地点描述"}}
    ],
    "items": [
        {{"name": "物品名", "description": "物品描述"}}
    ]
}}

只返回JSON，不要其他内容。"""
        
        result = await llm_service.generate(
            prompt=extraction_prompt,
            system_prompt="你是一个信息提取专家，擅长从小说内容中提取结构化信息。"
        )
        
        # Parse result
        try:
            # Clean up JSON
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            
            data = json.loads(result)
            
            # Save events
            for event in data.get("events", []):
                if event.get("title"):
                    story_event = StoryEvent(
                        novel_id=novel_id,
                        user_id=user_id,
                        chapter_id=source_id if source_type == "chapter" else None,
                        title=event["title"],
                        description=event.get("description", ""),
                        importance=event.get("importance", 5)
                    )
                    db.add(story_event)
            
            # Save knowledge entries
            for char in data.get("characters", []):
                if char.get("name") and char.get("action"):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="character_action",
                        source_id=source_id,
                        content=f"{char['name']}: {char['action']}",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
            
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
            
            for item in data.get("items", []):
                if item.get("name"):
                    entry = KnowledgeEntry(
                        novel_id=novel_id,
                        user_id=user_id,
                        entry_type="item",
                        source_id=source_id,
                        content=f"{item['name']}: {item.get('description', '')}",
                        extra_metadata={"source_type": source_type}
                    )
                    db.add(entry)
            
            db.commit()
            logger.info(f"Extracted knowledge from {source_type} {source_id}")
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse extraction result: {e}")
            
    except Exception as e:
        logger.error(f"Knowledge extraction failed: {e}")

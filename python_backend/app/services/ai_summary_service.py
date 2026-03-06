"""
AI Summary Service - Generate chapter summaries automatically
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.database import Chapter, ChapterReview, Novel, Outline, Character, ChapterOutline
from app.models.database import AIModelConfig
from app.services.langchain.llm_service import get_llm_service
import json


async def generate_chapter_summary(
    db: Session,
    user_id: int,
    novel_id: int,
    chapter_id: int,
    model_config: Optional[AIModelConfig] = None
) -> Optional[Dict[str, Any]]:
    """
    Generate AI summary for a chapter
    
    Args:
        db: Database session
        user_id: User ID
        novel_id: Novel ID
        chapter_id: Chapter ID
        model_config: AI model configuration
        
    Returns:
        Generated summary data or None if failed
    """
    # Get chapter
    chapter = db.query(Chapter).filter(
        Chapter.id == chapter_id,
        Chapter.user_id == user_id
    ).first()
    
    if not chapter:
        return None
    
    # Get novel
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        return None
    
    # Get outline
    outline = db.query(Outline).filter(
        Outline.novel_id == novel_id,
        Outline.is_active == True
    ).first()
    
    # Get chapter outline
    chapter_outline = db.query(ChapterOutline).filter(
        ChapterOutline.novelId == novel_id,
        ChapterOutline.chapterNumber == chapter.chapter_number
    ).first()
    
    # Get previous chapters (last 3)
    previous_chapters = db.query(Chapter).filter(
        Chapter.novel_id == novel_id,
        Chapter.user_id == user_id,
        Chapter.chapter_number < chapter.chapter_number,
        Chapter.is_current == True
    ).order_by(Chapter.chapter_number.desc()).limit(3).all()
    
    # Get characters
    characters = db.query(Character).filter(
        Character.novel_id == novel_id,
        Character.user_id == user_id
    ).all()
    
    # Build context
    previous_context = ""
    if previous_chapters:
        previous_context = "\n\n".join([
            f"第{c.chapter_number}章 {c.title or ''}：{(c.content or '')[:500]}..."
            for c in reversed(previous_chapters)
        ])
    
    character_info = "\n".join([
        f"- {c.name}：{c.personality or ''}"
        for c in characters
    ])
    
    # Build prompt
    prompt = f"""你是一位专业的小说编辑。请对以下章节进行详细总结和分析。

小说信息：
- 标题：{novel.title}
- 类型：{novel.genre or '未设定'}
- 风格：{novel.style or '未设定'}

{f"总大纲：{outline.content[:1000]}" if outline else ""}

{f"前文回顾：{previous_context}" if previous_context else "这是第一章"}

{f"本章细纲：{chapter_outline.fullContent[:1000]}" if chapter_outline else ""}

本章内容（第{chapter.chapter_number}章）：
{chapter.content}

{f"主要角色：{character_info}" if character_info else ""}

请进行以下总结和分析（使用JSON格式返回）：

1. plotSummary: 剧情总结（300-500字）
2. openingDescription: 开头描述（150-200字）
3. middleDescription: 中间发展（200-300字）
4. endingDescription: 结尾描述（150-200字）
5. keyIssues: 重点问题描述（200-300字）
6. qualityScore: 章节质量评分（1-10）
7. foreshadowingMarkers: 本章设置的伏笔（字符串）
8. resolvedForeshadowing: 已回收的伏笔（字符串）
9. overallComment: 整体评价（200-300字）

注意：所有字符串字段中的换行请使用\\n表示，确保返回有效的JSON格式。"""
    
    # Generate summary
    llm_service = get_llm_service(model_config)
    
    system_prompt = """你是一位专业的小说编辑，擅长总结和分析小说章节。

你的任务是：
1. 总结本章的剧情要点（开头、中间、结尾）
2. 结合前文上下文，分析剧情连贯性
3. 指出存在的问题和不合理之处
4. 识别伏笔的设置和回收

重要：返回有效的JSON格式，所有字符串中的换行使用\\n表示。"""
    
    try:
        response = await llm_service.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            response_format="json"
        )
        
        # Parse JSON
        summary_data = json.loads(response)
        
        # Save to database
        review = ChapterReview(
            novel_id=novel_id,
            user_id=user_id,
            chapter_id=chapter_id,
            quality_score=summary_data.get('qualityScore', 0),
            plot_summary=summary_data.get('plotSummary'),
            opening_description=summary_data.get('openingDescription'),
            middle_description=summary_data.get('middleDescription'),
            ending_description=summary_data.get('endingDescription'),
            key_issues=summary_data.get('keyIssues'),
            foreshadowing_markers=summary_data.get('foreshadowingMarkers'),
            resolved_foreshadowing=summary_data.get('resolvedForeshadowing'),
            overall_comment=summary_data.get('overallComment')
        )

        db.add(review)
        db.commit()
        db.refresh(review)

        # Auto-mark resolved foreshadowing
        if summary_data.get('resolvedForeshadowing'):
            try:
                from app.models.database import Foreshadowing
                # Get all pending foreshadowing for this novel
                pending_foreshadowing = db.query(Foreshadowing).filter(
                    Foreshadowing.novel_id == novel_id,
                    Foreshadowing.user_id == user_id,
                    Foreshadowing.status == 'pending'
                ).all()

                resolved_text = summary_data.get('resolvedForeshadowing', '').lower()

                # Try to match and mark as resolved
                for f in pending_foreshadowing:
                    # Simple matching: if foreshadowing content appears in resolved text
                    if f.content and f.content.lower() in resolved_text:
                        f.status = 'resolved'
                        f.actual_resolution_chapter_id = chapter_id
                        f.resolution_content = summary_data.get('resolvedForeshadowing')
                        print(f"Auto-marked foreshadowing {f.id} as resolved in chapter {chapter.chapter_number}")

                db.commit()
            except Exception as mark_error:
                print(f"Warning: Failed to auto-mark resolved foreshadowing: {mark_error}")

        return summary_data

    except Exception as e:
        print(f"Error generating chapter summary: {e}")
        import traceback
        traceback.print_exc()
        return None


"""
章节生成 API（基于 LangGraph）
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy.orm import Session

from app.db.mysql import get_db
from app.services.auth import get_current_active_user
from app.models.database import User, Chapter
from app.services.langgraph.chapter_generation_graph import chapter_generation_graph

router = APIRouter(prefix="/chapter-generation", tags=["chapter-generation"])


class GenerateChapterOutlineRequest(BaseModel):
    novel_id: int
    chapter_number: int


class GenerateChapterOutlineResponse(BaseModel):
    success: bool
    chapter_outline: Dict
    message: str


class GenerateChapterContentRequest(BaseModel):
    novel_id: int
    chapter_number: int
    target_word_count: int = 5000


class GenerateChapterContentResponse(BaseModel):
    success: bool
    chapter_id: int
    content: str
    summary: str
    extracted_knowledge: List[Dict]
    message: str


class BatchGenerateOutlinesRequest(BaseModel):
    novel_id: int
    start_chapter: int
    end_chapter: int


class BatchGenerateOutlinesResponse(BaseModel):
    success: bool
    total: int
    succeeded: int
    failed: int
    results: List[Dict]
    message: str


class BatchGenerateContentRequest(BaseModel):
    novel_id: int
    start_chapter: int
    end_chapter: int
    target_word_count: int = 5000


class BatchGenerateContentResponse(BaseModel):
    success: bool
    total: int
    succeeded: int
    failed: int
    results: List[Dict]
    message: str


@router.post("/outline", response_model=GenerateChapterOutlineResponse)
async def generate_chapter_outline(
    request: GenerateChapterOutlineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """生成细纲（基于 LangGraph）"""
    from sqlalchemy import text
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"开始生成第{request.chapter_number}章细纲")

        # 获取总大纲
        outline_query = text("""
            SELECT content FROM outlines
            WHERE novel_id = :novel_id AND user_id = :user_id AND is_active = 1
            ORDER BY created_at DESC LIMIT 1
        """)
        outline_result = db.execute(outline_query, {
            "novel_id": request.novel_id,
            "user_id": current_user.id
        }).fetchone()

        if not outline_result:
            raise HTTPException(status_code=404, detail="未找到大纲")

        outline = outline_result[0]

        # 获取前几章细纲
        previous_outlines_query = text("""
            SELECT chapterNumber, plotDevelopment, characterDynamics, sceneDescription
            FROM chapteroutlines
            WHERE novelId = :novel_id AND userId = :user_id AND chapterNumber < :chapter_number
            ORDER BY chapterNumber DESC LIMIT 3
        """)
        previous_outlines = db.execute(previous_outlines_query, {
            "novel_id": request.novel_id,
            "user_id": current_user.id,
            "chapter_number": request.chapter_number
        }).fetchall()

        previous_outlines_list = [
            {
                "chapter_number": row[0],
                "plot_development": row[1],
                "character_dynamics": row[2],
                "scene_description": row[3]
            }
            for row in previous_outlines
        ]

        # 获取前几章摘要
        previous_summaries_query = text("""
            SELECT ai_summary FROM chapters
            WHERE novel_id = :novel_id AND user_id = :user_id AND chapter_number < :chapter_number
            ORDER BY chapter_number DESC LIMIT 2
        """)
        previous_summaries = db.execute(previous_summaries_query, {
            "novel_id": request.novel_id,
            "user_id": current_user.id,
            "chapter_number": request.chapter_number
        }).fetchall()

        previous_summaries_list = [row[0] for row in previous_summaries if row[0]]

        # 构建初始状态（只生成细纲，不生成正文）
        initial_state = {
            "novel_id": request.novel_id,
            "user_id": current_user.id,
            "chapter_number": request.chapter_number,
            "target_word_count": None,  # 设置为 None，表示只生成细纲，不生成正文
            "outline": outline,
            "previous_outlines": previous_outlines_list,
            "previous_summaries": previous_summaries_list,
            "characters": [],
            "locations": [],
            "items": [],
            "organizations": [],
            "foreshadowing": [],
            "character_relations": [],
            "chapter_outline": None,
            "chapter_content": None,
            "chapter_summary": None,
            "extracted_knowledge": None,
            "new_foreshadowing": None,
            "error": None
        }

        logger.info(f"初始状态: {initial_state}")

        # 执行工作流（会自动在生成细纲后停止，因为 target_word_count 为 None）
        result = chapter_generation_graph.invoke(initial_state)

        logger.info(f"工作流执行完成")
        logger.info(f"结果: {result}")

        if result.get('error'):
            raise HTTPException(status_code=500, detail=result['error'])

        # 保存细纲到数据库
        chapter_outline = result.get('chapter_outline')

        if not chapter_outline:
            raise HTTPException(status_code=500, detail="细纲生成失败：未返回细纲内容")

        content = chapter_outline['content']

        # 检查是否已存在
        check_query = text("""
            SELECT id FROM chapteroutlines
            WHERE novelId = :novel_id AND userId = :user_id AND chapterNumber = :chapter_number
        """)
        existing = db.execute(check_query, {
            "novel_id": request.novel_id,
            "user_id": current_user.id,
            "chapter_number": request.chapter_number
        }).fetchone()

        if existing:
            # 更新
            update_query = text("""
                UPDATE chapteroutlines
                SET fullContent = :content,
                    plotDevelopment = :content,
                    previousSummary = :content,
                    characterDynamics = :content,
                    sceneDescription = :content,
                    keyPoints = :content,
                    updatedAt = NOW()
                WHERE id = :id
            """)
            db.execute(update_query, {"id": existing[0], "content": content})
        else:
            # 插入
            insert_query = text("""
                INSERT INTO chapteroutlines
                (novelId, userId, chapterNumber, fullContent, plotDevelopment, previousSummary, characterDynamics, sceneDescription, keyPoints, createdAt, updatedAt)
                VALUES (:novel_id, :user_id, :chapter_number, :content, :content, :content, :content, :content, :content, NOW(), NOW())
            """)
            db.execute(insert_query, {
                "novel_id": request.novel_id,
                "user_id": current_user.id,
                "chapter_number": request.chapter_number,
                "content": content
            })

        db.commit()

        return GenerateChapterOutlineResponse(
            success=True,
            chapter_outline=chapter_outline,
            message=f"第{request.chapter_number}章细纲生成成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"细纲生成失败: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"细纲生成失败: {str(e)}")


@router.post("/content", response_model=GenerateChapterContentResponse)
async def generate_chapter_content(
    request: GenerateChapterContentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    生成章节内容（基于 LangGraph）

    流程：
    1. 获取细纲
    2. 获取前几章摘要
    3. 从向量库检索相关知识
    4. 生成章节内容
    5. 生成AI摘要
    6. 提取知识
    7. 同步到知识库
    """
    from sqlalchemy import text

    # 获取细纲
    outline_query = text("""
        SELECT fullContent, plotDevelopment, characterDynamics, sceneDescription, keyPoints
        FROM chapteroutlines
        WHERE novelId = :novel_id AND userId = :user_id AND chapterNumber = :chapter_number
    """)
    outline_result = db.execute(outline_query, {
        "novel_id": request.novel_id,
        "user_id": current_user.id,
        "chapter_number": request.chapter_number
    }).fetchone()

    if not outline_result:
        raise HTTPException(status_code=404, detail="未找到细纲，请先生成细纲")

    # 构建细纲内容（优先使用细纲管理的完整内容）
    full_content = (outline_result[0] or "").strip()
    if full_content:
        chapter_outline_content = full_content
    else:
        chapter_outline_content = f"""
剧情发展：{outline_result[1] or ''}
人物动态：{outline_result[2] or ''}
场景描述：{outline_result[3] or ''}
关键对话：{outline_result[4] or ''}
"""

    # 获取前几章摘要（从 chapterreviews 表）
    previous_summaries_query = text("""
        SELECT cr.plotSummary
        FROM chapterreviews cr
        JOIN chapters c ON cr.chapterId = c.id
        WHERE c.novel_id = :novel_id AND c.user_id = :user_id AND c.chapter_number < :chapter_number
        ORDER BY c.chapter_number DESC LIMIT 3
    """)
    previous_summaries = db.execute(previous_summaries_query, {
        "novel_id": request.novel_id,
        "user_id": current_user.id,
        "chapter_number": request.chapter_number
    }).fetchall()

    previous_summaries_list = [row[0] for row in previous_summaries if row[0]]

    # 获取总大纲（用于生成章节内容时参考）
    main_outline_query = text("""
        SELECT content FROM outlines
        WHERE novel_id = :novel_id AND user_id = :user_id AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
    """)
    main_outline_result = db.execute(main_outline_query, {
        "novel_id": request.novel_id,
        "user_id": current_user.id
    }).fetchone()

    main_outline = main_outline_result[0] if main_outline_result else ""

    # 构建初始状态（向量库检索会在 LangGraph 的 retrieve_knowledge 节点中执行）
    initial_state = {
        "novel_id": request.novel_id,
        "user_id": current_user.id,
        "chapter_number": request.chapter_number,
        "target_word_count": request.target_word_count,
        "outline": main_outline,  # 添加总大纲
        "previous_outlines": [],
        "previous_summaries": previous_summaries_list,
        "chapter_outline": {"content": chapter_outline_content},
        "characters": [],  # 会在 retrieve_knowledge 节点中填充
        "locations": [],   # 会在 retrieve_knowledge 节点中填充
        "items": [],       # 会在 retrieve_knowledge 节点中填充
        "organizations": [], # 会在 retrieve_knowledge 节点中填充
        "foreshadowing": [], # 会在 retrieve_knowledge 节点中填充
        "character_relations": [],
        "chapter_content": None,
        "chapter_summary": None,
        "extracted_knowledge": None,
        "new_foreshadowing": None,
        "error": None
    }

    # 执行完整工作流
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"开始生成第{request.chapter_number}章内容")
        logger.info(f"初始状态: {initial_state}")

        result = chapter_generation_graph.invoke(initial_state)

        logger.info(f"工作流执行完成")
        logger.info(f"结果: {result}")

        if result.get('error'):
            raise HTTPException(status_code=500, detail=result['error'])

        # 保存章节到数据库
        content = result['chapter_content']
        word_count = len(content) if content else 0

        chapter = Chapter(
            novel_id=request.novel_id,
            user_id=current_user.id,
            chapter_number=request.chapter_number,
            title=f"第{request.chapter_number}章",
            content=content,
            word_count=word_count
        )
        db.add(chapter)
        db.commit()
        db.refresh(chapter)

        # 暂时跳过 ChapterReview 保存
        logger.info(f"章节保存成功，ID: {chapter.id}")

        return GenerateChapterContentResponse(
            success=True,
            chapter_id=chapter.id,
            content=result['chapter_content'],
            summary=result['chapter_summary'],
            extracted_knowledge=result.get('extracted_knowledge', []),
            message=f"第{request.chapter_number}章生成成功"
        )

    except Exception as e:
        db.rollback()
        import traceback
        logger.error(f"章节生成失败: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"章节生成失败: {str(e)}")


@router.post("/batch-outlines", response_model=BatchGenerateOutlinesResponse)
async def batch_generate_outlines(
    request: BatchGenerateOutlinesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """批量生成细纲（按顺序）"""
    import logging
    logger = logging.getLogger(__name__)
    
    if request.start_chapter > request.end_chapter:
        raise HTTPException(status_code=400, detail="起始章节号不能大于结束章节号")
    
    if request.end_chapter - request.start_chapter + 1 > 100:
        raise HTTPException(status_code=400, detail="一次最多生成100章细纲")
    
    total = request.end_chapter - request.start_chapter + 1
    succeeded = 0
    failed = 0
    results = []
    
    logger.info(f"开始批量生成细纲：第{request.start_chapter}章到第{request.end_chapter}章，共{total}章")
    
    for chapter_number in range(request.start_chapter, request.end_chapter + 1):
        try:
            logger.info(f"正在生成第{chapter_number}章细纲...")
            
            # 调用单个细纲生成逻辑
            outline_request = GenerateChapterOutlineRequest(
                novel_id=request.novel_id,
                chapter_number=chapter_number
            )
            
            result = await generate_chapter_outline(
                request=outline_request,
                db=db,
                current_user=current_user
            )
            
            results.append({
                "chapter_number": chapter_number,
                "success": True,
                "message": result.message
            })
            succeeded += 1
            logger.info(f"第{chapter_number}章细纲生成成功")
            
        except Exception as e:
            logger.error(f"第{chapter_number}章细纲生成失败: {e}")
            results.append({
                "chapter_number": chapter_number,
                "success": False,
                "message": f"生成失败: {str(e)}"
            })
            failed += 1
    
    return BatchGenerateOutlinesResponse(
        success=failed == 0,
        total=total,
        succeeded=succeeded,
        failed=failed,
        results=results,
        message=f"批量生成完成：成功{succeeded}章，失败{failed}章"
    )


@router.post("/batch-content", response_model=BatchGenerateContentResponse)
async def batch_generate_content(
    request: BatchGenerateContentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """批量生成章节内容（按顺序，需要先有细纲）"""
    import logging
    logger = logging.getLogger(__name__)
    
    if request.start_chapter > request.end_chapter:
        raise HTTPException(status_code=400, detail="起始章节号不能大于结束章节号")
    
    if request.end_chapter - request.start_chapter + 1 > 50:
        raise HTTPException(status_code=400, detail="一次最多生成50章内容")
    
    total = request.end_chapter - request.start_chapter + 1
    succeeded = 0
    failed = 0
    results = []
    
    logger.info(f"开始批量生成章节内容：第{request.start_chapter}章到第{request.end_chapter}章，共{total}章")
    
    for chapter_number in range(request.start_chapter, request.end_chapter + 1):
        try:
            logger.info(f"正在生成第{chapter_number}章内容...")
            
            # 调用单个章节内容生成逻辑
            content_request = GenerateChapterContentRequest(
                novel_id=request.novel_id,
                chapter_number=chapter_number,
                target_word_count=request.target_word_count
            )
            
            result = await generate_chapter_content(
                request=content_request,
                db=db,
                current_user=current_user
            )
            
            results.append({
                "chapter_number": chapter_number,
                "success": True,
                "chapter_id": result.chapter_id,
                "message": result.message
            })
            succeeded += 1
            logger.info(f"第{chapter_number}章内容生成成功")
            
        except Exception as e:
            logger.error(f"第{chapter_number}章内容生成失败: {e}")
            results.append({
                "chapter_number": chapter_number,
                "success": False,
                "message": f"生成失败: {str(e)}"
            })
            failed += 1
    
    return BatchGenerateContentResponse(
        success=failed == 0,
        total=total,
        succeeded=succeeded,
        failed=failed,
        results=results,
        message=f"批量生成完成：成功{succeeded}章，失败{failed}章"
    )


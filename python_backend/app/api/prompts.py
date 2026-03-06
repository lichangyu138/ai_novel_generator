"""
Prompt模板管理API路由
管理大纲、细纲、章节生成的Prompt模板
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from ..services.auth import get_current_user_dict as get_current_user

router = APIRouter(prefix="/prompts", tags=["prompts"])


# ============================================
# 请求/响应模型
# ============================================

class PromptTemplateCreate(BaseModel):
    name: str
    template_type: str  # outline, detailed_outline, chapter, character, worldbuilding, revision
    content: str
    description: Optional[str] = None
    variables: Optional[List[str]] = None  # 模板中使用的变量列表
    is_default: bool = False


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class PromptTemplateResponse(BaseModel):
    id: int
    user_id: int
    name: str
    template_type: str
    content: str
    description: Optional[str]
    variables: Optional[List[str]]
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PromptPreviewRequest(BaseModel):
    template_id: int
    variables: dict  # 变量值映射


class PromptPreviewResponse(BaseModel):
    rendered_prompt: str
    token_count: int


# ============================================
# 默认Prompt模板
# ============================================

DEFAULT_TEMPLATES = {
    "outline": {
        "name": "默认大纲生成模板",
        "content": """你是一位专业的小说大纲设计师。请根据以下信息生成一份详细的小说大纲。

## 小说基本信息
- 标题：{title}
- 类型：{genre}
- 风格：{style}
- 简介：{description}
- 目标字数：{target_word_count}字
- 预计章节数：{chapter_count}章

## 世界观设定
{world_setting}

## 主要人物
{characters}

## 用户提示词
{user_prompt}

## 要求
1. 大纲应包含完整的故事主线和支线
2. 明确每个阶段的核心冲突和转折点
3. 人物成长弧线要清晰
4. 伏笔和回收要有规划
5. 结构要符合三幕式或英雄之旅等经典叙事结构

请生成大纲：""",
        "variables": ["title", "genre", "style", "description", "target_word_count", "chapter_count", "world_setting", "characters", "user_prompt"]
    },
    "detailed_outline": {
        "name": "默认细纲生成模板",
        "content": """你是一位专业的小说细纲设计师。请根据以下信息为指定章节生成详细的细纲。

## 小说信息
- 标题：{title}
- 类型：{genre}
- 当前进度：第{start_chapter}章 - 第{end_chapter}章

## 总大纲
{outline}

## 前情提要
{previous_summary}

## 本组章节需要完成的情节点
{plot_points}

## 活跃人物
{active_characters}

## 待回收的伏笔
{pending_foreshadowing}

## 要求
1. 为每一章生成详细的场景列表
2. 明确每章的情感基调
3. 标注重要对话和行动
4. 注意人物状态的连续性
5. 合理安排伏笔的埋设和回收

请生成第{start_chapter}章到第{end_chapter}章的细纲：""",
        "variables": ["title", "genre", "start_chapter", "end_chapter", "outline", "previous_summary", "plot_points", "active_characters", "pending_foreshadowing"]
    },
    "chapter": {
        "name": "默认章节生成模板",
        "content": """你是一位专业的小说作家。请根据以下信息生成小说章节内容。

## 小说信息
- 标题：{title}
- 类型：{genre}
- 风格：{style}
- 当前章节：第{chapter_number}章 - {chapter_title}

## 章节细纲
{detailed_outline}

## 前一章摘要
{previous_chapter_summary}

## 本章出场人物
{chapter_characters}

## 人物当前状态
{character_states}

## 相关知识库内容
{knowledge_context}

## 相关人物关系
{relationship_context}

## 写作要求
1. 字数要求：{target_word_count}字左右
2. 保持人物性格和说话风格的一致性
3. 场景描写要生动具体
4. 对话要符合人物特点
5. 注意情节的连贯性和节奏感
6. 适当使用伏笔和悬念

请开始创作：""",
        "variables": ["title", "genre", "style", "chapter_number", "chapter_title", "detailed_outline", "previous_chapter_summary", "chapter_characters", "character_states", "knowledge_context", "relationship_context", "target_word_count"]
    },
    "revision": {
        "name": "默认修改模板",
        "content": """你是一位专业的小说编辑。请根据以下修改意见对章节内容进行修改。

## 原文内容
{original_content}

## 修改意见
{revision_feedback}

## 人物设定参考
{character_reference}

## 修改要求
1. 保持原文的整体结构和风格
2. 针对性地修改指出的问题
3. 确保修改后内容与上下文连贯
4. 保持人物性格的一致性

请输出修改后的完整内容：""",
        "variables": ["original_content", "revision_feedback", "character_reference"]
    },
    "character": {
        "name": "默认人物生成模板",
        "content": """你是一位专业的小说人物设计师。请根据以下信息生成详细的人物设定。

## 小说信息
- 标题：{title}
- 类型：{genre}
- 世界观：{world_setting}

## 人物基本要求
{character_requirements}

## 已有人物（避免重复）
{existing_characters}

## 要求
1. 人物性格要立体，有优点也有缺点
2. 背景故事要与世界观契合
3. 人物目标和动机要明确
4. 设计独特的说话风格和口头禅
5. 考虑与其他人物的潜在关系

请生成人物设定：""",
        "variables": ["title", "genre", "world_setting", "character_requirements", "existing_characters"]
    }
}


# ============================================
# API路由
# ============================================

@router.get("/templates", response_model=List[PromptTemplateResponse])
async def list_templates(
    template_type: Optional[str] = Query(None, description="模板类型过滤"),
    include_defaults: bool = Query(True, description="是否包含默认模板"),
    current_user: dict = Depends(get_current_user)
):
    """获取用户的所有Prompt模板"""
    # TODO: 从数据库获取用户自定义模板
    templates = []
    
    # 添加默认模板
    if include_defaults:
        for idx, (ttype, template) in enumerate(DEFAULT_TEMPLATES.items()):
            if template_type is None or template_type == ttype:
                templates.append(PromptTemplateResponse(
                    id=-(idx + 1),  # 负数ID表示默认模板
                    user_id=0,
                    name=template["name"],
                    template_type=ttype,
                    content=template["content"],
                    description=f"系统默认{ttype}模板",
                    variables=template["variables"],
                    is_default=True,
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                ))
    
    return templates


@router.get("/templates/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(get_current_user)
):
    """获取单个Prompt模板"""
    # 检查是否是默认模板
    if template_id < 0:
        idx = -template_id - 1
        template_types = list(DEFAULT_TEMPLATES.keys())
        if idx < len(template_types):
            ttype = template_types[idx]
            template = DEFAULT_TEMPLATES[ttype]
            return PromptTemplateResponse(
                id=template_id,
                user_id=0,
                name=template["name"],
                template_type=ttype,
                content=template["content"],
                description=f"系统默认{ttype}模板",
                variables=template["variables"],
                is_default=True,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
    
    raise HTTPException(status_code=404, detail="模板不存在")


@router.post("/templates", response_model=PromptTemplateResponse)
async def create_template(
    data: PromptTemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建自定义Prompt模板"""
    # TODO: 保存到数据库
    return PromptTemplateResponse(
        id=1,
        user_id=current_user["id"],
        name=data.name,
        template_type=data.template_type,
        content=data.content,
        description=data.description,
        variables=data.variables or [],
        is_default=data.is_default,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@router.put("/templates/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    template_id: int,
    data: PromptTemplateUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新Prompt模板"""
    if template_id < 0:
        raise HTTPException(status_code=400, detail="默认模板不可修改")
    
    raise HTTPException(status_code=404, detail="模板不存在")


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    current_user: dict = Depends(get_current_user)
):
    """删除Prompt模板"""
    if template_id < 0:
        raise HTTPException(status_code=400, detail="默认模板不可删除")
    
    raise HTTPException(status_code=404, detail="模板不存在")


@router.post("/templates/preview", response_model=PromptPreviewResponse)
async def preview_template(
    data: PromptPreviewRequest,
    current_user: dict = Depends(get_current_user)
):
    """预览渲染后的Prompt"""
    # 获取模板
    template_content = ""
    if data.template_id < 0:
        idx = -data.template_id - 1
        template_types = list(DEFAULT_TEMPLATES.keys())
        if idx < len(template_types):
            ttype = template_types[idx]
            template_content = DEFAULT_TEMPLATES[ttype]["content"]
    
    if not template_content:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 渲染模板
    try:
        rendered = template_content.format(**data.variables)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"缺少变量: {e}")
    
    # 估算token数量（简单估算：中文约1.5字符/token，英文约4字符/token）
    token_count = len(rendered) // 2
    
    return PromptPreviewResponse(
        rendered_prompt=rendered,
        token_count=token_count
    )


@router.post("/templates/{template_id}/duplicate", response_model=PromptTemplateResponse)
async def duplicate_template(
    template_id: int,
    new_name: str = Query(..., description="新模板名称"),
    current_user: dict = Depends(get_current_user)
):
    """复制模板（可用于基于默认模板创建自定义模板）"""
    # 获取原模板
    original = None
    if template_id < 0:
        idx = -template_id - 1
        template_types = list(DEFAULT_TEMPLATES.keys())
        if idx < len(template_types):
            ttype = template_types[idx]
            original = DEFAULT_TEMPLATES[ttype]
            original["template_type"] = ttype
    
    if not original:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 创建新模板
    return PromptTemplateResponse(
        id=1,
        user_id=current_user["id"],
        name=new_name,
        template_type=original["template_type"],
        content=original["content"],
        description=f"基于'{original['name']}'创建",
        variables=original["variables"],
        is_default=False,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@router.get("/templates/types/list")
async def list_template_types():
    """获取所有模板类型"""
    return {
        "types": [
            {"value": "outline", "label": "大纲生成", "description": "用于生成小说整体大纲"},
            {"value": "detailed_outline", "label": "细纲生成", "description": "用于生成章节细纲"},
            {"value": "chapter", "label": "章节生成", "description": "用于生成章节正文"},
            {"value": "revision", "label": "内容修改", "description": "用于根据反馈修改内容"},
            {"value": "character", "label": "人物生成", "description": "用于生成人物设定"},
            {"value": "worldbuilding", "label": "世界观构建", "description": "用于生成世界观设定"}
        ]
    }

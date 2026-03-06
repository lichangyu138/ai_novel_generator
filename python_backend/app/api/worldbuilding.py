"""
世界观构建API路由
包含伏笔管理、事件管理、时间线、地点、物品、组织等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict
from pydantic import BaseModel
from datetime import datetime

from ..services.auth import get_current_user_dict as get_current_user

router = APIRouter(prefix="/worldbuilding", tags=["worldbuilding"])


# ============================================
# 通用响应模型
# ============================================

class MessageResponse(BaseModel):
    message: str


# ============================================
# 伏笔管理
# ============================================

class ForeshadowingCreate(BaseModel):
    title: str
    content: str
    planted_chapter: int
    target_chapter: Optional[int] = None
    related_characters: Optional[List[int]] = None
    related_events: Optional[List[int]] = None
    importance: str = "medium"  # low, medium, high, critical


class ForeshadowingUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    target_chapter: Optional[int] = None
    status: Optional[str] = None  # planted, developing, resolved, abandoned
    resolution_notes: Optional[str] = None
    actual_resolved_chapter: Optional[int] = None


class ForeshadowingResponse(BaseModel):
    id: int
    novel_id: int
    title: str
    content: str
    planted_chapter: int
    target_chapter: Optional[int]
    actual_resolved_chapter: Optional[int]
    importance: str
    status: str
    resolution_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/novels/{novel_id}/foreshadowing", response_model=ForeshadowingResponse)
async def create_foreshadowing(
    novel_id: int,
    data: ForeshadowingCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建伏笔"""
    # TODO: 实现数据库操作
    return ForeshadowingResponse(
        id=1,
        novel_id=novel_id,
        title=data.title,
        content=data.content,
        planted_chapter=data.planted_chapter,
        target_chapter=data.target_chapter,
        actual_resolved_chapter=None,
        importance=data.importance,
        status="planted",
        resolution_notes=None,
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/foreshadowing", response_model=List[ForeshadowingResponse])
async def list_foreshadowing(
    novel_id: int,
    status: Optional[str] = Query(None, description="状态过滤"),
    importance: Optional[str] = Query(None, description="重要性过滤"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说的所有伏笔"""
    # TODO: 实现数据库查询
    return []


@router.put("/foreshadowing/{foreshadowing_id}", response_model=ForeshadowingResponse)
async def update_foreshadowing(
    foreshadowing_id: int,
    data: ForeshadowingUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新伏笔"""
    raise HTTPException(status_code=404, detail="伏笔不存在")


@router.post("/foreshadowing/{foreshadowing_id}/resolve", response_model=ForeshadowingResponse)
async def resolve_foreshadowing(
    foreshadowing_id: int,
    chapter_number: int = Query(..., description="回收章节号"),
    resolution_notes: Optional[str] = Query(None, description="回收说明"),
    current_user: dict = Depends(get_current_user)
):
    """回收伏笔"""
    raise HTTPException(status_code=404, detail="伏笔不存在")


@router.get("/novels/{novel_id}/foreshadowing/pending")
async def get_pending_foreshadowing(
    novel_id: int,
    current_chapter: int = Query(..., description="当前章节号"),
    current_user: dict = Depends(get_current_user)
):
    """获取待回收的伏笔（已到期或即将到期）"""
    # TODO: 实现逻辑
    return {
        "overdue": [],  # 已过期未回收
        "upcoming": [],  # 即将到期
        "active": []  # 正在发展中
    }


# ============================================
# 事件管理
# ============================================

class EventCreate(BaseModel):
    name: str
    description: str
    event_type: str  # main_plot, subplot, background, flashback
    chapter_number: int
    timeline_position: Optional[int] = None
    participants: Optional[List[int]] = None
    location: Optional[str] = None
    consequences: Optional[str] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    consequences: Optional[str] = None
    status: Optional[str] = None  # planned, occurred, referenced


class EventResponse(BaseModel):
    id: int
    novel_id: int
    name: str
    description: str
    event_type: str
    chapter_number: int
    timeline_position: Optional[int]
    location: Optional[str]
    consequences: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventCausalityCreate(BaseModel):
    cause_event_id: int
    effect_event_id: int
    relationship_type: str  # direct_cause, indirect_cause, enables, prevents
    description: Optional[str] = None


@router.post("/novels/{novel_id}/events", response_model=EventResponse)
async def create_event(
    novel_id: int,
    data: EventCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建事件"""
    return EventResponse(
        id=1,
        novel_id=novel_id,
        name=data.name,
        description=data.description,
        event_type=data.event_type,
        chapter_number=data.chapter_number,
        timeline_position=data.timeline_position,
        location=data.location,
        consequences=data.consequences,
        status="planned",
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/events", response_model=List[EventResponse])
async def list_events(
    novel_id: int,
    event_type: Optional[str] = Query(None, description="事件类型过滤"),
    chapter_number: Optional[int] = Query(None, description="章节号过滤"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说的所有事件"""
    return []


@router.post("/events/causality", response_model=MessageResponse)
async def create_event_causality(
    data: EventCausalityCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建事件因果关系"""
    return MessageResponse(message="因果关系创建成功")


@router.get("/novels/{novel_id}/events/causality-chain")
async def get_causality_chain(
    novel_id: int,
    event_id: int = Query(..., description="起始事件ID"),
    direction: str = Query("both", description="方向: causes, effects, both"),
    depth: int = Query(3, ge=1, le=10, description="查询深度"),
    current_user: dict = Depends(get_current_user)
):
    """获取事件因果链"""
    return {
        "event_id": event_id,
        "causes": [],
        "effects": []
    }


# ============================================
# 时间线管理
# ============================================

class TimelineEntryCreate(BaseModel):
    event_name: str
    event_description: Optional[str] = None
    timeline_date: str  # 故事内时间
    timeline_order: int
    chapter_number: Optional[int] = None
    event_id: Optional[int] = None
    is_flashback: bool = False


class TimelineEntryResponse(BaseModel):
    id: int
    novel_id: int
    event_name: str
    event_description: Optional[str]
    timeline_date: str
    timeline_order: int
    chapter_number: Optional[int]
    event_id: Optional[int]
    is_flashback: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/novels/{novel_id}/timeline", response_model=TimelineEntryResponse)
async def create_timeline_entry(
    novel_id: int,
    data: TimelineEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建时间线条目"""
    return TimelineEntryResponse(
        id=1,
        novel_id=novel_id,
        event_name=data.event_name,
        event_description=data.event_description,
        timeline_date=data.timeline_date,
        timeline_order=data.timeline_order,
        chapter_number=data.chapter_number,
        event_id=data.event_id,
        is_flashback=data.is_flashback,
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/timeline", response_model=List[TimelineEntryResponse])
async def get_timeline(
    novel_id: int,
    include_flashbacks: bool = Query(True, description="是否包含闪回"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说时间线"""
    return []


# ============================================
# 地点管理
# ============================================

class LocationCreate(BaseModel):
    name: str
    location_type: str  # city, village, building, natural, realm, other
    description: str
    parent_location_id: Optional[int] = None
    atmosphere: Optional[str] = None
    notable_features: Optional[str] = None
    first_appearance: Optional[int] = None


class LocationResponse(BaseModel):
    id: int
    novel_id: int
    name: str
    location_type: str
    description: str
    parent_location_id: Optional[int]
    atmosphere: Optional[str]
    notable_features: Optional[str]
    first_appearance: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/novels/{novel_id}/locations", response_model=LocationResponse)
async def create_location(
    novel_id: int,
    data: LocationCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建地点"""
    return LocationResponse(
        id=1,
        novel_id=novel_id,
        name=data.name,
        location_type=data.location_type,
        description=data.description,
        parent_location_id=data.parent_location_id,
        atmosphere=data.atmosphere,
        notable_features=data.notable_features,
        first_appearance=data.first_appearance,
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/locations", response_model=List[LocationResponse])
async def list_locations(
    novel_id: int,
    location_type: Optional[str] = Query(None, description="地点类型过滤"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说的所有地点"""
    return []


@router.get("/novels/{novel_id}/locations/hierarchy")
async def get_location_hierarchy(
    novel_id: int,
    current_user: dict = Depends(get_current_user)
):
    """获取地点层级结构"""
    return {
        "locations": [],
        "hierarchy": {}
    }


# ============================================
# 物品管理
# ============================================

class ItemCreate(BaseModel):
    name: str
    item_type: str  # weapon, armor, artifact, consumable, material, other
    description: str
    abilities: Optional[str] = None
    rarity: str = "common"  # common, uncommon, rare, epic, legendary, unique
    current_owner_id: Optional[int] = None
    origin: Optional[str] = None
    first_appearance: Optional[int] = None


class ItemResponse(BaseModel):
    id: int
    novel_id: int
    name: str
    item_type: str
    description: str
    abilities: Optional[str]
    rarity: str
    current_owner_id: Optional[int]
    origin: Optional[str]
    first_appearance: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/novels/{novel_id}/items", response_model=ItemResponse)
async def create_item(
    novel_id: int,
    data: ItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建物品"""
    return ItemResponse(
        id=1,
        novel_id=novel_id,
        name=data.name,
        item_type=data.item_type,
        description=data.description,
        abilities=data.abilities,
        rarity=data.rarity,
        current_owner_id=data.current_owner_id,
        origin=data.origin,
        first_appearance=data.first_appearance,
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/items", response_model=List[ItemResponse])
async def list_items(
    novel_id: int,
    item_type: Optional[str] = Query(None, description="物品类型过滤"),
    rarity: Optional[str] = Query(None, description="稀有度过滤"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说的所有物品"""
    return []


# ============================================
# 组织管理
# ============================================

class OrganizationCreate(BaseModel):
    name: str
    org_type: str  # sect, kingdom, guild, family, company, other
    description: str
    hierarchy: Optional[str] = None
    goals: Optional[str] = None
    leader_id: Optional[int] = None
    headquarters: Optional[str] = None
    founding_story: Optional[str] = None
    first_appearance: Optional[int] = None


class OrganizationResponse(BaseModel):
    id: int
    novel_id: int
    name: str
    org_type: str
    description: str
    hierarchy: Optional[str]
    goals: Optional[str]
    leader_id: Optional[int]
    headquarters: Optional[str]
    founding_story: Optional[str]
    first_appearance: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/novels/{novel_id}/organizations", response_model=OrganizationResponse)
async def create_organization(
    novel_id: int,
    data: OrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建组织"""
    return OrganizationResponse(
        id=1,
        novel_id=novel_id,
        name=data.name,
        org_type=data.org_type,
        description=data.description,
        hierarchy=data.hierarchy,
        goals=data.goals,
        leader_id=data.leader_id,
        headquarters=data.headquarters,
        founding_story=data.founding_story,
        first_appearance=data.first_appearance,
        created_at=datetime.now()
    )


@router.get("/novels/{novel_id}/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    novel_id: int,
    org_type: Optional[str] = Query(None, description="组织类型过滤"),
    current_user: dict = Depends(get_current_user)
):
    """获取小说的所有组织"""
    return []


@router.get("/novels/{novel_id}/organizations/{org_id}/members")
async def get_organization_members(
    novel_id: int,
    org_id: int,
    current_user: dict = Depends(get_current_user)
):
    """获取组织成员"""
    return {
        "organization_id": org_id,
        "members": []
    }

# ============================================
# 知识库同步到世界观
# ============================================

class SyncKnowledgeRequest(BaseModel):
    knowledge_entry_id: int
    merge_strategy: str = "append"  # append, replace, skip


class SyncKnowledgeResponse(BaseModel):
    success: bool
    action: str  # created, merged, replaced, skipped
    worldbuilding_id: Optional[int] = None
    message: str


@router.post("/novels/{novel_id}/sync-knowledge", response_model=SyncKnowledgeResponse)
async def sync_knowledge_to_worldbuilding(
    novel_id: int,
    request: SyncKnowledgeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    同步知识库条目到世界观管理
    支持去重和内容合并
    """
    from sqlalchemy.orm import Session
    from app.db.mysql import get_db
    from app.services.knowledge_sync_service import sync_knowledge_to_character, sync_knowledge_to_event
    from app.models.database import KnowledgeEntry

    db = next(get_db())

    try:
        # Get knowledge entry
        entry = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.id == request.knowledge_entry_id,
            KnowledgeEntry.user_id == current_user["id"]
        ).first()

        if not entry:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Sync based on type
        if entry.category == "character":
            result = await sync_knowledge_to_character(
                db, request.knowledge_entry_id, current_user["id"], novel_id, request.merge_strategy
            )
            return SyncKnowledgeResponse(
                success=result["success"],
                action=result["action"],
                worldbuilding_id=result.get("character_id"),
                message=result.get("message", "")
            )
        elif entry.category == "event":
            result = await sync_knowledge_to_event(
                db, request.knowledge_entry_id, current_user["id"], novel_id, request.merge_strategy
            )
            return SyncKnowledgeResponse(
                success=result["success"],
                action=result["action"],
                worldbuilding_id=result.get("event_id"),
                message=result.get("message", "")
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported knowledge type: {entry.category}")

    finally:
        db.close()


# ============================================
# AI提取人物设定
# ============================================

class ExtractCharactersRequest(BaseModel):
    source_type: str  # "outline" 或 "chapter" 或 "all_chapters"
    source_id: Optional[int] = None  # 章节ID（当source_type为chapter时）
    additional_prompt: Optional[str] = None  # 额外的提取要求


class ExtractCharactersResponse(BaseModel):
    success: bool
    extracted_count: int
    characters: List[Dict]
    message: str


@router.post("/novels/{novel_id}/extract-characters", response_model=ExtractCharactersResponse)
async def extract_characters_from_content(
    novel_id: int,
    request: ExtractCharactersRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    使用AI从小说大纲或章节内容中提取人物设定
    """
    from sqlalchemy.orm import Session
    from app.db.mysql import get_db
    from app.models.database import Novel, Outline, Chapter, Character
    from app.services.langchain.llm_service import get_llm_service
    from app.services.knowledge_service import get_knowledge_service
    import json
    import re

    db = next(get_db())

    try:
        # 验证小说存在
        novel = db.query(Novel).filter(
            Novel.id == novel_id,
            Novel.user_id == current_user["id"]
        ).first()

        if not novel:
            raise HTTPException(status_code=404, detail="Novel not found")

        # 获取提取源内容
        content_to_extract = ""
        source_description = ""

        if request.source_type == "outline":
            # 从大纲提取
            outline = db.query(Outline).filter(
                Outline.novel_id == novel_id,
                Outline.user_id == current_user["id"],
                Outline.is_current == True
            ).first()

            if not outline:
                raise HTTPException(status_code=404, detail="No active outline found")

            content_to_extract = outline.content
            source_description = f"小说《{novel.title}》的大纲"

        elif request.source_type == "chapter":
            # 从指定章节提取
            if not request.source_id:
                raise HTTPException(status_code=400, detail="source_id is required for chapter extraction")

            chapter = db.query(Chapter).filter(
                Chapter.id == request.source_id,
                Chapter.novel_id == novel_id,
                Chapter.user_id == current_user["id"]
            ).first()

            if not chapter:
                raise HTTPException(status_code=404, detail="Chapter not found")

            content_to_extract = chapter.content or ""
            source_description = f"第{chapter.chapter_number}章：{chapter.title or '无标题'}"

        elif request.source_type == "all_chapters":
            # 从所有章节提取
            chapters = db.query(Chapter).filter(
                Chapter.novel_id == novel_id,
                Chapter.user_id == current_user["id"]
            ).order_by(Chapter.chapter_number).all()

            if not chapters:
                raise HTTPException(status_code=404, detail="No chapters found")

            # 合并所有章节内容（限制总长度）
            chapter_contents = []
            total_length = 0
            max_length = 10000  # 最多提取10000字

            for chapter in chapters:
                if chapter.content:
                    chapter_text = f"\n\n=== 第{chapter.chapter_number}章：{chapter.title or '无标题'} ===\n{chapter.content}"
                    if total_length + len(chapter_text) > max_length:
                        remaining = max_length - total_length
                        chapter_contents.append(chapter_text[:remaining])
                        break
                    chapter_contents.append(chapter_text)
                    total_length += len(chapter_text)

            content_to_extract = "".join(chapter_contents)
            source_description = f"小说《{novel.title}》的所有章节（共{len(chapters)}章）"

        else:
            raise HTTPException(status_code=400, detail=f"Invalid source_type: {request.source_type}")

        if not content_to_extract or len(content_to_extract.strip()) < 50:
            raise HTTPException(status_code=400, detail="Content too short to extract characters")

        # 获取已存在的人物名称（避免重复提取）
        existing_characters = db.query(Character).filter(
            Character.novel_id == novel_id,
            Character.user_id == current_user["id"]
        ).all()
        existing_names = [c.name for c in existing_characters]

        # 构建提取提示词
        existing_names_text = "、".join(existing_names[:10]) if existing_names else "无"
        if len(existing_names) > 10:
            existing_names_text += f"等{len(existing_names)}个"

        extraction_prompt = f"""请从以下{source_description}中提取所有出现的人物设定信息。

**已存在的人物（避免重复）：** {existing_names_text}

**提取内容：**
{content_to_extract[:8000]}

**提取要求：**
1. 提取所有出现的人物，包括主角、配角、反派等
2. 对于每个人物，提取以下信息：
   - name: 人物名称（必填）
   - role: 角色定位（主角/配角/反派/其他）
   - gender: 性别（如果文中提到）
   - age: 年龄或年龄段（如果文中提到）
   - personality: 性格特点（如果文中提到）
   - background: 背景故事（如果文中提到）
   - appearance: 外貌描述（如果文中提到）
   - abilities: 能力/技能（如果文中提到）
   - relationships: 与其他角色的关系（如果文中提到）

3. 只提取文中明确提到的人物，不要臆造
4. 如果信息不足，可以留空，但name必须填写
5. 避免提取已存在的人物（除非有新的重要信息需要补充）

**返回格式（JSON数组）：**
[
  {{
    "name": "张三",
    "role": "主角",
    "gender": "男",
    "age": "20岁",
    "personality": "勇敢、正义感强",
    "background": "出身贫寒，立志成为剑客",
    "appearance": "身材高大，面容坚毅",
    "abilities": "剑法精湛",
    "relationships": "与李四是好友"
  }}
]

只返回JSON数组，不要其他说明文字。如果某个字段没有信息，可以省略该字段。"""

        if request.additional_prompt:
            extraction_prompt += f"\n\n**用户额外要求：** {request.additional_prompt}"

        # 调用LLM提取
        llm_service = get_llm_service()
        print(f"[extract_characters] 开始提取人物设定，内容长度: {len(content_to_extract)}")
        
        response_text = llm_service.generate_sync(
            prompt=extraction_prompt,
            system_prompt="你是一位专业的小说人物设定提取专家。请仔细分析文本，准确提取人物信息，并以JSON格式返回。",
            max_tokens=8000
        )

        print(f"[extract_characters] LLM返回内容长度: {len(response_text)}")

        # 解析JSON响应
        try:
            # 尝试提取JSON部分（可能包含markdown代码块）
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                json_text = json_match.group(0)
            else:
                json_text = response_text

            extracted_characters = json.loads(json_text)
            
            if not isinstance(extracted_characters, list):
                raise ValueError("Response is not a list")

        except Exception as e:
            print(f"[extract_characters] JSON解析失败: {e}")
            print(f"[extract_characters] 响应内容: {response_text[:500]}")
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")

        # 保存提取的人物到数据库
        saved_count = 0
        saved_characters = []

        for char_data in extracted_characters:
            if not char_data.get("name") or not char_data["name"].strip():
                continue

            char_name = char_data["name"].strip()

            # 检查是否已存在同名人物
            existing_char = db.query(Character).filter(
                Character.novel_id == novel_id,
                Character.user_id == current_user["id"],
                Character.name == char_name
            ).first()

            if existing_char:
                # 如果已存在，可以选择更新或跳过
                # 这里选择跳过，避免覆盖已有设定
                print(f"[extract_characters] 跳过已存在的人物: {char_name}")
                continue

            # 创建新人物
            new_character = Character(
                novel_id=novel_id,
                user_id=current_user["id"],
                name=char_name,
                role=char_data.get("role"),
                gender=char_data.get("gender"),
                age=char_data.get("age"),
                personality=char_data.get("personality"),
                background=char_data.get("background"),
                appearance=char_data.get("appearance"),
                abilities=char_data.get("abilities"),
                relationships=char_data.get("relationships"),
                extra_info={
                    "extracted_from": request.source_type,
                    "extraction_source": source_description
                }
            )

            db.add(new_character)
            saved_count += 1

            # 准备返回数据
            saved_characters.append({
                "name": char_name,
                "role": char_data.get("role"),
                "gender": char_data.get("gender"),
                "age": char_data.get("age"),
            })

        db.commit()

        # 同步到知识库
        if saved_count > 0:
            knowledge_service = get_knowledge_service()
            for char_data in saved_characters:
                char = db.query(Character).filter(
                    Character.novel_id == novel_id,
                    Character.user_id == current_user["id"],
                    Character.name == char_data["name"]
                ).first()
                if char:
                    await knowledge_service.sync_character_to_knowledge(db, char)

        return ExtractCharactersResponse(
            success=True,
            extracted_count=saved_count,
            characters=saved_characters,
            message=f"成功提取并保存了 {saved_count} 个人物设定"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[extract_characters] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to extract characters: {str(e)}")
    finally:
        db.close()
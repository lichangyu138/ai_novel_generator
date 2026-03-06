"""
搜索API路由
提供全文搜索、跨索引搜索、搜索建议等功能
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel

from ..services.auth import get_current_user_dict as get_current_user
from ..db.elasticsearch import es_service

router = APIRouter(prefix="/search", tags=["search"])


# ============================================
# 请求/响应模型
# ============================================

class SearchResult(BaseModel):
    """搜索结果"""
    id: str
    score: float
    highlight: Optional[dict] = None
    # 其他字段根据索引类型动态添加
    
    class Config:
        extra = "allow"


class SearchResponse(BaseModel):
    """搜索响应"""
    hits: List[dict]
    total: int


class GlobalSearchResponse(BaseModel):
    """全局搜索响应"""
    chapters: SearchResponse
    characters: SearchResponse
    events: SearchResponse
    locations: SearchResponse
    items: SearchResponse
    organizations: SearchResponse
    foreshadowing: SearchResponse


class SuggestResponse(BaseModel):
    """搜索建议响应"""
    suggestions: List[str]


class AggregateResponse(BaseModel):
    """聚合统计响应"""
    stats: dict


# ============================================
# 搜索API
# ============================================

@router.get("/chapters", response_model=SearchResponse)
async def search_chapters(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索章节内容"""
    result = await es_service.search(
        index=es_service.INDEX_CHAPTERS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["title", "content", "summary"],
        size=size,
        from_=from_
    )
    return result


@router.get("/characters", response_model=SearchResponse)
async def search_characters(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索人物"""
    result = await es_service.search(
        index=es_service.INDEX_CHARACTERS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["name", "aliases", "personality", "background", "abilities"],
        size=size,
        from_=from_
    )
    return result


@router.get("/events", response_model=SearchResponse)
async def search_events(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索事件"""
    result = await es_service.search(
        index=es_service.INDEX_EVENTS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["name", "description", "consequences", "location"],
        size=size,
        from_=from_
    )
    return result


@router.get("/locations", response_model=SearchResponse)
async def search_locations(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索地点"""
    result = await es_service.search(
        index=es_service.INDEX_LOCATIONS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["name", "description", "atmosphere", "notable_features"],
        size=size,
        from_=from_
    )
    return result


@router.get("/items", response_model=SearchResponse)
async def search_items(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索物品"""
    result = await es_service.search(
        index=es_service.INDEX_ITEMS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["name", "description", "abilities", "origin"],
        size=size,
        from_=from_
    )
    return result


@router.get("/organizations", response_model=SearchResponse)
async def search_organizations(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索组织"""
    result = await es_service.search(
        index=es_service.INDEX_ORGANIZATIONS,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["name", "description", "goals", "hierarchy", "founding_story"],
        size=size,
        from_=from_
    )
    return result


@router.get("/foreshadowing", response_model=SearchResponse)
async def search_foreshadowing(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(20, ge=1, le=100, description="返回结果数量"),
    from_: int = Query(0, ge=0, alias="from", description="分页起始位置"),
    current_user: dict = Depends(get_current_user)
):
    """搜索伏笔"""
    result = await es_service.search(
        index=es_service.INDEX_FORESHADOWING,
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        fields=["title", "content", "resolution_notes"],
        size=size,
        from_=from_
    )
    return result


@router.get("/global", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    novel_id: Optional[int] = Query(None, description="小说ID"),
    size: int = Query(5, ge=1, le=20, description="每个索引返回的结果数量"),
    current_user: dict = Depends(get_current_user)
):
    """
    全局搜索
    跨所有索引搜索，返回各类型的匹配结果
    """
    results = await es_service.search_all(
        query=q,
        user_id=current_user["id"],
        novel_id=novel_id,
        size=size
    )
    
    return GlobalSearchResponse(
        chapters=results.get("chapters", {"hits": [], "total": 0}),
        characters=results.get("characters", {"hits": [], "total": 0}),
        events=results.get("events", {"hits": [], "total": 0}),
        locations=results.get("locations", {"hits": [], "total": 0}),
        items=results.get("items", {"hits": [], "total": 0}),
        organizations=results.get("organizations", {"hits": [], "total": 0}),
        foreshadowing=results.get("foreshadowing", {"hits": [], "total": 0})
    )


@router.get("/suggest", response_model=SuggestResponse)
async def get_suggestions(
    q: str = Query(..., min_length=1, description="输入的查询词"),
    index: str = Query("characters", description="索引名称"),
    field: str = Query("name", description="建议字段"),
    size: int = Query(5, ge=1, le=10, description="返回建议数量"),
    current_user: dict = Depends(get_current_user)
):
    """
    搜索建议/自动补全
    根据输入的查询词返回匹配的建议
    """
    suggestions = await es_service.suggest(
        index=index,
        query=q,
        user_id=current_user["id"],
        field=field,
        size=size
    )
    return SuggestResponse(suggestions=suggestions)


@router.get("/stats/{index}", response_model=AggregateResponse)
async def get_stats(
    index: str,
    novel_id: Optional[int] = Query(None, description="小说ID"),
    field: str = Query("status", description="聚合字段"),
    current_user: dict = Depends(get_current_user)
):
    """
    聚合统计
    获取指定索引的字段统计信息
    """
    stats = await es_service.aggregate_stats(
        index=index,
        user_id=current_user["id"],
        novel_id=novel_id,
        agg_field=field
    )
    return AggregateResponse(stats=stats)


@router.get("/health")
async def check_es_health():
    """检查Elasticsearch连接状态"""
    return {
        "connected": es_service.connected,
        "message": "Elasticsearch连接正常" if es_service.connected else "Elasticsearch未连接"
    }

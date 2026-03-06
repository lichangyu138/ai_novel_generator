"""
Pydantic Schemas for API Request/Response Models
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    USER = "user"


class GenerationStatusEnum(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReviewStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


# Auth Schemas
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRoleEnum
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


# Novel Schemas
class NovelCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    genre: Optional[str] = None
    style: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    world_setting: Optional[str] = None


class NovelUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    genre: Optional[str] = None
    style: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    world_setting: Optional[str] = None
    status: Optional[str] = None


class NovelResponse(BaseModel):
    id: int
    user_id: int
    title: str
    genre: Optional[str]
    style: Optional[str]
    description: Optional[str]
    prompt: Optional[str]
    world_setting: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class NovelListResponse(BaseModel):
    items: List[NovelResponse]
    total: int
    page: int
    page_size: int


# Character Schemas
class CharacterRelation(BaseModel):
    character_id: int
    relation_type: str
    description: Optional[str] = None


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None
    abilities: Optional[str] = None
    relationships: Optional[List[CharacterRelation]] = None
    extra_info: Optional[Dict[str, Any]] = None


class CharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None
    abilities: Optional[str] = None
    relationships: Optional[List[CharacterRelation]] = None
    extra_info: Optional[Dict[str, Any]] = None


class CharacterResponse(BaseModel):
    id: int
    novel_id: int
    user_id: int
    name: str
    role: Optional[str]
    gender: Optional[str]
    age: Optional[str]
    personality: Optional[str]
    background: Optional[str]
    appearance: Optional[str]
    abilities: Optional[str]
    relationships: Optional[List[Dict[str, Any]]]
    extra_info: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Outline Schemas
class OutlineGenerate(BaseModel):
    """Request to generate outline"""
    pass  # Uses novel settings


class OutlineUpdate(BaseModel):
    content: str


class OutlineResponse(BaseModel):
    id: int
    novel_id: int
    content: str
    version: int
    is_current: bool
    status: Optional[GenerationStatusEnum] = None  # Note: outlines table does not have status column
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Detailed Outline Schemas
class DetailedOutlineGenerate(BaseModel):
    """Request to generate detailed outline for a chapter group"""
    group_index: int
    start_chapter: int
    end_chapter: int


class DetailedOutlineUpdate(BaseModel):
    content: str


class DetailedOutlineResponse(BaseModel):
    id: int
    outline_id: int
    novel_id: int
    group_index: int
    start_chapter: int
    end_chapter: int
    content: str
    version: int
    is_current: bool
    status: GenerationStatusEnum
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Chapter Schemas
class ChapterGenerate(BaseModel):
    """Request to generate chapter content"""
    chapter_number: int
    detailed_outline_id: Optional[int] = None


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class ChapterReview(BaseModel):
    status: ReviewStatusEnum
    feedback: Optional[str] = None


class ChapterRevise(BaseModel):
    feedback: str


class ChapterResponse(BaseModel):
    id: int
    novel_id: int
    chapter_number: int
    title: Optional[str]
    content: Optional[str]
    word_count: int
    version: int
    is_current: bool
    generation_status: GenerationStatusEnum
    review_status: ReviewStatusEnum
    review_feedback: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# AI Model Config Schemas
class AIModelConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_type: str = Field(..., min_length=1, max_length=50)
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.9, ge=0, le=1)
    max_tokens: int = Field(default=4096, ge=1, le=128000)
    is_default: bool = False


class AIModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    model_type: Optional[str] = None
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0, le=2)
    top_p: Optional[float] = Field(None, ge=0, le=1)
    max_tokens: Optional[int] = Field(None, ge=1, le=128000)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class AIModelConfigResponse(BaseModel):
    id: int
    user_id: int
    name: str
    model_type: str
    api_base: Optional[str]
    model_name: Optional[str]
    temperature: float
    top_p: float
    max_tokens: int
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Generation History Schemas
class GenerationHistoryResponse(BaseModel):
    id: int
    novel_id: int
    generation_type: str
    target_id: Optional[int]
    input_prompt: Optional[str]
    output_content: Optional[str]
    model_config_data: Optional[Dict[str, Any]] = Field(None, alias="model_config")  # 重命名：model_config是Pydantic保留属性
    token_usage: Optional[Dict[str, Any]]
    duration_seconds: Optional[float]
    status: GenerationStatusEnum
    error_message: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True  # 允许使用字段名或别名


# Knowledge Graph Schemas
class GraphNode(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    source: int
    target: int
    type: str
    description: Optional[str] = None


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class TimelineEvent(BaseModel):
    id: int
    name: str
    time_point: str
    description: Optional[str]
    chapter_id: Optional[int]


class TimelineResponse(BaseModel):
    events: List[TimelineEvent]


# Knowledge Base Schemas
class KnowledgeStatsResponse(BaseModel):
    total: int
    character: int
    chapter_content: int
    setting: int
    plot: int


# Admin Schemas
class AdminUserUpdate(BaseModel):
    role: Optional[UserRoleEnum] = None
    is_active: Optional[bool] = None


class AdminUserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    page_size: int

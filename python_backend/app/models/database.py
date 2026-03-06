"""
SQLAlchemy Database Models
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, synonym
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
import enum
import json

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class GenerationStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


# User Model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    novels = relationship("Novel", back_populates="user", cascade="all, delete-orphan")
    model_configs = relationship("AIModelConfig", back_populates="user", cascade="all, delete-orphan")


# Novel Project Model
class Novel(Base):
    __tablename__ = "novels"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    genre = Column(String(100))  # 类型：玄幻、都市、科幻等
    style = Column(String(100))  # 风格：轻松、严肃、幽默等
    description = Column(Text)  # 简介
    prompt = Column(Text)  # 提示词/设定
    world_setting = Column(Text)  # 世界观设定
    status = Column(String(50), default="draft")  # draft, in_progress, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="novels")
    characters = relationship("Character", back_populates="novel", cascade="all, delete-orphan")
    outlines = relationship("Outline", back_populates="novel", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")
    generation_histories = relationship("GenerationHistory", back_populates="novel", cascade="all, delete-orphan")


# Character Model
class Character(Base):
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(50))  # 主角、配角、反派等
    gender = Column(String(20))
    personality = Column(Text)  # 性格描述
    background = Column(Text)  # 背景故事
    appearance = Column(Text)  # 外貌描述
    abilities = Column(Text)  # 能力/技能
    _relationships = Column("relationships", Text)  # 与其他角色的关系（TEXT类型，存储JSON字符串）
    notes = Column(Text)  # 备注（用于存储extra_info等额外信息）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Note:
    # The underlying MySQL `characters` table has:
    # - `relationships` as TEXT (not JSON)
    # - `notes` as TEXT (not extra_info)
    # - No `age` column
    # To keep API compatibility, we expose these as hybrid properties.
    
    def _get_notes_dict(self):
        """Parse notes field as JSON, return dict"""
        if not self.notes:
            return {}
        try:
            return json.loads(self.notes) if isinstance(self.notes, str) else self.notes
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def _set_notes_dict(self, value):
        """Store dict as JSON string in notes field"""
        if value is None:
            self.notes = None
        elif isinstance(value, dict):
            self.notes = json.dumps(value, ensure_ascii=False) if value else None
        else:
            self.notes = value
    
    @property
    def relationships(self):
        """Get relationships as a list (for API compatibility)"""
        if not self._relationships:
            return None
        try:
            return json.loads(self._relationships) if isinstance(self._relationships, str) else self._relationships
        except (json.JSONDecodeError, TypeError):
            return None
    
    @relationships.setter
    def relationships(self, value):
        """Set relationships from a list (for API compatibility)"""
        if value is None:
            self._relationships = None
        elif isinstance(value, list):
            self._relationships = json.dumps(value, ensure_ascii=False) if value else None
        else:
            # If it's already a string, store as-is
            self._relationships = value
    
    @hybrid_property
    def extra_info(self):
        """Get extra_info from notes field"""
        notes_dict = self._get_notes_dict()
        # Remove age from extra_info if it exists (age has its own property)
        extra = {k: v for k, v in notes_dict.items() if k != "age"}
        return extra if extra else None
    
    @extra_info.setter
    def extra_info(self, value):
        """Store extra_info in notes field"""
        notes_dict = self._get_notes_dict()
        # Preserve age if it exists
        if "age" in notes_dict:
            notes_dict["age"] = notes_dict["age"]
        # Update with new extra_info
        if value:
            if isinstance(value, dict):
                notes_dict.update({k: v for k, v in value.items() if k != "age"})
            else:
                notes_dict["extra_info"] = value
        self._set_notes_dict(notes_dict)
    
    @hybrid_property
    def age(self):
        """Get age from notes field"""
        notes_dict = self._get_notes_dict()
        return notes_dict.get("age")
    
    @age.setter
    def age(self, value):
        """Store age in notes field"""
        notes_dict = self._get_notes_dict()
        if value is not None:
            notes_dict["age"] = value
        elif "age" in notes_dict:
            del notes_dict["age"]
        self._set_notes_dict(notes_dict)
    
    # Relationships
    novel = relationship("Novel", back_populates="characters")


# Outline Model (大纲)
class Outline(Base):
    __tablename__ = "outlines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)  # 大纲内容
    version = Column(Integer, default=1)  # 版本号
    # DB schema uses `is_active` (Node/Drizzle + init SQL). Keep `is_current` as a backwards-compatible alias.
    is_active = Column("is_active", Boolean, default=True)  # 是否为当前激活版本
    is_current = synonym("is_active")
    # Note: outlines table does NOT have a status column in the database schema
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    novel = relationship("Novel", back_populates="outlines")
    detailed_outlines = relationship("DetailedOutline", back_populates="outline", cascade="all, delete-orphan")


# Detailed Outline Model (细纲，每5章一组)
class DetailedOutline(Base):
    __tablename__ = "detailed_outlines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="CASCADE"), nullable=False, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_index = Column(Integer, nullable=False)  # 组索引（第几组，每组5章）
    start_chapter = Column(Integer, nullable=False)  # 起始章节号
    end_chapter = Column(Integer, nullable=False)  # 结束章节号
    content = Column(Text, nullable=False)  # 细纲内容
    version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    status = Column(Enum(GenerationStatus), default=GenerationStatus.COMPLETED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    outline = relationship("Outline", back_populates="detailed_outlines")


# ChapterOutline Model (单章细纲 - 与Node.js后端共享的表)
class ChapterOutline(Base):
    """
    章节细纲模型 - 映射到 chapteroutlines 表
    这个表由Node.js和Python后端共享使用
    """
    __tablename__ = "chapteroutlines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novelId = Column("novelId", Integer, nullable=False, index=True)
    userId = Column("userId", Integer, nullable=False, index=True)
    chapterNumber = Column("chapterNumber", Integer, nullable=False)
    previousSummary = Column("previousSummary", Text)  # 前文总结
    plotDevelopment = Column("plotDevelopment", Text)  # 剧情发展
    characterDynamics = Column("characterDynamics", Text)  # 人物动态
    sceneDescription = Column("sceneDescription", Text)  # 场景描述
    keyPoints = Column("keyPoints", Text)  # 关键对话要点
    fullContent = Column("fullContent", Text)  # 完整细纲内容
    version = Column("version", Integer, default=1)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
    updatedAt = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Chapter Model
class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255))
    content = Column(Text)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    novel = relationship("Novel", back_populates="chapters")


# AI Model Configuration
class AIModelConfig(Base):
    __tablename__ = "ai_model_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # 配置名称
    model_type = Column(String(50), nullable=False)  # openai, custom, etc.
    api_key = Column(String(500))  # 加密存储
    api_base = Column(String(500))
    model_name = Column(String(100))
    temperature = Column(Float, default=0.7)
    top_p = Column(Float, default=0.9)
    max_tokens = Column(Integer, default=4096)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="model_configs")


# Generation History
class GenerationHistory(Base):
    __tablename__ = "generation_histories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    generation_type = Column(String(50), nullable=False)  # outline, detailed_outline, chapter
    target_id = Column(Integer)  # 关联的outline_id, detailed_outline_id, 或 chapter_id
    input_prompt = Column(Text)  # 输入的提示词
    output_content = Column(Text)  # 生成的内容
    model_config = Column(JSON)  # 使用的模型配置
    token_usage = Column(JSON)  # token使用情况
    duration_seconds = Column(Float)  # 生成耗时
    status = Column(Enum(GenerationStatus), default=GenerationStatus.COMPLETED)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    novel = relationship("Novel", back_populates="generation_histories")


# Knowledge Base Entry (for Milvus metadata)
class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_type = Column(String(50), nullable=False)  # character, plot, setting, chapter_content
    source_id = Column(Integer)  # 来源ID（character_id, chapter_id等）
    content = Column(Text, nullable=False)  # 原始内容
    milvus_id = Column(String(100))  # Milvus中的向量ID
    extra_metadata = Column(JSON)  # 额外元数据
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



# Permission Configuration
class PermissionConfig(Base):
    __tablename__ = "permission_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)  # 权限名称
    description = Column(Text)  # 权限描述
    resource_type = Column(String(50), nullable=False)  # novel, chapter, outline, etc.
    action = Column(String(50), nullable=False)  # create, read, update, delete, generate
    allowed_roles = Column(JSON, default=["admin"])  # 允许的角色列表
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Embedding Model Configuration
class EmbeddingModelConfig(Base):
    __tablename__ = "embedding_model_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # 配置名称
    provider = Column(String(50), nullable=False)  # openai, huggingface, custom
    api_key = Column(String(500))  # 加密存储
    api_base = Column(String(500))
    model_name = Column(String(100), nullable=False)
    dimension = Column(Integer, default=1536)  # 向量维度
    batch_size = Column(Integer, default=100)  # 批处理大小
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Rerank Model Configuration
class RerankModelConfig(Base):
    __tablename__ = "rerank_model_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # 配置名称
    provider = Column(String(50), nullable=False)  # cohere, jina, custom
    api_key = Column(String(500))  # 加密存储
    api_base = Column(String(500))
    model_name = Column(String(100), nullable=False)
    top_k = Column(Integer, default=10)  # 重排后返回的数量
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# System Configuration (for admin settings)
class SystemConfig(Base):
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True)  # 配置键
    value = Column(Text)  # 配置值（JSON格式）
    description = Column(Text)  # 配置描述
    config_type = Column(String(50), default="string")  # string, number, boolean, json
    is_public = Column(Boolean, default=False)  # 是否公开（前端可见）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Story Event (for knowledge graph)
class StoryEvent(Base):
    __tablename__ = "story_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), index=True)
    title = Column(String(255), nullable=False)  # 事件标题
    description = Column(Text)  # 事件描述
    event_type = Column(String(50))  # 事件类型：战斗、对话、转折等
    importance = Column(Integer, default=5)  # 重要程度 1-10
    characters_involved = Column(JSON)  # 涉及的角色ID列表
    location = Column(String(255))  # 发生地点
    time_in_story = Column(String(100))  # 故事内时间
    extra_metadata = Column(JSON)  # 额外元数据
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Content Version History
class ContentVersion(Base):
    __tablename__ = "content_versions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    content_type = Column(String(50), nullable=False)  # chapter, outline, detailed_outline
    content_id = Column(Integer, nullable=False)  # 关联的内容ID
    novel_id = Column(Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)  # 版本内容
    change_summary = Column(String(500))  # 变更摘要
    created_by = Column(String(50))  # ai, user
    created_at = Column(DateTime, default=datetime.utcnow)


# Chapter Review (AI Summary) Model
class ChapterReview(Base):
    __tablename__ = "chapterreviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    novel_id = Column("novelId", Integer, ForeignKey("novels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column("userId", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_id = Column("chapterId", Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    quality_score = Column("qualityScore", Integer, default=0)
    plot_summary = Column("plotSummary", Text)
    opening_description = Column("openingDescription", Text)
    middle_description = Column("middleDescription", Text)
    ending_description = Column("endingDescription", Text)
    key_issues = Column("keyIssues", Text)
    foreshadowing_markers = Column("foreshadowingNotes", Text)
    resolved_foreshadowing = Column("resolvedForeshadowing", Text)
    overall_comment = Column("overallComment", Text)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

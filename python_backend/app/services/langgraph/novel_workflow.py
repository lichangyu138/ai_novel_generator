"""
LangGraph Novel Generation Workflow
Implements the complete novel generation pipeline:
Outline -> Detailed Outline -> Chapter Content
"""
from typing import Dict, Any, List, Optional, AsyncGenerator, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
import logging
import operator

from app.services.langchain.llm_service import get_llm_service
from app.services.langchain.rag_service import get_rag_service
from app.models.database import AIModelConfig

logger = logging.getLogger(__name__)


# State definitions
class NovelState(TypedDict):
    """State for novel generation workflow"""
    user_id: int
    novel_id: int
    novel_info: Dict[str, Any]
    characters: List[Dict[str, Any]]
    outline: str
    detailed_outlines: List[Dict[str, Any]]
    current_chapter: int
    chapter_content: str
    messages: Annotated[List[str], operator.add]
    error: Optional[str]


class OutlineGeneratorNode:
    """Node for generating novel outline"""
    
    SYSTEM_PROMPT = """你是一位专业的小说大纲策划师。你需要根据用户提供的小说设定，创作一份完整的小说大纲。

大纲应包含：
1. 故事主线概述
2. 主要情节节点
3. 人物发展弧线
4. 冲突与高潮设计
5. 结局走向

请确保大纲逻辑连贯，情节紧凑，具有吸引力。"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        self.llm_service = get_llm_service(model_config)
    
    async def generate(self, state: NovelState) -> AsyncGenerator[str, None]:
        """Generate novel outline with streaming"""
        novel_info = state["novel_info"]
        characters = state["characters"]
        
        # Build prompt
        prompt = f"""
## 小说基本信息
- 标题：{novel_info.get('title', '未命名')}
- 类型：{novel_info.get('genre', '未指定')}
- 风格：{novel_info.get('style', '未指定')}
- 简介：{novel_info.get('description', '')}

## 世界观设定
{novel_info.get('world_setting', '无特殊设定')}

## 创作提示词
{novel_info.get('prompt', '')}

## 主要人物
"""
        for char in characters:
            prompt += f"""
### {char.get('name', '未命名')}
- 角色定位：{char.get('role', '')}
- 性格特点：{char.get('personality', '')}
- 背景故事：{char.get('background', '')}
"""
        
        prompt += "\n请根据以上信息，创作一份详细的小说大纲。"
        
        async for chunk in self.llm_service.generate_stream(
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT
        ):
            yield chunk


class DetailedOutlineGeneratorNode:
    """Node for generating detailed outline (细纲)"""
    
    SYSTEM_PROMPT = """你是一位专业的小说细纲策划师。你需要根据大纲，为指定的章节组创作详细的细纲。

每章细纲应包含：
1. 章节标题
2. 主要场景
3. 出场人物
4. 情节要点
5. 情感基调
6. 与前后章节的衔接

请确保细纲详细具体，便于后续章节内容的创作。"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        self.llm_service = get_llm_service(model_config)
    
    async def generate(
        self,
        state: NovelState,
        group_index: int,
        start_chapter: int,
        end_chapter: int
    ) -> AsyncGenerator[str, None]:
        """Generate detailed outline for a chapter group with streaming"""
        novel_info = state["novel_info"]
        outline = state["outline"]
        characters = state["characters"]
        
        prompt = f"""
## 小说信息
- 标题：{novel_info.get('title', '')}
- 类型：{novel_info.get('genre', '')}

## 总大纲
{outline}

## 人物列表
"""
        for char in characters:
            prompt += f"- {char.get('name', '')}: {char.get('personality', '')}\n"
        
        prompt += f"""
## 任务
请为第 {start_chapter} 章到第 {end_chapter} 章创作详细的细纲。
这是第 {group_index + 1} 组细纲（每5章为一组）。

请按照以下格式输出每章的细纲：

### 第X章：章节标题
**场景**：主要场景描述
**人物**：本章出场人物
**情节**：
1. 情节点1
2. 情节点2
...
**情感基调**：本章的情感氛围
**衔接**：与前后章节的关联
"""
        
        async for chunk in self.llm_service.generate_stream(
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT
        ):
            yield chunk


class ChapterGeneratorNode:
    """Node for generating chapter content with RAG"""
    
    SYSTEM_PROMPT = """你是一位专业的小说作家。你需要根据细纲和参考信息，创作完整的章节内容。

创作要求：
1. 文笔流畅，描写生动
2. 人物性格保持一致
3. 情节发展符合逻辑
4. 对话自然真实
5. 场景描写细腻
6. 保持与整体风格的统一

请确保章节内容完整，字数充实（建议2000-5000字）。"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        self.rag_service = get_rag_service(model_config)
    
    async def generate(
        self,
        state: NovelState,
        chapter_number: int,
        detailed_outline: str,
        previous_summaries: List[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Generate chapter content with RAG context and streaming"""
        novel_info = state["novel_info"]
        user_id = state["user_id"]
        novel_id = state["novel_id"]

        # Build previous summaries context
        summaries_text = ""
        if previous_summaries:
            summaries_text = "\n## 前面章节AI总结\n"
            for summary in previous_summaries:
                summaries_text += f"\n### 第{summary.get('chapter_number', '?')}章\n"
                if summary.get('plot_summary'):
                    summaries_text += f"**剧情总结**: {summary['plot_summary']}\n"
                if summary.get('opening'):
                    summaries_text += f"**开头**: {summary['opening']}\n"
                if summary.get('middle'):
                    summaries_text += f"**中间**: {summary['middle']}\n"
                if summary.get('ending'):
                    summaries_text += f"**结尾**: {summary['ending']}\n"

        prompt = f"""
## 小说信息
- 标题：{novel_info.get('title', '')}
- 类型：{novel_info.get('genre', '')}
- 风格：{novel_info.get('style', '')}
{summaries_text}
## 本章细纲
{detailed_outline}

## 任务
请根据以上细纲和前面章节的总结，创作第 {chapter_number} 章的完整内容。
注意保持与前文的连贯性和一致性。
"""

        async for chunk in self.rag_service.generate_with_rag(
            user_id=user_id,
            novel_id=novel_id,
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT,
            include_characters=True,
            include_world=True,
            include_timeline=True,
            entry_types=["character", "chapter_content", "setting"],
            top_k=5
        ):
            yield chunk


class ChapterRevisionNode:
    """Node for revising chapter content based on feedback"""
    
    SYSTEM_PROMPT = """你是一位专业的小说编辑。你需要根据审核意见修改章节内容。

修改要求：
1. 准确理解审核意见
2. 针对性地修改问题部分
3. 保持整体风格一致
4. 确保修改后的内容流畅自然
5. 不要改变原有的优秀部分"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        self.llm_service = get_llm_service(model_config)
    
    async def revise(
        self,
        original_content: str,
        feedback: str,
        novel_info: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Revise chapter content based on feedback with streaming"""
        prompt = f"""
## 小说信息
- 标题：{novel_info.get('title', '')}
- 风格：{novel_info.get('style', '')}

## 原始章节内容
{original_content}

## 审核意见
{feedback}

## 任务
请根据审核意见修改章节内容，输出修改后的完整章节。
"""
        
        async for chunk in self.llm_service.generate_stream(
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT
        ):
            yield chunk


class NovelWorkflow:
    """Complete novel generation workflow using LangGraph"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        self.model_config = model_config
        self.outline_generator = OutlineGeneratorNode(model_config)
        self.detailed_outline_generator = DetailedOutlineGeneratorNode(model_config)
        self.chapter_generator = ChapterGeneratorNode(model_config)
        self.chapter_revision = ChapterRevisionNode(model_config)
    
    async def generate_outline(
        self,
        user_id: int,
        novel_id: int,
        novel_info: Dict[str, Any],
        characters: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """Generate novel outline with streaming"""
        state: NovelState = {
            "user_id": user_id,
            "novel_id": novel_id,
            "novel_info": novel_info,
            "characters": characters,
            "outline": "",
            "detailed_outlines": [],
            "current_chapter": 0,
            "chapter_content": "",
            "messages": [],
            "error": None
        }
        
        async for chunk in self.outline_generator.generate(state):
            yield chunk
    
    async def generate_detailed_outline(
        self,
        user_id: int,
        novel_id: int,
        novel_info: Dict[str, Any],
        characters: List[Dict[str, Any]],
        outline: str,
        group_index: int,
        start_chapter: int,
        end_chapter: int
    ) -> AsyncGenerator[str, None]:
        """Generate detailed outline for a chapter group with streaming"""
        state: NovelState = {
            "user_id": user_id,
            "novel_id": novel_id,
            "novel_info": novel_info,
            "characters": characters,
            "outline": outline,
            "detailed_outlines": [],
            "current_chapter": 0,
            "chapter_content": "",
            "messages": [],
            "error": None
        }
        
        async for chunk in self.detailed_outline_generator.generate(
            state, group_index, start_chapter, end_chapter
        ):
            yield chunk
    
    async def generate_chapter(
        self,
        user_id: int,
        novel_id: int,
        novel_info: Dict[str, Any],
        characters: List[Dict[str, Any]],
        chapter_number: int,
        detailed_outline: str,
        previous_summaries: List[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Generate chapter content with RAG and streaming"""
        state: NovelState = {
            "user_id": user_id,
            "novel_id": novel_id,
            "novel_info": novel_info,
            "characters": characters,
            "outline": "",
            "detailed_outlines": [],
            "current_chapter": chapter_number,
            "chapter_content": "",
            "messages": [],
            "error": None
        }

        async for chunk in self.chapter_generator.generate(
            state, chapter_number, detailed_outline, previous_summaries
        ):
            yield chunk
    
    async def revise_chapter(
        self,
        novel_info: Dict[str, Any],
        original_content: str,
        feedback: str
    ) -> AsyncGenerator[str, None]:
        """Revise chapter content based on feedback with streaming"""
        async for chunk in self.chapter_revision.revise(
            original_content, feedback, novel_info
        ):
            yield chunk


def get_novel_workflow(model_config: Optional[AIModelConfig] = None) -> NovelWorkflow:
    """Get novel workflow instance"""
    return NovelWorkflow(model_config)

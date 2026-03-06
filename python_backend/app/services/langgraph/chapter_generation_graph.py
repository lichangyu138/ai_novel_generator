"""
章节生成 LangGraph 工作流
包含：细纲生成 -> 章节生成 -> 知识提取 -> 同步
"""
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from app.services.langchain.llm_service import get_llm_service, LLMService
from app.models.database import AIModelConfig
from app.db.milvus import get_milvus_client
from app.db.mysql import get_db


class ChapterGenerationState(TypedDict):
    """章节生成状态"""
    novel_id: int
    user_id: int
    chapter_number: int
    target_word_count: Optional[int]  # 目标字数（可选，如果为None或0则只生成细纲）

    # 输入
    outline: str  # 总大纲
    previous_outlines: List[Dict]  # 前几章细纲
    previous_summaries: List[str]  # 前几章摘要

    # 检索到的知识
    characters: List[Dict]  # 相关人物
    locations: List[Dict]  # 相关地点
    items: List[Dict]  # 相关道具
    organizations: List[Dict]  # 相关组织
    foreshadowing: List[Dict]  # 相关伏笔
    character_relations: List[Dict]  # 人物关系图谱

    # 生成结果
    chapter_outline: Optional[Dict]  # 细纲
    chapter_content: Optional[str]  # 章节内容
    chapter_summary: Optional[str]  # AI摘要
    extracted_knowledge: Optional[List[Dict]]  # 提取的知识
    new_foreshadowing: Optional[List[Dict]]  # 新伏笔

    # 错误信息
    error: Optional[str]

def _enforce_scene_limit(outline_text: str, max_scenes: int = 3) -> str:
    """
    Best-effort post-processor:
    - If the model outputs more than `max_scenes` scenes, merge the extra parts into the last kept scene.
    This avoids UI/next-step prompt bloat when users require 1-3 scenes per chapter.
    """
    if not outline_text or max_scenes <= 0:
        return outline_text

    # Common headings: 场景一/二/三... or 场景1/2/3...
    import re

    pattern = re.compile(r"(?m)^(场景[一二三四五六七八九十0-9]+[：:])")
    matches = list(pattern.finditer(outline_text))
    if len(matches) <= max_scenes:
        return outline_text

    # Keep content up to the start of (max_scenes+1)-th scene; append the remainder into the last kept scene.
    cut_idx = matches[max_scenes].start()
    kept = outline_text[:cut_idx].rstrip()
    extra = outline_text[cut_idx:].strip()

    if not extra:
        return kept

    return (
        kept
        + "\n\n【合并的额外场景/要点（系统自动压缩）】\n"
        + extra
        + "\n"
    )


def retrieve_knowledge(state: ChapterGenerationState) -> ChapterGenerationState:
    """从向量库和知识图谱检索相关知识"""
    try:
        from app.services.langchain.embedding_service import get_embedding_service

        milvus_client = get_milvus_client()
        embedding_service = get_embedding_service()

        # 构建查询文本（基于大纲和前文）
        query_text = f"第{state['chapter_number']}章\n{state['outline']}"
        if state['previous_summaries']:
            query_text = f"前文：{state['previous_summaries'][-1]}\n{query_text}"

        # 生成查询向量
        query_embedding = embedding_service.embed_text_sync(query_text)

        # 向量检索
        results = milvus_client.search_vectors(
            user_id=state['user_id'],
            novel_id=state['novel_id'],
            query_embedding=query_embedding,
            top_k=10
        )

        # 确保 results 是列表
        if results is None:
            results = []

        # 分类结果
        state['characters'] = [r for r in results if r.get('entry_type') == 'character']
        state['locations'] = [r for r in results if r.get('entry_type') == 'location']
        state['items'] = [r for r in results if r.get('entry_type') == 'item']
        state['organizations'] = [r for r in results if r.get('entry_type') == 'organization']
        state['foreshadowing'] = [r for r in results if r.get('entry_type') == 'foreshadowing']

        # TODO: 从 Neo4j 获取人物关系图谱
        state['character_relations'] = []

    except Exception as e:
        print(f"知识检索失败: {e}")
        import traceback
        traceback.print_exc()
        # 设置空列表，继续执行
        state['characters'] = []
        state['locations'] = []
        state['items'] = []
        state['organizations'] = []
        state['foreshadowing'] = []
        state['character_relations'] = []

    return state


def generate_chapter_outline(state: ChapterGenerationState) -> ChapterGenerationState:
    """生成细纲"""
    print(f"[generate_chapter_outline] 开始生成细纲，章节: {state['chapter_number']}")

    # 如果已有细纲内容，直接跳过生成
    existing_outline = state.get('chapter_outline', {}).get('content') if state.get('chapter_outline') else None
    if existing_outline and existing_outline.strip():
        print(f"[generate_chapter_outline] 已存在细纲内容，长度: {len(existing_outline)} 字，跳过重新生成")
        return state

    try:
        # 创建临时模型配置，强制使用指定 key
        temp_config = AIModelConfig(
            user_id=state['user_id'],
            name="temp_hk_config",
            model_type="openai",
            api_key="hk-4rlisq100003893046dc10e91fa58f850eaba608d8ff489d",
            api_base="https://api.openai-hk.com/v1",
            model_name="gemini-3-pro-preview",
            temperature=0.7,
            max_tokens=32768  # 推理模型需要更大的 token 空间
        )
        llm = LLMService(model_config=temp_config)

        # 构建上下文，处理第一章的特殊情况
        is_first_chapter = state['chapter_number'] == 1

        # 总大纲部分
        outline_section = ""
        if state.get('outline') and state['outline'].strip():
            outline_section = f"""# 小说总大纲
{state['outline']}
"""
        else:
            # 如果没有总大纲，给出默认指引
            outline_section = """# 创作指引
这是一部小说的开篇章节，请根据以下要求创作一个引人入胜的开局。
"""

        # 前几章细纲部分
        previous_section = ""
        if state.get('previous_outlines') and len(state['previous_outlines']) > 0:
            previous_section = f"""
# 前几章细纲
{chr(10).join([f"第{o['chapter_number']}章：{o.get('plot_development', '')}" for o in state['previous_outlines'][-3:]])}
"""

        # 相关知识部分
        knowledge_section = ""
        has_knowledge = False

        if state.get('characters') and len(state['characters']) > 0:
            knowledge_section += "\n# 相关人物\n"
            knowledge_section += chr(10).join([f"- {c.get('content', '')[:200]}" for c in state['characters'][:5]])
            has_knowledge = True

        if state.get('locations') and len(state['locations']) > 0:
            knowledge_section += "\n# 相关地点\n"
            knowledge_section += chr(10).join([f"- {l.get('content', '')[:200]}" for l in state['locations'][:3]])
            has_knowledge = True

        if state.get('organizations') and len(state['organizations']) > 0:
            knowledge_section += "\n# 相关组织\n"
            knowledge_section += chr(10).join([f"- {o.get('content', '')[:200]}" for o in state['organizations'][:3]])
            has_knowledge = True

        # 组合完整上下文
        context = outline_section + previous_section + knowledge_section

        # 根据是否是第一章调整提示词
        if is_first_chapter:
            chapter_instruction = f"""请为第{state['chapter_number']}章（开篇章节）生成详细细纲。

**这是第一章，需要特别注意：**
1. 引入主角和基本世界观
2. 设置一个吸引读者的开局（可以是冲突、悬念、或独特场景）
3. 建立故事的基调和氛围
4. 为后续情节埋下伏笔

**硬性要求（必须遵守，否则视为失败）：**
1) 输出总长度 ≤ 2000 个中文字符（按字符计数，不是“约”）
2) 禁止重复任何模块/标题/段落（尤其不要把“前文总结/场景一二三/剧情发展/人物动态/场景描述”等再复述一遍）
3) 只保留一个完整结构，不要追加“补充/再次总结/再来一遍/以下为...”等二次输出
4) 场景数严格 1-3 个：只允许“场景一/二/三”（或场景1/2/3）；素材点太多时必须合并删减进前三个场景

在满足以上硬规则前提下，尽量写得信息密度高，以支持生成 5000 字以上正文。"""
        else:
            chapter_instruction = f"""请为第{state['chapter_number']}章生成详细细纲。

**硬性要求（必须遵守，否则视为失败）：**
1) 输出总长度 ≤ 2000 个中文字符（按字符计数，不是“约”）
2) 禁止重复任何模块/标题/段落（尤其不要把“前文总结/场景一二三/剧情发展/人物动态/场景描述”等再复述一遍）
3) 只保留一个完整结构，不要追加“补充/再次总结/再来一遍/以下为...”等二次输出
4) 场景数严格 1-3 个：只允许“场景一/二/三”（或场景1/2/3）；素材点太多时必须合并删减进前三个场景

在满足以上硬规则前提下，尽量写得信息密度高，以支持生成 5000 字以上正文。"""

        prompt = f"""{context}

{chapter_instruction}

细纲内容应包括：
1. 本章的主要场景（严格：1-3个场景；最少1个，最多3个；超过的必须合并进前3个场景中）
2. 每个场景的详细情节发展
3. 人物的动作、对话要点、心理活动
4. 场景转换的衔接
5. 本章的情感基调和氛围
6. 关键的细节描写提示

格式要求：
- 按场景顺序描述，每个场景都要详细展开
- 只允许输出“场景一/二/三”（或场景1/2/3）三段结构；如果素材点太多，请在每个场景内用要点合并，禁止新增第4个场景
- 包含具体的对话要点和人物互动
- 标注重要的情节转折点
- 不要只写大纲标题，要写成流水账式的详细描述

示例格式：
场景一：主角在某个地点做某事。详细描述环境、动作、心理...（继续详细描述）
场景二：发生了什么事件，主角如何反应...（继续详细描述）
"""

        print(f"[generate_chapter_outline] 调用 LLM，提示词长度: {len(prompt)}")
        print(f"[generate_chapter_outline] 是否第一章: {is_first_chapter}")
        print(f"[generate_chapter_outline] 有总大纲: {bool(state.get('outline'))}")
        print(f"[generate_chapter_outline] 有前章细纲: {bool(state.get('previous_outlines'))}")
        print(f"[generate_chapter_outline] 有知识库: {has_knowledge}")

        # 使用同步方法，进一步收紧 max_tokens，降低“超长/复读”概率（中文通常 1 字≈1 token 左右）
        response = llm.generate_sync(prompt, max_tokens=2200)

        # 检查细纲长度并截断
        if len(response) < 800:
            print(f"[generate_chapter_outline] 警告：细纲过短 ({len(response)} 字)，可能影响正文生成质量")

        # 强制“每章最多3个场景”（若模型越界则合并）
        response = _enforce_scene_limit(response, max_scenes=3)

        # 如果超过2000字，截断到2000字
        if len(response) > 2000:
            print(f"[generate_chapter_outline] 警告：细纲过长 ({len(response)} 字)，截断到2000字")
            response = response[:2000]

        print(f"[generate_chapter_outline] LLM 返回，内容长度: {len(response) if response else 0}")
        print(f"[generate_chapter_outline] 内容预览: {response[:200] if response else 'None'}")

        # 解析细纲（简化版，实际需要更复杂的解析）
        state['chapter_outline'] = {
            'chapter_number': state['chapter_number'],
            'content': response
        }

        print(f"[generate_chapter_outline] 细纲生成完成")

    except Exception as e:
        print(f"[generate_chapter_outline] 错误: {e}")
        import traceback
        traceback.print_exc()
        state['error'] = f"细纲生成失败: {str(e)}"

    return state


def generate_chapter_content(state: ChapterGenerationState) -> ChapterGenerationState:
    """生成章节内容"""
    # 创建临时模型配置，强制使用指定 key
    temp_config = AIModelConfig(
        user_id=state['user_id'],
        name="temp_hk_config",
        model_type="openai",
        api_key="hk-4rlisq100003893046dc10e91fa58f850eaba608d8ff489d",
        api_base="https://api.openai-hk.com/v1",
        model_name="gemini-3-pro-preview",
        temperature=0.7,
        max_tokens=32768  # 推理模型需要更大的 token 空间
    )
    llm = LLMService(model_config=temp_config)

    # 构建上下文，处理第一章的特殊情况
    is_first_chapter = state['chapter_number'] == 1

    # 总大纲部分
    main_outline_section = ""
    if state.get('outline') and state['outline'].strip():
        main_outline_section = f"""# 小说总大纲
{state['outline'][:1000]}

"""

    # 细纲部分（必须有）
    outline_content = state['chapter_outline']['content']

    # 前几章摘要部分
    previous_section = ""
    if state.get('previous_summaries') and len(state['previous_summaries']) > 0:
        previous_section = f"""# 前几章摘要
{chr(10).join([f"第{i+1}章：{s}" for i, s in enumerate(state['previous_summaries'][-2:])])}

"""

    # 相关知识部分
    knowledge_section = ""
    if state.get('characters') and len(state['characters']) > 0:
        knowledge_section += "# 相关人物\n"
        knowledge_section += chr(10).join([c.get('content', '')[:200] for c in state['characters'][:5]])
        knowledge_section += "\n\n"

    if state.get('locations') and len(state['locations']) > 0:
        knowledge_section += "# 相关地点\n"
        knowledge_section += chr(10).join([l.get('content', '')[:200] for l in state['locations'][:3]])
        knowledge_section += "\n\n"

    # 组合上下文
    context = f"""{main_outline_section}# 本章细纲
{outline_content}

{previous_section}{knowledge_section}"""

    # 根据是否是第一章调整提示词
    target_words = state.get('target_word_count', 5000)

    if is_first_chapter:
        chapter_instruction = f"""请根据以上细纲，创作第{state['chapter_number']}章（开篇章节）的小说正文。

**这是第一章，需要特别注意：**
1. 自然引入主角，展现其性格特点
2. 通过场景和对话展现世界观，不要生硬说明
3. 设置吸引读者的开局冲突或悬念
4. 建立故事的基调和氛围

**严格要求：正文必须达到{target_words}汉字以上**"""
    else:
        chapter_instruction = f"""请根据以上细纲，创作第{state['chapter_number']}章的小说正文。

**严格要求：正文必须达到{target_words}汉字以上**"""

    prompt = f"""{context}

{chapter_instruction}

写作要求：
1. 直接写小说正文，不要大纲标题
2. 第三人称叙事，详细描写场景、对话、心理
3. 充分展开情节，不要跳跃
4. 对话要完整，场景要细腻
5. 开头直接进入场景
6. 每个场景都要充分展开，包含详细的环境描写、人物动作、对话和心理活动
7. 不要用省略号跳过情节，要完整呈现每一个场景
8. 对话要自然流畅，包含人物的语气、表情、动作等细节

注意：{target_words}字是最低要求，请务必写够字数。如果细纲内容较少，请充分展开每个场景的描写。
"""

    print(f"[generate_chapter_content] 开始生成章节内容")
    print(f"[generate_chapter_content] 目标字数: {target_words}")
    print(f"[generate_chapter_content] 是否第一章: {is_first_chapter}")
    print(f"[generate_chapter_content] 有总大纲: {bool(state.get('outline'))}")
    print(f"[generate_chapter_content] 总大纲长度: {len(state.get('outline', '')) if state.get('outline') else 0} 字")
    print(f"[generate_chapter_content] 细纲长度: {len(outline_content)} 字")
    print(f"[generate_chapter_content] 有前几章摘要: {bool(state.get('previous_summaries'))}")
    print(f"[generate_chapter_content] 有知识库: {bool(state.get('characters') or state.get('locations'))}")

    # 使用 gemini-3-pro-preview，支持更大的 max_tokens
    max_tokens = min(int(target_words * 4), 65536)
    print(f"[generate_chapter_content] max_tokens: {max_tokens}")

    response = llm.generate_sync(prompt, max_tokens=max_tokens)
    print(f"[generate_chapter_content] 第一次生成长度: {len(response)} 字")

    # 如果内容为空或过短，且目标字数较大，尝试续写
    if len(response) < target_words * 0.5 and target_words >= 3000:
        print(f"[generate_chapter_content] 内容过短，尝试续写...")
        conversation = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response},
            {"role": "user", "content": "请继续写完剩余内容，直到达到目标字数。"}
        ]

        for i in range(3):  # 最多续写3次
            continuation = llm.generate_sync(conversation[-1]["content"], max_tokens=max_tokens)
            print(f"[generate_chapter_content] 第{i+2}次续写长度: {len(continuation)} 字")

            if continuation and len(continuation) > 50:
                response += continuation
                conversation.append({"role": "assistant", "content": continuation})
                conversation.append({"role": "user", "content": "继续"})

                if len(response) >= target_words * 0.8:
                    print(f"[generate_chapter_content] 已达到目标字数，停止续写")
                    break
            else:
                print(f"[generate_chapter_content] 续写返回空内容，停止")
                break

    print(f"[generate_chapter_content] 最终内容长度: {len(response)} 字")

    if len(response) < target_words * 0.8:
        print(f"[generate_chapter_content] 警告：生成内容过短 ({len(response)} 字)，目标 {target_words} 字")

    state['chapter_content'] = response
    return state


def generate_summary(state: ChapterGenerationState) -> ChapterGenerationState:
    """生成章节摘要"""
    # 创建临时模型配置，强制使用指定 key
    temp_config = AIModelConfig(
        user_id=state['user_id'],
        name="temp_hk_config",
        model_type="openai",
        api_key="hk-4rlisq100003893046dc10e91fa58f850eaba608d8ff489d",
        api_base="https://api.openai-hk.com/v1",
        model_name="gemini-3-pro-preview",
        temperature=0.7,
        max_tokens=32768
    )
    llm = LLMService(model_config=temp_config)

    prompt = f"""请为以下章节生成简洁摘要（200字以内）：

{state['chapter_content'][:2000]}

摘要要求：
- 概括主要情节
- 提及关键人物
- 标注重要事件
"""

    response = llm.generate_sync(prompt)
    state['chapter_summary'] = response

    return state


def extract_knowledge(state: ChapterGenerationState) -> ChapterGenerationState:
    """从章节中提取知识"""
    try:
        # 创建临时模型配置，强制使用指定 key
        temp_config = AIModelConfig(
            user_id=state['user_id'],
            name="temp_hk_config",
            model_type="openai",
            api_key="hk-4rlisq100003893046dc10e91fa58f850eaba608d8ff489d",
            api_base="https://api.openai-hk.com/v1",
            model_name="gemini-3-pro-preview",
            temperature=0.7,
            max_tokens=32768
        )
        llm = LLMService(model_config=temp_config)

        prompt = f"""从以下章节中提取知识条目（JSON格式）：

{state['chapter_content']}

请提取：
1. 新出现的人物（name, description, type='character'）
2. 新出现的地点（name, description, type='location'）
3. 新出现的物品（name, description, type='item'）
4. 新出现的组织（name, description, type='organization'）
5. 新埋下的伏笔（name, description, type='foreshadowing'）

返回JSON数组格式：
[
  {{"type": "character", "name": "张三", "description": "主角的朋友"}},
  {{"type": "location", "name": "月影山", "description": "神秘的修炼圣地"}}
]
"""

        response = llm.generate_sync(prompt)

        # 解析JSON（需要错误处理）
        try:
            import json
            state['extracted_knowledge'] = json.loads(response)
        except:
            state['extracted_knowledge'] = []

    except Exception as e:
        print(f"[extract_knowledge] 知识提取失败: {e}，跳过此步骤")
        import traceback
        traceback.print_exc()
        state['extracted_knowledge'] = []

    return state


def sync_to_knowledge_base(state: ChapterGenerationState) -> ChapterGenerationState:
    """同步到知识库"""
    from app.models.database import KnowledgeEntry

    db = next(get_db())

    try:
        # 保存提取的知识
        for item in state.get('extracted_knowledge', []):
            # 将 name 和 description 合并到 content 中
            content = f"{item.get('name', '')}: {item.get('description', '')}"

            entry = KnowledgeEntry(
                novel_id=state['novel_id'],
                user_id=state['user_id'],
                entry_type=item.get('type', 'unknown'),
                content=content,
                source_id=None,  # 暂时为空，后续可以关联到 chapter_id
                extra_metadata={
                    'name': item.get('name'),
                    'description': item.get('description'),
                    'extracted_from_chapter': state['chapter_number']
                }
            )
            db.add(entry)

        db.commit()
    except Exception as e:
        db.rollback()
        state['error'] = f"知识同步失败: {str(e)}"
        print(f"[sync_to_knowledge_base] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

    return state


def should_generate_content(state: ChapterGenerationState) -> str:
    """判断是否需要生成正文内容"""
    # 如果 target_word_count 不存在、为 None 或为 0，则只生成细纲
    target_words = state.get('target_word_count')
    if target_words is None or target_words == 0:
        return "end"
    return "generate_content"


def build_chapter_generation_graph():
    """构建章节生成工作流图"""
    workflow = StateGraph(ChapterGenerationState)

    # 添加节点
    workflow.add_node("retrieve_knowledge", retrieve_knowledge)
    workflow.add_node("generate_outline", generate_chapter_outline)
    workflow.add_node("generate_content", generate_chapter_content)
    workflow.add_node("generate_summary", generate_summary)
    workflow.add_node("extract_knowledge", extract_knowledge)
    workflow.add_node("sync_knowledge", sync_to_knowledge_base)

    # 定义流程
    workflow.set_entry_point("retrieve_knowledge")
    workflow.add_edge("retrieve_knowledge", "generate_outline")
    # 生成细纲后，根据条件决定是否继续生成正文
    workflow.add_conditional_edges(
        "generate_outline",
        should_generate_content,
        {
            "generate_content": "generate_content",
            "end": END
        }
    )
    workflow.add_edge("generate_content", "generate_summary")
    workflow.add_edge("generate_summary", "extract_knowledge")
    workflow.add_edge("extract_knowledge", "sync_knowledge")
    workflow.add_edge("sync_knowledge", END)

    return workflow.compile()


# 全局实例
chapter_generation_graph = build_chapter_generation_graph()


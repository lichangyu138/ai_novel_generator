"""
细纲生成 LangGraph 工作流
"""
from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
from app.db.milvus import get_milvus_client
from app.services.langchain.llm_service import get_llm_service

class ChapterOutlineState(TypedDict):
    novel_id: int
    user_id: int
    chapter_number: int
    main_outline: str  # 总大纲
    previous_outlines: List[Dict]  # 前几章细纲
    retrieved_knowledge: Dict[str, List[Dict]]  # 检索到的知识
    generated_outline: Dict[str, str]  # 生成的细纲

def retrieve_knowledge(state: ChapterOutlineState) -> ChapterOutlineState:
    """从向量库和知识图谱检索相关知识"""
    milvus = get_milvus_client()
    
    # 构建查询文本
    query_text = f"{state['main_outline']}\n前文：{state['previous_outlines'][-1]['content'] if state['previous_outlines'] else ''}"
    
    # 向量检索
    results = milvus.search_similar(
        user_id=state['user_id'],
        novel_id=state['novel_id'],
        query_text=query_text,
        top_k=10
    )
    
    # 分类知识
    knowledge = {
        'characters': [],
        'locations': [],
        'items': [],
        'organizations': []
    }
    
    for r in results:
        entry_type = r.get('entry_type', '')
        if entry_type in knowledge:
            knowledge[entry_type].append(r)
    
    state['retrieved_knowledge'] = knowledge
    return state

def generate_outline(state: ChapterOutlineState) -> ChapterOutlineState:
    """生成细纲"""
    llm = get_llm_service()
    
    # 构建提示词
    context = f"""# 小说总大纲
{state['main_outline']}

# 前几章细纲
{chr(10).join([f"第{o['chapter_number']}章：{o['content'][:200]}..." for o in state['previous_outlines'][-3:]])}

# 相关人物
{chr(10).join([f"- {c['name']}: {c['content'][:100]}" for c in state['retrieved_knowledge']['characters'][:5]])}

# 相关地点
{chr(10).join([f"- {l['name']}: {l['content'][:100]}" for l in state['retrieved_knowledge']['locations'][:3]])}

# 相关组织
{chr(10).join([f"- {o['name']}: {o['content'][:100]}" for o in state['retrieved_knowledge']['organizations'][:3]])}

# 相关道具
{chr(10).join([f"- {i['name']}: {i['content'][:100]}" for i in state['retrieved_knowledge']['items'][:3]])}
"""
    
    prompt = f"""{context}

请为第{state['chapter_number']}章生成详细细纲，并严格遵守以下硬性要求（否则视为失败）：
1) 输出总长度 ≤ 2000 个中文字符（按字符计数，不是“约”）
2) 场景数严格 1-3 个：只允许“场景一/二/三”（或场景1/2/3）；素材点太多时必须合并删减进前三个场景
3) 禁止重复任何模块/标题/段落；不要出现“剧情发展/人物动态/场景描述”等二次复述同一内容的重复块
4) 只输出一次完整结构，不要在末尾追加“补充/再总结/以下继续/再来一遍”

输出结构请严格按下面顺序：
1) 前文总结（承接上文）
2) 场景一：地点/人物/冲突触发/推进与信息（可用要点合并）
3) 场景二：（可选）升级/对抗/交换信息
4) 场景三：（可选）转折/代价/结尾钩子
5) 关键对话要点（最多6条）

要求：
- 与总大纲保持一致，自然承接前文
- 合理使用已有的人物、地点、组织、道具
- 情节紧凑，有冲突和转折
- 禁止出现“场景四/场景5”等第4个及以上场景标题；如果你想写更多，只能合并进前三个场景
"""
    
    result = llm.generate(prompt)
    
    # 如果超过2000字，截断到2000字
    if len(result) > 2000:
        print(f"[generate_outline] 警告：细纲过长 ({len(result)} 字)，截断到2000字")
        result = result[:2000]
    
    # 解析结果（简化版）
    state['generated_outline'] = {
        'previousSummary': result[:500] if len(result) > 500 else result,
        'plotDevelopment': result[500:1500] if len(result) > 1500 else result[500:],
        'characterDynamics': result[1500:2000] if len(result) > 2000 else result[1500:],
        'sceneDescription': result[2000:2500] if len(result) > 2500 else '',
        'dialoguePoints': result[2500:] if len(result) > 2500 else ''
    }
    
    return state

# 创建工作流
def create_chapter_outline_graph():
    workflow = StateGraph(ChapterOutlineState)
    
    workflow.add_node("retrieve_knowledge", retrieve_knowledge)
    workflow.add_node("generate_outline", generate_outline)
    
    workflow.set_entry_point("retrieve_knowledge")
    workflow.add_edge("retrieve_knowledge", "generate_outline")
    workflow.add_edge("generate_outline", END)
    
    return workflow.compile()

# 执行函数
async def generate_chapter_outline(
    novel_id: int,
    user_id: int,
    chapter_number: int,
    main_outline: str,
    previous_outlines: List[Dict],
    db: Session
) -> Dict[str, str]:
    """生成细纲"""
    graph = create_chapter_outline_graph()
    
    result = await graph.ainvoke({
        'novel_id': novel_id,
        'user_id': user_id,
        'chapter_number': chapter_number,
        'main_outline': main_outline,
        'previous_outlines': previous_outlines,
        'retrieved_knowledge': {},
        'generated_outline': {}
    })
    
    return result['generated_outline']


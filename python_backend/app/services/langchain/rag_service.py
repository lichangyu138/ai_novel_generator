"""
RAG Service - Retrieval Augmented Generation
Combines vector search with LLM generation for context-aware content
"""
from typing import List, Dict, Any, Optional, AsyncGenerator
import logging

from app.db.milvus import get_milvus_client
from app.db.neo4j import get_neo4j_client
from app.services.langchain.llm_service import get_llm_service
from app.services.langchain.embedding_service import get_embedding_service
from app.models.database import AIModelConfig

logger = logging.getLogger(__name__)


class RAGService:
    """RAG Service for context-aware novel generation"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        """
        Initialize RAG service
        
        Args:
            model_config: Optional custom model configuration
        """
        self.llm_service = get_llm_service(model_config)
        self.embedding_service = get_embedding_service()
        self.milvus_client = get_milvus_client()
        self.neo4j_client = get_neo4j_client()
    
    async def retrieve_context(
        self,
        user_id: int,
        novel_id: int,
        query: str,
        entry_types: Optional[List[str]] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant context from vector database
        
        Args:
            user_id: User ID for data isolation
            novel_id: Novel project ID
            query: Query text
            entry_types: Optional filter by entry types
            top_k: Number of results to return
        
        Returns:
            List of relevant context entries
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.embed_text(query)
        
        results = []
        
        if entry_types:
            for entry_type in entry_types:
                type_results = self.milvus_client.search_vectors(
                    user_id=user_id,
                    novel_id=novel_id,
                    query_embedding=query_embedding,
                    entry_type=entry_type,
                    top_k=top_k
                )
                results.extend(type_results)
        else:
            results = self.milvus_client.search_vectors(
                user_id=user_id,
                novel_id=novel_id,
                query_embedding=query_embedding,
                top_k=top_k
            )
        
        # Sort by score and deduplicate
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:top_k]
        
        return results
    
    async def get_character_context(
        self,
        user_id: int,
        novel_id: int
    ) -> Dict[str, Any]:
        """
        Get character relationship context from knowledge graph
        
        Args:
            user_id: User ID
            novel_id: Novel ID
        
        Returns:
            Character graph data
        """
        return self.neo4j_client.get_character_graph(user_id, novel_id)
    
    async def get_world_context(
        self,
        user_id: int,
        novel_id: int
    ) -> Dict[str, Any]:
        """
        Get world structure context from knowledge graph
        
        Args:
            user_id: User ID
            novel_id: Novel ID
        
        Returns:
            World graph data
        """
        return self.neo4j_client.get_world_graph(user_id, novel_id)
    
    async def get_timeline_context(
        self,
        user_id: int,
        novel_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get timeline context from knowledge graph
        
        Args:
            user_id: User ID
            novel_id: Novel ID
        
        Returns:
            Timeline events
        """
        return self.neo4j_client.get_timeline(user_id, novel_id)
    
    def _format_context(
        self,
        vector_results: List[Dict[str, Any]],
        character_graph: Optional[Dict[str, Any]] = None,
        world_graph: Optional[Dict[str, Any]] = None,
        timeline: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Format retrieved context into a prompt-friendly string
        
        Args:
            vector_results: Results from vector search
            character_graph: Character relationship data
            world_graph: World structure data
            timeline: Timeline events
        
        Returns:
            Formatted context string
        """
        context_parts = []
        
        # Vector search results
        if vector_results:
            context_parts.append("## 相关内容参考")
            for i, result in enumerate(vector_results, 1):
                context_parts.append(f"\n### 参考{i} ({result['entry_type']})")
                context_parts.append(result["content"])
        
        # Character relationships
        if character_graph and character_graph.get("nodes"):
            context_parts.append("\n## 人物关系")
            for node in character_graph["nodes"]:
                context_parts.append(f"- {node['name']} ({node.get('role', '未知角色')})")
            
            if character_graph.get("edges"):
                context_parts.append("\n### 人物关系网络")
                for edge in character_graph["edges"]:
                    context_parts.append(f"- {edge['source']} --[{edge['type']}]--> {edge['target']}")
        
        # World structure
        if world_graph and world_graph.get("nodes"):
            context_parts.append("\n## 世界观设定")
            for node in world_graph["nodes"]:
                context_parts.append(f"- {node['name']} ({node.get('type', '')}): {node.get('description', '')}")
        
        # Timeline
        if timeline:
            context_parts.append("\n## 时间线")
            for event in timeline:
                context_parts.append(f"- [{event['time_point']}] {event['name']}: {event.get('description', '')}")
        
        return "\n".join(context_parts)
    
    async def generate_with_rag(
        self,
        user_id: int,
        novel_id: int,
        prompt: str,
        system_prompt: str,
        include_characters: bool = True,
        include_world: bool = True,
        include_timeline: bool = True,
        entry_types: Optional[List[str]] = None,
        top_k: int = 5
    ) -> AsyncGenerator[str, None]:
        """
        Generate content with RAG context (streaming)
        
        Args:
            user_id: User ID
            novel_id: Novel ID
            prompt: Generation prompt
            system_prompt: System prompt
            include_characters: Include character context
            include_world: Include world context
            include_timeline: Include timeline context
            entry_types: Vector search entry types filter
            top_k: Number of vector results
        
        Yields:
            Generated text chunks
        """
        # Retrieve context
        vector_results = await self.retrieve_context(
            user_id, novel_id, prompt, entry_types, top_k
        )
        
        character_graph = None
        world_graph = None
        timeline = None
        
        if include_characters:
            character_graph = await self.get_character_context(user_id, novel_id)
        
        if include_world:
            world_graph = await self.get_world_context(user_id, novel_id)
        
        if include_timeline:
            timeline = await self.get_timeline_context(user_id, novel_id)
        
        # Format context
        context = self._format_context(
            vector_results, character_graph, world_graph, timeline
        )
        
        # Build enhanced prompt
        enhanced_prompt = f"""
{context}

---

根据以上参考信息，请完成以下任务：

{prompt}
"""
        
        # Generate with streaming
        async for chunk in self.llm_service.generate_stream(
            prompt=enhanced_prompt,
            system_prompt=system_prompt
        ):
            yield chunk


def get_rag_service(model_config: Optional[AIModelConfig] = None) -> RAGService:
    """Get RAG service instance"""
    return RAGService(model_config)

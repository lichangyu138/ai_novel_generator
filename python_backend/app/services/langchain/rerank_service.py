"""
Rerank Service - Document Reranking for RAG
"""
from typing import List, Optional, Tuple
import logging
import httpx

from app.config.settings import get_settings
from app.db.mysql import get_db_session
from app.models.database import RerankModelConfig

settings = get_settings()
logger = logging.getLogger(__name__)


class RerankResult:
    """Result from reranking"""
    def __init__(self, index: int, score: float, text: str):
        self.index = index
        self.score = score
        self.text = text
    
    def __repr__(self):
        return f"RerankResult(index={self.index}, score={self.score:.4f})"


class RerankService:
    """Service for reranking documents using various providers"""
    
    PROVIDERS = {
        "cohere": "https://api.cohere.ai/v1/rerank",
        "jina": "https://api.jina.ai/v1/rerank",
    }
    
    def __init__(
        self,
        provider: str = "cohere",
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: str = "rerank-multilingual-v3.0",
        top_k: int = 10
    ):
        """
        Initialize rerank service
        
        Args:
            provider: Provider name (cohere, jina, custom)
            api_key: API key for the provider
            api_base: Custom API base URL
            model: Model name
            top_k: Number of top results to return
        """
        self.provider = provider
        self.api_key = api_key or settings.RERANK_MODEL_API_KEY
        self.api_base = api_base or settings.RERANK_MODEL_API_BASE or self.PROVIDERS.get(provider)
        self.model = model
        self.top_k = top_k
    
    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None
    ) -> List[RerankResult]:
        """
        Rerank documents based on query relevance
        
        Args:
            query: The query to rank documents against
            documents: List of documents to rerank
            top_k: Override default top_k
        
        Returns:
            List of RerankResult sorted by relevance
        """
        if not documents:
            return []
        
        k = top_k or self.top_k
        k = min(k, len(documents))
        
        if not self.api_key:
            logger.warning("No rerank API key configured, returning original order")
            return [RerankResult(i, 1.0 - i * 0.01, doc) for i, doc in enumerate(documents[:k])]
        
        try:
            if self.provider == "cohere":
                return await self._rerank_cohere(query, documents, k)
            elif self.provider == "jina":
                return await self._rerank_jina(query, documents, k)
            else:
                return await self._rerank_custom(query, documents, k)
        except Exception as e:
            logger.error(f"Rerank failed: {e}")
            # Fallback to original order
            return [RerankResult(i, 1.0 - i * 0.01, doc) for i, doc in enumerate(documents[:k])]
    
    async def _rerank_cohere(
        self,
        query: str,
        documents: List[str],
        top_k: int
    ) -> List[RerankResult]:
        """Rerank using Cohere API"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_base or self.PROVIDERS["cohere"],
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "query": query,
                    "documents": documents,
                    "top_n": top_k,
                    "return_documents": False
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("results", []):
                idx = item["index"]
                results.append(RerankResult(
                    index=idx,
                    score=item["relevance_score"],
                    text=documents[idx]
                ))
            
            return sorted(results, key=lambda x: x.score, reverse=True)
    
    async def _rerank_jina(
        self,
        query: str,
        documents: List[str],
        top_k: int
    ) -> List[RerankResult]:
        """Rerank using Jina API"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_base or self.PROVIDERS["jina"],
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "query": query,
                    "documents": documents,
                    "top_n": top_k
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("results", []):
                idx = item["index"]
                results.append(RerankResult(
                    index=idx,
                    score=item["relevance_score"],
                    text=documents[idx]
                ))
            
            return sorted(results, key=lambda x: x.score, reverse=True)
    
    async def _rerank_custom(
        self,
        query: str,
        documents: List[str],
        top_k: int
    ) -> List[RerankResult]:
        """Rerank using custom API endpoint"""
        if not self.api_base:
            raise ValueError("Custom provider requires api_base")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_base,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "query": query,
                    "documents": documents,
                    "top_n": top_k
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("results", data.get("data", [])):
                idx = item.get("index", 0)
                results.append(RerankResult(
                    index=idx,
                    score=item.get("relevance_score", item.get("score", 0)),
                    text=documents[idx] if idx < len(documents) else ""
                ))
            
            return sorted(results, key=lambda x: x.score, reverse=True)[:top_k]
    
    def rerank_sync(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None
    ) -> List[RerankResult]:
        """Synchronous version of rerank"""
        import asyncio
        return asyncio.get_event_loop().run_until_complete(
            self.rerank(query, documents, top_k)
        )


# Global rerank service instance
_rerank_service: Optional[RerankService] = None


def get_rerank_service(refresh: bool = False) -> RerankService:
    """
    Get rerank service instance, optionally refreshing from database config
    
    Args:
        refresh: If True, reload configuration from database
    
    Returns:
        RerankService instance
    """
    global _rerank_service
    
    if _rerank_service is None or refresh:
        # Try to load default config from database
        try:
            db = get_db_session()
            config = db.query(RerankModelConfig).filter(
                RerankModelConfig.is_default == True,
                RerankModelConfig.is_active == True
            ).first()
            
            if config:
                _rerank_service = RerankService(
                    provider=config.provider,
                    api_key=config.api_key,
                    api_base=config.api_base,
                    model=config.model_name,
                    top_k=config.top_k
                )
                logger.info(f"Loaded rerank config: {config.name}")
            else:
                _rerank_service = RerankService()
                logger.info("Using default rerank config")
            
            db.close()
        except Exception as e:
            logger.warning(f"Failed to load rerank config from DB: {e}")
            _rerank_service = RerankService()
    
    return _rerank_service


def get_rerank_service_by_id(config_id: int) -> Optional[RerankService]:
    """
    Get rerank service by configuration ID
    
    Args:
        config_id: Database ID of the rerank configuration
    
    Returns:
        RerankService instance or None
    """
    try:
        db = get_db_session()
        config = db.query(RerankModelConfig).filter(
            RerankModelConfig.id == config_id,
            RerankModelConfig.is_active == True
        ).first()
        
        if config:
            service = RerankService(
                provider=config.provider,
                api_key=config.api_key,
                api_base=config.api_base,
                model=config.model_name,
                top_k=config.top_k
            )
            db.close()
            return service
        
        db.close()
        return None
    except Exception as e:
        logger.error(f"Failed to get rerank service by ID: {e}")
        return None

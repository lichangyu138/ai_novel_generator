"""
Embedding Service - Text to Vector Conversion with Dynamic Configuration
"""
from typing import List, Optional
from langchain_openai import OpenAIEmbeddings
import asyncio
import logging
import requests

from app.config.settings import get_settings
from app.db.mysql import get_db_session
from app.models.database import EmbeddingModelConfig

settings = get_settings()
logger = logging.getLogger(__name__)


class CustomOllamaEmbeddings:
    """Custom Ollama Embeddings wrapper that uses the correct API endpoint"""

    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/embeddings"

    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            response = requests.post(
                self.api_url,
                json={"model": self.model, "prompt": text},
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except Exception as e:
            logger.error(f"Ollama embedding failed: {e}")
            raise

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        return [self.embed_query(text) for text in texts]

    async def aembed_query(self, text: str) -> List[float]:
        """Async version of embed_query"""
        return await asyncio.to_thread(self.embed_query, text)

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """Async version of embed_documents"""
        return await asyncio.to_thread(self.embed_documents, texts)


class EmbeddingService:
    """Service for generating text embeddings with dynamic configuration support"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
        provider: str = "openai",
    ):
        """
        Initialize embedding service
        
        Args:
            api_key: Optional API key override
            api_base: Optional API base URL override
            model: Embedding model name
            dimension: Embedding dimension
        """
        self.model = model
        self.dimension = dimension
        self.provider = provider
        self._api_key = api_key
        self._api_base = api_base
        self._embeddings = None
        self._init_embeddings()
    
    def _init_embeddings(self):
        """Initialize the embeddings model"""
        try:
            provider = (self.provider or settings.EMBEDDING_PROVIDER or "openai").lower()
            if provider == "ollama":
                base_url = self._api_base or settings.EMBEDDING_MODEL_API_BASE or "http://localhost:11434"
                # Use custom Ollama embeddings wrapper
                self._embeddings = CustomOllamaEmbeddings(
                    model=self.model,
                    base_url=base_url,
                )
                logger.info(f"Initialized Ollama embeddings: {self.model} at {base_url}")
            else:
                self._embeddings = OpenAIEmbeddings(
                    api_key=self._api_key or settings.EMBEDDING_MODEL_API_KEY or settings.OPENAI_API_KEY,
                    base_url=self._api_base or settings.EMBEDDING_MODEL_API_BASE or settings.OPENAI_API_BASE,
                    model=self.model,
                )
                logger.info(f"Initialized OpenAI embeddings: {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            self._embeddings = None
    
    @property
    def embeddings(self):
        if self._embeddings is None:
            self._init_embeddings()
        return self._embeddings
    
    def reconfigure(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: Optional[str] = None,
        dimension: Optional[int] = None,
        provider: Optional[str] = None,
    ):
        """Reconfigure the embedding service with new settings"""
        if api_key:
            self._api_key = api_key
        if api_base:
            self._api_base = api_base
        if model:
            self.model = model
        if dimension:
            self.dimension = dimension
        if provider:
            self.provider = provider
        self._init_embeddings()
    
    async def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
        
        Returns:
            Embedding vector
        """
        if not self.embeddings:
            raise RuntimeError("Embedding service not initialized")
        if hasattr(self.embeddings, "aembed_query"):
            return await self.embeddings.aembed_query(text)
        # Fallback for providers without async API (e.g., OllamaEmbeddings)
        return await asyncio.to_thread(self.embeddings.embed_query, text)
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        """
        if not self.embeddings:
            raise RuntimeError("Embedding service not initialized")
        if hasattr(self.embeddings, "aembed_documents"):
            return await self.embeddings.aembed_documents(texts)
        return await asyncio.to_thread(self.embeddings.embed_documents, texts)
    
    def embed_text_sync(self, text: str) -> List[float]:
        """
        Generate embedding for a single text (synchronous)
        
        Args:
            text: Text to embed
        
        Returns:
            Embedding vector
        """
        if not self.embeddings:
            raise RuntimeError("Embedding service not initialized")
        return self.embeddings.embed_query(text)
    
    def embed_texts_sync(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (synchronous)
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        """
        if not self.embeddings:
            raise RuntimeError("Embedding service not initialized")
        return self.embeddings.embed_documents(texts)


# Global embedding service instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service(refresh: bool = False) -> EmbeddingService:
    """
    Get embedding service instance, optionally refreshing from database config
    
    Args:
        refresh: If True, reload configuration from database
    
    Returns:
        EmbeddingService instance
    """
    global _embedding_service
    
    if _embedding_service is None or refresh:
        # Try to load default config from database
        try:
            db = get_db_session()
            config = db.query(EmbeddingModelConfig).filter(
                EmbeddingModelConfig.is_default == True,
                EmbeddingModelConfig.is_active == True
            ).first()
            
            if config:
                _embedding_service = EmbeddingService(
                    api_key=config.api_key,
                    api_base=config.api_base,
                    model=config.model_name,
                    dimension=config.dimension,
                    provider=getattr(config, "provider", settings.EMBEDDING_PROVIDER),
                )
                logger.info(f"Loaded embedding config: {config.name}")
            else:
                _embedding_service = EmbeddingService(
                    provider=settings.EMBEDDING_PROVIDER,
                    model=settings.EMBEDDING_MODEL_NAME,
                    dimension=settings.EMBEDDING_DIMENSION,
                )
                logger.info("Using default embedding config")
            
            db.close()
        except Exception as e:
            logger.warning(f"Failed to load embedding config from DB: {e}")
            _embedding_service = EmbeddingService(
                provider=settings.EMBEDDING_PROVIDER,
                model=settings.EMBEDDING_MODEL_NAME,
                dimension=settings.EMBEDDING_DIMENSION,
            )
    
    return _embedding_service


def get_embedding_service_by_id(config_id: int) -> Optional[EmbeddingService]:
    """
    Get embedding service by configuration ID
    
    Args:
        config_id: Database ID of the embedding configuration
    
    Returns:
        EmbeddingService instance or None
    """
    try:
        db = get_db_session()
        config = db.query(EmbeddingModelConfig).filter(
            EmbeddingModelConfig.id == config_id,
            EmbeddingModelConfig.is_active == True
        ).first()
        
        if config:
            service = EmbeddingService(
                api_key=config.api_key,
                api_base=config.api_base,
                model=config.model_name,
                dimension=config.dimension
            )
            db.close()
            return service
        
        db.close()
        return None
    except Exception as e:
        logger.error(f"Failed to get embedding service by ID: {e}")
        return None

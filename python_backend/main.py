"""
AI Novel Generator - FastAPI Application Entry Point
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.api import api_router
from app.config.settings import get_settings
from app.db.mysql import init_db
from app.db.milvus import milvus_client
from app.db.neo4j import neo4j_client
from app.db.elasticsearch import es_service
from app.db.redis import redis_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting AI Novel Generator Backend...")
    
    # Initialize MySQL database
    try:
        init_db()
        logger.info("MySQL database initialized")
    except Exception as e:
        logger.warning(f"MySQL initialization warning: {e}")
    
    # Initialize Milvus
    try:
        milvus_client.connect()
        milvus_client.init_collection()
        logger.info("Milvus vector database initialized")
    except Exception as e:
        logger.warning(f"Milvus initialization warning: {e}")
    
    # Initialize Neo4j
    try:
        neo4j_client.connect()
        neo4j_client.init_constraints()
        logger.info("Neo4j graph database initialized")
    except Exception as e:
        logger.warning(f"Neo4j initialization warning: {e}")
    
    # Initialize Elasticsearch
    try:
        es_service.connect()
        logger.info("Elasticsearch initialized")
    except Exception as e:
        logger.warning(f"Elasticsearch initialization warning: {e}")
    
    # Initialize Redis
    try:
        redis_client.connect()
        logger.info("Redis initialized")
    except Exception as e:
        logger.warning(f"Redis initialization warning: {e}")
    
    logger.info("AI Novel Generator Backend started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Novel Generator Backend...")
    
    try:
        milvus_client.disconnect()
    except Exception:
        pass
    
    try:
        neo4j_client.disconnect()
    except Exception:
        pass
    
    try:
        redis_client.disconnect()
    except Exception:
        pass
    
    logger.info("AI Novel Generator Backend shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered novel generation platform with RAG and knowledge graph support",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "api": "up"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

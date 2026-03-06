"""
API Routes module initialization
"""
from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.novels import router as novels_router
from app.api.characters import router as characters_router
from app.api.outlines import router as outlines_router
from app.api.chapters import router as chapters_router
from app.api.knowledge import router as knowledge_router
from app.api.model_config import router as model_config_router
from app.api.history import router as history_router
from app.api.admin import router as admin_router
from app.api.search import router as search_router
from app.api.worldbuilding import router as worldbuilding_router
from app.api.prompts import router as prompts_router
from app.api.config import router as config_router
from app.api.generate import router as generate_router
from app.api.vector import router as vector_router
from app.api.chapter_generation import router as chapter_generation_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(novels_router)
api_router.include_router(characters_router)
api_router.include_router(outlines_router)
api_router.include_router(chapters_router)
api_router.include_router(knowledge_router)
api_router.include_router(model_config_router)
api_router.include_router(history_router)
api_router.include_router(admin_router)
api_router.include_router(search_router)
api_router.include_router(worldbuilding_router)
api_router.include_router(prompts_router)
api_router.include_router(config_router)
api_router.include_router(generate_router)
api_router.include_router(vector_router)
api_router.include_router(chapter_generation_router)

__all__ = ["api_router"]

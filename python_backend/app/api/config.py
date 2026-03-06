"""
Configuration API - Admin settings for models, permissions, and system config
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.mysql import get_db
from app.services.auth import get_admin_user, get_current_user
from app.models.database import (
    User, EmbeddingModelConfig, RerankModelConfig, 
    PermissionConfig, SystemConfig
)

router = APIRouter(prefix="/config", tags=["Configuration"])


# ==================== Schemas ====================

class EmbeddingModelCreate(BaseModel):
    name: str
    provider: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: str
    dimension: int = 1536
    batch_size: int = 100
    is_default: bool = False


class EmbeddingModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: Optional[str] = None
    dimension: Optional[int] = None
    batch_size: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class EmbeddingModelResponse(BaseModel):
    id: int
    name: str
    provider: str
    api_base: Optional[str]
    model_name: str
    dimension: int
    batch_size: int
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True


class RerankModelCreate(BaseModel):
    name: str
    provider: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: str
    top_k: int = 10
    is_default: bool = False


class RerankModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model_name: Optional[str] = None
    top_k: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class RerankModelResponse(BaseModel):
    id: int
    name: str
    provider: str
    api_base: Optional[str]
    model_name: str
    top_k: int
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True


class PermissionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    resource_type: str
    action: str
    allowed_roles: List[str] = ["admin"]


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    resource_type: Optional[str] = None
    action: Optional[str] = None
    allowed_roles: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PermissionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    resource_type: str
    action: str
    allowed_roles: List[str]
    is_active: bool

    class Config:
        from_attributes = True


class SystemConfigCreate(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    config_type: str = "string"
    is_public: bool = False


class SystemConfigUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None
    config_type: Optional[str] = None
    is_public: Optional[bool] = None


class SystemConfigResponse(BaseModel):
    id: int
    key: str
    value: Optional[str]
    description: Optional[str]
    config_type: str
    is_public: bool

    class Config:
        from_attributes = True


# ==================== Embedding Model Endpoints ====================

@router.get("/embedding-models", response_model=List[EmbeddingModelResponse])
async def list_embedding_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """List all embedding model configurations (Admin only)"""
    models = db.query(EmbeddingModelConfig).all()
    return models


@router.post("/embedding-models", response_model=EmbeddingModelResponse)
async def create_embedding_model(
    data: EmbeddingModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new embedding model configuration (Admin only)"""
    # If setting as default, unset other defaults
    if data.is_default:
        db.query(EmbeddingModelConfig).update({"is_default": False})
    
    model = EmbeddingModelConfig(**data.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.put("/embedding-models/{model_id}", response_model=EmbeddingModelResponse)
async def update_embedding_model(
    model_id: int,
    data: EmbeddingModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update an embedding model configuration (Admin only)"""
    model = db.query(EmbeddingModelConfig).filter(EmbeddingModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # If setting as default, unset other defaults
    if update_data.get("is_default"):
        db.query(EmbeddingModelConfig).filter(EmbeddingModelConfig.id != model_id).update({"is_default": False})
    
    for key, value in update_data.items():
        setattr(model, key, value)
    
    db.commit()
    db.refresh(model)
    return model


@router.delete("/embedding-models/{model_id}")
async def delete_embedding_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete an embedding model configuration (Admin only)"""
    model = db.query(EmbeddingModelConfig).filter(EmbeddingModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    db.delete(model)
    db.commit()
    return {"message": "Model deleted successfully"}


# ==================== Rerank Model Endpoints ====================

@router.get("/rerank-models", response_model=List[RerankModelResponse])
async def list_rerank_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """List all rerank model configurations (Admin only)"""
    models = db.query(RerankModelConfig).all()
    return models


@router.post("/rerank-models", response_model=RerankModelResponse)
async def create_rerank_model(
    data: RerankModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new rerank model configuration (Admin only)"""
    if data.is_default:
        db.query(RerankModelConfig).update({"is_default": False})
    
    model = RerankModelConfig(**data.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.put("/rerank-models/{model_id}", response_model=RerankModelResponse)
async def update_rerank_model(
    model_id: int,
    data: RerankModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update a rerank model configuration (Admin only)"""
    model = db.query(RerankModelConfig).filter(RerankModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if update_data.get("is_default"):
        db.query(RerankModelConfig).filter(RerankModelConfig.id != model_id).update({"is_default": False})
    
    for key, value in update_data.items():
        setattr(model, key, value)
    
    db.commit()
    db.refresh(model)
    return model


@router.delete("/rerank-models/{model_id}")
async def delete_rerank_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete a rerank model configuration (Admin only)"""
    model = db.query(RerankModelConfig).filter(RerankModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    db.delete(model)
    db.commit()
    return {"message": "Model deleted successfully"}


# ==================== Permission Endpoints ====================

@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """List all permission configurations (Admin only)"""
    permissions = db.query(PermissionConfig).all()
    return permissions


@router.post("/permissions", response_model=PermissionResponse)
async def create_permission(
    data: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new permission configuration (Admin only)"""
    existing = db.query(PermissionConfig).filter(PermissionConfig.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Permission name already exists")
    
    permission = PermissionConfig(**data.model_dump())
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: int,
    data: PermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update a permission configuration (Admin only)"""
    permission = db.query(PermissionConfig).filter(PermissionConfig.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(permission, key, value)
    
    db.commit()
    db.refresh(permission)
    return permission


@router.delete("/permissions/{permission_id}")
async def delete_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete a permission configuration (Admin only)"""
    permission = db.query(PermissionConfig).filter(PermissionConfig.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    db.delete(permission)
    db.commit()
    return {"message": "Permission deleted successfully"}


# ==================== System Config Endpoints ====================

@router.get("/system", response_model=List[SystemConfigResponse])
async def list_system_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """List all system configurations (Admin only)"""
    configs = db.query(SystemConfig).all()
    return configs


@router.get("/system/public", response_model=List[SystemConfigResponse])
async def list_public_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List public system configurations (All users)"""
    configs = db.query(SystemConfig).filter(SystemConfig.is_public == True).all()
    return configs


@router.post("/system", response_model=SystemConfigResponse)
async def create_system_config(
    data: SystemConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new system configuration (Admin only)"""
    existing = db.query(SystemConfig).filter(SystemConfig.key == data.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Config key already exists")
    
    config = SystemConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.put("/system/{config_key}", response_model=SystemConfigResponse)
async def update_system_config(
    config_key: str,
    data: SystemConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update a system configuration (Admin only)"""
    config = db.query(SystemConfig).filter(SystemConfig.key == config_key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    return config


@router.delete("/system/{config_key}")
async def delete_system_config(
    config_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete a system configuration (Admin only)"""
    config = db.query(SystemConfig).filter(SystemConfig.key == config_key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    db.delete(config)
    db.commit()
    return {"message": "Config deleted successfully"}

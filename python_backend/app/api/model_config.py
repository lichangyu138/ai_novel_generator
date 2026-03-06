"""
AI Model Configuration API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.mysql import get_db
from app.models.schemas import (
    AIModelConfigCreate,
    AIModelConfigUpdate,
    AIModelConfigResponse
)
from app.models.database import AIModelConfig, User
from app.services.auth import get_current_active_user

router = APIRouter(prefix="/model-configs", tags=["AI Model Configuration"])


@router.post("", response_model=AIModelConfigResponse)
async def create_model_config(
    config_data: AIModelConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new AI model configuration
    """
    # If setting as default, unset other defaults
    if config_data.is_default:
        db.query(AIModelConfig).filter(
            AIModelConfig.user_id == current_user.id,
            AIModelConfig.is_default == True
        ).update({"is_default": False})
    
    config = AIModelConfig(
        user_id=current_user.id,
        name=config_data.name,
        model_type=config_data.model_type,
        api_key=config_data.api_key,
        api_base=config_data.api_base,
        model_name=config_data.model_name,
        temperature=config_data.temperature,
        top_p=config_data.top_p,
        max_tokens=config_data.max_tokens,
        is_default=config_data.is_default
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return AIModelConfigResponse.model_validate(config)


@router.get("", response_model=List[AIModelConfigResponse])
async def list_model_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all model configurations for current user
    """
    configs = db.query(AIModelConfig).filter(
        AIModelConfig.user_id == current_user.id
    ).order_by(AIModelConfig.is_default.desc(), AIModelConfig.created_at.desc()).all()
    
    return [AIModelConfigResponse.model_validate(c) for c in configs]


@router.get("/{config_id}", response_model=AIModelConfigResponse)
async def get_model_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific model configuration
    """
    config = db.query(AIModelConfig).filter(
        AIModelConfig.id == config_id,
        AIModelConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found"
        )
    
    return AIModelConfigResponse.model_validate(config)


@router.put("/{config_id}", response_model=AIModelConfigResponse)
async def update_model_config(
    config_id: int,
    config_data: AIModelConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a model configuration
    """
    config = db.query(AIModelConfig).filter(
        AIModelConfig.id == config_id,
        AIModelConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found"
        )
    
    # If setting as default, unset other defaults
    if config_data.is_default:
        db.query(AIModelConfig).filter(
            AIModelConfig.user_id == current_user.id,
            AIModelConfig.is_default == True,
            AIModelConfig.id != config_id
        ).update({"is_default": False})
    
    # Update fields
    update_data = config_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    return AIModelConfigResponse.model_validate(config)


@router.delete("/{config_id}")
async def delete_model_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a model configuration
    """
    config = db.query(AIModelConfig).filter(
        AIModelConfig.id == config_id,
        AIModelConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found"
        )
    
    db.delete(config)
    db.commit()
    
    return {"message": "Model configuration deleted successfully"}


@router.post("/{config_id}/set-default", response_model=AIModelConfigResponse)
async def set_default_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Set a model configuration as default
    """
    config = db.query(AIModelConfig).filter(
        AIModelConfig.id == config_id,
        AIModelConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found"
        )
    
    # Unset other defaults
    db.query(AIModelConfig).filter(
        AIModelConfig.user_id == current_user.id,
        AIModelConfig.is_default == True
    ).update({"is_default": False})
    
    # Set this as default
    config.is_default = True
    
    db.commit()
    db.refresh(config)
    
    return AIModelConfigResponse.model_validate(config)


@router.post("/test")
async def test_model_config(
    config_data: AIModelConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Test a model configuration without saving
    """
    from app.services.langchain.llm_service import LLMService
    from app.models.database import AIModelConfig as AIModelConfigModel
    
    # Create temporary config object
    temp_config = AIModelConfigModel(
        user_id=current_user.id,
        name=config_data.name,
        model_type=config_data.model_type,
        api_key=config_data.api_key,
        api_base=config_data.api_base,
        model_name=config_data.model_name,
        temperature=config_data.temperature,
        top_p=config_data.top_p,
        max_tokens=config_data.max_tokens
    )
    
    try:
        llm_service = LLMService(temp_config)
        response = await llm_service.generate(
            prompt="Say 'Hello, I am working!' in one sentence.",
            max_tokens=50
        )
        
        return {
            "success": True,
            "message": "Model configuration is valid",
            "test_response": response
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Model configuration test failed: {str(e)}"
        }

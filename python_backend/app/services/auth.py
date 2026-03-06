"""
Authentication Service - JWT Token Management and User Authentication
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.mysql import get_db
from app.db.redis import redis_client
from app.models.database import User, UserRole

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme
security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    """Token payload data"""
    user_id: int
    username: str
    role: str
    exp: datetime


class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(user: User, store_in_redis: bool = True) -> str:
    """Create a JWT access token for a user"""
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value if isinstance(user.role, UserRole) else user.role,
        "exp": expire
    }
    
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    # Store token in Redis for validation and revocation
    if store_in_redis and redis_client.is_connected:
        redis_client.store_token(user.id, token, settings.REDIS_TOKEN_EXPIRE_SECONDS)
    
    return token


def decode_token(token: str, validate_redis: bool = True) -> Optional[TokenData]:
    """Decode and validate a JWT token"""
    try:
        print(f"[decode_token] Decoding token: {token[:50]}...")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        print(f"[decode_token] Payload: {payload}")

        # 支持两种格式：
        # 1. Python 格式: { sub, username, role, exp }
        # 2. Node.js 格式: { userId, username }

        user_id = None
        if "sub" in payload:
            # Python 格式
            user_id = int(payload.get("sub"))
            print(f"[decode_token] Python format, user_id from 'sub': {user_id}")
        elif "userId" in payload:
            # Node.js 格式
            user_id = int(payload.get("userId"))
            print(f"[decode_token] Node.js format, user_id from 'userId': {user_id}")

        username = payload.get("username")
        role = payload.get("role", "user")  # 默认角色

        # exp 可能不存在（Node.js token）
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            exp = datetime.fromtimestamp(exp_timestamp)
        else:
            # 如果没有过期时间，设置一个默认值
            exp = datetime.utcnow() + timedelta(days=365)

        if user_id is None or username is None:
            print(f"[decode_token] Missing user_id or username")
            return None

        print(f"[decode_token] Success: user_id={user_id}, username={username}")

        # Validate token exists in Redis (for revocation support)
        # 注意：Node.js 的 token 可能不在 Redis 中，所以跳过验证
        if validate_redis and redis_client.is_connected and "sub" in payload:
            redis_user_id = redis_client.validate_token(token)
            if redis_user_id is None or redis_user_id != user_id:
                return None
            # Refresh token expiry on successful validation
            redis_client.refresh_token_expiry(user_id)
        
        return TokenData(user_id=user_id, username=username, role=role, exp=exp)
    except JWTError:
        return None


def revoke_user_token(user_id: int) -> bool:
    """Revoke a user's token (logout)"""
    if redis_client.is_connected:
        return redis_client.revoke_token(user_id)
    return True


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_username: Optional[str] = Header(None)
) -> User:
    """Get current authenticated user from token or headers"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 方案1: 尝试从 X-User-ID 和 X-Username headers 获取用户（用于Node.js后端调用）
    if x_user_id and x_username:
        try:
            user_id = int(x_user_id)
            user = db.query(User).filter(
                User.id == user_id,
                User.username == x_username
            ).first()

            if user and user.is_active:
                return user
        except (ValueError, TypeError):
            pass

    # 方案2: 尝试从 Bearer token 获取用户（标准JWT认证）
    if credentials:
        token = credentials.credentials
        token_data = decode_token(token)

        if token_data is None:
            raise credentials_exception

        user = db.query(User).filter(User.id == token_data.user_id).first()

        if user is None:
            raise credentials_exception

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )

        return user

    # 两种方案都失败
    raise credentials_exception


async def get_current_user_dict(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_username: Optional[str] = Header(None)
) -> dict:
    """
    Get current authenticated user as a dict.

    Notes:
    - Some API modules historically treat `current_user` like a dict (e.g. current_user["id"]).
    - Keep `get_current_user()` returning ORM `User` for modules that use attribute access.
    """
    user = await get_current_user(
        credentials=credentials,
        db=db,
        x_user_id=x_user_id,
        x_username=x_username,
    )
    return {
        "id": user.id,
        "username": user.username,
        "role": getattr(user, "role", None),
        "is_active": getattr(user, "is_active", None),
    }


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate a user by username and password"""
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user


def register_user(
    db: Session,
    username: str,
    email: str,
    password: str,
    role: UserRole = UserRole.USER
) -> User:
    """Register a new user"""
    try:
        # Check if username exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        
        # Check if email exists
        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        user = User(
            username=username,
            email=email,
            password_hash=get_password_hash(password),
            role=role,
            is_active=True
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Rollback on any other error
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

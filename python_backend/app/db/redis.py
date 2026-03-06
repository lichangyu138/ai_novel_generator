"""
Redis Client - Token Storage and Session Management
"""
import json
import logging
from typing import Optional, Any
import redis
from redis.exceptions import RedisError

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RedisClient:
    """Redis client for token and session management"""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._connected = False
    
    def connect(self) -> bool:
        """Connect to Redis server"""
        try:
            self._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            # Test connection
            self._client.ping()
            self._connected = True
            logger.info("Redis connected successfully")
            return True
        except RedisError as e:
            logger.warning(f"Redis connection failed: {e}")
            self._connected = False
            return False
    
    def disconnect(self):
        """Disconnect from Redis"""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
            self._connected = False
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if not self._connected or not self._client:
            return False
        try:
            self._client.ping()
            return True
        except RedisError:
            self._connected = False
            return False
    
    # ==================== Token Management ====================
    
    def store_token(self, user_id: int, token: str, expire_seconds: Optional[int] = None) -> bool:
        """Store user token in Redis"""
        if not self.is_connected:
            return False
        
        try:
            key = f"token:{user_id}"
            expire = expire_seconds or settings.REDIS_TOKEN_EXPIRE_SECONDS
            self._client.setex(key, expire, token)
            
            # Also store reverse lookup
            token_key = f"token_user:{token}"
            self._client.setex(token_key, expire, str(user_id))
            
            return True
        except RedisError as e:
            logger.error(f"Failed to store token: {e}")
            return False
    
    def get_token(self, user_id: int) -> Optional[str]:
        """Get user token from Redis"""
        if not self.is_connected:
            return None
        
        try:
            key = f"token:{user_id}"
            return self._client.get(key)
        except RedisError as e:
            logger.error(f"Failed to get token: {e}")
            return None
    
    def validate_token(self, token: str) -> Optional[int]:
        """Validate token and return user_id if valid"""
        if not self.is_connected:
            return None
        
        try:
            token_key = f"token_user:{token}"
            user_id = self._client.get(token_key)
            return int(user_id) if user_id else None
        except RedisError as e:
            logger.error(f"Failed to validate token: {e}")
            return None
    
    def revoke_token(self, user_id: int) -> bool:
        """Revoke user token"""
        if not self.is_connected:
            return False
        
        try:
            # Get current token first
            key = f"token:{user_id}"
            token = self._client.get(key)
            
            # Delete both keys
            self._client.delete(key)
            if token:
                self._client.delete(f"token_user:{token}")
            
            return True
        except RedisError as e:
            logger.error(f"Failed to revoke token: {e}")
            return False
    
    def refresh_token_expiry(self, user_id: int, expire_seconds: Optional[int] = None) -> bool:
        """Refresh token expiry time"""
        if not self.is_connected:
            return False
        
        try:
            key = f"token:{user_id}"
            token = self._client.get(key)
            if not token:
                return False
            
            expire = expire_seconds or settings.REDIS_TOKEN_EXPIRE_SECONDS
            self._client.expire(key, expire)
            self._client.expire(f"token_user:{token}", expire)
            return True
        except RedisError as e:
            logger.error(f"Failed to refresh token expiry: {e}")
            return False
    
    # ==================== Session Data ====================
    
    def set_session_data(self, user_id: int, key: str, data: Any, expire_seconds: Optional[int] = None) -> bool:
        """Store session data for user"""
        if not self.is_connected:
            return False
        
        try:
            session_key = f"session:{user_id}:{key}"
            value = json.dumps(data) if not isinstance(data, str) else data
            
            if expire_seconds:
                self._client.setex(session_key, expire_seconds, value)
            else:
                self._client.set(session_key, value)
            
            return True
        except RedisError as e:
            logger.error(f"Failed to set session data: {e}")
            return False
    
    def get_session_data(self, user_id: int, key: str) -> Optional[Any]:
        """Get session data for user"""
        if not self.is_connected:
            return None
        
        try:
            session_key = f"session:{user_id}:{key}"
            value = self._client.get(session_key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
        except RedisError as e:
            logger.error(f"Failed to get session data: {e}")
            return None
    
    def delete_session_data(self, user_id: int, key: str) -> bool:
        """Delete session data"""
        if not self.is_connected:
            return False
        
        try:
            session_key = f"session:{user_id}:{key}"
            self._client.delete(session_key)
            return True
        except RedisError as e:
            logger.error(f"Failed to delete session data: {e}")
            return False
    
    # ==================== Rate Limiting ====================
    
    def check_rate_limit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Check rate limit for a key
        
        Returns:
            tuple: (is_allowed, remaining_requests)
        """
        if not self.is_connected:
            return True, limit  # Allow if Redis is down
        
        try:
            rate_key = f"rate:{key}"
            current = self._client.get(rate_key)
            
            if current is None:
                self._client.setex(rate_key, window_seconds, 1)
                return True, limit - 1
            
            current_count = int(current)
            if current_count >= limit:
                return False, 0
            
            self._client.incr(rate_key)
            return True, limit - current_count - 1
        except RedisError as e:
            logger.error(f"Rate limit check failed: {e}")
            return True, limit
    
    # ==================== Cache ====================
    
    def cache_set(self, key: str, value: Any, expire_seconds: int = 3600) -> bool:
        """Set cache value"""
        if not self.is_connected:
            return False
        
        try:
            cache_key = f"cache:{key}"
            data = json.dumps(value) if not isinstance(value, str) else value
            self._client.setex(cache_key, expire_seconds, data)
            return True
        except RedisError as e:
            logger.error(f"Cache set failed: {e}")
            return False
    
    def cache_get(self, key: str) -> Optional[Any]:
        """Get cache value"""
        if not self.is_connected:
            return None
        
        try:
            cache_key = f"cache:{key}"
            value = self._client.get(cache_key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
        except RedisError as e:
            logger.error(f"Cache get failed: {e}")
            return None
    
    def cache_delete(self, key: str) -> bool:
        """Delete cache value"""
        if not self.is_connected:
            return False
        
        try:
            cache_key = f"cache:{key}"
            self._client.delete(cache_key)
            return True
        except RedisError as e:
            logger.error(f"Cache delete failed: {e}")
            return False


# Global Redis client instance
redis_client = RedisClient()

#!/bin/bash
# AI小说生成系统 Redis初始化脚本
# 创建时间: 2025-12-12
# 版本: 1.0.0

# 配置变量
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-}

echo "=== AI小说生成系统 Redis初始化 ==="

# 检查Redis是否运行
if ! redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo "错误: Redis服务未运行，请先启动Redis"
    exit 1
fi

echo "Redis连接成功"

# 设置认证（如果有密码）
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD"
else
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
fi

# 创建Token相关的Key前缀说明
echo "
Redis Key命名规范:
- token:{user_id}:{token_id} - 用户Token存储
- session:{session_id} - 会话数据
- rate_limit:{user_id}:{endpoint} - API限流
- cache:novel:{novel_id} - 小说缓存
- cache:chapter:{chapter_id} - 章节缓存
- queue:generate - 生成任务队列
- lock:generate:{novel_id} - 生成锁
"

# 设置一些默认配置
$REDIS_CLI CONFIG SET maxmemory 256mb
$REDIS_CLI CONFIG SET maxmemory-policy allkeys-lru

echo "Redis配置完成"
echo "
使用说明:
1. Token存储: SET token:{user_id}:{token_id} {token_data} EX 86400
2. 会话存储: SET session:{session_id} {session_data} EX 3600
3. 限流检查: INCR rate_limit:{user_id}:{endpoint}
4. 缓存设置: SET cache:novel:{novel_id} {data} EX 300
"

echo "=== Redis初始化完成 ==="

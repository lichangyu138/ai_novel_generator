#!/bin/bash
# AI Novel Generator - Python Backend 启动脚本
# 使用方法: ./start_backend.sh

echo "=================================="
echo "AI Novel Generator - Python Backend"
echo "=================================="
echo ""

# 激活 conda 环境
echo "激活 conda 环境: ai_novel_generator"
source $(conda info --base)/etc/profile.d/conda.sh
conda activate ai_novel_generator

# 检查依赖
echo "检查依赖..."
if ! pip show email-validator > /dev/null 2>&1; then
    echo "安装缺失的依赖: email-validator"
    pip install email-validator==2.1.1
fi

# 启动服务
echo ""
echo "启动 Python 后端服务..."
echo "服务地址: http://localhost:8001"
echo "API 文档: http://localhost:8001/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload


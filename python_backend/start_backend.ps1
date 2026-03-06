# AI Novel Generator - Python Backend 启动脚本
# 使用方法: .\start_backend.ps1

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "AI Novel Generator - Python Backend" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 激活 conda 环境
Write-Host "激活 conda 环境: ai_novel_generator" -ForegroundColor Yellow
conda activate ai_novel_generator

# 检查依赖
Write-Host "检查依赖..." -ForegroundColor Yellow
$emailValidator = conda list email-validator 2>$null | Select-String "email-validator"
if (-not $emailValidator) {
    Write-Host "安装缺失的依赖: email-validator" -ForegroundColor Yellow
    pip install email-validator==2.1.1
}

# 启动服务
Write-Host ""
Write-Host "启动 Python 后端服务..." -ForegroundColor Green
Write-Host "服务地址: http://localhost:8001" -ForegroundColor Green
Write-Host "API 文档: http://localhost:8001/docs" -ForegroundColor Green
Write-Host ""
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload


@echo off
echo ========================================
echo AI小说生成系统 - 启动后端服务
echo ========================================
echo.

cd /d "%~dp0.."

REM 检查虚拟环境
if exist "venv\Scripts\activate.bat" (
    echo 激活虚拟环境...
    call venv\Scripts\activate.bat
) else (
    echo 警告: 未找到虚拟环境，使用系统Python
)

REM 检查.env文件
if not exist ".env" (
    echo 错误: 未找到.env配置文件
    echo 请复制env.template为.env并配置相关参数
    pause
    exit /b 1
)

echo 启动FastAPI服务...
echo 服务地址: http://localhost:8000
echo API文档: http://localhost:8000/docs
echo.

python main.py

pause

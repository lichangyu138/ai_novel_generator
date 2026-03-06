#!/bin/bash
# AI小说生成系统 部署脚本
# 创建时间: 2025-12-12
# 版本: 1.0.0

set -e

echo "=== AI小说生成系统 部署脚本 ==="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker未安装${NC}"
        echo "请先安装Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}错误: Docker Compose未安装${NC}"
        echo "请先安装Docker Compose"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker和Docker Compose已安装${NC}"
}

# 检查环境变量文件
check_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}警告: .env文件不存在${NC}"
        echo "正在从.env.example创建..."
        if [ -f .env.example ]; then
            cp .env.example .env
            echo -e "${YELLOW}请编辑.env文件配置必要的环境变量${NC}"
        else
            echo -e "${RED}错误: .env.example文件也不存在${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ 环境变量文件已就绪${NC}"
}

# 创建必要的目录
create_dirs() {
    mkdir -p uploads
    mkdir -p nginx/ssl
    echo -e "${GREEN}✓ 目录结构已创建${NC}"
}

# 启动服务
start_services() {
    echo "正在启动服务..."
    
    # 启动基础服务
    docker-compose up -d mysql redis neo4j
    
    echo "等待数据库启动..."
    sleep 30
    
    # 初始化数据库
    echo "初始化MySQL数据库..."
    docker exec -i ai_novel_mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD:-root123456} < scripts/init-mysql.sql || true
    
    # 启动向量数据库
    docker-compose up -d milvus-etcd milvus-minio milvus
    
    echo "等待Milvus启动..."
    sleep 20
    
    # 启动应用服务
    docker-compose up -d node-backend python-backend
    
    echo -e "${GREEN}✓ 所有服务已启动${NC}"
}

# 停止服务
stop_services() {
    echo "正在停止服务..."
    docker-compose down
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
}

# 查看服务状态
status_services() {
    echo "服务状态:"
    docker-compose ps
}

# 查看日志
view_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f --tail=100
    else
        docker-compose logs -f --tail=100 $service
    fi
}

# 重建服务
rebuild_services() {
    echo "正在重建服务..."
    docker-compose build --no-cache
    docker-compose up -d
    echo -e "${GREEN}✓ 服务已重建${NC}"
}

# 备份数据
backup_data() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $backup_dir
    
    echo "正在备份MySQL..."
    docker exec ai_novel_mysql mysqldump -uroot -p${MYSQL_ROOT_PASSWORD:-root123456} ai_novel_generator > $backup_dir/mysql_backup.sql
    
    echo "正在备份Neo4j..."
    docker exec ai_novel_neo4j neo4j-admin database dump neo4j --to-path=/var/lib/neo4j/backups || true
    docker cp ai_novel_neo4j:/var/lib/neo4j/backups $backup_dir/neo4j_backup || true
    
    echo -e "${GREEN}✓ 备份完成: $backup_dir${NC}"
}

# 显示帮助
show_help() {
    echo "用法: ./deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  start     启动所有服务"
    echo "  stop      停止所有服务"
    echo "  restart   重启所有服务"
    echo "  status    查看服务状态"
    echo "  logs      查看日志 (可选: logs [服务名])"
    echo "  rebuild   重建并启动服务"
    echo "  backup    备份数据"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh start"
    echo "  ./deploy.sh logs node-backend"
}

# 主函数
main() {
    local command=$1
    
    case $command in
        start)
            check_docker
            check_env
            create_dirs
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            ;;
        status)
            status_services
            ;;
        logs)
            view_logs $2
            ;;
        rebuild)
            check_docker
            rebuild_services
            ;;
        backup)
            backup_data
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}未知命令: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"

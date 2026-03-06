# 幻写次元 - AI小说生成系统

> 一个功能完整的AI辅助小说创作平台，集成大语言模型、知识图谱、向量检索等先进技术，提供从设定到完整章节生成的全流程创作支持。

---

## 📋 目录

- [项目概述](#项目概述)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [账号密码](#账号密码)
- [部署指南](#部署指南)
- [配置说明](#配置说明)
- [API文档](#api文档)
- [项目结构](#项目结构)
- [常见问题](#常见问题)

---

## 🎯 项目概述

**幻写次元**是一个基于人工智能的小说创作辅助平台，旨在帮助作者从构思到成稿的全流程创作。系统集成了大语言模型（LLM）、知识图谱（Neo4j）、向量检索（Milvus）、全文搜索（Elasticsearch）等先进技术，提供智能大纲生成、角色设定、章节创作、内容优化等功能。

### 核心价值

| 特性 | 描述 |
|------|------|
| **全流程创作** | 从世界观设定、大纲、细纲到章节内容的完整创作链路 |
| **知识图谱** | 使用Neo4j存储人物关系、世界观、时间线，确保人物不偏离预设 |
| **向量检索** | 使用Milvus存储小说关键信息，通过RAG技术保证情节连贯 |
| **流式生成** | 实时显示AI生成进度，提升用户体验 |
| **多模型支持** | 支持OpenAI、Anthropic、DeepSeek等多种AI模型，支持自定义API |
| **全文搜索** | 使用Elasticsearch实现中文分词、拼音搜索、高亮显示等高级搜索功能 |

---

## ✨ 核心特性

### 1. 小说项目管理
- 创建/编辑/删除小说项目
- 配置小说基本信息（标题、类型、风格、简介、提示词）
- 世界观设定管理
- 支持多种小说类型：玄幻、仙侠、武侠、都市、言情、科幻、历史、游戏、竞技、军事等

### 2. 角色设定管理
- 创建/编辑/删除角色
- 角色信息（姓名、性格、背景、外貌、能力等）
- 关系网络：支持建立角色间的各种关系（亲属、朋友、敌人等）
- AI生成：一键生成角色描述
- 自动同步到Neo4j知识图谱

### 3. 大纲系统
- **总大纲**：整体故事框架和主线剧情
- **细纲**：每章约2000字的详细规划，包含：
  - 前文总结
  - 本章剧情发展
  - 人物动态
  - 场景描述
  - 关键事件
- 基于设定和提示词的AI大纲生成
- 流式响应，实时显示生成进度
- 大纲版本管理

### 4. 章节创作
- **单章生成**：每次生成一章，确保质量
- **字数控制**：支持1500-5000字选择
- **流式输出**：实时显示生成内容
- **AI对话修改**：通过对话方式调整内容
- **手动编辑**：完全的编辑自由度
- 结合Milvus向量库检索历史内容（RAG）
- 结合Neo4j知识图谱确保一致性

### 5. 知识图谱
- 人物关系网络可视化
- 世界观结构图谱
- 时间线图谱
- 自动提取人物、地点、物品、事件信息
- 每章生成后自动同步

### 6. AI评论系统
每章生成后自动分析：
- **质量评分**：综合评估章节质量
- **偏差检查**：与大纲/细纲的一致性分析
- **优缺点分析**：指出亮点和待改进处
- **未来建议**：对后续剧情的建议
- **伏笔标记**：识别和跟踪伏笔

### 7. 阅读与导出
- **阅读模式**：日间/夜间/护眼三种主题
- **字体调节**：大小和行距自定义
- **Markdown导出**：支持导出为MD格式

### 8. 用户系统
- 用户注册/登录（JWT认证）
- 角色管理（admin/user）
- 数据隔离（每个用户只能访问自己的数据）

### 9. AI模型配置
- 支持OpenAI和自定义API
- 模型参数配置（温度、top_p等）
- 多模型切换

---

## 🛠 技术栈

### 前端
- **框架**: React 19 + TypeScript
- **路由**: Wouter
- **状态管理**: TanStack Query
- **API通信**: tRPC
- **UI组件**: Radix UI + Tailwind CSS
- **构建工具**: Vite
- **包管理**: pnpm

### 后端

#### Node.js 后端
- **框架**: Express + TypeScript
- **数据库**: MySQL 8.0+ (Drizzle ORM)
- **缓存**: Redis 7.0+
- **认证**: JWT (jose)

#### Python 后端
- **框架**: FastAPI
- **AI框架**: LangChain + LangGraph
- **数据库**: 
  - MySQL 8.0+ (SQLAlchemy)
  - Neo4j 5.0+ (知识图谱)
  - Milvus 2.3+ (向量数据库)
  - Elasticsearch 8.0+ (全文搜索)
  - Redis 7.0+ (缓存)

### 基础设施
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx (可选)

---

## 🏗 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 小说管理  │  │ 角色设定  │  │ 大纲系统  │  │ 章节创作  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js 后端 (Express)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 用户认证  │  │ 数据管理  │  │ 文件上传  │  │ API路由  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Python 后端 (FastAPI)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ AI生成   │  │ 知识图谱  │  │ 向量检索  │  │ 全文搜索  │  │
│  │ LangGraph│  │  Neo4j   │  │  Milvus  │  │Elasticsearch│
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据存储层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  MySQL   │  │  Redis   │  │  Neo4j   │  │  Milvus  │  │
│  │ (主数据) │  │ (缓存)   │  │(知识图谱)│  │(向量库)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 系统要求

#### 最低配置
- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 50GB 可用空间
- **操作系统**: Ubuntu 20.04+ / macOS 12+ / Windows 10+

#### 推荐配置
- **CPU**: 8核心
- **内存**: 16GB RAM
- **存储**: 100GB SSD
- **GPU**: NVIDIA GPU（用于本地模型推理，可选）

#### 软件依赖
| 组件 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | 18.0+ | 前端和Node后端运行时 |
| Python | 3.11+ | Python后端运行时 |
| MySQL | 8.0+ | 主数据库 |
| Redis | 7.0+ | 缓存和会话管理 |
| Neo4j | 5.0+ | 知识图谱存储 |
| Milvus | 2.3+ | 向量数据库 |
| Docker | 24.0+ | 容器化部署（可选） |

### 方式一：Docker部署（推荐）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd ai_novel_generator
```

#### 2. 配置环境变量

创建 `.env` 文件（可选，docker-compose.yml 中有默认值）：

```env
# MySQL
MYSQL_ROOT_PASSWORD=root123456
MYSQL_USER=novel_user
MYSQL_PASSWORD=novel_password

# Neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j123456

# JWT
JWT_SECRET=your-jwt-secret-key

# OpenAI API (可选)
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASE=https://api.openai.com/v1
```

#### 3. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 初始化数据库

```bash
# 进入Python后端容器
docker exec -it ai_novel_python bash

# 运行初始化脚本
python init_database.py
```

#### 5. 访问系统

- **前端**: http://localhost:3000
- **Python API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474
- **MinIO Console**: http://localhost:9001

### 方式二：本地开发部署

#### 1. 前端部署

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build

# 生产运行
pnpm start
```

#### 2. Python后端部署

```bash
cd python_backend

# 创建虚拟环境
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp env.template .env
# 编辑 .env 文件，填入你的配置

# 初始化数据库
python init_database.py

# 启动服务
python main.py
# 或使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔐 账号密码

### Web系统登录账号

#### 默认管理员账号
- **用户名**: `admin`
- **密码**: `admin123`
- **邮箱**: `admin@example.com`
- **角色**: 管理员

> ⚠️ **重要提示**: 首次登录后请立即修改密码！

#### 重置管理员密码

如果忘记管理员密码，可以运行重置脚本：

```bash
cd python_backend
python reset_admin_password.py
```

脚本会将管理员密码重置为 `admin123`。

#### 创建测试用户

```bash
cd python_backend
python create_test_user.py
```

将创建测试账号：
- **用户名**: `test`
- **密码**: `test123`

### 数据库账号密码

#### MySQL
- **Root用户**: `root` / `root123456` (Docker默认)
- **应用用户**: `novel_user` / `novel_password` (Docker默认)
- **生产环境**: 见 `python_backend/env.production`

#### Neo4j
- **用户名**: `neo4j`
- **密码**: `neo4j123456` (Docker默认)
- **生产环境**: 见 `python_backend/env.production`

#### Redis
- **密码**: 无（Docker默认）
- **生产环境**: 见 `python_backend/env.production`

#### MinIO (Milvus存储)
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`
- **Console**: http://localhost:9001

---

## 📦 部署指南

### Docker Compose 服务说明

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| MySQL | ai_novel_mysql | 3306 | 主数据库 |
| Redis | ai_novel_redis | 6379 | 缓存服务 |
| Neo4j | ai_novel_neo4j | 7474, 7687 | 知识图谱 |
| Milvus | ai_novel_milvus | 19530, 9091 | 向量数据库 |
| Milvus etcd | ai_novel_milvus_etcd | 2379 | Milvus元数据 |
| Milvus MinIO | ai_novel_milvus_minio | 9000, 9001 | Milvus对象存储 |
| Elasticsearch | ai_novel_elasticsearch | 9200 | 全文搜索 |
| Node.js后端 | ai_novel_node | 3000 | Node后端服务 |
| Python后端 | ai_novel_python | 8000 | Python后端服务 |
| Nginx | ai_novel_nginx | 80, 443 | 反向代理（可选） |

### 生产环境部署

#### 1. 使用生产环境配置

```bash
# 复制生产环境配置
cp python_backend/env.production python_backend/.env

# 编辑 .env 文件，修改为你的生产环境配置
```

#### 2. 启动Nginx反向代理

```bash
# 使用production profile启动Nginx
docker-compose --profile production up -d nginx
```

#### 3. 配置SSL证书

将SSL证书放置在 `nginx/ssl/` 目录下，并修改 `nginx/nginx.conf` 配置。

### 数据备份

#### MySQL备份

```bash
# 备份数据库
docker exec ai_novel_mysql mysqldump -u root -p ai_novel_generator > backup.sql

# 恢复数据库
docker exec -i ai_novel_mysql mysql -u root -p ai_novel_generator < backup.sql
```

#### Neo4j备份

```bash
# 进入Neo4j容器
docker exec -it ai_novel_neo4j bash

# 使用neo4j-admin备份
neo4j-admin database dump neo4j --to=/backups/neo4j.dump
```

#### Milvus备份

Milvus数据存储在MinIO中，备份MinIO数据卷即可：

```bash
docker run --rm -v ai_novel_generator_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/milvus_backup.tar.gz /data
```

---

## ⚙️ 配置说明

### 环境变量配置

#### Python后端 (`python_backend/.env`)

```env
# 应用设置
APP_NAME=AI Novel Generator
APP_VERSION=1.0.0
DEBUG=false
HOST=0.0.0.0
PORT=8000

# JWT认证
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# MySQL数据库
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=ai_novel_generator

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TOKEN_EXPIRE_SECONDS=86400

# Neo4j知识图谱
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Milvus向量数据库
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_USER=
MILVUS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USER=
ELASTICSEARCH_PASSWORD=

# AI模型配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# 生成参数
DEFAULT_TEMPERATURE=0.7
DEFAULT_TOP_P=0.9
DEFAULT_MAX_TOKENS=4096
```

#### Node.js后端

环境变量通过 `docker-compose.yml` 或系统环境变量配置：

```env
NODE_ENV=production
DATABASE_URL=mysql://user:password@host:3306/ai_novel_generator
REDIS_URL=redis://host:6379
JWT_SECRET=your-jwt-secret-key
```

### 数据库初始化

#### 初始化MySQL

```bash
cd python_backend
python init_database.py
```

脚本会：
1. 创建数据库（如果不存在）
2. 创建所有表结构
3. 创建默认管理员用户（admin/admin123）

#### 初始化Neo4j

Neo4j会在首次启动时自动创建约束和索引。也可以手动运行：

```python
from app.db.neo4j import neo4j_client
neo4j_client.connect()
neo4j_client.init_constraints()
```

#### 初始化Milvus

Milvus会在首次使用时自动创建集合。也可以手动初始化：

```python
from app.db.milvus import milvus_client
milvus_client.connect()
milvus_client.init_collection()
```

---

## 📚 API文档

### Python后端API

启动服务后，访问以下地址查看API文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 主要API端点

#### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

#### 小说管理
- `GET /api/novels` - 获取小说列表
- `POST /api/novels` - 创建小说
- `GET /api/novels/{id}` - 获取小说详情
- `PUT /api/novels/{id}` - 更新小说
- `DELETE /api/novels/{id}` - 删除小说

#### 角色管理
- `GET /api/characters` - 获取角色列表
- `POST /api/characters` - 创建角色
- `GET /api/characters/{id}` - 获取角色详情
- `PUT /api/characters/{id}` - 更新角色
- `DELETE /api/characters/{id}` - 删除角色

#### 大纲生成
- `POST /api/outlines/generate` - 生成大纲
- `GET /api/outlines/{id}` - 获取大纲详情
- `PUT /api/outlines/{id}` - 更新大纲

#### 章节生成
- `POST /api/chapters/generate` - 生成章节（流式）
- `GET /api/chapters/{id}` - 获取章节详情
- `PUT /api/chapters/{id}` - 更新章节

#### 知识图谱
- `GET /api/knowledge/graph` - 获取知识图谱
- `GET /api/knowledge/characters` - 获取角色关系图
- `GET /api/knowledge/timeline` - 获取时间线

---

## 📁 项目结构

```
ai_novel_generator/
├── client/                      # 前端代码
│   ├── src/
│   │   ├── components/         # React组件
│   │   ├── pages/              # 页面组件
│   │   ├── lib/                # 工具库
│   │   └── contexts/           # React Context
│   └── public/                 # 静态资源
│
├── server/                      # Node.js后端
│   ├── _core/                   # 核心模块
│   ├── routers/                 # API路由
│   └── services/                # 业务服务
│
├── python_backend/              # Python后端
│   ├── app/
│   │   ├── api/                 # API路由
│   │   ├── config/              # 配置管理
│   │   ├── db/                  # 数据库连接
│   │   ├── models/              # 数据模型
│   │   └── services/            # 业务服务
│   │       ├── langchain/       # LangChain服务
│   │       └── langgraph/       # LangGraph工作流
│   ├── main.py                  # 应用入口
│   ├── requirements.txt         # Python依赖
│   ├── init_database.py         # 数据库初始化
│   └── env.template             # 环境变量模板
│
├── scripts/                      # 初始化脚本
│   ├── init-mysql.sql           # MySQL初始化
│   ├── init-neo4j.cypher        # Neo4j初始化
│   └── init_milvus.py           # Milvus初始化
│
├── docker-compose.yml            # Docker Compose配置
├── Dockerfile.node               # Node.js Dockerfile
├── package.json                  # Node.js依赖
└── README.md                     # 项目说明（本文件）
```

---

## ❓ 常见问题

### Q1: 如何更换LLM模型？

A: 在AI模型配置页面添加新的模型配置，支持OpenAI兼容的API。也可以在 `.env` 文件中配置：

```env
OPENAI_API_KEY=your_api_key
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

### Q2: 向量库和知识图谱是必须的吗？

A: 不是必须的。如果不配置Milvus和Neo4j，系统会使用降级模式运行，但RAG和知识图谱功能将不可用。

### Q3: 如何备份数据？

A: 定期备份MySQL数据库即可。Milvus和Neo4j的数据可以通过各自的备份工具进行备份。详见[数据备份](#数据备份)章节。

### Q4: 忘记管理员密码怎么办？

A: 运行重置脚本：

```bash
cd python_backend
python reset_admin_password.py
```

### Q5: 如何修改端口？

A: 修改 `docker-compose.yml` 中的端口映射，或修改 `.env` 文件中的 `PORT` 配置。

### Q6: 如何查看服务日志？

A: 使用Docker Compose查看：

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f python-backend
docker-compose logs -f node-backend
```

### Q7: 如何重启服务？

A: 

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart python-backend
```

### Q8: 如何清理所有数据？

A: ⚠️ **警告**: 这将删除所有数据！

```bash
# 停止并删除所有容器和数据卷
docker-compose down -v
```

---

## 📄 许可证

MIT License

---

## 👥 贡献

欢迎提交Issue和Pull Request！

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交Issue
- 发送邮件

---

**最后更新**: 2025年12月


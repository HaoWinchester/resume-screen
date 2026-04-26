# Quickstart: HR 简历智能筛查系统

**Branch**: `1-resume-screening`
**Created**: 2026-04-17

---

## 前置条件

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose（可选）

## 快速启动（Docker Compose）

### 1. 克隆项目并配置环境变量

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

编辑 `backend/.env`，填入必要的配置：
```
DATABASE_URL=postgresql://user:pass@localhost:5432/resume_assistant
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 2. 启动所有服务

```bash
docker compose up -d
```

### 3. 初始化数据库

```bash
docker compose exec backend python -m alembic upgrade head
```

### 4. 访问应用

- 前端: http://localhost:3000
- 后端 API 文档: http://localhost:8000/docs
- 后端 ReDoc: http://localhost:8000/redoc

## 手动启动

### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload --port 8000

# 另开终端，启动 Celery Worker
celery -A app.worker worker --loglevel=info
```

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 项目结构

```
ResumeAssistant/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 应用入口
│   │   ├── config.py            # 配置管理
│   │   ├── database.py          # 数据库连接
│   │   ├── models/              # SQLAlchemy 模型
│   │   ├── schemas/             # Pydantic 数据校验
│   │   ├── api/                 # API 路由
│   │   │   ├── auth.py
│   │   │   ├── companies.py
│   │   │   ├── job_requirements.py
│   │   │   ├── job_templates.py
│   │   │   ├── resumes.py
│   │   │   └── analysis.py
│   │   ├── services/            # 业务逻辑
│   │   │   ├── auth_service.py
│   │   │   ├── resume_parser.py
│   │   │   ├── ai_analyzer.py
│   │   │   └── export_service.py
│   │   ├── tasks/               # Celery 异步任务
│   │   │   ├── parse_resume.py
│   │   │   └── analyze_resume.py
│   │   └── worker.py            # Celery 配置
│   ├── alembic/                 # 数据库迁移
│   ├── tests/                   # 测试
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router 页面
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── dashboard/
│   │   │   ├── jobs/
│   │   │   │   ├── [id]/
│   │   │   │   └── new/
│   │   │   ├── resumes/
│   │   │   │   └── [id]/
│   │   │   └── analysis/
│   │   │       ├── [id]/
│   │   │       └── compare/
│   │   ├── components/          # UI 组件
│   │   │   ├── layout/
│   │   │   ├── resume/
│   │   │   ├── analysis/
│   │   │   └── common/
│   │   ├── lib/                 # 工具函数
│   │   │   ├── api.ts           # API 客户端
│   │   │   └── auth.ts          # 认证工具
│   │   ├── hooks/               # 自定义 Hooks
│   │   └── types/               # TypeScript 类型
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── specs/                       # 功能规格文档
```

## 核心开发流程

1. **添加新功能**：先在 `specs/` 中更新规格，再实现代码
2. **数据库变更**：使用 Alembic 生成和执行迁移
3. **API 开发**：Model → Schema → Service → Route
4. **前端开发**：Type → API → Component → Page

## 测试

```bash
# 后端测试
cd backend && pytest

# 前端测试
cd frontend && npm test
```

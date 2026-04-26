# Research: HR 简历智能筛查系统

**Branch**: `1-resume-screening`
**Created**: 2026-04-17

---

## 1. 前端技术选型

### Decision: React + Next.js (App Router)

**Rationale**:
- Next.js 提供 SSR/SSG 支持，首屏加载快，SEO 友好
- App Router 支持服务端组件，减少客户端 JS 体积
- 丰富的组件生态（shadcn/ui、Ant Design 等）
- 社区活跃，招聘场景的 Web 应用有大量成熟实践

**Alternatives considered**:
- Vue + Nuxt: 优秀但生态略小于 React
- 纯 React SPA: 缺少 SSR 和文件路由，开发效率较低

### UI 组件库: Ant Design 5.x

**Rationale**:
- 中文场景下有完善的表单、表格、上传、进度条组件
- 企业级组件质量高，开箱即用
- 与 React 生态无缝集成

## 2. 后端技术选型

### Decision: Python + FastAPI

**Rationale**:
- Python 是 AI/ML 生态的首选语言，便于集成 LLM SDK
- FastAPI 原生支持 async，适合高并发文件上传和 AI 调用
- 自动生成 OpenAPI 文档，前后端协作高效
- Pydantic 数据校验与序列化能力出色

**Alternatives considered**:
- Node.js + Express: AI 集成生态不如 Python
- Django: 过于重量级，异步支持不如 FastAPI
- Go: AI 生态薄弱

### 任务队列: Celery + Redis

**Rationale**:
- 简历分析和 AI 调用是耗时操作，必须异步处理
- Celery 是 Python 生态最成熟的任务队列
- Redis 同时作为缓存和消息代理，减少组件数量

## 3. 数据库选型

### Decision: PostgreSQL

**Rationale**:
- 支持 JSONB 类型，适合存储简历解析后的半结构化数据
- 成熟稳定，社区庞大
- 全文搜索能力可辅助简历内容检索
- 支持事务、行级锁，确保数据一致性

**Alternatives considered**:
- MongoDB: 适合非结构化数据，但事务支持较弱
- MySQL: JSON 支持不如 PostgreSQL 灵活

## 4. AI/LLM 服务选型

### Decision: Claude API (Anthropic) + OpenAI API 双通道

**Rationale**:
- Claude 在中文理解和长文本分析方面表现优秀，作为主分析引擎
- OpenAI GPT-4 作为备用通道，确保服务可用性
- 两者均有成熟的 Python SDK
- Prompt 工程可实现结构化评分输出

**Alternatives considered**:
- 仅用单一 LLM: 存在单点故障风险
- 开源模型自部署: 初期成本高，运维复杂

### Prompt 策略: 结构化 JSON 输出

**Rationale**:
- 通过精心设计的 Prompt 引导 LLM 输出 JSON 格式的评分结果
- 包含各维度评分（0-100）、分析文字、优势/不足列表
- 结合岗位需求作为上下文，确保评估与需求对齐

## 5. 文件解析方案

### Decision: 组合方案

| 文件类型 | 解析工具                          | 说明                       |
| -------- | --------------------------------- | -------------------------- |
| PDF      | PyMuPDF (fitz)                    | 速度快，支持文本和图片提取 |
| DOC/DOCX | python-docx                       | 成熟的 Word 文件解析库     |
| JPG/PNG  | OCR → PyMuPDF 或 Tesseract        | 图片型简历通过 OCR 提取    |

**Rationale**:
- 组合使用多个专业解析库覆盖所有格式
- 解析后统一输出纯文本，送入 LLM 分析
- 解析失败的文件保留原始文件供人工查看

## 6. 文件存储

### Decision: 本地文件系统 + MinIO（可选 S3）

**Rationale**:
- 初期使用本地文件系统，降低部署复杂度
- 预留 MinIO/S3 接口，方便后续迁移到云存储
- 文件按 公司/岗位/简历 三级目录组织

## 7. 认证方案

### Decision: JWT (JSON Web Token)

**Rationale**:
- 无状态认证，易于横向扩展
- 前后端分离架构的标准选择
- 支持 Token 刷新机制
- 使用 bcrypt 加密存储密码

## 8. 部署方案

### Decision: Docker Compose

**Rationale**:
- 一键部署所有服务（前端、后端、数据库、Redis、Worker）
- 开发和生产环境一致性
- 便于各组件独立扩缩容
- 初期足够满足需求

**Alternatives considered**:
- Kubernetes: 过于复杂，不适合初期项目
- 纯物理部署: 环境不一致问题多

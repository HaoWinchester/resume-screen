---
name: project-profile
description: 供产品交付 Agent Team 使用的项目专属上下文。
---

# 项目 Profile

## 产品定位

ResumeAssistant 是面向 HR 的简历筛选和招聘流程产品。处理这个项目时，要把它当作客户可交付产品，而不是一次性 demo。

## 当前技术栈

- 前端：Next.js 14、React 18、TypeScript、Ant Design 5、Zustand、Recharts、Playwright E2E。
- 后端：FastAPI、Pydantic v2、SQLAlchemy async、Alembic、PostgreSQL、Celery、Redis。
- AI / 解析：OpenAI SDK、Anthropic SDK、PyMuPDF、python-docx、OCR 工具。
- 本地前端：`http://localhost:3004`
- 本地后端健康检查：`http://localhost:8001/health`
- 常用浏览器测试账号：`admin@test.com` / `12345678`

## 交付原则

1. 保护产品可信度：不要把 parser JSON、模型原始输出、异常栈、`null`、`undefined` 直接暴露给 HR 用户。
2. 在最早可靠层修问题：解析错误优先改 parser，契约错误改后端，存量展示问题由前端做防御性 fallback。
3. 异步任务必须可观察：解析、分析任务要有清晰状态语义和恢复路径。
4. 涉及布局、导航或用户流程的前端改动，需要真实浏览器验证。
5. 测试范围与风险匹配：小改动跑聚焦测试，跨流程改动补后端测试、构建检查或 Playwright smoke。

## 复用说明

迁移到其他项目时，保留 agent 团队文件，替换本文件中的产品定位、技术栈、URL、测试账号、命令和质量约束。

# ResumeAssistant Claude Code Instructions

本仓库的交付流程已经整理为可复用的 agent team。

## 读取顺序

进入仓库后，优先按下面顺序建立上下文：

1. `AGENTS.md`
2. `skills/resumeassistant-agent-team/SKILL.md`
3. `agents/team.yaml`
4. `agents/project-profile.md`
5. `agents/orchestrator-agent.md`
6. Orchestrator 选中的 specialist agent

## Agent Team

主控：

- `orchestrator-agent`

专业角色：

- `spec-agent`
- `ui-agent`
- `frontend-agent`
- `backend-agent`
- `database-agent`
- `test-agent`
- `fix-agent`
- `monitor-agent`
- `acceptance-agent`
- `deploy-agent`
- `legacy-dev-agent`

团队注册表在 `agents/team.yaml`，每个 agent 都有稳定名称、内容文件、推荐模型和推理强度。

## 行为约束

- 不要忽略 `agents/` 后临时自创一套角色流程。
- 不要让 specialist agent 互相越权；跨层问题交回 `orchestrator-agent` 路由。
- 如果需求还不清楚，先走 `spec-agent`。
- 如果实现完成但还没有证据，先走 `test-agent` 和 `monitor-agent`。
- 如果准备给客户看，先走 `acceptance-agent`。
- 如果准备发布，先走 `deploy-agent`。

## 旧目录说明

`.skills/` 是兼容层，保留 Speckit 和旧版角色型 skill。新的 agent team 以 `agents/` 为准。

迁移到别的项目时，复制 `agents/` 和 `skills/resumeassistant-agent-team/`，然后替换 `agents/project-profile.md`。

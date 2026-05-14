# ResumeAssistant Agent Instructions

本仓库现在采用“Agent Team + Skill 入口”的组织方式。

## 1. 当前主入口

优先读取：

1. `skills/resumeassistant-agent-team/SKILL.md`
2. `agents/team.yaml`
3. `agents/project-profile.md`
4. `agents/orchestrator-agent.md`
5. Orchestrator 指定的 specialist agent

`agents/team.yaml` 是团队注册表，里面声明了每个 agent 的：

- `name`
- `content`
- `model`
- `reasoning_effort`
- ownership
- handoff flow

## 2. Agent Team 结构

团队入口：

- `orchestrator-agent`

交付角色：

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

默认流程：

```text
orchestrator-agent
  -> spec-agent
  -> ui-agent
  -> frontend-agent / backend-agent / database-agent
  -> test-agent
  -> fix-agent, if needed
  -> monitor-agent
  -> acceptance-agent
  -> deploy-agent
```

## 3. Orchestrator 原则

- Orchestrator 负责分派、交接、阻断和状态摘要。
- Specialist agent 负责各自领域的判断和产出。
- 不要让单个 specialist 跨层接管全部工作。
- 不要跳过 spec 澄清直接进入 UI 或代码实现。
- 不要把应用运行时 orchestrator 和 agent orchestrator 混为一谈：前者是代码，后者是模型协作协议。

## 4. 项目 Profile

项目技术栈和本地约束写在：

- `agents/project-profile.md`

迁移到新项目时，优先复制 `agents/` 和 `skills/resumeassistant-agent-team/`，然后替换 `agents/project-profile.md`。

## 5. 旧 `.skills` 目录

`.skills/` 现在作为兼容层保留：

- Speckit 相关 skill 仍可参考。
- 旧的 `*-agent/SKILL.md` 不再作为主维护入口。
- 新增或修改 agent 团队角色时，统一改 `agents/*.md` 和 `agents/team.yaml`。

如果本地 skill 与 agent team 冲突，优先使用 `agents/` 下的新团队定义。

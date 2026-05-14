---
name: resumeassistant-agent-team
description: 当用户希望用 Agent Team 处理 ResumeAssistant 或类似产品交付工作时，必须使用这个 skill。适用于 agent team、orchestrator agent、specialist agents、handoff、多智能体协作、需求到实现到验收的完整交付流程，也适用于把这套团队复用到其他项目。
---

# ResumeAssistant Agent Team

## 目标

使用 `agents/` 中的可复用团队来协同产品交付。团队将“总控协调”和“专业角色职责”分开：

- `agents/team.yaml` 是团队注册表，声明每个 agent 的名称、内容文件、推荐模型和交接职责。
- `agents/orchestrator-agent.md` 是团队入口。
- `agents/project-profile.md` 保存项目专属技术栈和交付约束。
- specialist agents 分别负责 spec、UI、前端、后端、数据库、测试、修复、监控、验收和发布判断。

## 启动步骤

1. 读取 `agents/team.yaml`。
2. 读取 `agents/project-profile.md`。
3. 读取 `agents/orchestrator-agent.md`。
4. 让 orchestrator 判断下一步该交给哪个 specialist agent。
5. 只读取当前阶段真正需要的 specialist agent 文件。

## 调用方式

### 在支持本地 skill 的环境中

直接在请求里写：

```text
使用 $resumeassistant-agent-team 帮我处理这个需求：……
```

或者：

```text
按 ResumeAssistant Agent Team 流程走，先让 orchestrator 判断下一步。
```

### 在只支持普通文件上下文的环境中

让 agent 明确按这些文件启动：

```text
请先读取 AGENTS.md，然后读取 skills/resumeassistant-agent-team/SKILL.md、
agents/team.yaml、agents/project-profile.md、agents/orchestrator-agent.md。
之后按 orchestrator 的路由读取对应 specialist agent。
```

### 在当前 Codex 会话中

可以直接说：

```text
用这个项目的 agent team 做：<你的任务>
```

我会按 `AGENTS.md -> skills/resumeassistant-agent-team -> agents/team.yaml -> orchestrator-agent` 的顺序启动。

## 执行策略

- 如果运行环境支持 subagent，且用户明确要求团队/委派/并行工作，可以把 specialist 作为隔离子 agent 派发。
- 如果运行环境不支持 subagent，或用户只是普通开发请求，就在主会话中按同样流程顺序读取对应 agent 文件。
- 紧密耦合、下一步马上依赖当前结果的任务，不要强行并行。
- 应用运行时 orchestrator 仍然保留在代码里。本 skill 只协调模型行为和交接协议，不替代产品自己的工作流引擎。

## 默认流程

```text
orchestrator-agent
  -> spec-agent
  -> ui-agent
  -> frontend-agent / backend-agent / database-agent
  -> test-agent
  -> fix-agent, 如果测试或 monitor 失败
  -> monitor-agent
  -> acceptance-agent
  -> deploy-agent
```

## 交接包格式

每次 handoff 都应该包含：

```yaml
goal: ""
scope: ""
inputs: []
constraints: []
expected_output: ""
blockers: []
```

## 迁移到其他项目

复制 `agents/` 和本 skill 到新仓库，然后替换 `agents/project-profile.md` 中的项目技术栈、URL、账号、命令和质量约束。

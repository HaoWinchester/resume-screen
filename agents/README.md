# 产品交付 Agent Team

这个目录保存可复用的 agent 团队。每个 agent 文件都是一张角色卡，包含 frontmatter：

- `name`：稳定的 agent id。
- `description`：什么时候使用这个 agent。
- `model`：推荐模型。
- `reasoning_effort`：推荐推理强度。
- 正文：具体角色职责、输入输出契约和工作规则。

使用时先读 [team.yaml](team.yaml)，再读 [orchestrator-agent.md](orchestrator-agent.md)。Orchestrator 负责决定当前阶段该交给哪个 specialist agent，并为它准备小而明确的输入包。

这套团队可以复制到别的项目。迁移时保留本目录结构，替换 [project-profile.md](project-profile.md) 里的项目栈、地址、命令和质量约束即可。

旧 `.skills/*-agent` 文件现在只是兼容层。新的 agent 角色请加在这里，不要继续放到 `.skills`。

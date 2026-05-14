# 旧版 Skills 目录说明

这个目录现在作为兼容层保留。新的 agent team 已经迁移到：

- `../agents/team.yaml`
- `../agents/*.md`
- `../skills/resumeassistant-agent-team/SKILL.md`

后续新增或修改 agent 角色时，请改 `../agents/`，不要继续在 `.skills/*-agent` 下扩展。

## 推荐拆分

- `spec-agent`
  负责把一句话需求澄清成结构化 spec，并为后续 Stitch / 开发阶段提供边界。
- `ui-agent`
  负责把已批准的 spec 组织成更适合 Stitch 使用的 prompt。
- `frontend-agent`
  负责把已批准的 UI 和当前功能点变成前端代码改动。
- `backend-agent`
  负责把当前功能点变成后端接口、契约、校验和服务层改动。
- `database-agent`
  负责 SQLAlchemy + Alembic + PostgreSQL 的模型、migration、seed/fixture 和持久化兼容。
- `test-agent`
  负责解释测试结果，决定继续、修复还是阻断。
- `fix-agent`
  负责把 bug、偏航 finding 和失败记忆收敛成最小修复集。
- `monitor-agent`
  负责检查当前实现是否仍与批准后的 spec 对齐。
- `acceptance-agent`
  负责挑选客户预览入口，并判断是否适合进入最终发布确认。
- `deploy-agent`
  负责基于验收结果决定是否允许发布。
- `dev-agent`
  兼容旧版单开发 agent 流程，当前主流程已经由 `frontend-agent`、`backend-agent`、`db-agent` 替代。

## 不建议抽成 skill 的部分

下面这些是项目运行时能力，应该继续保留在代码里：

- `orchestrator`
- 工作流状态机
- Stitch 调用与下载逻辑
- 数据库执行器
- 文件写入器
- 日志与报告落盘
- 预览服务
- 部署执行器

## 旧内容使用建议

如果你要把这套能力迁移到别的项目里，推荐顺序是：

1. 先迁移 `../agents/` 里的团队角色和 `team.yaml`
2. 再迁移 `../skills/resumeassistant-agent-team/` 里的触发入口
3. 再迁移项目自己的确定性执行层
4. 最后迁移应用运行时 orchestrator 或状态机

这样复用成本最低，也不会把运行时代码和提示词耦死。

## V3 补充

历史版本中，这些 skill 已经不只是角色说明，还补了：

- 更明确的“示例输入 / 示例输出”
- 初版评测集计划

如果后面要继续迭代，建议优先为新的 `agents/` 团队补评测，而不是继续维护旧 `.skills/*-agent`。

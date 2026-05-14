# 旧版本地 Skills 说明

`.skills/` 是兼容层。新的 agent team 已迁移到仓库根目录：

- `agents/team.yaml`
- `agents/*.md`
- `skills/resumeassistant-agent-team/SKILL.md`

使用规则：

1. 需要 agent team 时，优先读取 `../skills/resumeassistant-agent-team/SKILL.md`。
2. 需要角色定义时，优先读取 `../agents/team.yaml` 和 `../agents/*.md`。
3. `.skills/speckit-*` 可以继续作为 Speckit 兼容 skill 参考。
4. `.skills/*-agent` 是旧版角色型 skill，不再作为主维护入口。

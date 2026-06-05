# Knowledge Candidate Lifecycle

## 背景与原因

OpenPrd 已经会在收工回顾中生成 knowledge candidate，并允许用户把有价值的草案沉淀为项目级 knowledge skill。但当前 `quality` 仍按文件系统里存在的 `candidate.json` 数量提示“待确认”，没有正式区分已合并、已拒绝、已归档和仍待审的候选。

这会让已人工审计过的候选继续污染质量报告，造成用户误以为还有大量未处理问题。

## 变更内容

- 为 knowledge candidate 增加正式生命周期状态：`pending-review`、`promoted/merged`、`rejected`、`archived`。
- 新增 `openprd knowledge candidates` 查看候选队列，支持按状态过滤。
- 新增 `openprd knowledge reject --id <candidate-id> --reason <text>`，把无价值候选标为已拒绝。
- 新增 `openprd knowledge archive --id <candidate-id> --reason <text>`，把重复、过期或已处理候选归档。
- 新增 `openprd knowledge restore --id <candidate-id>`，把已处理候选恢复为待审。
- 修改 `openprd quality . --verify`，只把 `pending-review` 候选计入待确认 warning 和 candidate count。
- 保留原始 candidate 文件，不物理删除证据。

## 能力范围

- `agent-requirements`: Agent 工作流中的项目经验候选治理。

## 影响范围

- 主要用户: 维护 OpenPrd quality、knowledge 和 Agent 收工回顾的 OpenPrd maintainer。
- 主要用户: 使用 OpenPrd 时需要清理 knowledge candidate 队列的 Agent 或开发者。
- CLI 接入面: 新增 `openprd knowledge` 子命令组。
- 质量报告: knowledge gate 的候选数量从“所有候选文件”改为“仍待审候选”。
- 数据持久化: `.openprd/knowledge/index.json` 和各 candidate 文件同步记录审查状态、时间、操作者和原因。

## 非目标

- 不删除历史 candidate 原始证据。
- 不改变已沉淀 skill 的正文内容。
- 不把所有历史候选自动 promote。
- 不把这个机制和 benchmark source candidate 或 growth candidate 混成一套。
- 不新增图形界面。

## 风险与缓解

- 风险: 旧状态如 `reviewed-noise`、`reviewed-duplicate` 被误判为 pending。缓解: 状态归一化时把这些历史 reviewed 状态视为已处理。
- 风险: candidate 文件和 index 状态不一致。缓解: CLI 操作同时更新 candidate 文件和 index，读取时 candidate 文件优先、index 兜底。
- 风险: `quality --learn --from` 被破坏。缓解: 保持原命令可用，learn 后继续把来源 candidate 标为 promoted。
- 风险: 已处理候选无法回到待审。缓解: 提供 `restore`。

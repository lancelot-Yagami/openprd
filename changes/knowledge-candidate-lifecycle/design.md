# 设计

## 状态模型

Knowledge candidate 使用以下状态：

- `pending-review`: 需要人工决定是否沉淀。
- `promoted`: 已通过 `quality --learn --from` 升级为正式 skill。
- `merged`: 已人工合并进某个正式 skill。
- `rejected`: 已确认不值得沉淀。
- `archived`: 已归档保留证据，暂不进入待审队列。

兼容历史状态：

- `pending` 视为 `pending-review`。
- `reviewed-noise`、`reviewed-duplicate`、`reviewed-weak-signal` 视为已处理，不计入 quality 待确认数。

## 数据写入

每次 reject/archive/restore/promote 都同步更新两处：

- `.openprd/knowledge/candidates/<id>/candidate.json`
- `.openprd/knowledge/index.json`

candidate 文件是更具体的证据记录，读取时优先使用；index 用于队列展示、聚合和历史兼容。

审查字段包括：

- `status`
- `reviewedAt`
- `reviewedBy`
- `reviewDecision`
- `reviewReason`
- `archivedAt` 或 `rejectedAt`
- `restoredAt`

## CLI

新增命令：

- `openprd knowledge candidates [path] [--status <status|all>] [--json]`
- `openprd knowledge reject [path] --id <candidate-id> --reason <text> [--json]`
- `openprd knowledge archive [path] --id <candidate-id> --reason <text> [--json]`
- `openprd knowledge restore [path] --id <candidate-id> [--json]`

默认 `candidates` 只列出 `pending-review`。`--status all` 显示所有候选。

## Quality 集成

`openprd quality . --verify` 继续扫描 `.openprd/knowledge`，但 knowledge gate 只把 pending 候选计入待确认 warning。

报告中仍保留汇总信息：

- `candidates`: pending 列表，保持向后兼容。
- `candidateCounts`: 按状态分组。
- `reviewedCandidates`: 已处理候选列表。

## 验证

- 单元/集成测试覆盖 candidate list、reject、archive、restore。
- 测试 `quality` 在 candidate 文件仍存在时，只对 pending 候选发出 warning。
- 测试 `quality --learn --from` 仍能把 candidate 标为 `promoted`。

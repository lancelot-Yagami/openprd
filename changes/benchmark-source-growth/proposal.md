# Benchmark 信源自增长闭环

## 背景与原因

Agent 在执行任务时会查询外部信息，用户也会通过互动采纳其中一部分高质量信源。当前 OpenPrd 已经有 benchmark candidate 和 approved registry，但缺少把“多次被采纳的信源”从执行复盘中逐步推荐为 benchmark 的闭环。

## 变更内容

- 新增 benchmark source observation 入口，用于记录本轮被采纳的外部信源。
- 对同一信源进行规范化去重，累计采纳次数、最近使用时间和证据。
- 达到阈值后只推荐纳入 benchmark，不自动 approve。
- 在 review/list 输出中提示用户用 `openprd benchmark approve <id>` 晋级 approved registry。
- 更新 CLI help、基础后端文档和测试。

## 能力范围

- `agent-benchmark-source-growth`: Agent 执行中的优质信源可以先进入候选库，累计采纳证据后推荐进入长期 benchmark。

## 影响范围

- 主要用户: 使用 OpenPrd 进行 Agent harness、benchmark、复盘和长期知识沉淀的用户。
- 依赖: 现有 `.openprd/benchmarks/` candidate inbox、approved sources registry 和 `openprd benchmark` CLI。
- 约束: candidate 不能作为已确认事实来源；达到阈值后仍需要用户确认。

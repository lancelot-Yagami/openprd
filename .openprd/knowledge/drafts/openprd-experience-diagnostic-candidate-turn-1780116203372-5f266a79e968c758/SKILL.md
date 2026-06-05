---
name: openprd-experience-diagnostic-candidate-turn-1780116203372-5f266a79e968c758
description: OpenPrd 在本轮回顾时自动生成的待确认项目经验草案。
---

# openprd-experience-diagnostic-candidate-turn-1780116203372-5f266a79e968c758

> 状态：draft
> 候选目录：`.openprd/knowledge/candidates/candidate-turn-1780116203372-5f266a79e968c758`
> Promote：`openprd quality . --learn --from .openprd/knowledge/candidates/candidate-turn-1780116203372-5f266a79e968c758`

## 为什么值得沉淀

- 本轮结果里已经出现可复用的症状、排查线索或根因模式，不应该只留在当前对话里。
- 这次改动直接影响 Agent / harness / hook / skill 行为，后续很容易再次踩到同类判断问题。
- 这次修复已经带有验证或收尾证据，适合尽快抽象成项目级研发经验。
- 症状: 本轮项目回顾
- run-verify: run verify passed
- dev-check: dev-check attention=9, warning=1 | touched: src/workspace-core.js, src/openprd.js, src/fleet.js, src/standards.js, test/helpers/openprd-test-helpers.js, test/openprd-run-fleet.test.js

## 下次触发时先看什么

- `src/workspace-core.js`
- `src/openprd.js`
- `src/fleet.js`
- `src/standards.js`
- `test/helpers/openprd-test-helpers.js`
- `test/openprd-run-fleet.test.js`
- `test/openprd-quality-standards.test.js`
- `test/openprd-agent-integration.test.js`
- `test/openprd-benchmark-knowledge.test.js`
- `test/openprd.test.js`
- `test/openprd-workspace-flow.test.js`
- `test/openprd-discovery-changes.test.js`
- `test/openprd-github-release.test.js`
- `.openprd/harness/turn-state.json`

## 可复用模式

- 先按本轮诊断线索复走一次，再补最小必要证据。

## 验证方式

- run verify passed
- dev-check attention=9, warning=1
- 复现一次同类路径，确认新的诊断包仍能导出 runtime-events、timeline、root-cause-candidates 和 diagnostic-report。
- 重点核对 run-verify -> quality-verify -> dev-check 的顺序是否符合预期。
- 修复后再次执行同一路径，确认时间线不再在历史失败断点中断。
- 把最终诊断包与质量报告一起归档，确保后续 Agent 能直接复用已有排查路径。

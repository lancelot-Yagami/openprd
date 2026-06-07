---
name: openprd-experience-diagnostic-candidate-eval-20260607124349
description: OpenPrd 在本轮回顾时自动生成的待确认项目经验草案。
---

# openprd-experience-diagnostic-candidate-eval-20260607124349

> 状态：draft
> 候选目录：`.openprd/knowledge/candidates/candidate-eval-20260607124349`
> Promote：`openprd quality . --learn --from .openprd/knowledge/candidates/candidate-eval-20260607124349`

## 触发条件

- 本轮结果里已经出现可复用的症状、排查线索或根因模式，不应该只留在当前对话里。
- 这次改动直接影响 Agent / harness / hook / skill 行为，后续很容易再次踩到同类判断问题。
- 这次修复已经带有验证或收尾证据，适合尽快抽象成项目级研发经验。
- dev-check
- doctor-green
- run-verify
- quality-verify
- 本轮项目回顾

## 适用范围

- 抽象模式: 同类故障通常会先在 runtime-events、timeline、root-cause-candidates 和 diagnostic-report 中留下证据。只要实现阶段就把这些结构化诊断面铺好，后续多数问题都能先靠现有证据定位，而不是临时补日志。
- 适用于项目源码或核心流程已经落地、需要把实现经验固化为项目知识的任务。
- 适用于本轮补过验证或测试夹具，后续同类需求需要同步复用验证方式的任务。
- 特别适用于 Agent、hook、harness、quality 或 growth 工作流改动，避免下次再次靠聊天上下文兜底。

## 典型输入

- 任务场景: dev-check
- 相关文件: src/workspace-workflow.js、src/codex-hook-runner-template.mjs、src/agent-integration.js、test/requirement-gate.test.js
- 已有证据类型: diagnostic-report
- 验证信号: dev-check、quality-verify

## 典型输出

- 项目经验候选与诊断包
- 待确认的项目经验草案
- 验证结论: dev-check attention=0, warning=4
- 可复用的验证链路与收尾动作

## 下次触发时先看什么

- `src/workspace-workflow.js`
- `src/codex-hook-runner-template.mjs`
- `src/agent-integration.js`
- `test/requirement-gate.test.js`
- `.openprd/harness/turn-state.json`

## 可复用模式

- 先按本轮诊断线索复走一次，再补最小必要证据。

## 验证方式

- dev-check attention=0, warning=4
- quality production-ready
- 复现一次同类路径，确认新的诊断包仍能导出 runtime-events、timeline、root-cause-candidates 和 diagnostic-report。
- 重点核对 dev-check -> doctor-green -> run-verify 的顺序是否符合预期。
- 修复后再次执行同一路径，确认时间线不再在历史失败断点中断。
- 把最终诊断包与质量报告一起归档，确保后续 Agent 能直接复用已有排查路径。

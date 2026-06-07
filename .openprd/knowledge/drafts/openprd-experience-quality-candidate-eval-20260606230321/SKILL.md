---
name: openprd-experience-quality-candidate-eval-20260606230321
description: OpenPrd 在本轮回顾时自动生成的待确认项目经验草案。
---

# openprd-experience-quality-candidate-eval-20260606230321

> 状态：draft
> 候选目录：`.openprd/knowledge/candidates/candidate-eval-20260606230321`
> Promote：`openprd quality . --learn --from .openprd/knowledge/candidates/candidate-eval-20260606230321`

## 触发条件

- 这次改动直接影响 Agent / harness / hook / skill 行为，后续很容易再次踩到同类判断问题。
- 这次修复已经带有验证或收尾证据，适合尽快抽象成项目级研发经验。
- doctor-green: doctor passed
- quality-verify: quality production-ready | touched: README.md, package.json, scripts/dev-check-wrapup-copy.mjs, scripts/openprd-dev-check.mjs, scripts/openprd-github-release-notes.mjs, scripts/openprd-review-presentation.mjs
- dev-check: dev-check attention=3, warning=5 | touched: src/codex-hook-runner-template.mjs, src/agent-integration.js, src/knowledge.js, src/quality-learning.js, src/quality.js, test/requirement-gate.test.js
- dev-check: dev-check attention=2, warning=2 | touched: AGENTS.md, skills/openprd-requirement-intake/SKILL.md, skills/openprd-harness/SKILL.md, skills/openprd-shared/SKILL.md, src/agent-integration.js, src/codex-hook-runner-template.mjs

## 适用范围

- 抽象模式: 质量缺口反复出现，通常是因为可观测性、护栏、测试与复盘知识被分散维护，没有进入同一套项目级诊断闭环。
- 适用于项目源码或核心流程已经落地、需要把实现经验固化为项目知识的任务。
- 特别适用于 Agent、hook、harness、quality 或 growth 工作流改动，避免下次再次靠聊天上下文兜底。

## 典型输入

- 任务场景: 质量门禁收口
- 相关文件: package.json、scripts/dev-check-wrapup-copy.mjs、scripts/openprd-dev-check.mjs、scripts/openprd-github-release-notes.mjs、scripts/openprd-review-presentation.mjs、scripts/quality-perf-check.mjs
- 已有证据类型: quality-report
- 验证信号: doctor-green、quality-verify、dev-check

## 典型输出

- 项目经验候选与诊断包
- 待确认的项目经验草案
- 验证结论: doctor passed
- 可复用的验证链路与收尾动作

## 下次触发时先看什么

- `package.json`
- `scripts/dev-check-wrapup-copy.mjs`
- `scripts/openprd-dev-check.mjs`
- `scripts/openprd-github-release-notes.mjs`
- `scripts/openprd-review-presentation.mjs`
- `scripts/quality-perf-check.mjs`
- `src/agent-integration.js`
- `src/benchmark/constants.js`
- `src/benchmark/operations.js`
- `src/benchmark/registry.js`
- `src/benchmark/render.js`
- `.openprd/quality/reports/eval-20260606230321.json`

## 可复用模式

- 先按本轮诊断线索复走一次，再补最小必要证据。

## 验证方式

- doctor passed
- quality production-ready
- dev-check attention=3, warning=5
- dev-check attention=2, warning=2
- 运行 openprd quality . --verify 并确认需要关注的门禁已经闭环。
- 打开 HTML 报告，核对证据链、评估结论和后续动作是否一致。
- 重新执行任务级 verify 命令，并把最终证据路径保留在质量报告里。

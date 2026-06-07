---
name: openprd-experience-diagnostic-candidate-doctor-passed
description: OpenPrd 在本轮回顾时自动生成的待确认项目经验草案。
---

# openprd-experience-diagnostic-candidate-doctor-passed

> 状态：draft
> 候选目录：`.openprd/knowledge/candidates/candidate-doctor-passed`
> Promote：`openprd quality . --learn --from .openprd/knowledge/candidates/candidate-doctor-passed`

## 触发条件

- 本轮结果里已经出现可复用的症状、排查线索或根因模式，不应该只留在当前对话里。
- 这次改动直接影响 Agent / harness / hook / skill 行为，后续很容易再次踩到同类判断问题。
- doctor passed
- 完成信号: doctor-green
- 症状: doctor passed
- doctor-green: doctor passed

## 适用范围

- 抽象模式: 当一轮实现已经达到可交付状态时，即使没有 turn-state，也要从最近验证信号和最近改动文件中自动抽出可复用的项目经验。
- 特别适用于 Agent、hook、harness、quality 或 growth 工作流改动，避免下次再次靠聊天上下文兜底。

## 典型输入

- 任务摘要: doctor passed
- 相关文件: .cursor/commands/openprd-fleet.md、.cursor/commands/openprd-guard.md、.cursor/commands/openprd-onboard.md、.cursor/commands/openprd-repair.md、.cursor/commands/openprd-loop.md、.cursor/commands/openprd-run.md
- 已有证据: review-signal:doctor-green
- 验证信号: doctor-green

## 典型输出

- knowledge candidate: .openprd/knowledge/candidates/candidate-doctor-passed/candidate.json
- 诊断报告: .openprd/knowledge/candidates/candidate-doctor-passed/diagnostic-report.json
- draft skill: .openprd/knowledge/drafts/openprd-experience-diagnostic-candidate-doctor-passed/SKILL.md
- 验证结论: doctor passed

## 下次触发时先看什么

- `.cursor/commands/openprd-fleet.md`
- `.cursor/commands/openprd-guard.md`
- `.cursor/commands/openprd-onboard.md`
- `.cursor/commands/openprd-repair.md`
- `.cursor/commands/openprd-loop.md`
- `.cursor/commands/openprd-run.md`
- `.cursor/commands/openprd-visual-compare.md`
- `.cursor/commands/openprd-verify.md`
- `doctor-green`

## 可复用模式

- 先按本轮诊断线索复走一次，再补最小必要证据。

## 验证方式

- doctor passed
- 确认自动抽象出来的触发条件、适用范围、典型输入输出和验证步骤与本轮交付一致。
- 再次执行当前主验证命令，确认输出与知识草案描述没有偏差。

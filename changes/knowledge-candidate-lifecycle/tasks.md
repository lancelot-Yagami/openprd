# 任务

- [x] T001.01 实现 knowledge candidate 生命周期状态 API
  - type: implementation
  - done: knowledge 模块可以列出、拒绝、归档、恢复候选，并兼容历史 reviewed 状态。
  - verify: npm --prefix openprd test -- --test-name-pattern "knowledge candidate lifecycle"
  - test-layer: unit, integration
  - test-size: medium
  - test-scope: cli-contract
  - evidence-plan: 单元/集成测试覆盖状态读写、index 同步和历史状态兼容。

- [x] T001.02 接入 openprd knowledge CLI
  - type: implementation
  - deps: T001.01
  - done: CLI 支持 candidates/reject/archive/restore，并有可读输出和 JSON 输出。
  - verify: npm --prefix openprd test -- --test-name-pattern "knowledge candidate lifecycle"
  - test-layer: unit, integration
  - test-size: medium
  - test-scope: cli-contract
  - evidence-plan: 测试 CLI/Workspace 函数返回结构和 help 文案。

- [x] T001.03 修改 quality pending 计数
  - type: implementation
  - deps: T001.02
  - done: quality 只把 pending-review 计入待确认 warning，已处理候选保留统计但不阻断。
  - verify: npm --prefix openprd test -- --test-name-pattern "knowledge candidate lifecycle|quality"
  - test-layer: unit, integration
  - test-size: medium
  - test-scope: cli-contract
  - evidence-plan: 测试 candidate 文件仍存在时，rejected/archived/merged 不进入 pending warning。

- [x] T001.04 保持 quality learn promote 路径兼容
  - type: verification
  - deps: T001.03
  - done: quality --learn --from 仍能把来源 candidate 标记为 promoted，且不再出现在 pending 列表。
  - verify: npm --prefix openprd test -- --test-name-pattern "quality learn can digest diagnostic bundles|knowledge candidate lifecycle"
  - test-layer: unit, integration
  - test-size: medium
  - test-scope: module
  - evidence-plan: 回归现有 learn 测试并新增 lifecycle 断言。

- [x] T001.05 更新 CLI 帮助和基础文档影响
  - type: documentation
  - deps: T001.04
  - done: usage 和 docs/basic/backend-structure.md 已同步新增 knowledge CLI 接入面或说明不适用。
  - verify: openprd standards . --verify
  - test-layer: manual
  - test-size: manual
  - test-scope: docs
  - evidence-plan: standards 校验。

- [x] T001.06 运行 OpenPrd 校验与收尾验证
  - type: governance
  - deps: T001.05
  - done: change、dev-check、standards、quality、run 和 doctor 校验通过，最终报告真实剩余风险。
  - verify: openprd change . --validate --change knowledge-candidate-lifecycle
  - test-layer: manual
  - test-size: manual
  - test-scope: governance
  - evidence-plan: change validate、dev-check、standards、quality、run、doctor。

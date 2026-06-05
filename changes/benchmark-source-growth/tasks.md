# 任务

- [x] T001.01 评审生成的 spec 覆盖
  - type: governance
  - done: 生成的 agent-benchmark-source-growth spec 符合用户确认的需求意图
  - verify: openprd change . --validate --change benchmark-source-growth

- [x] T001.02 实现 benchmark source observation 数据结构与规范化去重
  - type: implementation
  - deps: T001.01
  - done: `openprd benchmark observe` 能写入或更新候选信源，并累计 adoptedCount、lastUsedAt 和 evidence
  - verify: npm test -- --test-name-pattern "benchmark source observations"

- [x] T001.03 实现阈值推荐与输出提示
  - type: implementation
  - deps: T001.02
  - done: 达到阈值的候选只推荐 approve，不自动进入 approved registry；benchmark list/grow review 输出可见推荐
  - verify: npm test -- --test-name-pattern "benchmark source observations"

- [x] T001.04 更新 CLI help、docs/basic 和生成的 benchmark/growth 指引
  - type: documentation
  - deps: T001.03
  - done: 相关命令入口、输出契约和自增长规则已同步到帮助与基础文档
  - verify: openprd standards . --verify

- [x] T001.05 回归 benchmark add/list/approve/verify 和 grow review
  - type: verification
  - deps: T001.04
  - done: 现有 benchmark 与 growth 测试保持通过，新观察流程有覆盖
  - verify: npm test -- --test-name-pattern "benchmark|grow|dev-check"

- [x] T001.06 运行 OpenPrd spec 校验
  - type: governance
  - deps: T001.05
  - done: benchmark-source-growth change 通过 OpenPrd 校验
  - verify: openprd change . --validate --change benchmark-source-growth

# 任务

- [x] T001.01 评审生成的 spec 覆盖
  - type: governance
  - done: 生成的 agent-requirements spec 符合 PRD 意图
  - verify: openprd change . --validate --change openprd-generated-change

- [x] T001.02 补齐主进程、窗口与后台接线
  - type: implementation
  - deps: T001.01
  - done: 主进程事件、窗口入口或后台能力的接线已经补齐，不会因为运行时边界遗漏而失效。 涉及: 依赖现有 openprd update、fleet --update-openprd、CLI args/print/main 测试结构。
  - verify: openprd run . --verify

- [x] T001.03 实现新增 CLI command: self-update
  - type: implementation
  - deps: T001.02
  - done: 已完成：新增 CLI command: self-update
  - verify: openprd run . --verify

- [x] T001.04 实现新增 CLI command: upgrade
  - type: implementation
  - deps: T001.03
  - done: 已完成：新增 CLI command: upgrade
  - verify: openprd run . --verify

- [x] T001.05 实现self-update 支持 --dry-run、--json，并默认使用公开 GitHub npm 安装源
  - type: implementation
  - deps: T001.04
  - done: 已完成：self-update 支持 --dry-run、--json，并默认使用公开 GitHub npm 安装源
  - verify: openprd run . --verify

- [x] T001.06 实现upgrade 支持 --dry-run、--json、--fleet，并把工具自更新和项目刷新拆成两个可报告阶段
  - type: implementation
  - deps: T001.05
  - done: 已完成：upgrade 支持 --dry-run、--json、--fleet，并把工具自更新和项目刷新拆成两个可报告阶段
  - verify: openprd run . --verify

- [x] T001.07 实现upgrade 单项目阶段调用更新后的 openprd update <path>
  - type: implementation
  - deps: T001.06
  - done: 已完成：upgrade 单项目阶段调用更新后的 openprd update <path>
  - verify: openprd run . --verify

- [x] T001.08 实现upgrade --fleet 阶段调用更新后的 openprd fleet <root> --update-openprd
  - type: implementation
  - deps: T001.07
  - done: 已完成：upgrade --fleet 阶段调用更新后的 openprd fleet <root> --update-openprd
  - verify: openprd run . --verify

- [x] T001.09 实现新增 print 输出函数，普通输出用用户能理解的步骤摘要，JSON 输出保留机器可读阶段结果
  - type: implementation
  - deps: T001.08
  - done: 已完成：新增 print 输出函数，普通输出用用户能理解的步骤摘要，JSON 输出保留机器可读阶段结果
  - verify: openprd run . --verify

- [x] T001.10 打通主流程闭环：用户运行 openprd self-update --dry-run，看到当前版本、目标来源和将执行的安装命令， 等 4 项
  - type: implementation
  - deps: T001.09
  - done: 主流程关键节点已经打通，用户可以按预期从入口走到结果收尾。涉及: 用户运行 openprd self-update --dry-run，看到当前版本、目标来源和将执行的安装命令，不修改工具或项目 等 4 项。
  - verify: openprd run . --verify

- [x] T001.11 验证用户可以运行 openprd self-update 更新 CLI 自身
  - type: verification
  - deps: T001.10
  - done: 已验证：用户可以运行 openprd self-update 更新 CLI 自身
  - verify: openprd run . --verify

- [x] T001.12 验证用户可以运行 openprd upgrade <project> 完成工具更新加项目刷新
  - type: verification
  - deps: T001.11
  - done: 已验证：用户可以运行 openprd upgrade <project> 完成工具更新加项目刷新
  - verify: openprd run . --verify

- [x] T001.13 验证用户可以对历史项目根目录运行组合升级并走 fleet 刷新已有 .openprd 项目
  - type: verification
  - deps: T001.12
  - done: 已验证：用户可以对历史项目根目录运行组合升级并走 fleet 刷新已有 .openprd 项目
  - verify: openprd run . --verify

- [x] T001.14 验证所有新增高风险写入入口支持 dry-run 或明确预演输出
  - type: verification
  - deps: T001.13
  - done: 已验证：所有新增高风险写入入口支持 dry-run 或明确预演输出
  - verify: openprd run . --verify

- [x] T001.15 验证README、README_CN、CLI help、基础后端文档和测试同步更新
  - type: verification
  - deps: T001.14
  - done: 已验证：README、README_CN、CLI help、基础后端文档和测试同步更新
  - verify: openprd run . --verify

- [x] T001.16 回归非功能约束：命令语义可预测，现有 update 不改含义 / 失败输出必须能定位失败阶段
  - type: verification
  - deps: T001.15
  - done: 非功能约束已经回归确认。涉及: 命令语义可预测，现有 update 不改含义 / 失败输出必须能定位失败阶段。
  - verify: openprd run . --verify

- [x] T001.17 回归非功能约束：dry-run 必须不写入 等 2 项
  - type: verification
  - deps: T001.16
  - done: 非功能约束已经回归确认。涉及: dry-run 必须不写入 等 2 项。
  - verify: openprd run . --verify

- [x] T001.18 回归非功能约束：测试覆盖成功路径、dry-run、失败分支和现有 update 回归
  - type: verification
  - deps: T001.17
  - done: 非功能约束已经回归确认。涉及: 测试覆盖成功路径、dry-run、失败分支和现有 update 回归。
  - verify: openprd run . --verify

- [x] T001.19 回归边界条件与失败处理：边界情况：当前运行环境是本地源码开发模式时，不自动覆盖源码，提示使用 npm install -g 或本地开发流 等 8 项
  - type: verification
  - deps: T001.18
  - done: 边界条件与失败处理已经回归确认。涉及: 边界情况：当前运行环境是本地源码开发模式时，不自动覆盖源码，提示使用 npm install -g 或本地开发流程 等 8 项。
  - verify: openprd run . --verify

- [ ] T001.20 维护 docs/basic 项目基础文档
  - type: documentation
  - deps: T001.19
  - done: 已检查 docs/basic 是否缺失或因本次需求、流程、结构、依赖、产品行为变化而过期；若涉及后端、脚本、Agent 或工具链变更，已同步评估 CLI 与 API 接入面，并在 backend-structure.md 中记录事实或不适用原因；需要更新的基础文档已同步
  - verify: openprd standards . --verify

- [ ] T001.21 更新文件说明书和文件夹 README
  - type: documentation
  - deps: T001.20
  - done: 本次变更涉及的文件说明书和文件夹 README 已检查；缺失的已补齐，过期的已更新
  - verify: openprd standards . --verify

- [ ] T001.22 运行 OpenPrd spec 校验
  - type: governance
  - deps: T001.21
  - done: 生成的 change 通过 OpenPrd 校验
  - verify: openprd change . --validate --change openprd-generated-change

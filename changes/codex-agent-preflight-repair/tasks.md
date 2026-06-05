# 任务

- [x] T001.01 评审生成的 spec 覆盖
  - type: governance
  - done: 生成的 agent-requirements spec 符合 PRD 意图
  - verify: openprd change . --validate --change codex-agent-preflight-repair

- [x] T001.02 实现新增 Codex 命令健康检查辅助模块，运行版本检查并返回结构化健康结果
  - type: implementation
  - deps: T001.01
  - done: 已完成：新增 Codex 命令健康检查辅助模块，运行版本检查并返回结构化健康结果
  - verify: openprd run . --verify

- [x] T001.03 实现Codex 代理循环在真实执行前调用健康检查；失败时不继续启动子会话
  - type: implementation
  - deps: T001.02
  - done: 已完成：Codex 代理循环在真实执行前调用健康检查；失败时不继续启动子会话
  - verify: openprd run . --verify

- [x] T001.04 实现识别平台原生组件缺失，输出诊断、缺失组件名和修复命令
  - type: implementation
  - deps: T001.03
  - done: 已完成：识别平台原生组件缺失，输出诊断、缺失组件名和修复命令
  - verify: openprd run . --verify

- [x] T001.05 实现医生命令在用户显式请求修复时运行全局安装，并在安装后再次验证
  - type: implementation
  - deps: T001.04
  - done: 已完成：医生命令在用户显式请求修复时运行全局安装，并在安装后再次验证
  - verify: openprd run . --verify

- [x] T001.06 实现循环命令的修复入口对 Codex 代理复用同一显式修复逻辑
  - type: implementation
  - deps: T001.05
  - done: 已完成：循环命令的修复入口对 Codex 代理复用同一显式修复逻辑
  - verify: openprd run . --verify

- [x] T001.07 打通主流程闭环：用户运行 Codex 代理循环；OpenPrd 先执行版本检查；成功后继续生成提示词并启动子会话 等 3 项
  - type: implementation
  - deps: T001.06
  - done: 主流程关键节点已经打通，用户可以按预期从入口走到结果收尾。涉及: 用户运行 Codex 代理循环；OpenPrd 先执行版本检查；成功后继续生成提示词并启动子会话 等 3 项。
  - verify: openprd run . --verify

- [x] T001.08 验证新增检查覆盖版本检查成功、组件缺失、修复成功和修复失败分支
  - type: verification
  - deps: T001.07
  - done: 已验证：新增检查覆盖版本检查成功、组件缺失、修复成功和修复失败分支
  - verify: openprd run . --verify

- [x] T001.09 验证普通输出不再只显示底层运行时错误
  - type: verification
  - deps: T001.08
  - done: 已验证：普通输出不再只显示底层运行时错误
  - verify: openprd run . --verify

- [x] T001.10 验证默认路径不会静默执行全局安装
  - type: verification
  - deps: T001.09
  - done: 已验证：默认路径不会静默执行全局安装
  - verify: openprd run . --verify

- [x] T001.11 回归非功能约束：默认不修改用户全局命令 / 子进程执行可测试、可注入或可模拟，不让测试真实联网安装
  - type: verification
  - deps: T001.10
  - done: 非功能约束已经回归确认。涉及: 默认不修改用户全局命令 / 子进程执行可测试、可注入或可模拟，不让测试真实联网安装。
  - verify: openprd run . --verify

- [x] T001.12 回归非功能约束：普通输出面向用户，机器输出保留诊断、命令、输出、错误和退出码 / 现有预演和非 Codex 代理行为保持兼容
  - type: verification
  - deps: T001.11
  - done: 非功能约束已经回归确认。涉及: 普通输出面向用户，机器输出保留诊断、命令、输出、错误和退出码 / 现有预演和非 Codex 代理行为保持兼容。
  - verify: openprd run . --verify

- [x] T001.13 回归边界条件与失败处理：边界情况：Codex 命令不存在 / 边界情况：版本检查返回其他错误 等 7 项
  - type: verification
  - deps: T001.12
  - done: 边界条件与失败处理已经回归确认。涉及: 边界情况：Codex 命令不存在 / 边界情况：版本检查返回其他错误 等 7 项。
  - verify: openprd run . --verify

- [x] T001.14 验证成本与额度护栏
  - type: verification
  - deps: T001.13
  - done: 已验证免费、试用或低权限用户不能绕过额度、并发、频率或总量限制
  - verify: openprd run . --verify

- [x] T001.15 验证滥用与越权路径
  - type: verification
  - deps: T001.14
  - done: 已覆盖重复请求、并发请求、越权身份和异常恢复等负向场景
  - verify: openprd run . --verify

- [x] T001.16 验证成本监控、报警和止损
  - type: verification
  - deps: T001.15
  - done: 已确认用量或成本信号、报警阈值和人工/自动止损动作可执行
  - verify: openprd run . --verify

- [x] T001.17 维护 docs/basic 项目基础文档
  - type: documentation
  - deps: T001.16
  - done: 已检查 docs/basic 是否缺失或因本次需求、流程、结构、依赖、产品行为变化而过期；若涉及后端、脚本、Agent 或工具链变更，已同步评估 CLI 与 API 接入面，并在 backend-structure.md 中记录事实或不适用原因；需要更新的基础文档已同步
  - verify: openprd standards . --verify

- [x] T001.18 更新文件说明书和文件夹 README
  - type: documentation
  - deps: T001.17
  - done: 本次变更涉及的文件说明书和文件夹 README 已检查；缺失的已补齐，过期的已更新
  - verify: openprd standards . --verify

- [x] T001.19 运行 OpenPrd spec 校验
  - type: governance
  - deps: T001.18
  - done: 生成的 change 通过 OpenPrd 校验
  - verify: openprd change . --validate --change codex-agent-preflight-repair

# 设计

## 背景

项目已经具备公开仓库安装、项目刷新和历史项目批量刷新能力，现在需要把它们整理成清晰、可预演、可组合的更新体验。

## 目标

- 提供清晰的 self-update 命令，让用户更新 OpenPrd CLI 自身。
- 提供组合升级命令，让更新后的 CLI 立即刷新单个项目或历史项目集群。
- 保持 openprd update 现有语义稳定，避免破坏老脚本。

## 范围

- 新增 openprd self-update 命令。
- 新增 openprd upgrade 命令，默认面向单项目。
- 为 upgrade 增加批量历史项目刷新模式，复用 fleet --update-openprd。
- 支持 dry-run、json 输出和错误分步报告。
- 保留 openprd update 的项目刷新语义。
- 补充 CLI 参数解析、打印输出、单测、README_CN/README 和 docs/basic/backend-structure.md。

## 约束

- 项目是 Node.js ESM CLI，命令分发位于 openprd/src/openprd.js，参数解析位于 openprd/src/cli/args.js。
- 需要使用 child_process 执行 npm/openprd 子命令，并保留 stdout/stderr/exit code。
- upgrade 自更新后必须重新解析外部 openprd 可执行文件，避免旧进程代码继续执行项目刷新。
- 测试不能真实联网或全局安装，需要通过依赖注入或可替换 runner 模拟。
- 不得输出或要求任何私有 token。
- 不得静默修改用户仓库源码或执行 git pull。
- 高风险写入命令需要 dry-run 和明确输出。
- 依赖现有 openprd update、fleet --update-openprd、CLI args/print/main 测试结构。
- 依赖 npm 能从 git+https://github.com/mileson/openprd.git 安装公开仓库版本。
- 依赖 Node.js >=20.19.0 环境。

## 业务护栏

- 待补充

## 风险与开放问题

- 假设: 第一版默认以 npm 全局安装为主要自更新路径。
- 假设: 用户愿意保留 update 的旧语义，并接受新增 upgrade 承接组合语义。
- 假设: 本地开发 checkout 中运行 self-update 时，提示手动开发流程比自动覆盖源码更安全。
- 风险: 真实全局 npm 安装可能受权限、网络或 PATH 影响。
- 风险: 自更新后 PATH 仍指向旧 openprd 可执行文件，导致项目刷新没有使用新版本。
- 风险: 命令命名如果不清晰，会继续造成 update/self-update/upgrade 心智混淆。
- 风险: 测试如果真实触发安装会污染开发机环境。
- 问题: 是否后续支持 --source npm|github|local|custom。
- 问题: 是否需要独立的 --no-self-update 或 --only-project-refresh 快捷参数。
- 问题: 是否需要为 package manager 选择增加可成长配置。

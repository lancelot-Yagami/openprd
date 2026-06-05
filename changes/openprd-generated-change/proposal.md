# 工具自更新与项目升级编排

## 背景与原因

当前项目刷新命令只处理项目内生成物，用户还需要手动更新工具自身；本次要新增独立的工具自更新入口和组合升级入口，让工具更新后能够继续刷新单个旧项目或历史项目集群。

## 变更内容

- 新增 openprd self-update 命令。
- 新增 openprd upgrade 命令，默认面向单项目。
- 为 upgrade 增加批量历史项目刷新模式，复用 fleet --update-openprd。
- 支持 dry-run、json 输出和错误分步报告。
- 保留 openprd update 的项目刷新语义。
- 补充 CLI 参数解析、打印输出、单测、README_CN/README 和 docs/basic/backend-structure.md。
- 新增 CLI command: self-update。
- 新增 CLI command: upgrade。
- self-update 支持 --dry-run、--json，并默认使用公开 GitHub npm 安装源。
- upgrade 支持 --dry-run、--json、--fleet，并把工具自更新和项目刷新拆成两个可报告阶段。
- upgrade 单项目阶段调用更新后的 openprd update <path>。
- upgrade --fleet 阶段调用更新后的 openprd fleet <root> --update-openprd。
- 新增 print 输出函数，普通输出用用户能理解的步骤摘要，JSON 输出保留机器可读阶段结果。
- 用户可以运行 openprd self-update 更新 CLI 自身。
- 用户可以运行 openprd upgrade <project> 完成工具更新加项目刷新。
- 用户可以对历史项目根目录运行组合升级并走 fleet 刷新已有 .openprd 项目。
- 所有新增高风险写入入口支持 dry-run 或明确预演输出。
- README、README_CN、CLI help、基础后端文档和测试同步更新。

## 能力范围

- `agent-requirements`: 工具自更新与项目升级编排 需求。

## 影响范围

- 主要用户: 希望像更新软件一样更新 OpenPrd CLI 的终端用户。
- 主要用户: 维护多个历史 OpenPrd 工作区的项目维护者和 Agent。
- 依赖: 依赖现有 openprd update、fleet --update-openprd、CLI args/print/main 测试结构。
- 依赖: 依赖 npm 能从 git+https://github.com/mileson/openprd.git 安装公开仓库版本。
- 依赖: 依赖 Node.js >=20.19.0 环境。
- 风险: 真实全局 npm 安装可能受权限、网络或 PATH 影响。
- 风险: 自更新后 PATH 仍指向旧 openprd 可执行文件，导致项目刷新没有使用新版本。
- 风险: 命令命名如果不清晰，会继续造成 update/self-update/upgrade 心智混淆。
- 风险: 测试如果真实触发安装会污染开发机环境。

# OpenPrd 会话线与需求线隔离

## 背景与原因

OpenPrd 在多项目并行、多对话并行和历史会话恢复场景下，仍然会复用当前项目的 active requirement、active change、旧 review artifact 或旧 PRD 内容，导致不同对话、不同需求任务之间发生串线和上下文污染。

## 变更内容

- 新增全局 session registry 的状态模型、读写和解析逻辑。
- 修改 run-harness 的历史会话恢复顺序与 workspace 选择逻辑。
- 修改 session-binding 的职责边界，让它只承担 repo-local 镜像与回显。
- 扩展 fleet、doctor 或等价检查，对过宽 root、父子嵌套 workspace、缺失 session 归属索引给出卫生提示。
- 调整执行策略判定，让跨项目或跨需求的并行执行默认使用隔离会话或 worktree。
- 补充 docs/basic、command catalog、skills / generated guidance 与测试。
- 提供全局 session registry，支持 upsert、lookup、候选 workspace 解析与调试输出。
- run-harness 在 session continuation 时必须先解析 session 对应 workspace，再解析 lane target。
- session binding 写入时同步更新全局 session registry，并保留 repo-local session mirror。
- requirement lane、review artifact、change/tasks 和 execution lane 要能明确区分本轮需求与历史 active change。
- 执行策略要能根据 workspace / lane 边界决定 serial、parallel-workers 或 parallel-workers-isolated，并把隔离原因显式输出。
- 新增 registry hygiene 检查，识别过宽 workspace root、父子嵌套和缺失索引。
- 新增全局 session registry，记录 sessionId 与 workspaceRoot、lane、change、task、workUnit 等映射。
- run-harness 恢复历史会话时改为先全局解析 workspace，再读取 repo-local binding。
- repo-local session binding 降级为项目内镜像缓存，不再作为全局唯一真相。
- 默认并行隔离策略前移：跨项目、跨需求或跨分支执行时直接使用隔离 session / cwd / worktree。
- 新增回归测试覆盖 session 恢复、requirement lane 隔离、registry 卫生检查和默认隔离执行判定。

## 能力范围

- `agent-requirements`: OpenPrd 会话线与需求线隔离 需求。

## 影响范围

- 主要用户: 在多个项目中同时使用 OpenPrd 的开发者
- 主要用户: 需要恢复历史会话、继续旧任务、同时推进多个需求的 Agent 使用者
- 主要用户: 维护 OpenPrd workflow、hook、run-harness 和 loop 的 OpenPrd maintainer
- 成本来源: E2E、真实浏览器、小程序、visual-compare、性能或极端数据测试会增加本地执行时间和排队成本。
- 成本来源: 默认新增能力不引入第三方服务调用或联网依赖；只有项目已有测试命令要求时才使用对应工具。
- 额度限制: 第一版测试策略以 advisory 和证据提示为主，不把固定比例作为硬性阻断。
- 额度限制: 大型或慢速测试必须有风险理由、执行范围和替代证据说明。
- 额度限制: 缺少本次执行证据时不能宣称已验证。
- 依赖: 依赖现有 ~/.openprd/registry/workspaces.jsonl、.openprd/harness/session-bindings、agent-sessions.jsonl 和 run-harness lane 逻辑。
- 依赖: 依赖 Git worktree 作为跨分支隔离的官方能力。
- 风险: 如果全局 registry 设计不清，可能把错误归属写成新的长期真相。
- 风险: 如果默认隔离策略过强，可能让简单同项目任务的执行体验变重。
- 风险: 如果回退策略太宽松，又会继续保留旧的串线风险。

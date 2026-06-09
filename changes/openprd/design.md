# 设计

## 背景

用户已经多次在真实使用中遇到串线问题，当前连 requirement intake 都会继续读出历史 test-strategy-router 内容。若不先把会话线、需求线和执行线彻底解耦，后续 OpenPrd 的恢复、并行执行和质量门禁都会继续建立在被污染的状态上。

## 目标

- 让每个对话、每次需求、每个任务都成为独立的一条线，不再共用旧 active 内容。
- 恢复历史会话时先精确定位真实 workspace，再进入该 workspace 内解析 change、task 和 work unit。
- 把会话归属、需求线状态和执行隔离从约定变成硬约束。
- 让并行执行默认使用 fresh session、fresh cwd，跨分支并行默认使用 git worktree。

## 范围

- 新增全局 session registry 的状态模型、读写和解析逻辑。
- 修改 run-harness 的历史会话恢复顺序与 workspace 选择逻辑。
- 修改 session-binding 的职责边界，让它只承担 repo-local 镜像与回显。
- 扩展 fleet、doctor 或等价检查，对过宽 root、父子嵌套 workspace、缺失 session 归属索引给出卫生提示。
- 调整执行策略判定，让跨项目或跨需求的并行执行默认使用隔离会话或 worktree。
- 补充 docs/basic、command catalog、skills / generated guidance 与测试。

## 约束

- 当前 OpenPrd 已有全局 workspace registry、repo-local session binding、run-harness lane 解析和 loop session 记录，需要在现有状态模型上扩展，而不是另起一套平行体系。
- 生成物、hooks、skills 与 docs/basic 需要同步更新，保持 CLI 与 agent guidance 一致。
- 不得把外部方法论中的比例当成未经项目确认的硬性合规要求。
- 不得让测试证据包含密钥、令牌、个人信息或完整敏感日志。
- 涉及微信小程序验证时仍必须使用 weapp-dev-mcp，不能仅靠普通端到端文字声明。
- 依赖现有 ~/.openprd/registry/workspaces.jsonl、.openprd/harness/session-bindings、agent-sessions.jsonl 和 run-harness lane 逻辑。
- 依赖 Git worktree 作为跨分支隔离的官方能力。

## 业务护栏

- 成本来源: E2E、真实浏览器、小程序、visual-compare、性能或极端数据测试会增加本地执行时间和排队成本。
- 成本来源: 默认新增能力不引入第三方服务调用或联网依赖；只有项目已有测试命令要求时才使用对应工具。
- 额度限制: 第一版测试策略以 advisory 和证据提示为主，不把固定比例作为硬性阻断。
- 额度限制: 大型或慢速测试必须有风险理由、执行范围和替代证据说明。
- 额度限制: 缺少本次执行证据时不能宣称已验证。
- 滥用防护: 不允许用旧日志、空测试、脚本存在或截图存在冒充本次测试证据。
- 滥用防护: 不允许把 70/20/10 当成硬指标诱导无意义单测或过度 E2E。
- 滥用防护: 测试豁免必须记录原因和风险。
- 监控信号: quality JSON/HTML 报告展示各测试层级的能力、执行证据、缺口和豁免理由。
- 监控信号: loop test report 记录任务级 test-layer、test-size、test-scope、verify command 和 evidence。
- 监控信号: run --verify 汇总 quality 的 productionReady 与测试证据缺口。
- 报警阈值: 必测层级缺少本次执行证据时显示 needs-evidence。
- 报警阈值: 任务触碰权限、成本、安全、用户主路径、发布或外部依赖却未升级验证时显示需关注。
- 报警阈值: 检测到大量 E2E 但缺少单测或集成/契约测试时提示倒金字塔风险。
- 止损动作: 发现证据不足时要求补测、补证据或记录明确豁免原因。
- 止损动作: 慢测试或 flaky 测试不能反复重跑掩盖，需要记录风险并建议拆出更稳定的中间层验证。
- 止损动作: 涉及小程序运行态时回到 weapp-dev-mcp 实测，不允许普通文字替代。

## 风险与开放问题

- 假设: 同一 session 在绝大多数时间只属于一个 workspace。
- 假设: 历史旧会话允许存在缺失索引，但新会话从本次改造起应稳定写入全局 registry。
- 假设: 当前多项目污染主要来自 workspace 归属不清、lane 复用和隔离触发过晚。
- 风险: 如果全局 registry 设计不清，可能把错误归属写成新的长期真相。
- 风险: 如果默认隔离策略过强，可能让简单同项目任务的执行体验变重。
- 风险: 如果回退策略太宽松，又会继续保留旧的串线风险。
- 问题: 第一版 session registry 是否只记录最新真相，还是保留 event log + current snapshot 双层结构。
- 问题: 当一个 session 同时关联 requirement lane 与 execution lane 时，CLI 默认展示哪个焦点对象更合适。
- 问题: registry hygiene 是放进 doctor、fleet、run --verify，还是三者都做。

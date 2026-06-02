# PRD Template Lenses

## 共同骨架

所有 L2 PRD 都先回答这些问题：

1. 为什么做：背景、问题、证据、为什么现在
2. 给谁做：用户、角色、相关方
3. 做到什么程度：目标、成功指标、验收标准
4. 做什么和不做什么：范围、非目标、边界情况
5. 用户怎么走：主流程、失败路径、恢复路径
6. 需求怎么验收：需求矩阵、优先级、验收标准、测试/验证
7. 有什么风险：依赖、约束、成本、滥用、开放问题
8. 如何交接：review、change、tasks、负责人、下一步

`base/prd.md` 提供这个骨架。其他模板不是附录，而是 lens：它们改变正文组织、需求矩阵和验收重点。

## Base

用于无法明确归类、或通用工程/产品需求。

推荐章节：

- 决策摘要
- 背景与问题
- 用户与相关方
- 目标与成功标准
- 范围与非目标
- 场景与流程
- 需求矩阵
- 业务护栏
- 约束、依赖、风险、开放问题
- 交接与下一步

## Consumer

用于个人用户、C 端体验、内容、增长、留存或情绪价值明显的需求。

把以下问题融入正文：

- 用户画像和用户分层
- 用户旅程和关键触点
- 第一个成功时刻
- 激活指标和留存指标
- 情绪价值或生活方式价值
- 触达、转化、留存或增长实验

需求矩阵建议增加：

- Journey Step
- User Motivation
- Aha Moment
- Activation / Retention Signal
- UX Risk

## B2B

用于企业、团队、后台、SaaS、组织流程、管理/审批/权限相关需求。

把以下问题融入正文：

- 买方、使用者、管理员、运营者
- 现状流程和目标流程
- 角色权限矩阵
- 审批、审计、日志和追责
- 集成依赖、上线迁移、培训和支持
- SLA、数据边界、合规和安全

需求矩阵建议增加：

- Role
- Permission / Approval
- Audit Evidence
- Admin / Operator Impact
- Integration Dependency

## Agent

用于 AI Agent、harness、skill、自动化、代码代理、人机协作或评估体系。

把以下问题融入正文：

- Human-Agent contract
- 自主边界和人工确认点
- 工具边界和高风险动作
- 状态模型、记忆和跨会话续接
- 失败恢复和人工接管
- 评估计划和回归证据
- 成本、额度、滥用和停止条件

需求矩阵建议增加：

- Autonomy Level
- Human Decision Point
- Tool Boundary
- State / Memory
- Fallback Path
- Evaluation Signal

## 写作规则

- 不输出大段空字段或 TBD 墙；缺事实时进入开放问题。
- 不把类型专项字段堆在末尾；把它们融进用户、流程、需求矩阵、验收和风险。
- PRD 写产品判断，`design.md` 写技术方案，`tasks.md` 写执行步骤。
- 每条 requirement 都应能追踪到验收标准和后续 task。

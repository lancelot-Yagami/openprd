# 角色

## 用户

- 主要用户:
- 第一次用 OpenPrd 梳理产品想法的产品经理、独立开发者与 Vibe Coding 用户
- 需要在模糊需求下帮助用户收敛方向并继续落地的 Agent 协作者

- 次要用户:
- 待补充

- 相关方:
- 维护 OpenPrd requirement-intake、workflow 和模板的开发者
- 后续需要基于已确认上下文继续实现的多轮 Agent 会话

## 类型专项

- humanAgentContract: Agent 先归纳用户群体、产品形态、第一版切片、边界与风险，再请求用户确认；如果信息不足，只能提出候选方向，不能把猜测当成定论。
- autonomyBoundary: Agent 可以根据当前需求和已有工作区状态推断首轮项目画像，但在用户确认前不得把推断直接写成最终需求事实或越过需求入口去改实现。
- toolBoundary: 仅使用本地 OpenPrd workflow、模板、测试和文档完成这次改动，不依赖新的外部运行时。
- stateModel: 新需求进入时先形成 project framing，再进入 requirement clarification、review/change/tasks 与实现。
- evalPlan: 通过 workspace flow、requirement gate、CLI 输出和模板相关测试验证新流程，同时运行 dev-check、standards、quality 与 run verify。

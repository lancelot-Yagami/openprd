---
name: openprd-requirement-intake
description: OpenPrd 需求入口与 PRD 分流 skill。用于用户提出产品需求、功能变更、bugfix、流程调整、跨对话续做、OpenPrd/PRD 生成、review/change/tasks 前置判断时，先按语义判断用户可见需求类型和内部 L0/L1/L2 路由码，并选择 base、consumer、b2b 或 agent PRD 模板 lens。
---

# OpenPrd Requirement Intake

## 作用

这份 skill 只做需求入口分流，不负责实现代码。

- 判断当前用户输入的用户可见需求类型和内部 L0/L1/L2 路由码
- 决定下一步是直接澄清、mini-plan，还是正式 PRD
- 为 L2 选择 `base`、`consumer`、`b2b` 或 `agent` PRD lens
- 把用户当前需求和历史 active change 分开，避免“继续任务”吞掉新范围
- 给 `$openprd-harness` 输出下一步行动合同

## 分流原则

不要按关键词判断。按影响面、未知数、决策成本和验证成本判断。

| 用户可见需求类型 | 内部路由码 | 判断含义 | 默认处理方式 |
|---|---|---|---|
| 快速修正 | L0 | 单点、低风险、可逆、验收清楚 | 可以直接处理并事后说明 |
| 现有功能优化 | L1 | 目标明确，但影响多个文件、状态或用户可见行为 | 先给对话内 mini-plan，再执行 |
| 新功能/新流程方案 | L2 | 新产品、模块、入口、流程、权限、计费、账号、AI/第三方、云服务、数据迁移、跨系统、长期工作流，或目标/验收/影响面不清 | 先走 PRD/review/change/tasks |

用户审查时优先显示“需求类型”，不要把内部调度码当成标题。需要审查或调试时，可以在同一段里附上“内部路由码：L1”，并保留上面的对照关系。

界面、页面、视觉、样式或前端体验需求需要额外判断 UI 影响面。若会明显改变信息架构、核心布局、主视觉、关键路径、组件层级/密度，或用户需要先选择设计方向，即使属于“现有功能优化”，也要先走“大界面改动视觉方案评审”：Computer Use 截取当前产品内功能截图，Image 2 基于截图生成至少 3 个方向，横向拼接带 1/2/3 序号的大图给用户确认。

如果同一句话同时包含“继续旧任务”和“新增范围”，先判断新增范围是否超出旧 PRD。超出时必须回到需求入口，更新 PRD/change/tasks，不能把“继续”当作实现授权。

## 工作流

1. 读取 `.openprd/` 状态和 `openprd run . --context`，但把它当作建议。
2. 用 `references/routing-rubric.md` 判断 L0/L1/L2。
3. 如果是 L2，读取 `references/prd-template-lenses.md` 选择 PRD lens。
4. 输出一个短的需求类型判断：
   - 需求类型：快速修正 / 现有功能优化 / 新功能/新流程方案
   - 内部路由码：L0 / L1 / L2
   - 理由：影响面、未知数、风险、验证成本
   - 当前需求是否覆盖历史 active change
   - 推荐下一步
   - L2 时的 PRD lens：base / consumer / b2b / agent
5. 把执行交回 `$openprd-harness`。

## 输出合同

### L0

- 直接处理或问 1 个必要问题。
- 不生成 PRD。
- 完成后说明变更和验证。

### L1

- 给 3-5 行 mini-plan。
- 明确范围内、范围外和验证方式。
- 若是大界面改动，mini-plan 之后先做 3 方向效果图评审，用户确认方向后再实现。
- 用户已明确要求执行时可继续实现。
- 不生成正式 PRD，除非 mini-plan 暴露出新的决策缺口。

### L2

- 先运行或建议 `openprd clarify .`。
- 先建立首轮项目画像：用户群体、产品形态、第一版切片、暂不处理、不能破坏和风险探针。
- 再用对话内摘要确认目标、用户/角色、范围、非目标、验收、开放问题。
- 使用 `openprd capture . --field ...` 写回确认事实。
- 选择并记录产品类型：`openprd classify . <consumer|b2b|agent>`；无法判断时保持 `base`。
- 再进入 `openprd synthesize .`、review artifact、change 和 tasks。

## PRD Lens

- `base`：通用产品或工程需求，强调问题、目标、首轮项目画像、范围、流程、需求矩阵、验收和风险。
- `consumer`：面向个人用户或 C 端体验，强调用户旅程、首次成功、激活、留存、情绪价值和增长指标。
- `b2b`：面向企业、团队、后台、SaaS 或组织流程，强调买方/使用者/管理员/运营者、权限矩阵、审批审计、集成依赖、SLA 和上线支持。
- `agent`：面向 AI Agent、harness、skill、自动化或人机协作工作流，强调 Human-Agent contract、自主边界、工具边界、状态模型、失败恢复和评估计划。

模板 lens 应融入正文结构，不要作为 PRD 末尾的字段附录。比如 B2B 的角色、权限和审批应该贯穿用户、流程、需求矩阵和验收标准；Agent 的自主边界应该贯穿范围、风险、任务和验证。

## 何时读取参考

- 分流有争议、用户输入很长、或涉及“继续旧任务 + 新范围”时，读 `references/routing-rubric.md`。
- 需要写 PRD、选择产品类型、或用户反馈 PRD 结构奇怪时，读 `references/prd-template-lenses.md`。

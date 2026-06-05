<!-- OPENPRD:AGENTS:START -->
## OpenPrd Harness

本项目由 OpenPrd 管理。Agent 应优先遵循 repo-local skills 和 hooks；`AGENTS.md` 只保留轻量入口合同。

### Scope

- skill 路由放在 `openprd-router`，命令清单放在 command catalog，强约束放在 hooks。
- `AGENTS.md` 只说明入口、默认行为和高风险门禁，不再承载静态长清单。

### Entry Points

- 先读 `skills/openprd-router/SKILL.md`；在生成的 Codex / Claude 环境里，优先读同名 `openprd-router` skill。
- 需要具体命令时，优先读 `.openprd/harness/command-catalog.md`，不要继续把命令清单膨胀回 `AGENTS.md`。
- `$openprd-shared`：共用语言、文档影响、敏感信息、浏览器安全、小程序验证、产品文案与 i18n 规则。
- `$openprd-requirement-intake`：需求入口分流、用户可见需求类型与内部 L0/L1/L2 路由码对照、PRD lens 选择。
- `$openprd-test-strategy`：测试策略分流、分层验证、任务级 evidence-plan、升级原因与豁免理由。
- `$openprd-harness`：主工作流、`run/loop`、review/change/tasks 与执行节奏。
- `$openprd-benchmark-router`：外部技术、公开 GitHub 仓库、benchmark/对标/最佳实践路由。
- `$openprd-standards` / `$openprd-quality`：`docs/basic/`、就绪验证、EVO 门禁、知识沉淀。
- `$openprd-diagram-review` / `$openprd-discovery-loop`：可视评审与长时间只读挖掘。

### 默认行为

1. 动手前先从 `.openprd/` 重建状态，并先运行 `openprd run . --context`；它是建议上下文，不是自动执行指令。
2. 规划、分析、架构评审、“怎么改”或“会动哪些文件”类请求保持只读；只有用户明确要求实现、继续任务、深度调研、对标复刻或提交时才进入执行。
3. 先分流再执行：`openprd-requirement-intake` 按影响面、未知数、决策成本和验证成本判断需求类型，并保留内部路由码对照：快速修正=L0，现有功能优化=L1，新功能/新流程方案=L2。用户审查默认显示“需求类型”，内部排障可附“内部路由码”。快速修正可直接处理并事后说明，现有功能优化先在对话内给 mini-plan 再执行；如果用户刚刚已经确认了 L1 mini-plan、范围边界或正式产品边界，后续承接要写成“已确认，我按这个继续”，不要用“确认，我们就按这个……”这类像再次索取确认的句子。新功能/新流程方案先走 requirement intake，再 `review/change/tasks`，最后才实现。`review.html` 是稳定评审 artifact，不再默认等于唯一的人类停顿点；默认按 decision-points approval policy 执行，只有当前 lane 仍要求人类决策时才在 final answer 主体里停下请求确认；当 review 已确认且 tasks 已就绪但还需要执行授权时，先给执行确认清单再请用户确认。
4. change/tasks 就绪后，用 `openprd-test-strategy` 按风险选择单元、集成、端到端、人工、视觉、小程序、性能或安全验证组合，并在任务或报告中保留 evidence-plan；同时根据任务边界记录 execution strategy：小范围修正保持 `serial`，中等规模 L1/L2 可推荐 `parallel-workers`，高风险或大规模实现再升级到 `parallel-workers-isolated`；70/20/10 只作健康形状参考，不作硬门禁。
5. 纯图片、封面图、配图、海报、插画、图标、贴纸、mockup 或“先看样子”请求默认直接使用 Codex 原生 Image 2；其中 logo、icon、avatar、badge 等开发素材在用户未明确要求场景化展示时，默认按独立素材输出（standalone asset）生成：全画布单主体，不额外添加卡片、设备框或其他展示容器；进入实现阶段时，已有参考图用 `openprd visual-compare --reference/--actual`，无参考图但改动界面用 `openprd visual-compare --before/--after`。
6. 用户给出会话 ID 并要求继续时，按工具无关的历史会话续接；不要要求工具专属 ID，也不要用当前 active change 或相似历史替代指定会话。
7. 单个 task 收尾时只运行本任务最小足够验证，并通过 `--evidence`、测试报告或任务 metadata 留下 task-scoped evidence；代码修改完成后、最终回复前，针对本轮实际 touched code files 运行 `openprd dev-check . <file...>`。阶段收口、全部实现完成、handoff/commit/release/publish 前，再运行 `openprd standards . --verify`、`openprd quality . --verify` 和 `openprd run . --verify`。
8. 微信小程序相关任务默认按“最小足够验证”执行：只有用户明确要求小程序实测、截图、抓日志/网络、复现问题，或当前改动必须依赖运行态证据时，才升级到本地小程序运行态验证；默认沿用当前小程序运行态或开发者工具会话连续验证，不要为了验证自动重开应用；只有用户明确要求从 0 到 1、冷启动或重开时，才从头启动。如果当前客户端没有相应工具，不要假定已经安装，也不要把缺少工具当成阻断。
9. `openprd init/setup/update/doctor` 记录的 `optionalCapabilities` 是非阻断式增强建议。当前任务明显受益但能力还未配置时，可在后续建议里说明它能帮什么、附官方文档 / GitHub 链接，并询问用户是否需要按当前客户端补配置；不要因为它未配置就阻断当前任务。

### Hook-Enforced Gates

- requirement：需求未完成 `clarify/review/change/tasks` 前阻断实现写入；tasks 就绪后，只有用户原始意图已明确要求实现，或后续在看过执行确认清单后明确发出执行指令时才放行。
- research：公开 GitHub 架构/对标先 DeepWiki；第三方技术用法、配置、限制、版本差异或迁移先查本地证据，不足时再按 `resolve_library_id -> query_docs` 使用 Context7。
- skill-visualization：修改 skill、`SKILL.md`、`AGENTS.md` 或相关 workflow 前，先输出彩色 Mermaid 方案并等待用户确认。
- secrets / weapp / browser / copy：分别处理 `secrets-vault`、按需的小程序运行态验证、窗口归属与 i18n/普通用户文案提醒。
- 需要细节时，读 router 指向的 skill 和 command catalog，而不是继续扩写 `AGENTS.md`。

### High-Risk Gate

Before freeze, handoff, accepted spec apply/archive, commit, push, release, or publish, ensure `openprd standards . --verify`, `openprd quality . --verify`, `openprd run . --verify`, and `openprd doctor .` are healthy.
If the quality report says `productionReady=false`, do not claim overall readiness. Reuse `openprd run . --verify` to separate current-task status from workspace-level debt, list the missing evidence or gates, and when only `feature-coverage` is pending describe it as task-ledger or evidence debt rather than a failed implementation.
The only baseline documentation path is `docs/basic/`.
<!-- OPENPRD:AGENTS:END -->
